import type { SolarBody } from "./solarIllumination";

type SolarPoint = { latitude: number; longitude: number };

const WIDTH = 720;
const HEIGHT = 360;
const STEPS = 1024;
const DEGREES_TO_RADIANS = Math.PI / 180;
const fromSRGB = (value: number) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const toSRGB = (value: number) => value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
const srgbByte = Uint8ClampedArray.from({ length: 4096 }, (_, i) => 255 * toSRGB(i / 4095));

function lookup(size: number, start: number, span: number, transform: (angle: number) => number) {
  return Float32Array.from({ length: size }, (_, i) => transform(start + span * (i + 0.5) / size));
}

const cosLon = lookup(WIDTH, -Math.PI, 2 * Math.PI, Math.cos);
const sinLon = lookup(WIDTH, -Math.PI, 2 * Math.PI, Math.sin);
const cosLat = lookup(HEIGHT, Math.PI / 2, -Math.PI, Math.cos);
const sinLat = lookup(HEIGHT, Math.PI / 2, -Math.PI, Math.sin);
const brightness = Float32Array.from({ length: STEPS + 1 }, (_, step) => {
  const incidence = 2 * step / STEPS - 1;
  const daylight = Math.max(0, Math.min(1, 0.5 + 200 * incidence));
  const light = 0.24 + 1.08 * Math.max(0, incidence) ** 0.62;
  return 4095 * (0.065 * (1 - daylight) + light * daylight);
});

export function createSolarFallback(canvas: HTMLCanvasElement, body: SolarBody) {
  canvas.hidden = true;
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const gain = body === "moon" ? 0.66 : 1;
  const linear = Float32Array.from({ length: 256 }, (_, value) => fromSRGB(gain * value / 255));
  const base = body === "moon" ? [linear[189], linear[188], linear[185]] : [linear[184], linear[104], linear[69]];
  const sunAcross = new Float32Array(WIDTH);
  let context: CanvasRenderingContext2D | null | undefined;
  let target: ImageData | undefined;
  let source: Uint8ClampedArray | undefined;
  let point: SolarPoint | null = null;
  let requested = false;
  let frame = 0;

  function paint() {
    frame = 0;
    if (!point || !context || !target) return;
    const longitude = point.longitude * DEGREES_TO_RADIANS;
    const latitude = point.latitude * DEGREES_TO_RADIANS;
    const sunX = Math.cos(latitude) * Math.cos(longitude);
    const sunY = Math.cos(latitude) * Math.sin(longitude);
    const sunZ = Math.sin(latitude);
    for (let x = 0; x < WIDTH; x++) sunAcross[x] = sunX * cosLon[x] + sunY * sinLon[x];

    const { data } = target;
    const texture = source;
    for (let y = 0, offset = 0; y < HEIGHT; y++) {
      const rowCos = cosLat[y];
      const rowSin = sunZ * sinLat[y];
      for (let x = 0; x < WIDTH; x++, offset += 4) {
        // Cosine of the solar zenith angle from the longitude and latitude at the pixel's center.
        const incidence = sunAcross[x] * rowCos + rowSin;
        const shade = brightness[Math.round((incidence + 1) * STEPS / 2)];
        const red = texture ? linear[texture[offset]] : base[0];
        const green = texture ? linear[texture[offset + 1]] : base[1];
        const blue = texture ? linear[texture[offset + 2]] : base[2];
        data[offset] = srgbByte[Math.min(4095, Math.floor(shade * red))];
        data[offset + 1] = srgbByte[Math.min(4095, Math.floor(shade * green))];
        data[offset + 2] = srgbByte[Math.min(4095, Math.floor(shade * blue))];
        data[offset + 3] = 255;
      }
    }
    context.putImageData(target, 0, 0);
    canvas.hidden = false;
  }

  function schedule() {
    if (point && !frame) frame = requestAnimationFrame(paint);
  }

  function setPoint(next: SolarPoint | null) {
    point = next;
    if (!point) {
      canvas.hidden = true;
      cancelAnimationFrame(frame);
      frame = 0;
      return;
    }

    if (context === undefined) {
      context = canvas.getContext("2d", { alpha: false });
      target = context?.createImageData(WIDTH, HEIGHT);
    }
    if (!context) return;

    if (!requested) {
      requested = true;
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        const buffer = document.createElement("canvas");
        buffer.width = WIDTH;
        buffer.height = HEIGHT;
        const reader = buffer.getContext("2d", { willReadFrequently: true });
        if (!reader) return;
        reader.drawImage(image, 0, 0, WIDTH, HEIGHT);
        source = reader.getImageData(0, 0, WIDTH, HEIGHT).data;
        schedule();
      };
      image.src = `${import.meta.env.BASE_URL}imagery/${body}.webp`;
    }
    schedule();
  }

  return { setPoint };
}
