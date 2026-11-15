export type SolarBody = "moon" | "mars";

export const SOLAR_DATE_MIN = "1800-01-01";
export const SOLAR_DATE_MAX = "2050-12-31";

const DAY_MS = 86_400_000;
const CENTURY_DAYS = 36_525;
const J2000 = Date.UTC(2000, 0, 1, 12);
const FIRST_DATE = Date.parse(SOLAR_DATE_MIN);
const PAST_LAST_DATE = Date.parse(SOLAR_DATE_MAX) + DAY_MS;
const RAD = Math.PI / 180;
const OBLIQUITY = 23.43928 * RAD;

type Vector = [x: number, y: number, z: number];
type Orientation = [rightAscension: number, declination: number, meridian: number];
type OrbitalElements = [a: number, eccentricity: number, inclination: number, longitude: number, perihelion: number, node: number];

// JPL's Keplerian fits to the J2000 ecliptic, table 1 (1800–2050).
// https://ssd.jpl.nasa.gov/planets/approx_pos.html
const EARTH_MOON_ORBIT: [OrbitalElements, OrbitalElements] = [
  [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0],
  [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0],
];
const MARS_ORBIT: [OrbitalElements, OrbitalElements] = [
  [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
  [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
];

// Effective UTC dates for TAI − UTC = 10 s, then one additional second per entry.
// https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls
// Future dates use the last published offset until another leap second is announced.
const LEAP_SECOND_EPOCHS = [
  "1972-01-01", "1972-07-01", "1973-01-01", "1974-01-01", "1975-01-01", "1976-01-01", "1977-01-01",
  "1978-01-01", "1979-01-01", "1980-01-01", "1981-07-01", "1982-07-01", "1983-07-01", "1985-07-01",
  "1988-01-01", "1990-01-01", "1991-01-01", "1992-07-01", "1993-07-01", "1994-07-01", "1996-01-01",
  "1997-07-01", "1999-01-01", "2006-01-01", "2009-01-01", "2012-07-01", "2015-07-01", "2017-01-01",
].map(value => Date.parse(value));

// Earlier dates treat the entered clock time as UT1, using the NASA eclipse canon's ΔT fit.
// https://eclipse.gsfc.nasa.gov/LEcat5/deltatpoly.html
const HISTORICAL_DELTA_T: [startYear: number, centerYear: number, coefficients: number[]][] = [
  [1961, 1975, [45.45, 1.067, -1 / 260, -1 / 718]],
  [1941, 1950, [29.07, 0.407, -1 / 233, 1 / 2547]],
  [1920, 1920, [21.20, 0.84493, -0.076100, 0.0020936]],
  [1900, 1900, [-2.79, 1.494119, -0.0598939, 0.0061966, -0.000197]],
  [1860, 1860, [7.62, 0.5737, -0.251754, 0.01680668, -0.0004473624, 1 / 233174]],
  [1800, 1800, [13.72, -0.332447, 0.0068612, 0.0041116, -0.00037436, 0.0000121272, -0.0000001699, 0.000000000875]],
];

function daysSinceJ2000(date: Date) {
  const instant = date.getTime();
  if (!(instant >= FIRST_DATE && instant < PAST_LAST_DATE)) {
    throw new RangeError(`Solar illumination dates must be between ${SOLAR_DATE_MIN} and ${SOLAR_DATE_MAX}.`);
  }
  let ttOffset: number;
  if (instant >= LEAP_SECOND_EPOCHS[0]) {
    const elapsed = LEAP_SECOND_EPOCHS.filter(epoch => epoch <= instant).length - 1;
    ttOffset = 42.184 + elapsed;
  } else {
    const year = date.getUTCFullYear();
    const yearStart = Date.UTC(year, 0, 1);
    const fraction = (instant - yearStart) / (Date.UTC(year + 1, 0, 1) - yearStart);
    const [, center, coefficients] = HISTORICAL_DELTA_T.find(([start]) => year >= start)!;
    const yearsFromCenter = year - center + fraction;
    ttOffset = coefficients.reduceRight((value, coefficient) => value * yearsFromCenter + coefficient, 0);
  }
  // TT and the ephemeris timescale TDB differ by less than two milliseconds.
  return (instant - J2000 + ttOffset * 1000) / DAY_MS;
}

function signedLongitude(degrees: number) {
  return ((degrees + 180) % 360 + 360) % 360 - 180;
}

function heliocentricPosition([elements, rates]: [OrbitalElements, OrbitalElements], centuries: number): Vector {
  const [a, e, inclination, longitude, perihelion, node] = elements.map((value, index) => value + rates[index] * centuries);
  const meanAnomaly = signedLongitude(longitude - perihelion) * RAD;
  let eccentricAnomaly = meanAnomaly;
  for (let iteration = 0; iteration < 4; iteration++) {
    eccentricAnomaly -= (eccentricAnomaly - e * Math.sin(eccentricAnomaly) - meanAnomaly) / (1 - e * Math.cos(eccentricAnomaly));
  }
  const radius = a * (1 - e * Math.cos(eccentricAnomaly));
  const trueAnomaly = Math.atan2(Math.sqrt(1 - e * e) * Math.sin(eccentricAnomaly), Math.cos(eccentricAnomaly) - e);
  const argument = trueAnomaly + (perihelion - node) * RAD;
  const alongNode = radius * Math.cos(argument);
  const acrossNode = radius * Math.sin(argument);
  const projected = acrossNode * Math.cos(inclination * RAD);
  return [
    alongNode * Math.cos(node * RAD) - projected * Math.sin(node * RAD),
    alongNode * Math.sin(node * RAD) + projected * Math.cos(node * RAD),
    acrossNode * Math.sin(inclination * RAD),
  ];
}

function lunarBarycenterOffset(centuries: number): Vector {
  // Leading lunar terms from Meeus, Astronomical Algorithms, chapter 47.
  // The Moon's offset is only 0.0026 AU, so these terms suffice for solar direction.
  const elongation = (297.8501921 + 445267.1114034 * centuries) * RAD;
  const anomaly = (134.9633964 + 477198.8675055 * centuries) * RAD;
  const argument = (93.2720950 + 483202.0175233 * centuries) * RAD;
  const evection = 2 * elongation - anomaly;
  // Subtract general precession in longitude for the J2000 ecliptic.
  const meanLongitude = 218.31665436 + (481267.88123421 - 1.3970) * centuries;
  const longitude = (meanLongitude + 6.288774 * Math.sin(anomaly) + 1.274027 * Math.sin(evection)
    + 0.658314 * Math.sin(2 * elongation) + 0.213618 * Math.sin(2 * anomaly)) * RAD;
  const latitude = (5.128122 * Math.sin(argument) + 0.280602 * Math.sin(anomaly + argument)
    + 0.277693 * Math.sin(anomaly - argument) + 0.173237 * Math.sin(2 * elongation - argument)) * RAD;
  const distance = 385000.56 - 20905.355 * Math.cos(anomaly) - 3699.111 * Math.cos(evection)
    - 2955.968 * Math.cos(2 * elongation) - 569.925 * Math.cos(2 * anomaly);
  // Convert geocentric kilometres to the Moon's offset from the barycenter in AU.
  const radius = distance * 0.9878494 / 149597870.7;
  const projected = radius * Math.cos(latitude);
  return [projected * Math.cos(longitude), projected * Math.sin(longitude), radius * Math.sin(latitude)];
}

// IAU body orientation via NASA/NAIF PCK00011. Each row is the phase at J2000,
// its rate per century, then amplitudes for pole RA, pole declination and W.
// https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc
type OrientationTerm = [phase: number, rate: number, ra: number, dec: number, meridian: number];
const MOON_ORIENTATION: OrientationTerm[] = [
  [125.045, -1935.5364525, -3.8787, 1.5419, 3.5610],
  [250.089, -3871.072905, -0.1204, 0.0239, 0.1208],
  [260.008, 475263.3328725, 0.0700, -0.0278, -0.0642],
  [176.625, 487269.629985, -0.0172, 0.0068, 0.0158],
  [357.529, 35999.0509575, 0, 0, 0.0252],
  [311.589, 964468.499310, 0.0072, -0.0029, -0.0066],
  [134.963, 477198.869325, 0, 0.0009, -0.0047],
  [276.617, 12006.300765, 0, 0, -0.0046],
  [34.226, 63863.5132425, 0, 0, 0.0028],
  [15.134, -5806.6093575, -0.0052, 0.0008, 0.0052],
  [119.743, 131.84064, 0, 0, 0.0040],
  [239.961, 6003.1503825, 0, 0, 0.0019],
  [25.053, 473327.79642, 0.0043, -0.0009, -0.0044],
];
const MARS_ORIENTATION: OrientationTerm[] = [
  [198.991226, 19139.4819985, 0.000068, 0, 0],
  [226.292679, 38280.8511281, 0.000238, 0, 0],
  [249.663391, 57420.7251593, 0.000052, 0, 0],
  [266.183510, 76560.6367950, 0.000009, 0, 0],
  [79.398797, 0.5042615, 0.419057, 0, 0],
  [122.433576, 19139.9407476, 0, 0.000051, 0],
  [43.058401, 38280.8753272, 0, 0.000141, 0],
  [57.663379, 57420.7517205, 0, 0.000031, 0],
  [79.476401, 76560.6495004, 0, 0.000005, 0],
  [166.325722, 0.5042615, 0, 1.591274, 0],
  [129.071773, 19140.0328244, 0, 0, 0.000145],
  [36.352167, 38281.0473591, 0, 0, 0.000157],
  [56.668646, 57420.9295360, 0, 0, 0.000040],
  [67.364003, 76560.2552215, 0, 0, 0.000001],
  [104.792680, 95700.4387578, 0, 0, 0.000001],
  [95.391654, 0.5042615, 0, 0, 0.584542],
];

function bodyOrientation(body: SolarBody, days: number, centuries: number): Orientation {
  const lunar = body === "moon";
  let ra = lunar ? 269.9949 + 0.0031 * centuries : 317.269202 - 0.10927547 * centuries;
  let dec = lunar ? 66.5392 + 0.0130 * centuries : 54.432516 - 0.05827105 * centuries;
  let meridian = lunar ? 38.3213 + days * (13.17635815 - 1.4e-12 * days) : 176.049863 + 350.891982443297 * days;
  for (const [phase, rate, raAmplitude, decAmplitude, meridianAmplitude] of lunar ? MOON_ORIENTATION : MARS_ORIENTATION) {
    const angle = (phase + rate * centuries) * RAD;
    const sine = Math.sin(angle);
    ra += raAmplitude * sine;
    dec += decAmplitude * Math.cos(angle);
    meridian += meridianAmplitude * sine;
  }
  return [ra * RAD, dec * RAD, signedLongitude(meridian)];
}

/** Direction toward the center of the Sun, in planetocentric degrees north and east. */
export function subsolarPoint(body: SolarBody, date: Date): { latitude: number; longitude: number } {
  const days = daysSinceJ2000(date);
  const centuries = days / CENTURY_DAYS;
  let [x, y, z] = heliocentricPosition(body === "moon" ? EARTH_MOON_ORBIT : MARS_ORBIT, centuries);
  if (body === "moon") {
    const [dx, dy, dz] = lunarBarycenterOffset(centuries);
    x += dx;
    y += dy;
    z += dz;
  }

  // Negate for body-to-Sun, then rotate from J2000 ecliptic to J2000 equatorial coordinates.
  const sunX = -x;
  const sunY = z * Math.sin(OBLIQUITY) - y * Math.cos(OBLIQUITY);
  const sunZ = -y * Math.sin(OBLIQUITY) - z * Math.cos(OBLIQUITY);
  const [ra, dec, meridian] = bodyOrientation(body, days, centuries);

  // Rotate into the body's equator, then measure longitude from its prime meridian.
  const equatorX = -sunX * Math.sin(ra) + sunY * Math.cos(ra);
  const azimuthY = -sunX * Math.cos(ra) - sunY * Math.sin(ra);
  const equatorY = azimuthY * Math.sin(dec) + sunZ * Math.cos(dec);
  const poleZ = sunZ * Math.sin(dec) - azimuthY * Math.cos(dec);
  return {
    latitude: Math.atan2(poleZ, Math.hypot(equatorX, equatorY)) / RAD,
    longitude: signedLongitude(Math.atan2(equatorY, equatorX) / RAD - meridian),
  };
}
