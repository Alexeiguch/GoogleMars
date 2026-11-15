import "./solarView.css";
import { locale, t } from "./i18n";
import { SOLAR_DATE_MAX, SOLAR_DATE_MIN, subsolarPoint, type SolarBody } from "./solarIllumination";

const MINUTE = 60_000;
const DAY = 1440 * MINUTE;
const FIRST = Date.parse(SOLAR_DATE_MIN);
const LAST = Date.parse(SOLAR_DATE_MAX) + DAY - MINUTE;
const PLAY_DURATION = 18_000;
const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const nowInMinutes = () => Math.min(LAST, Math.max(FIRST, Math.floor(Date.now() / MINUTE) * MINUTE));

export type SolarPoints = Record<SolarBody, ReturnType<typeof subsolarPoint>>;

export function mountSolarView(draw: (points: SolarPoints) => void) {
  const date = byId<HTMLInputElement>("solar-date");
  const time = byId<HTMLInputElement>("solar-time");
  const status = byId("solar-date-status");
  const now = byId<HTMLButtonElement>("solar-now");
  const slider = byId<HTMLInputElement>("solar-timeline");
  const play = byId<HTMLButtonElement>("solar-play");
  const playLabel = byId("solar-play-label");
  const ticks = byId("solar-ticks");
  const range = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-solar-days]"));
  const moon = byId<HTMLOutputElement>("solar-moon");
  const mars = byId<HTMLOutputElement>("solar-mars");

  date.min = SOLAR_DATE_MIN;
  date.max = SOLAR_DATE_MAX;
  let instant = FIRST;
  let start = FIRST;
  let days = 1;
  let end = FIRST;
  let frame = 0;
  let points: SolarPoints | null = null;
  let invalid: "date" | "time" | null = null;

  const calendar = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale(), { ...options, timeZone: "UTC" });
  const decimal = () => new Intl.NumberFormat(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const dateTime = () => calendar({ dateStyle: "medium", timeStyle: "short", hourCycle: "h23" });
  let number = decimal();
  let dateLabel = dateTime();
  const coords = (point: SolarPoints[SolarBody]) => {
    return `${number.format(Math.abs(point.latitude))}° ${point.latitude < 0 ? "S" : "N"} · ${number.format(Math.abs(point.longitude))}° ${point.longitude < 0 ? t("solar.west") : "E"}`;
  };

  function paintReadout() {
    if (points) {
      moon.value = coords(points.moon);
      mars.value = coords(points.mars);
    }
    slider.setAttribute("aria-valuetext", `${dateLabel.format(instant)} UTC`);
  }

  function paintError() {
    if (invalid === "date") {
      const limits = calendar({ dateStyle: "medium" });
      status.textContent = t("solar.invalidDate", { min: limits.format(FIRST), max: limits.format(LAST) });
    } else status.textContent = invalid === "time" ? t("solar.invalidTime") : "";
    for (const field of [date, time]) {
      if (field === (invalid === "date" ? date : invalid === "time" ? time : null)) field.setAttribute("aria-invalid", "true");
      else field.removeAttribute("aria-invalid");
    }
  }

  function paintPlay() {
    const label = frame ? "solar.pause" : "solar.play";
    playLabel.dataset.i18n = label;
    playLabel.textContent = t(label);
    play.classList.toggle("is-playing", !!frame);
  }

  function paintTicks() {
    const span = end - start;
    const oneDay = span < DAY;
    const format = oneDay ? calendar({ hourCycle: "h23", hour: "2-digit", minute: "2-digit" }) : calendar({ day: "numeric", month: "short" });
    const tickDays = Math.round(span / DAY / 3);
    const offsets = oneDay ? [0, DAY / 4, DAY / 2, DAY * 3 / 4] : tickDays > 0 ? [0, tickDays * DAY, 2 * tickDays * DAY] : [0];
    const marks = [...offsets.filter((offset) => offset < span * .87).map((offset) => start + offset), end];
    ticks.replaceChildren(...marks.map((mark) => {
      const tick = document.createElement("span");
      // Tick positions also represent ranges shortened at the last supported date.
      tick.style.setProperty("--tick", `${(mark - start) / span * 100}%`);
      tick.textContent = format.format(mark);
      return tick;
    }));
  }

  function display(value: number) {
    instant = value;
    const timestamp = new Date(instant);
    const iso = timestamp.toISOString();
    if (date.value !== iso.slice(0, 10)) date.value = iso.slice(0, 10);
    if (time.value !== iso.slice(11, 16)) time.value = iso.slice(11, 16);
    slider.value = String((instant - start) / MINUTE);
    points = { moon: subsolarPoint("moon", timestamp), mars: subsolarPoint("mars", timestamp) };
    paintReadout();
    draw(points);
  }

  function setWindow(value: number) {
    start = Math.floor(value / DAY) * DAY;
    end = Math.min(LAST, start + days * DAY - MINUTE);
    slider.max = String((end - start) / MINUTE);
    paintTicks();
    display(value);
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    paintPlay();
  }

  function clearError() {
    if (!invalid) return;
    invalid = null;
    paintError();
  }

  function commitClock() {
    stop();
    invalid = !date.validity.valid ? "date" : !time.validity.valid ? "time" : null;
    paintError();
    if (!invalid) setWindow(Date.parse(`${date.value}T${time.value}Z`));
  }

  for (const field of [date, time]) {
    field.addEventListener("focus", stop);
    field.addEventListener("change", commitClock);
  }

  now.addEventListener("click", () => {
    stop();
    clearError();
    setWindow(nowInMinutes());
  });

  slider.addEventListener("input", () => {
    stop();
    clearError();
    display(start + slider.valueAsNumber * MINUTE);
  });

  for (const button of range) {
    button.addEventListener("click", () => {
      const next = Number(button.dataset.solarDays);
      if (days === next) return;
      stop();
      clearError();
      days = next;
      for (const choice of range) choice.setAttribute("aria-pressed", String(choice === button));
      setWindow(instant);
    });
  }

  play.addEventListener("click", () => {
    if (frame) { stop(); return; }
    clearError();
    if (instant === end) display(start);
    const from = instant;
    const started = performance.now();
    const tick = (at: number) => {
      const minutes = Math.floor(Math.max(0, at - started) / PLAY_DURATION * (end - start) / MINUTE);
      const next = Math.min(end, from + minutes * MINUTE);
      if (next !== instant) display(next);
      if (next < end) frame = requestAnimationFrame(tick);
      else stop();
    };
    frame = requestAnimationFrame(tick);
    paintPlay();
  });

  document.addEventListener("visibilitychange", () => { if (document.hidden && frame) stop(); });

  return {
    get points() { return points; },
    enter() {
      clearError();
      if (points) display(instant);
      else setWindow(nowInMinutes());
    },
    stop,
    localize() {
      number = decimal();
      dateLabel = dateTime();
      if (!points) return;
      paintTicks();
      paintReadout();
      paintError();
    },
  };
}
