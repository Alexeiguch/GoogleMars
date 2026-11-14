"""Sitios de referencia v2 (Luna y Marte) con su fuente, y mallas de ventanas.

Solo datos y geometría: no lee ningún DEM ni usa la red.

Luna (polo sur, 80–90°S):
- MOON_REGIONS: 9 regiones candidatas de Artemis III (NASA, oct. 2024; desde feb. 2026 el
  primer alunizaje tripulado es Artemis IV) y 7 regiones de ago. 2022 retiradas en 2024.
  Centro y límites = mosaicos LROC NAC "low-Sun controlled" (data.lroc.im-ldi.com), cotejados
  el 14/11/2026 en cada página; latitudes cotejadas con la tabla de NASA GSFC (NTRS 20250007692).
  Las regiones sin centro propio verificado llevan verified=False y lo dicen en coord_quality.
- MOON_SITES: puntos con coordenadas publicadas (IM-2, Gläser et al., IAU).
- moon_polar_grid(): malla regular azimutal polar; region_tiles(): teselas dentro de una región.

Marte: MARS_SITES, 43 sitios (aterrizajes, zonas de exploración humana de 2015 y sitios por tipo
de terreno), latitud norte positiva y longitud este en -180..180. hirise_category es la categoría
del catálogo del visor (src/data/catalog.json) más parecida, asignada a mano (no viene de la fuente).
mars_site_tiles(): n×n ventanas alrededor de un sitio.

Ejecutar desde pipeline/:  python -m analogs.reference_sites   (imprime un resumen)
"""

from __future__ import annotations

import math
from collections import Counter

MOON_R_KM = 1737.4
MARS_R_KM = 3396.19

HIRISE_CATEGORIES = ("Impact terrain", "Ridges & layered terrain", "Valleys & fans",
                     "Dunes", "Ice & polar terrain", "Volcanic terrain")

LROC = "https://data.lroc.im-ldi.com/lroc/view_rdr/"
GSFC = "https://ntrs.nasa.gov/api/citations/20250007692/downloads/PDFpresentation.pdf"
GLASER = "https://ntrs.nasa.gov/api/citations/20170007365/downloads/20170007365.pdf"


def _region(id, name, group, lat, lon, bounds, extent_km, coord_quality, verified,
            source_url, source_note, mosaic=None):
    b = None if bounds is None else dict(zip(("lat_min", "lat_max", "lon_min", "lon_max"), bounds))
    return dict(id=id, name=name, group=group, lat=lat, lon=lon, bounds=b, extent_km=extent_km,
                coord_quality=coord_quality, verified=verified, mosaic=mosaic,
                source_url=source_url, source_note=source_note)


# Límites de los mosaicos LROC tal como los publica cada página (lon este en -180..180).
_B_DEGERRIM = (-89.02, -87.79, -83.18, -41.31)
_B_MTMOUTON = (-86.07, -84.82, 27.29, 43.23)

MOON_REGIONS: list[dict] = [
    # --- 9 regiones de oct. 2024 ---
    _region("peak_near_cabeus_b", "Peak near Cabeus B", "artemis_2024", -83.6, -68.8,
            (-84.06, -83.21, -72.47, -64.80), 19.9, "centro_mosaico_lroc", True,
            LROC + "NAC_ROI_CABEUSPKLO1",
            "Mosaico LROC NAC_ROI_CABEUSPKLO1_P836S2912 ('Peak Near Cabeus B', candidata de Artemis III): "
            "centro -83.6, 291.2 E (= -68.8); límites lat -84.06 a -83.21, lon -72.47 a -64.80 (página "
            "cotejada el 14/11/2026). GSFC TFAWS 2025 (NTRS 20250007692): latitud del centro -83.6, área "
            "397.3 km² (extent_km = raíz del área). Cráter Cabeus B (IAU, Feature/8058): -82.26, -54.58.",
            "NAC_ROI_CABEUSPKLO1_P836S2912"),
    _region("haworth", "Haworth", "artemis_2024", -86.7, -23.7,
            (-87.39, -86.11, -34.98, -12.36), 29.8, "centro_mosaico_lroc", True,
            LROC + "NAC_ROI_HAWORTH_LO1",
            "Mosaico LROC NAC_ROI_HAWORTH_LO1_P867S3363: centro -86.7, 336.3 E (= -23.7); límites lat "
            "-87.39 a -86.11, lon -34.98 a -12.36 (cotejado el 14/11/2026). GSFC TFAWS 2025: latitud -86.7, "
            "área 886.6 km². Cráter Haworth (IAU, Feature/14502): -87.45, -5.17. También región en 2022.",
            "NAC_ROI_HAWORTH_LO1_P867S3363"),
    _region("malapert_massif", "Malapert Massif", "artemis_2024", -86.0, 0.3,
            (-86.33, -85.63, -5.66, 5.15), 21.0, "centro_mosaico_lroc", True,
            LROC + "NAC_ROI_MALAPERTLO1",
            "Mosaico LROC NAC_ROI_MALAPERTLO1_P860S0003: centro -86.0, 0.3; límites lat -86.33 a -85.63, "
            "lon -5.66 a 5.15 (cotejado el 14/11/2026). GSFC TFAWS 2025: latitud -86.0, área 439.9 km². "
            "Mons Malapert (IAU, Feature/16338): -85.98, -1.67. También región en 2022.",
            "NAC_ROI_MALAPERTLO1_P860S0003"),
    _region("mons_mouton_plateau", "Mons Mouton Plateau", "artemis_2024", -84.3, 30.6,
            (-85.76, -82.85, 15.49, 46.61), 66.5, "centro_mosaico_lroc", True,
            LROC + "NAC_ROI_MOUTNPLTLO1",
            "Mosaico LROC NAC_ROI_MOUTNPLTLO1_P843S0306: centro -84.3, 30.6; límites lat -85.76 a -82.85, "
            "lon 15.49 a 46.61 (cotejado el 14/11/2026). GSFC TFAWS 2025: latitud -84.2, área 4428.4 km², "
            "mucho mayor que las demás regiones. Mons Mouton (IAU, Feature/16070): -84.60, 31.00.",
            "NAC_ROI_MOUTNPLTLO1_P843S0306"),
    _region("mons_mouton", "Mons Mouton (antes Leibnitz Beta Plateau)", "artemis_2024", -85.4, 35.3,
            _B_MTMOUTON, 16.0, "centro_mosaico_lroc_compartido_lon_no_verificada", False,
            LROC + "NAC_ROI_MTMOUTONLO1",
            "Mosaico LROC compartido 'Nobile Rim 1 and Mons Mouton (Leibnitz Beta Plateau)' "
            "NAC_ROI_MTMOUTONLO1_P854S0353: centro -85.4, 35.3; límites lat -86.07 a -84.82, lon 27.29 a "
            "43.23 (cotejado el 14/11/2026). Lat y lon son las del mosaico compartido: la longitud propia "
            "de la región NO está verificada. GSFC TFAWS 2025: latitud -85.4, área 255.2 km². Región "
            "'Leibnitz Beta Plateau' en 2022 (Mons Mouton aprobado por la IAU el 13-may-2022).",
            "NAC_ROI_MTMOUTONLO1_P854S0353"),
    _region("nobile_rim_1", "Nobile Rim 1", "artemis_2024", -85.4, 35.3,
            _B_MTMOUTON, 20.0, "centro_mosaico_lroc_compartido_lon_no_verificada", False,
            LROC + "NAC_ROI_MTMOUTONLO1",
            "Mismo mosaico LROC compartido con Mons Mouton (NAC_ROI_MTMOUTONLO1_P854S0353, centro -85.4, "
            "35.3; lon 27.29 a 43.23). La longitud propia NO está verificada. GSFC TFAWS 2025: latitud "
            "-85.4, área 398.7 km². Cráter Nobile (IAU, Feature/4321): -85.28, 53.27. También región en 2022.",
            "NAC_ROI_MTMOUTONLO1_P854S0353"),
    _region("nobile_rim_2", "Nobile Rim 2", "artemis_2024", -83.9, 58.7,
            (-84.40, -83.50, 54.46, 63.02), 19.9, "centro_mosaico_lroc", True,
            LROC + "NAC_ROI_NOBILE02LO1",
            "Mosaico LROC NAC_ROI_NOBILE02LO1_P839S0587: centro -83.9, 58.7; límites lat -84.40 a -83.50, "
            "lon 54.46 a 63.02 (cotejado el 14/11/2026). GSFC TFAWS 2025: latitud -83.9, área 397.8 km². "
            "Peña-Asensio et al. (Acta Astronautica; arXiv 2406.19863) sitúan su punto óptimo en "
            "-84.20156, 60.69989. También región en 2022.",
            "NAC_ROI_NOBILE02LO1_P839S0587"),
    _region("de_gerlache_rim_2", "de Gerlache Rim 2", "artemis_2024", -88.2, -66.7,
            _B_DEGERRIM, 20.0, "lat_gsfc_lon_mosaico_compartido_no_verificada", False, GSFC,
            "Latitud -88.2 de la tabla NASA GSFC TFAWS 2025 (área 399.8 km²). Longitud -66.7 = centro del "
            "mosaico LROC 'de Gerlache Rim' NAC_ROI_DEGERRIMLO1_P885S2933 (centro -88.5, 293.3 E; límites "
            "lat -89.02 a -87.79, lon -83.18 a -41.31; cotejado el 14/11/2026), que puede abarcar Rim 1 y "
            "Rim 2: longitud INCIERTA y límites del mosaico, no de la región. Cráter de Gerlache (IAU, "
            "Feature/1439): -88.48, -88.34. También región en 2022.",
            "NAC_ROI_DEGERRIMLO1_P885S2933"),
    _region("slater_plain", "Slater Plain", "artemis_2024", -88.08, 111.29,
            None, 20.0, "centro_crater_iau_lon_no_verificada", False,
            "https://planetarynames.wr.usgs.gov/Feature/15325",
            "Posición = centro del cráter Slater (Gazetteer IAU, planetográfica +Este: -88.08, 111.29; "
            "D = 25.12 km; cotejado el 14/11/2026). La tabla GSFC TFAWS 2025 da para la región latitud "
            "-87.1 y área 399.3 km²: la región está a ~30 km del centro del cráter hacia el ecuador y su "
            "longitud no está verificada. No hay mosaico LROC de la región (solo el de la PSR de Slater, "
            "NAC_ROI_PSRSLATRLOA, centro -87.5, 121.4, que no es la región)."),
    # --- 7 regiones de ago. 2022 retiradas en oct. 2024 ---
    _region("faustini_rim_a", "Faustini Rim A", "artemis_2022_retirada", -87.8, 90.0,
            (-88.19, -87.54, 79.51, 100.49), 15.0, "centro_mosaico_lroc", True,
            LROC + "NAC_ROI_FAUSTINILO1",
            "Mosaico LROC NAC_ROI_FAUSTINILO1_P878S0900: centro -87.8, 90.0; límites lat -88.19 a -87.54, "
            "lon 79.51 a 100.49 (cotejado el 14/11/2026). 15x15 km según la nota de NASA de 2022. "
            "Rejilla USGS en DOI 10.5066/P13FD9ZD (no leída).",
            "NAC_ROI_FAUSTINILO1_P878S0900"),
    _region("peak_near_shackleton", "Peak near Shackleton", "artemis_2022_retirada", -88.8, 124.7,
            (-89.17, -88.44, 107.53, 141.84), 15.0, "centro_mosaico_lroc", True,
            LROC + "NAC_ROI_SHKLTNPKLO1",
            "Mosaico LROC NAC_ROI_SHKLTNPKLO1_P888S1247 (y el #2, SHKLTNPKLO2, con el mismo centro y "
            "límites): centro -88.8, 124.7; límites lat -89.17 a -88.44, lon 107.53 a 141.84 (cotejado el "
            "14/11/2026).",
            "NAC_ROI_SHKLTNPKLO1_P888S1247"),
    _region("amundsen_rim", "Amundsen Rim", "artemis_2022_retirada", -84.2, 69.3,
            (-84.65, -83.80, 65.10, 73.51), 15.0, "centro_mosaico_lroc", True,
            LROC + "NAC_ROI_AMUNDRIMLO1",
            "Mosaico LROC NAC_ROI_AMUNDRIMLO1_P842S0693: centro -84.2, 69.3; límites lat -84.65 a -83.80, "
            "lon 65.10 a 73.51 (cotejado el 14/11/2026). Cráter Amundsen (IAU): -84.44, 83.07.",
            "NAC_ROI_AMUNDRIMLO1_P842S0693"),
    _region("de_gerlache_kocher_massif", "de Gerlache-Kocher Massif", "artemis_2022_retirada", -85.8, -116.4,
            (-86.27, -85.39, -122.59, -110.48), 15.0, "centro_mosaico_lroc", True,
            LROC + "NAC_ROI_DEGERKCHLO1",
            "Mosaico LROC NAC_ROI_DEGERKCHLO1_P858S24363: centro -85.8, 243.6 E (= -116.4); límites lat "
            "-86.27 a -85.39, lon -122.59 a -110.48 (cotejado el 14/11/2026).",
            "NAC_ROI_DEGERKCHLO1_P858S24363"),
    _region("de_gerlache_rim_1", "de Gerlache Rim 1", "artemis_2022_retirada", -88.5, -66.7,
            _B_DEGERRIM, 15.0, "no_verificada_centro_mosaico_compartido", False,
            LROC + "NAC_ROI_DEGERRIMLO1",
            "Solo existe el mosaico LROC genérico 'de Gerlache Rim' NAC_ROI_DEGERRIMLO1_P885S2933 (centro "
            "-88.5, 293.3 E = -66.7; límites lat -89.02 a -87.79, lon -83.18 a -41.31; cotejado el "
            "14/11/2026), que puede cubrir Rim 1 y Rim 2. No hay centro verificado para Rim 1. Polígono en "
            "la release USGS DOI 10.5066/P13FD9ZD (no leída).",
            "NAC_ROI_DEGERRIMLO1_P885S2933"),
    _region("connecting_ridge", "Connecting Ridge", "artemis_2022_retirada", -89.4505, -137.16,
            None, 15.0, "punto_c1_glaser_no_es_centro", False, GLASER,
            "No es el centro de la región (no verificado): es el punto C1 de máxima iluminación media de la "
            "cresta Shackleton–de Gerlache según Gläser et al. ('Illumination conditions at the lunar "
            "poles: Implications for future exploration', Planetary and Space Science), tabla 1: -89.4505, "
            "222.84 E (= -137.16). No hay mosaico LROC de la región. Rejilla USGS en DOI 10.5066/P13FD9ZD "
            "(no leída). Mismo punto que el sitio connecting_ridge_c1."),
    _region("connecting_ridge_extension", "Connecting Ridge Extension", "artemis_2022_retirada", -89.3157, -114.06,
            None, 15.0, "no_verificada_punto_c2_glaser", False, GLASER,
            "No hay coordenadas publicadas de esta región. Se usa el punto C2 de Connecting Ridge de "
            "Gläser et al. (tabla 1: -89.3157, 245.94 E = -114.06), pero NO consta que corresponda a "
            "'Connecting Ridge Extension'. Polígono en la release USGS DOI 10.5066/P13FD9ZD (no leída). "
            "Mismo punto que el sitio connecting_ridge_c2."),
]


def _site(id, name, lat, lon, coord_quality, source_url, source_note, same_as_region=None):
    return dict(id=id, name=name, group="sitios_polo_sur", lat=lat, lon=lon, bounds=None, extent_km=None,
                coord_quality=coord_quality, verified=True, mosaic=None, same_as_region=same_as_region,
                source_url=source_url, source_note=source_note)


# Fuera a propósito: Peak near Shackleton (mosaico #2 = la región peak_near_shackleton), el sitio
# previsto de IM-2 (-84.78, 29.13; a ~1 km de la posición final) y los centros IAU de Mons Mouton y
# Nobile (referencias de VIPER, cuya posición exacta no está publicada).
MOON_SITES: list[dict] = [
    _site("im2_athena", "Intuitive Machines IM-2 (Athena), posición final en Mons Mouton", -84.7906, 29.1957,
          "publicada_lroc", "https://lroc.im-ldi.com/images/1408",
          "LROC 'IM-2 Athena Seen Obliquely' (10-mar-2025): 84.7906° S, 29.1957° E (cotejado el 14/11/2026). "
          "Quedó de lado dentro de un cráter de ~20 m cerca del centro de Mons Mouton. El sitio previsto "
          "era -84.78, 29.13 (LROC 'IM-2 Landing Region', https://lroc.im-ldi.com/images/1401)."),
    _site("connecting_ridge_c1", "Connecting Ridge C1 (cresta Shackleton–de Gerlache)", -89.4505, -137.16,
          "de_articulo_cientifico", GLASER,
          "Gläser et al., tabla 1 (DTM LOLA de 20 m, 2017–2037): -89.4505, 222.84 E; iluminación media "
          "76.0 %. Mazarico et al. (2011): -89.45, 222.69 E. A 2 m sobre el suelo (tabla 2): -89.4398, "
          "222.83 E, 88.0 %.", same_as_region="connecting_ridge"),
    _site("connecting_ridge_c2", "Connecting Ridge C2", -89.3157, -114.06,
          "de_articulo_cientifico", GLASER,
          "Gläser et al., tabla 1: -89.3157, 245.94 E; iluminación media 75.6 %. Tabla 2 (2 m): -89.3130, "
          "245.98 E.", same_as_region="connecting_ridge_extension"),
    _site("shackleton_borde_s", "Borde S de Shackleton (punto de alta iluminación)", -89.7849, -156.03,
          "de_articulo_cientifico", GLASER,
          "Gläser et al., tabla 1: -89.7849, 203.97 E; iluminación media 81.0 %. Mazarico et al. (2011): "
          "-89.78, 204.27 E."),
    _site("shackleton", "Cráter Shackleton (centro según la IAU)", -89.67, 129.78,
          "centro_crater_iau", "https://planetarynames.wr.usgs.gov/Feature/5450",
          "Gazetteer of Planetary Nomenclature (IAU/USGS): Shackleton, D = 20.92 km, -89.67, 129.78 "
          "(planetográfica, +Este; cotejado el 14/11/2026). Mismo id que la referencia de la v1."),
]

# ---------------------------------------------------------------- Luna fuera del polo
# El reto habla de "candidate permanent Moon-base locations" sin limitarse al polo sur. Estos sitios
# se comparan solo como gemelos (no entran en el ranking ni en la validación del polo sur) y con
# SLDEM2015 (59 m, 60°S–60°N), no con el LOLA global de 118 m, que cerca del ecuador tiene huecos de
# 1–4 km entre trazas rellenados por interpolación.
LROC_OBJECTS = "https://data.lroc.im-ldi.com/lroc/view_rdr/SHAPEFILE_ANTHROPOGENIC_OBJECTS"
LROC_PITS = "https://data.lroc.im-ldi.com/lroc/view_rdr/SHAPEFILE_LUNAR_PIT_LOCATIONS"


def _np_site(id, name, kind, lat, lon, source_url, source_note):
    return dict(id=id, name=name, group="luna_fuera_del_polo", subgroup=kind, lat=lat, lon=lon,
                coord_quality="publicada_lroc", verified=True, source_url=source_url, source_note=source_note)


_OBJ = ("Shapefile 'Anthropogenic Objects' de LROC (ANTHROPOGENIC_OBJECTS_180.ZIP, PDS LROLRC_2001/EXTRAS; "
        "mantiene las coordenadas de Wagner et al. 2017, Icarus 283), leído el 14/11/2026: ")
_PIT = ("Lunar Pit Locations de LROC (LUNAR_PIT_LOCATIONS.CSV, PDS LROLRC_2001/EXTRAS; Atlas de fosos de "
        "LROC), leído el 14/11/2026: ")

MOON_NONPOLAR_SITES: list[dict] = [
    _np_site("apollo11", "Apollo 11 (Mare Tranquillitatis)", "apollo", 0.67416, 23.47314, LROC_OBJECTS,
             _OBJ + "A11_LM, módulo lunar Eagle, 0.67416, 23.47314."),
    _np_site("apollo12", "Apollo 12 (Oceanus Procellarum)", "apollo", -3.0128, -23.4219, LROC_OBJECTS,
             _OBJ + "A12_LM, módulo lunar Intrepid, -3.0128, -23.4219."),
    _np_site("apollo14", "Apollo 14 (Fra Mauro)", "apollo", -3.64589, -17.47194, LROC_OBJECTS,
             _OBJ + "A14_LM, módulo lunar Antares, -3.64589, -17.47194."),
    _np_site("apollo15", "Apollo 15 (Hadley–Apeninos)", "apollo", 26.13239, 3.6333, LROC_OBJECTS,
             _OBJ + "A15_LM, módulo lunar Falcon, 26.13239, 3.6333."),
    _np_site("apollo16", "Apollo 16 (tierras altas de Descartes)", "apollo", -8.9734, 15.5011, LROC_OBJECTS,
             _OBJ + "A16_LM, módulo lunar Orion, -8.9734, 15.5011."),
    _np_site("apollo17", "Apollo 17 (Taurus–Littrow)", "apollo", 20.1911, 30.7723, LROC_OBJECTS,
             _OBJ + "A17_LM, módulo lunar Challenger, 20.1911, 30.7723."),
    _np_site("change3", "Chang'e 3 (Mare Imbrium)", "change", 44.1214, -19.5117, LROC_OBJECTS,
             _OBJ + "ChangE3, módulo de aterrizaje, 44.1214, -19.5117."),
    _np_site("change4", "Chang'e 4 (cráter Von Kármán, cara oculta)", "change", -45.4562, 177.5886, LROC_OBJECTS,
             _OBJ + "ChangE4, módulo de aterrizaje, -45.4562, 177.5886."),
    _np_site("change5", "Chang'e 5 (Oceanus Procellarum, Mons Rümker)", "change", 43.0576, -51.9161, LROC_OBJECTS,
             _OBJ + "ChangE5, módulo de aterrizaje, 43.0576, -51.9161."),
    _np_site("change6", "Chang'e 6 (cuenca Apollo, cara oculta)", "change", -41.6383, -153.9857, LROC_OBJECTS,
             _OBJ + "ChangE6, módulo de aterrizaje, -41.6383, -153.9857."),
    _np_site("foso_marius_hills", "Foso de Marius Hills (posible tubo de lava)", "foso", 14.0917, -56.7701, LROC_PITS,
             _PIT + "Marius Hills Pit, 14.0917, -56.7701 (303.2299 E); 40 m de profundidad."),
    _np_site("foso_mare_tranquillitatis", "Foso de Mare Tranquillitatis (posible tubo de lava)", "foso", 8.3355,
             33.222, LROC_PITS, _PIT + "Mare Tranquillitatis Pit, 8.3355, 33.222; 105 m de profundidad interior."),
    _np_site("foso_mare_ingenii", "Foso de Mare Ingenii (posible tubo de lava, cara oculta)", "foso", -35.9494,
             166.0559, LROC_PITS, _PIT + "Mare Ingenii Pit, -35.9494, 166.0559."),
]


def moon_site_tiles(site: dict, spacing_km: float = 10, n: int = 3) -> list[dict]:
    """Como mars_site_tiles, pero en la esfera lunar (para los sitios fuera del polo)."""
    offs = _offsets(n * spacing_km, spacing_km)
    out = []
    for y in reversed(offs):
        for x in offs:
            lat, lon = _aeqd_inverse(site["lat"], site["lon"], x, y, MOON_R_KM)
            out.append(dict(id=f"{site['id']}_t{len(out)}", lat=round(lat, 5), lon=round(lon, 5),
                            group=site["group"], site=site["id"], spacing_km=spacing_km, east_km=x, north_km=y,
                            source_url=site["source_url"],
                            source=f"ventana {len(out)} de {n}×{n} (paso {spacing_km:g} km) alrededor de {site['id']}"))
    return out


MARS_SITES: list[dict] = [
    dict(
        id="viking1", name="Viking 1 (Chryse Planitia)", group="aterrizaje",
        lat=22.269, lon=-47.951, hirise_category="Impact terrain", verified=True,
        why="Primer aterrizaje con éxito de EE. UU. en Marte (1976), en las llanuras de Chryse Planitia.",
        source_url="https://ode.rsl.wustl.edu/mars/pagehelp/Content/Missions_Instruments/Landing_Sites.htm",
        source_note="La página ODE (Nodo de Geociencias del PDS) da 'Viking Lander 1: 22.269° N, 312.049° E'. No dice si la latitud es planetocéntrica (ODE trabaja normalmente en planetocéntrica con longitud este). La longitud se pasó de 0-360 a -180..180: 312.049-360 = -47.951."),
    dict(
        id="viking2", name="Viking 2 (Utopia Planitia)", group="aterrizaje",
        lat=47.668, lon=134.28, hirise_category="Ice & polar terrain", verified=True,
        why="Aterrizaje de 1976 en latitudes medias del norte, en Utopia Planitia (llanura con hielo estacional).",
        source_url="https://ode.rsl.wustl.edu/mars/pagehelp/Content/Missions_Instruments/Landing_Sites.htm",
        source_note="ODE: 'Viking Lander 2: 47.668° N, 134.280° E'. No hizo falta convertir. La página no dice el sistema de latitud."),
    dict(
        id="mars_pathfinder", name="Mars Pathfinder / Sojourner (Ares Vallis)", group="aterrizaje",
        lat=19.095, lon=-33.253, hirise_category="Valleys & fans", verified=True,
        why="Aterrizaje de 1997 en la desembocadura del canal de inundación Ares Vallis, sobre Chryse Planitia.",
        source_url="https://ode.rsl.wustl.edu/mars/pagehelp/Content/Missions_Instruments/Landing_Sites.htm",
        source_note="ODE: 'Pathfinder: 19.095° N, 326.747° E'. Longitud convertida: 326.747-360 = -33.253."),
    dict(
        id="spirit_gusev", name="Spirit (cráter Gusev)", group="aterrizaje",
        lat=-14.5692, lon=175.4729, hirise_category="Impact terrain", verified=True,
        why="Lugar de aterrizaje del rover MER-A Spirit (2004) en el cráter Gusev, un posible paleolago.",
        source_url="https://ode.rsl.wustl.edu/mars/pagehelp/Content/Missions_Instruments/Landing_Sites.htm",
        source_note="ODE da dos soluciones. Uso la triangulación cartográfica: '14.5692° S, 175.4729° E'. La solución Doppler es 14.571892° S, 175.47848° E. Sin conversión de longitud."),
    dict(
        id="meridiani", name="Opportunity (Meridiani Planum, cráter Eagle)", group="aterrizaje",
        lat=-1.9462, lon=-5.5266, hirise_category="Ridges & layered terrain", verified=True,
        why="Lugar de aterrizaje del rover MER-B Opportunity (2004) en Meridiani Planum, llanura con hematita y sulfatos.",
        source_url="https://ode.rsl.wustl.edu/mars/pagehelp/Content/Missions_Instruments/Landing_Sites.htm",
        source_note="ODE, triangulación cartográfica: '1.9462° S, 354.4734° E'. La solución Doppler es 1.9483° S, 354.47417° E. Longitud convertida: 354.4734-360 = -5.5266."),
    dict(
        id="phoenix", name="Phoenix (Vastitas Borealis, llanuras polares del norte)", group="polar",
        lat=68.22, lon=-125.75, hirise_category="Ice & polar terrain", verified=True,
        why="Aterrizaje de 2008 en las llanuras árticas con suelo poligonal. Confirmó hielo de agua a pocos centímetros de la superficie.",
        source_url="https://ode.rsl.wustl.edu/mars/pagehelp/Content/Missions_Instruments/Landing_Sites.htm",
        source_note="ODE: 'Phoenix: 68.22° N, 234.25° E'. Longitud convertida: 234.25-360 = -125.75. Solo dos decimales en la fuente."),
    dict(
        id="gale", name="Curiosity, Bradbury Landing (cráter Gale)", group="aterrizaje",
        lat=-4.589467, lon=137.441633, hirise_category="Ridges & layered terrain", verified=True,
        why="Lugar de aterrizaje del rover MSL Curiosity (2012) en Aeolis Palus, dentro del cráter Gale, al pie de Aeolis Mons (Mount Sharp).",
        source_url="https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json",
        source_note="Primer punto (sol 3, site 2, drive 0) del GeoJSON oficial de recorrido de NASA/JPL: lon 137.441633, lat -4.589467. Ya está en longitud este -180..180. Concuerda con ODE ('MSL Gale (Curiosity): 4.59° S, 137.44° E'). El archivo no indica el datum de latitud, pero la cartografía de MSL es planetocéntrica."),
    dict(
        id="elysium", name="InSight (Elysium Planitia)", group="aterrizaje",
        lat=4.502384, lon=135.623447, hirise_category="Volcanic terrain", verified=True,
        why="Aterrizaje de 2018 de la estación geofísica InSight en un cráter degradado y arenoso de Elysium Planitia.",
        source_url="https://doi.org/10.1029/2020EA001248",
        source_note="Golombek et al. (2020), Earth and Space Science, 'Location and Setting of the Mars InSight Lander, Instruments, and Landing Site'. Leí el resumen vía la API de Europe PMC (PMC7583488): 'The lander is located at 4.502384°N, 135.623447°E', en un sistema 'positive east, planetocentric'. Sin conversión."),
    dict(
        id="jezero", name="Perseverance, Octavia E. Butler Landing (cráter Jezero)", group="aterrizaje",
        lat=18.44462715, lon=77.45088572, hirise_category="Valleys & fans", verified=True,
        why="Lugar de aterrizaje del rover Mars 2020 Perseverance (2021) en el cráter Jezero, un antiguo lago con delta.",
        source_url="https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json",
        source_note="Primer punto del GeoJSON oficial de recorrido de NASA/JPL (sol 13, site 3, drive 0, dist_total_m 0, 'Site increment, no motion'): lon 77.45088572, lat 18.44462715. Es la posición antes del primer movimiento, que figura en sol 14. Ya está en longitud este. No encontré un documento de NASA que dé '18.4447N 77.4508E' de forma explícita; esa cifra solo aparece en Wikipedia."),
    dict(
        id="utopia", name="Zhurong / Tianwen-1 (Utopia Planitia sur)", group="aterrizaje",
        lat=25.066, lon=109.925, hirise_category="Impact terrain", verified=True,
        why="Aterrizaje chino de 2021 en el sur de Utopia Planitia, cerca del límite de la dicotomía y de posibles líneas de costa antiguas.",
        source_url="https://www.nature.com/articles/s41550-021-01519-5",
        source_note="Liu, Li, Zhang et al. (2022), Nature Astronomy, 'Geomorphic contexts and science focus of the Zhurong landing site on Mars': 'the Zhurong rover landed at 109.925° E, 25.066° N at an elevation of −4,099.4 m'. El artículo no dice si la latitud es planetocéntrica, aunque así lo indica el uso de la longitud este. Sin conversión."),
    dict(
        id="ez_arcadia_phlegra_dorsa", name="EZ Arcadia Planitia – Phlegra Dorsa (Barker et al.)", group="llanura_hielo",
        lat=39, lon=172, hirise_category="Ice & polar terrain", verified=True,
        why="Base sostenible propuesta en una llanura de latitudes medias del norte con alto contenido de agua (hielo somero) para ISRU.",
        source_url="https://www.hou.usra.edu/meetings/explorationzone2015/pdf/1002.pdf",
        source_note="Resumen #1002 del taller EZ 2015 (Barker, James, Chamitoff, Clifford): 'a Landing Site (LS) located in Arcadia Planetia, along the Phlegra Dorsa, at 39°N 172°E'. La fuente no indica el sistema de latitud. Valores redondeados a grados enteros."),
    dict(
        id="ez_erebus_montes", name="EZ Erebus Montes (Arcadia/Amazonis, Viola et al.)", group="llanura_hielo",
        lat=39, lon=-167.9, hirise_category="Ice & polar terrain", verified=True,
        why="Zona de latitud media con hielo excedente cerca de la superficie, sobre coladas amazónicas. Es la latitud más baja con hielo somero conocido.",
        source_url="https://www.hou.usra.edu/meetings/explorationzone2015/pdf/1011.pdf",
        source_note="Resumen #1011 (Viola, McEwen, Dundas): 'Erebus Montes: This proposed site is centered near 192.1°E, 39.0°N'. Longitud convertida: 192.1-360 = -167.9. El mismo resumen propone una segunda EZ, Acheron Fossae, en 220.6°E, 39.8°N (-139.4). La fuente no indica el sistema de latitud."),
    dict(
        id="ez_deuteronilus_mensae", name="EZ Dichotomy Boundary Deuteronilus Mensae (Head et al.)", group="llanura_hielo",
        lat=39.11, lon=23.199, hirise_category="Ice & polar terrain", verified=True,
        why="Zona en el límite de la dicotomía con mesas, glaciares cubiertos de detritos y hielo masivo detectado por SHARAD, accesible para ISRU.",
        source_url="https://www.hou.usra.edu/meetings/explorationzone2015/pdf/1033.pdf",
        source_note="Resumen #1033 (Head et al.): 'The Dichotomy Boundary Deuteronilus Mensae (DBDM) Exploration Zone (EZ) (39.11° N, 23.199° E)'. Sin conversión. Otra EZ en la misma región es la #1044 de Plaut, con un mapa de 20–24°E y 40–42°N. La fuente no indica el sistema de latitud."),
    dict(
        id="ez_protonilus_mensae", name="EZ Protonilus Mensae (Gallegos y Newsom)", group="llanura_hielo",
        lat=42.187, lon=48.062, hirise_category="Ice & polar terrain", verified=True,
        why="Terreno fragmentado (fretted) con relleno de valle lineado y hielo, al este del cráter Moreux, en el límite de la dicotomía.",
        source_url="https://www.hou.usra.edu/meetings/explorationzone2015/pdf/1053.pdf",
        source_note="Resumen #1053: 'The proposed EZ (48.062E, 42.187N) is in the Protonilus Mensae region'. Sin conversión. La fuente no indica el sistema de latitud."),
    dict(
        id="ez_hebrus_valles", name="EZ Hebrus Valles (Davila et al.)", group="canon",
        lat=20.0833, lon=126.6333, hirise_category="Valleys & fans", verified=True,
        why="Tramo medio de un canal de inundación con contactos geológicos, posible hielo remanente y cavidades subterráneas que servirían de refugio.",
        source_url="https://www.hou.usra.edu/meetings/explorationzone2015/pdf/1012.pdf",
        source_note="Resumen #1012: 'centered at 20°05' N, 126°38' E'. Paso de grados y minutos a decimal: 20+5/60 = 20.0833 y 126+38/60 = 126.6333. La fuente no indica el sistema de latitud."),
    dict(
        id="ez_jezero_syrtis_isidis", name="EZ Jezero – Syrtis Major – Isidis (Mustard et al.)", group="crater",
        lat=17.747, lon=77.037, hirise_category="Valleys & fans", verified=True,
        why="Cuenca de Jezero con delta y su contacto con Isidis y las lavas de Syrtis Major. Tiene minerales hidratados como recurso.",
        source_url="https://www.hou.usra.edu/meetings/explorationzone2015/pdf/1034.pdf",
        source_note="Resumen #1034: 'The center of the Exploration Zone is 17.747° N 77.037° E'. Sin conversión. El centro de la EZ está a unos 0,7° al suroeste del lugar de aterrizaje de Perseverance."),
    dict(
        id="ez_mawrth_vallis", name="EZ Mawrth Vallis (Horgan et al.)", group="barrancos",
        lat=24.3, lon=-19.2, hirise_category="Ridges & layered terrain", verified=True,
        why="Meseta junto al canal Mawrth Vallis con el mayor afloramiento de rocas ricas en arcillas de Marte. Agua extraíble de los filosilicatos.",
        source_url="https://www.hou.usra.edu/meetings/explorationzone2015/pdf/1009.pdf",
        source_note="Resumen #1009: 'The plateau above the Mawrth Vallis outflow channel near 340.8°E, 24.3°N'. Longitud convertida: 340.8-360 = -19.2. Aviso: el texto da la ubicación aproximada de la meseta y no la llama explícitamente 'centro de la EZ'."),
    dict(
        id="ez_columbus_crater", name="EZ cráter Columbus (Terra Sirenum, Lynch y Wray)", group="crater",
        lat=-29, lon=-166, hirise_category="Impact terrain", verified=True,
        why="Paleolago alimentado por agua subterránea, con gran diversidad de depósitos acuosos (sulfatos, arcillas) en las tierras altas del sur.",
        source_url="https://www.hou.usra.edu/meetings/explorationzone2015/pdf/1041.pdf",
        source_note="Resumen #1041: 'located in the northwest region of Terra Sirenum (29° S, 166° W)'. La fuente usa longitud oeste: 166°W = -166° este. Son las coordenadas del cráter (110 km de diámetro), redondeadas a grados enteros. El resumen sitúa la EZ/LS sobre el fondo del cráter, pero no da su centro exacto. La fuente no indica si la longitud oeste es planetográfica."),
    dict(
        id="ez_coprates_chasma", name="EZ Valles Marineris – Coprates Chasma occidental (Mojarro et al.)", group="canon",
        lat=-11.684, lon=-66.633, hirise_category="Ridges & layered terrain", verified=True,
        why="EZ dentro del sistema de cañones de Valles Marineris, sobre un bloque de falla basculado, con RSL y posible actividad acuosa subsuperficial.",
        source_url="https://www.hou.usra.edu/meetings/explorationzone2015/pdf/1036.pdf",
        source_note="Resumen #1036: 'centered atop an inferred tilted fault block ... in the western aspect of Coprates Chasma, 293.367°E -11.684°N'. Longitud convertida: 293.367-360 = -66.633. No sirve como sustituto de Ius Chasma: en el taller de 2015 no encontré ninguna EZ propia de Ius Chasma. Otra EZ de cañón es la de Melas Chasma oriental (#1007), cuyo texto extraído no daba coordenadas numéricas."),
    dict(
        id="ez_hellas_rim", name="EZ borde de Hellas (Levy y Holt)", group="llanura_hielo",
        lat=-39.05, lon=101.91, hirise_category="Ice & polar terrain", verified=True,
        why="Borde oriental de la cuenca de impacto Hellas, con cráteres antiguos, canales de agua y abundante hielo (glaciares cubiertos de detritos), en latitudes medias del sur.",
        source_url="https://www.hou.usra.edu/meetings/explorationzone2015/pdf/1037.pdf",
        source_note="Resumen #1037: 'Located at 39.05° S, 101.91° E, the Hellas Rim EZ'. Sin conversión. Hay una EZ vecina de Rice et al. (#1038), 'centered near 40°S; 104°E'."),
    dict(
        id="candor_chasma_oeste_depositos_estratificados", name="Candor Chasma occidental: depósitos sedimentarios estratificados", group="canon",
        lat=-6.733, lon=-75.515, hirise_category="Ridges & layered terrain", verified=True,
        why="Interior de Valles Marineris con algunos de los depósitos estratificados de grano fino más gruesos de Marte, posiblemente alterados por agua subterránea (sulfatos); representa el relleno sedimentario de un cañón tectónico.",
        source_url="https://www.uahirise.org/ESP_026378_1730",
        source_note="Página HiRISE 'Sedimentary Layers in West Candor Chasma' (ESP_026378_1730): Latitude (centered) -6.733°, Longitude (East) 284.485°. Conversión oeste/este: 284.485 - 360 = -75.515. HiRISE ya da latitud planetocéntrica (comprobado: Gasa en HiRISE -35.729 coincide con el centro del Gazetteer -35.718; en planetográfica diferiría ~0.3°). Se elige este punto y no el centro del Gazetteer (-6.533, 289.221E, Candor Chasma mide 810 km) porque la ventana de 30 km debe caer sobre los depósitos estratificados."),
    dict(
        id="coprates_chasma_borde_norte", name="Coprates Chasma: borde norte y pared con fallas y capas", group="canon",
        lat=-12.836, lon=-60.085, hirise_category="Ridges & layered terrain", verified=True,
        why="Borde y pared del cañón de Valles Marineris con fallas expuestas y capas en las laderas: representa la pared escarpada de un gran cañón tectónico.",
        source_url="https://www.uahirise.org/PSP_005069_1670",
        source_note="Página HiRISE 'Exposed Faults in Coprates Chasma Wall' (PSP_005069_1670): Latitude (centered) -12.836°, Longitude (East) 299.915° → 299.915 - 360 = -60.085. El texto dice que muestra parte del borde norte de Coprates Chasma con fallas y capas en las laderas. Centro del Gazetteer (-13.365, 299.262E) no usado porque el accidente mide 958 km y el centro caería en el fondo."),
    dict(
        id="kasei_valles_isla_aerodinamica", name="Kasei Valles: canales en una isla aerodinámica", group="canon",
        lat=29.866, lon=-52.084, hirise_category="Valleys & fans", verified=True,
        why="Fondo de uno de los mayores canales de desagüe (outflow) de Marte, con islas aerodinámicas formadas por inundaciones catastróficas; análogo de los Channeled Scablands.",
        source_url="https://www.uahirise.org/ESP_075855_2100",
        source_note="Página HiRISE 'Channels on a Streamlined Island of Kasei Vallis' (ESP_075855_2100): Latitude (centered) 29.866°, Longitude (East) 307.916° → -52.084. El texto dice que son canales pequeños en el fondo de Kasei Valles, en el borde de sotavento de una isla aerodinámica. Gazetteer (centro 25.136, 297.122E, 1580 km de longitud) no usado por ser enorme."),
    dict(
        id="olympus_mons_flanco_norte_abanicos_lava", name="Olympus Mons: abanicos de lava en el flanco", group="volcan",
        lat=19.701, lon=-133.941, hirise_category="Volcanic terrain", verified=True,
        why="Flanco del mayor volcán en escudo del Sistema Solar, con canales de lava que pasan a abanicos; análogo de los flancos de volcanes en escudo hawaianos.",
        source_url="https://www.uahirise.org/PSP_002909_2000",
        source_note="Página HiRISE 'Fans of Lava Flows on the Flanks of Olympus Mons' (PSP_002909_2000): Latitude (centered) 19.701°, Longitude (East) 226.059° → -133.941. Está a ~1° al norte del centro del Gazetteer (18.653, 226.198E), es decir, sobre el flanco norte fuera de la caldera, como pide el tipo 'flanco'."),
    dict(
        id="arsia_mons_pozo_posible_caverna", name="Arsia Mons (NE): pozo candidato a entrada de caverna", group="volcan",
        lat=-5.532, lon=-118.604, hirise_category="Volcanic terrain", verified=True,
        why="Pozo oscuro sin borde ni eyecta en una llanura de lava al noreste de Arsia Mons, interpretado como posible entrada a una caverna o tubo de lava; análogo de tubos y pozos de colapso volcánicos terrestres.",
        source_url="https://www.uahirise.org/PSP_003647_1745",
        source_note="Página HiRISE 'Candidate Cavern Entrance Northeast of Arsia Mons' (PSP_003647_1745): Latitude (centered) -5.532°, Longitude (East) 241.396° → -118.604. Texto: punto muy oscuro en una llanura de lava polvorienta al noreste de Arsia Mons, sin borde elevado ni eyecta. Nota: la interpretación como caverna es discutida (otras fuentes lo consideran un pozo cilíndrico). El centro del Gazetteer de Arsia Mons (-8.257, 239.908E) caería en la caldera."),
    dict(
        id="pavonis_mons_sur_respiraderos", name="Llanuras al sur de Pavonis Mons: pequeños respiraderos eruptivos", group="volcan",
        lat=-5.493, lon=-114.358, hirise_category="Volcanic terrain", verified=True,
        why="Campo volcánico de Tharsis con pequeños respiraderos junto a escudos bajos; análogo de campos de escudos basálticos tipo Snake River Plain.",
        source_url="https://www.uahirise.org/ESP_056959_1745",
        source_note="Página HiRISE 'Small Eruptive Vents South of Pavonis Mons' (ESP_056959_1745, HiPOD 10 dic 2020): Latitude (centered) -5.493°, Longitude (East) 245.642° → -114.358. La página leída solo trae el título y metadatos (la descripción de respiraderos junto a escudos bajos proviene del resultado de búsqueda del HiPOD). Alternativa cercana verificada: 'En Echelon Fissure Vents South of Pavonis Mons' (ESP_035768_1730) -6.721°, 245.994°E."),
    dict(
        id="hale_borde_noroeste_barrancos", name="Cráter Hale: barrancos en el borde noroeste", group="barrancos",
        lat=-35.093, lon=-37.586, hirise_category="Valleys & fans", verified=True,
        why="Barrancos en la pared interior de un cráter joven de 137 km, con tributarios, canales sinuosos y abanicos similares a los formados por agua en la Tierra.",
        source_url="https://www.uahirise.org/ESP_014074_1445",
        source_note="Página HiRISE 'Gullies on the Northwest Rim of Hale Crater' (ESP_014074_1445): Latitude (centered) -35.093°, Longitude (East) 322.414° → -37.586. El centro del Gazetteer de Hale (-35.688, 323.638E, 137 km) caería en el fondo/pico central; por eso se usa el borde con barrancos."),
    dict(
        id="gasa_crater_barrancos_activos", name="Cráter Gasa: barrancos activos", group="barrancos",
        lat=-35.729, lon=129.386, hirise_category="Valleys & fans", verified=True,
        why="Cráter de ~7 km en latitudes medias del sur con barrancos que muestran depósitos nuevos (actividad estacional, posiblemente por escarcha de CO2).",
        source_url="https://www.uahirise.org/ESP_020661_1440",
        source_note="Página HiRISE 'Recent Gully Activity on Mars' (ESP_020661_1440): Latitude (centered) -35.729°, Longitude (East) 129.386° (ya en -180..180). Coincide con el centro del Gazetteer (Feature 14593: -35.7179, 129.3998E, diámetro 7.03 km), así que la ventana de 30 km abarca todo el cráter."),
    dict(
        id="newton_crater_interior_barrancos", name="Cráter sin nombre dentro de Newton: barrancos diversos", group="barrancos",
        lat=-40.807, lon=-159.791, hirise_category="Valleys & fans", verified=True,
        why="Cráter de ~7 km y ~700 m de profundidad dentro de Newton (Terra Sirenum) con sistemas de barrancos muy variados en sus paredes este y sur.",
        source_url="https://www.uahirise.org/PSP_001697_1390",
        source_note="Página HiRISE 'Gullies and... Gullies? in Terra Sirenum' (PSP_001697_1390): Latitude (centered) -40.807°, Longitude (East) 200.209° → -159.791. El texto dice que es un cráter sin nombre dentro del cráter Newton. Está dentro de los límites de Newton en el Gazetteer (lat -43.03 a -37.97, lon 198.64–205.30E). Alternativa: sitio RSL de Newton ESP_040491_1375 (-42.287, 202.200E)."),
    dict(
        id="tooting_crater", name="Cráter Tooting", group="crater",
        lat=23.207, lon=-152.2387, hirise_category="Impact terrain", verified=True,
        why="Uno de los cráteres más jóvenes de Marte de más de 20 km, con material picado (pitted) y eyecta lobulada; representa un cráter complejo fresco en Amazonis.",
        source_url="https://planetarynames.wr.usgs.gov/Feature/6059",
        source_note="Gazetteer of Planetary Nomenclature, Tooting (Feature 6059), leído del shapefile oficial MARS_nomenclature_center_pts (asc-planetarynames-data); el metadato dice latitud planetocéntrica y longitud positiva al este: center_lat 23.2070, center_lon 207.7613E → -152.2387; diámetro 27.86 km, por lo que el cráter cabe casi entero en la ventana de 30 km. HiRISE ESP_062934_2040 ('Pitted Material from Tooting Crater', 23.498, 207.567E) lo describe como uno de los cráteres más jóvenes >20 km."),
    dict(
        id="holden_crater_depositos_suroeste", name="Cráter Holden: depósitos estratificados bajo abanicos aluviales", group="crater",
        lat=-26.96, lon=-34.543, hirise_category="Valleys & fans", verified=True,
        why="Capas finas casi horizontales (con arcillas según CRISM) bajo abanicos aluviales en el sector suroeste del cráter: posible lago en un cráter.",
        source_url="https://www.uahirise.org/PSP_003077_1530",
        source_note="Página HiRISE 'A Closer Look at Holden Crater' (PSP_003077_1530): Latitude (centered) -26.960°, Longitude (East) 325.457° → -34.543. El texto dice que los depósitos afloran mejor en el sector suroeste, bajo abanicos aluviales. Centro del Gazetteer (-26.04, 325.981E, 153 km) no usado."),
    dict(
        id="eberswalde_delta", name="Cráter Eberswalde: delta", group="crater",
        lat=-23.835, lon=-33.619, hirise_category="Valleys & fans", verified=True,
        why="Delta bien conservado (~100 m de capas) con red distributaria, lóbulos y canales invertidos; análogo de deltas lacustres terrestres.",
        source_url="https://www.uahirise.org/PSP_001336_1560",
        source_note="Página HiRISE 'Delta Structure in Eberswalde Crater' (PSP_001336_1560): Latitude (centered) -23.835°, Longitude (East) 326.381° → -33.619. Eberswalde fue candidato de MSL, pero nunca hubo aterrizaje. Centro del Gazetteer: -23.975, 326.703E (62 km)."),
    dict(
        id="arcadia_planitia_crater_hielo", name="Arcadia Planitia: cráter nuevo que expuso hielo", group="llanura_hielo",
        lat=43.884, lon=-155.654, hirise_category="Ice & polar terrain", verified=True,
        why="Cráter reciente de 13 m que expuso hielo de agua somero en el interior y la eyecta: prueba directa de hielo enterrado a poca profundidad en llanuras de latitud media.",
        source_url="https://www.uahirise.org/ESP_025840_2240",
        source_note="Página HiRISE 'Mars Mysteries: Unveiling the Icy Craters' (ESP_025840_2240): Latitude (centered) 43.884°, Longitude (East) 204.346° → -155.654. El texto dice 'a 13-meter diameter crater in Arcadia Planitia where ice was exposed'. Está dentro de los límites de Arcadia Planitia en el Gazetteer (33.88–64.20N, 165.78–210.39E)."),
    dict(
        id="utopia_planitia_terreno_festoneado", name="Utopia Planitia: terreno festoneado y polígonos", group="llanura_hielo",
        lat=44.73, lon=88.485, hirise_category="Ice & polar terrain", verified=True,
        why="Depresiones festoneadas (scalloped) y polígonos en el manto rico en hielo; interpretadas como pérdida de hielo por sublimación o termokarst, análogo del permafrost terrestre.",
        source_url="https://www.uahirise.org/PSP_002070_2250",
        source_note="Página HiRISE 'Scallop and Polygonal Features in Utopia Planitia' (PSP_002070_2250): Latitude (centered) 44.730°, Longitude (East) 88.485° (ya en -180..180). El texto dice que en Utopia el terreno festoneado está entre 45 y 50°N. Alternativa: ESP_025620_2275 (47.067, 93.754E)."),
    dict(
        id="deuteronilus_mensae_lda", name="Deuteronilus Mensae: delantal de derrubios lobulado", group="llanura_hielo",
        lat=43.621, lon=28.618, hirise_category="Ice & polar terrain", verified=True,
        why="Delantal de derrubios lobulado (LDA) rodeando mesetas en la dicotomía; el radar SHARAD indica que está compuesto mayormente de hielo (glaciar cubierto de derrubios).",
        source_url="https://www.uahirise.org/ESP_016959_2240",
        source_note="Página HiRISE 'Lobate Debris Apron in Deuteronilus Mensae' (ESP_016959_2240): Latitude (centered) 43.621°, Longitude (East) 28.618° (ya en -180..180). Dentro de los límites de Deuteronilus Mensae en el Gazetteer (39.57–49.86N, 13.68–35.37E)."),
    dict(
        id="chasma_boreale_escarpe_npld", name="Cabecera de Chasma Boreale: depósitos estratificados del polo norte", group="polar",
        lat=84.41, lon=-16.505, hirise_category="Ice & polar terrain", verified=True,
        why="Escarpe donde afloran los depósitos estratificados polares del norte (hielo con polvo) sobre materiales oscuros con estratificación cruzada; análogo de los casquetes de hielo terrestres.",
        source_url="https://www.uahirise.org/PSP_001334_2645",
        source_note="Página HiRISE 'North Polar Layered Deposits in Head Scarp of Chasma Boreale' (PSP_001334_2645): Latitude (centered) 84.410°, Longitude (East) 343.495° → -16.505. Alternativa: 'Steepest Scarp in the North Polar Layered Deposits' (PSP_001550_2640) 83.821, 235.286E."),
    dict(
        id="planum_australe_spld", name="Planum Australe: afloramientos de los depósitos estratificados del polo sur", group="polar",
        lat=-84.219, lon=-130.852, hirise_category="Ice & polar terrain", verified=True,
        why="Afloramiento de capas de hielo de agua con polvo del casquete sur; la propia página HiRISE dice que su mejor análogo terrestre son los mantos de hielo de Groenlandia y la Antártida.",
        source_url="https://www.uahirise.org/PSP_004664_0955",
        source_note="Página HiRISE 'Outcrops of Layers in the South Polar Layered Deposits' (PSP_004664_0955): Latitude (centered) -84.219°, Longitude (East) 229.148° → -130.852. Centro del Gazetteer de Planum Australe: -83.35, 157.70E (1430 km), no usado."),
    dict(
        id="korolev_crater", name="Cráter Korolev", group="polar",
        lat=72.7677, lon=164.584, hirise_category="Ice & polar terrain", verified=True,
        why="Cráter de 81 km en alta latitud norte, relleno de un montículo de hielo de agua permanente; análogo de hielo atrapado en depresiones polares.",
        source_url="https://planetarynames.wr.usgs.gov/Feature/3091",
        source_note="Gazetteer, Korolev (Feature 3091), leído del shapefile oficial (planetocéntrica, este positivo): center_lat 72.7677, center_lon 164.584E (ya en -180..180); diámetro 81.37 km. El centro cae sobre el montículo de hielo que rellena el cráter. Cotejo HiRISE: 'Edge of Korolev Crater Ice Mound' (ESP_019248_2530) 72.912, 166.186E; 'Western Rim Region of Korolev Crater' (PSP_007961_2530) 72.899, 162.006E."),
    dict(
        id="medusae_fossae_yardangs", name="Medusae Fossae: yardangs", group="otro",
        lat=-1.488, lon=-163.641, hirise_category="Ridges & layered terrain", verified=True,
        why="Yardangs tallados por el viento en una roca blanda de grano fino (posible ceniza volcánica); análogos de los yardangs de desiertos terrestres.",
        source_url="https://www.uahirise.org/ESP_046504_1785",
        source_note="Página HiRISE 'Wind Carved Rock' (ESP_046504_1785): Latitude (centered) -1.488°, Longitude (East) 196.359° → -163.641. El texto dice que son yardangs en Medusae Fossae. Dentro de los límites del Gazetteer de Medusae Fossae (-6.04 a -1.39, 195.04–199.31E)."),
    dict(
        id="nili_patera_dunas_activas", name="Nili Patera: dunas y ripples activos", group="otro",
        lat=8.722, lon=67.345, hirise_category="Dunes", verified=True,
        why="Campo de dunas basálticas con migración medible de dunas y ripples dentro de una caldera; análogo de campos de dunas activos terrestres.",
        source_url="https://www.uahirise.org/ESP_028575_1890",
        source_note="Página HiRISE 'Continual Dune and Ripple Migration in Nili Patera' (ESP_028575_1890): Latitude (centered) 8.722°, Longitude (East) 67.345° (ya en -180..180). A ~0.3° del centro del Gazetteer de Nili Patera (8.969, 67.167E, 67.5 km)."),
    dict(
        id="aram_chaos_bloques_estratificados", name="Aram Chaos: bloques levantados de depósitos claros estratificados", group="otro",
        lat=2.262, lon=-19.921, hirise_category="Ridges & layered terrain", verified=True,
        why="Terreno caótico dentro de un cráter de 280 km con bloques de capas claras ricas en hematita y silicatos alterados por agua (antiguo lago), cerca del origen de Ares Vallis.",
        source_url="https://www.uahirise.org/ESP_054753_1825",
        source_note="Página HiRISE 'Uplifted Blocks of Light-Toned Layered Deposits' (ESP_054753_1825): Latitude (centered) 2.262°, Longitude (East) 340.079° → -19.921. Centro del Gazetteer de Aram Chaos: 2.523, 337.608E (-22.392); se usa el punto HiRISE porque cae sobre los bloques estratificados."),
    dict(
        id="mawrth_vallis_filosilicatos", name="Mawrth Vallis: filosilicatos", group="otro",
        lat=23.345, lon=-17.385, hirise_category="Ridges & layered terrain", verified=True,
        why="Región con arcillas (filosilicatos) formadas por alteración acuosa de las rocas; fue candidata a sitio de aterrizaje de MSL, pero nunca hubo aterrizaje.",
        source_url="https://www.uahirise.org/PSP_009616_2035",
        source_note="Página HiRISE 'Mawrth Vallis Phyllosilicates and Crater (MSL)' (PSP_009616_2035): Latitude (centered) 23.345°, Longitude (East) 342.615° → -17.385. El texto dice que la imagen está justo al este de la tercera elipse candidata de MSL y que la zona contiene minerales de arcilla. Centro del Gazetteer: 22.430, 343.027E."),
    dict(
        id="nili_fossae_llanuras_carbonatos", name="Nili Fossae: llanuras con carbonatos", group="otro",
        lat=21.731, lon=79.062, hirise_category="Ridges & layered terrain", verified=True,
        why="Parte del mayor depósito de rocas ricas en carbonatos conocido en Marte, asociado a olivino; análogo de serpentinización y carbonatación de rocas ultramáficas terrestres.",
        source_url="https://www.uahirise.org/ESP_032728_2020",
        source_note="Página HiRISE 'Proposed Site for Future Exploration in Nili Fossae Carbonate Plains' (ESP_032728_2020): Latitude (centered) 21.731°, Longitude (East) 79.062° (ya en -180..180). La página no tiene texto descriptivo; el contexto de los carbonatos viene del comunicado de NASA PIA19817, que cita esta observación (solo lo vi en resultados de búsqueda). Centro del Gazetteer de Nili Fossae: 22.018, 76.695E."),
]


# ---------------------------------------------------------------------------- geometría

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float, radius_km: float) -> float:
    """Distancia de círculo máximo en una esfera de radio `radius_km`."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * radius_km * math.asin(min(1.0, math.sqrt(h)))


def _aeqd_forward(lat0: float, lon0: float, lat: float, lon: float, radius_km: float) -> tuple[float, float]:
    """(lat, lon) -> (este, norte) en km en la azimutal equidistante centrada en (lat0, lon0)."""
    p0, p, dl = math.radians(lat0), math.radians(lat), math.radians(lon - lon0)
    cosc = max(-1.0, min(1.0, math.sin(p0) * math.sin(p) + math.cos(p0) * math.cos(p) * math.cos(dl)))
    c = math.acos(cosc)
    k = 1.0 if c < 1e-12 else c / math.sin(c)
    x = k * math.cos(p) * math.sin(dl)
    y = k * (math.cos(p0) * math.sin(p) - math.sin(p0) * math.cos(p) * math.cos(dl))
    return x * radius_km, y * radius_km


def _aeqd_inverse(lat0: float, lon0: float, east: float, north: float, radius_km: float) -> tuple[float, float]:
    """(este, norte) en km -> (lat, lon) en grados, lon en -180..180 (como terrain._aeqd_inverse)."""
    p0, l0 = math.radians(lat0), math.radians(lon0)
    rho = math.hypot(east, north)
    if rho == 0:
        return lat0, lon0
    c = rho / radius_km
    lat = math.asin(math.cos(c) * math.sin(p0) + north * math.sin(c) * math.cos(p0) / rho)
    lon = l0 + math.atan2(east * math.sin(c), rho * math.cos(p0) * math.cos(c) - north * math.sin(p0) * math.sin(c))
    return math.degrees(lat), (math.degrees(lon) + 180) % 360 - 180


def _in_bounds(lat: float, lon: float, b: dict | None) -> bool:
    if b is None or not (b["lat_min"] <= lat <= b["lat_max"]):
        return False
    if b["lon_min"] <= b["lon_max"]:
        return b["lon_min"] <= lon <= b["lon_max"]
    return lon >= b["lon_min"] or lon <= b["lon_max"]  # cruza el antimeridiano


def _bounds_area(b: dict) -> float:
    dlon = (b["lon_max"] - b["lon_min"]) % 360
    return dlon * (math.sin(math.radians(b["lat_max"])) - math.sin(math.radians(b["lat_min"])))


def regions_containing(lat: float, lon: float) -> list[str]:
    """Ids de las regiones lunares cuyos límites contienen el punto, de la más pequeña a la mayor."""
    hits = [r for r in MOON_REGIONS if _in_bounds(lat, lon, r["bounds"])]
    return [r["id"] for r in sorted(hits, key=lambda r: _bounds_area(r["bounds"]))]


def _offsets(extent_km: float, spacing_km: float) -> list[float]:
    """Centros de celdas de `spacing_km` que cubren un intervalo de `extent_km` centrado en 0."""
    n = max(1, math.ceil(extent_km / spacing_km - 1e-9))
    return [(i - (n - 1) / 2) * spacing_km for i in range(n)]


# ---------------------------------------------------------------------------- mallas

def moon_polar_grid(spacing_km: float, lat_limit: float = -84.0) -> list[dict]:
    """Malla cuadrada regular en la azimutal equidistante polar sur (x, y en km desde el polo,
    x = rho·sin(lon), y = rho·cos(lon), como moon_pole.py); conserva los puntos con lat <= lat_limit.
    Orden: fila 0 = y máxima, de oeste (x mínima) a este."""
    rho_max = math.radians(90 + lat_limit) * MOON_R_KM
    m = int(rho_max // spacing_km)
    src = f"malla regular generada (azimutal polar, paso {spacing_km:g} km, {-lat_limit:g}–90°S)"
    out = []
    for j in range(m, -m - 1, -1):
        for i in range(-m, m + 1):
            x, y = i * spacing_km, j * spacing_km
            rho = math.hypot(x, y)
            lat = -90 + math.degrees(rho / MOON_R_KM)
            if lat > lat_limit + 1e-9:
                continue
            lon = math.degrees(math.atan2(x, y)) if rho > 0 else 0.0
            regs = regions_containing(lat, lon)
            out.append(dict(id=f"malla{spacing_km:g}km_{len(out):04d}", lat=round(lat, 5), lon=round(lon, 5),
                            group="malla_polar", source=src, x_km=x, y_km=y, spacing_km=spacing_km,
                            region=regs[0] if regs else None, regions=regs))
    return out


def region_tiles(region: dict, spacing_km: float, max_extent_km: float | None = None) -> list[dict]:
    """Centros de ventanas de `spacing_km` que teselan los límites de una región lunar.

    Malla local azimutal centrada en el centro de la región; se conservan los centros que caen
    dentro del rectángulo lat/lon de los límites. Con `max_extent_km`, solo el cuadrado central de ese
    lado (alrededor del centro de la región). Sin límites: un único punto en el centro.
    Orden: fila 0 = norte, de oeste a este."""
    rid, b = region["id"], region["bounds"]
    base = dict(group=region["group"], region=rid, spacing_km=spacing_km, coord_quality=region["coord_quality"],
                source=f"teselas de {spacing_km:g} km dentro de los límites de {rid}", source_url=region["source_url"])
    if b is None:
        return [{"id": f"{rid}_t{spacing_km:g}km_00", "lat": region["lat"], "lon": region["lon"], **base,
                 "east_km": 0.0, "north_km": 0.0, "source": f"centro de {rid} (región sin límites publicados)"}]
    lat0, lon0 = region["lat"], region["lon"]
    if max_extent_km:
        xs = ys = _offsets(max_extent_km, spacing_km)
    else:  # extensión de los límites en la proyección local, muestreando el contorno
        pts = []
        for t in (k / 50 for k in range(51)):
            la = b["lat_min"] + t * (b["lat_max"] - b["lat_min"])
            lo = b["lon_min"] + t * ((b["lon_max"] - b["lon_min"]) % 360)
            pts += [(la, b["lon_min"]), (la, b["lon_max"]), (b["lat_min"], lo), (b["lat_max"], lo)]
        xy = [_aeqd_forward(lat0, lon0, la, lo, MOON_R_KM) for la, lo in pts]
        x0, x1 = min(p[0] for p in xy), max(p[0] for p in xy)
        y0, y1 = min(p[1] for p in xy), max(p[1] for p in xy)
        xs = [(x0 + x1) / 2 + o for o in _offsets(x1 - x0, spacing_km)]
        ys = [(y0 + y1) / 2 + o for o in _offsets(y1 - y0, spacing_km)]
    out = []
    for y in sorted(ys, reverse=True):
        for x in xs:
            lat, lon = _aeqd_inverse(lat0, lon0, x, y, MOON_R_KM)
            if _in_bounds(lat, lon, b):
                out.append({"id": f"{rid}_t{spacing_km:g}km_{len(out):02d}", "lat": round(lat, 5),
                            "lon": round(lon, 5), **base, "east_km": round(x, 3), "north_km": round(y, 3)})
    return out


def mars_site_tiles(site: dict, spacing_km: float = 10, n: int = 3) -> list[dict]:
    """n×n centros de ventanas en una malla local azimutal (esfera de Marte) centrada en el sitio.
    Orden: fila 0 = norte, de oeste a este; con n impar, la central es el propio sitio."""
    offs = _offsets(n * spacing_km, spacing_km)
    out = []
    for y in reversed(offs):
        for x in offs:
            lat, lon = _aeqd_inverse(site["lat"], site["lon"], x, y, MARS_R_KM)
            out.append(dict(id=f"{site['id']}_t{len(out)}", lat=round(lat, 5), lon=round(lon, 5),
                            group=site["group"], site=site["id"], hirise_category=site["hirise_category"],
                            spacing_km=spacing_km, east_km=x, north_km=y, source_url=site["source_url"],
                            source=f"ventana {len(out)} de {n}×{n} (paso {spacing_km:g} km) alrededor de {site['id']}"))
    return out


def all_moon_named() -> list[dict]:
    """MOON_REGIONS + MOON_SITES, sin los sitios que ya son el punto de una región (same_as_region)."""
    return MOON_REGIONS + [s for s in MOON_SITES if not s.get("same_as_region")]


def _summary() -> None:
    reg = Counter((r["group"], r["verified"]) for r in MOON_REGIONS)
    print(f"Luna: {len(MOON_REGIONS)} regiones")
    for (g, v), k in sorted(reg.items()):
        print(f"  {g:24s} {'verificadas' if v else 'NO verificadas':15s} {k}")
    print(f"Luna: {len(MOON_SITES)} sitios ({len(all_moon_named())} referencias con nombre sin duplicados)")
    for s in MOON_SITES:
        extra = f"  (= región {s['same_as_region']})" if s["same_as_region"] else ""
        print(f"  {s['id']:22s} {s['lat']:9.4f} {s['lon']:9.4f}{extra}")
    print(f"Marte: {len(MARS_SITES)} sitios")
    for g, k in sorted(Counter(s["group"] for s in MARS_SITES).items()):
        print(f"  {g:24s} {k}")
    for g, k in sorted(Counter(s["hirise_category"] for s in MARS_SITES).items()):
        print(f"  [{g}] {k}")
    for sp in (30, 10):
        grid = moon_polar_grid(sp)
        inreg = Counter(p["region"] for p in grid if p["region"])
        print(f"Malla polar {sp} km (84–90°S): {len(grid)} puntos; en regiones: {dict(inreg)}")
    print("Teselas por región (10 km | 5 km):")
    t10 = t5 = 0
    for r in MOON_REGIONS:
        a = len(region_tiles(r, 10))
        mx = 20 if r["id"] == "mons_mouton_plateau" else None
        b = len(region_tiles(r, 5, max_extent_km=mx))
        t10, t5 = t10 + a, t5 + b
        note = " (5 km: 20 km centrales)" if mx else ("" if r["bounds"] else " (sin límites: solo el centro)")
        print(f"  {r['id']:28s} {a:4d} | {b:4d}{note}")
    print(f"  {'total':28s} {t10:4d} | {t5:4d}")
    print(f"Marte, teselas 3×3 de 10 km: {sum(len(mars_site_tiles(s)) for s in MARS_SITES)}")


if __name__ == "__main__":
    _summary()
