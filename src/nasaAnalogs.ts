import rawAnalogs from "./data/nasa-analogs.json";
import { getLang, type Lang } from "./i18n";

type Localized = Record<Lang, string>;

export type NasaAnalogSite = {
  name: string;
  lat: number;
  lon: number;
  approximate?: boolean;
  image?: { url: string; alt: string | Localized; credit: string };
};

export type NasaAnalog = {
  id: string;
  body: "moon" | "mars";
  earth: NasaAnalogSite;
  target: NasaAnalogSite;
  summary: Localized;
  sources: { label: Localized; url: string }[];
};

export const nasaAnalogs: NasaAnalog[] = rawAnalogs as NasaAnalog[];
export const nasaText = (label: Localized | string) => typeof label === "string" ? label : label[getLang()];
