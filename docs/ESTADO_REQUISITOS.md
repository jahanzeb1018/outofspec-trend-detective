# Estado de los requisitos de la especificación (docs/ESPECIFICACION_TECNICA_TRENES.md)

Leyenda: ✅ hecho · 🟡 hecho con una adaptación (explicada) · ⛔ no hecho (motivo) · 👥 depende del equipo

## Módulos (§5)

| ID | Estado | Dónde / nota |
|---|---|---|
| FR-HOME-1/2/3 | ✅ | `pages/Home.tsx`: animación 1981→2025→2041-60→2081-2100, pausa, respeta `prefers-reduced-motion`, 3+ botones, cifras del pipeline |
| FR-EXP-1…8 | ✅ | `pages/Explore.tsx`: 13 indicadores, Now/Trend/Future, FDR antes/después con punteado y recuento, panel de tramo con serie + Sen + IC + futuro + frase + estadística avanzada, línea de tiempo, "mismo proceso, riesgos opuestos", umbral 35-42 °C |
| FR-EXP-9 (MODIS) | ⛔ | Necesita cuenta Earthdata (AppEEARS). Queda como trabajo futuro |
| FR-DET-1…4 | ✅ | `pages/Detective.tsx`: 3 pasos, catálogo cerrado de 12 variables NASA, **POWER en vivo desde el navegador** (CORS comprobado) con caché IndexedDB y 8 lugares de respaldo |
| FR-DET-5 | 🟡 | Los ejemplos clásicos usan NASA POWER (MERRA-2/CERES) en vez de GPM/MODIS/GLDAS vía Giovanni/AppEEARS, que exigen Earthdata |
| FR-DET-6 | 🟡 | Selector de estación (año, DJF, MAM, JJA, SON) en lugar de Mann-Kendall estacional: también elimina el ciclo estacional |
| FR-ROUTE-1…6 | ✅ | `pages/Trip.tsx`: 24 trayectos precalculados (rutas más cortas sobre la topología de OSM), tira por km, probabilidad climatológica en la fecha, 3 tarjetas, tipo de vía por línea, URL compartible |
| FR-LAB-1…9 | ✅ | `pages/Lab.tsx` + `model/mc.worker.ts`: procedencia 🛰/👤/🗺, perfiles, T neutra (valor/rango/FRA), resistencia, carga-resistencia, BSM con bandas FRA, Monte Carlo en Web Worker, pregunta inversa y ventana calor↔frío, vía que se dobla, "Describe your track", caja de supuestos |
| FR-NET-1…6 | ✅ | `pages/Network2050.tsx`: escenario/periodo, 4 tarjetas, áreas apiladas 1981-2100, climas gemelos (mapa + lista), matriz antigüedad × calor, top-10 |
| FR-MET-1/2 | ✅ | `pages/Methods.tsx`: datos, estadística en dos niveles, modelos, validación, limitaciones, referencias, licencias, uso de IA, descargas, reproducción, glosario |
| FR-TOUR-1/2 | ✅ | 3 tours (ferrocarril, detective, tu viaje en julio) |
| FR-MGR-1…3 | ✅ | `pages/Manager.tsx`: CSV local; descarga todas las celdas para que las peticiones no revelen nada; exporta CSV |
| FR-UX-1/2/4 | ✅ | Glosario con tooltips, estados iniciales útiles, tabla de datos bajo cada gráfico |
| FR-UX-3 (ES/EN) | ⛔ | Interfaz solo en inglés (lo exigen las bases); el selector español no está hecho |

## Requisitos no funcionales (§6)

| ID | Estado | Nota |
|---|---|---|
| NFR-1 web estática desplegada | 👥 | Build listo + workflow de GitHub Pages. Falta crear el repositorio público y publicar (decisión del equipo) |
| NFR-2 rendimiento | ✅ | JS inicial 407 KB gzip (SDK de IA cargado bajo demanda); red 1,9 MB; series por celda bajo demanda |
| NFR-3 accesibilidad | 🟡 | aria-labels, foco visible, teclado, tablas alternativas, movimiento reducido. Lighthouse no medido |
| NFR-4 responsive | ✅ | Probado a 390 px sin scroll horizontal |
| NFR-5/6 reproducibilidad, determinismo | ✅ | `pipeline/run_all.py`, procedencia en cada JSON, Monte Carlo con semilla |
| NFR-7 robustez | ✅ | Sin IA → reglas; sin POWER → ejemplos offline |
| NFR-8 seguridad | ✅ | Ninguna clave en el repo; proxy opcional o clave en sessionStorage |
| NFR-9 licencias | ✅ | `LICENSE`, `DATA_LICENSES.md`, atribuciones en mapas |
| NFR-10 calidad | 🟡 | tsc estricto, 39 tests Vitest + 28 pytest en verde; sin ESLint configurado |

## Datos, modelos y validación (§7–§12, §17)

| Punto | Estado | Nota |
|---|---|---|
| NASA POWER (159 celdas, 1981-2025) | ✅ | |
| NEX-GDDP-CMIP6 | 🟡 | Sin Google Earth Engine: descarga recortada a España desde el servicio THREDDS de NASA NCCS (mismo dataset). 6 modelos (incl. GISS-E2-1-G de NASA), SSP2-4.5 y SSP5-8.5 |
| Red ferroviaria | 🟡 | El servicio WFS de Adif bloquea descargas automáticas (HTTP 403): se usa OpenStreetMap (13.426 km tras quitar vías paralelas). Las líneas de ancho métrico etiquetadas como `narrow_gauge` en OSM no están incluidas |
| Años de apertura | 🟡 | Tabla de 16 líneas de alta velocidad con enlace a la fuente pública; las convencionales se agrupan. ⚠️ Revisar cada año contra su fuente antes de presentar |
| Estadística (Sen, MK Hamed-Rao, OLS, BH-FDR, años necesarios) | ✅ | Variante conservadora de Hamed-Rao: el test original daba un 10 % de falsos positivos con ruido blanco (n = 45); la conservadora da un 5 % |
| Modelo de temperatura del carril v0/v1 | ✅ | v1 con anclaje en días ≥35 °C (G_ref 847 W/m², v_ref 2,07 m/s) |
| Modelo de pandeo FRA | ✅ | Curvatura solo como aviso cualitativo (no se extrajo la tabla de curvas del informe) |
| Validación con estaciones (NOAA GHCN-Daily) | ✅ | 10 estaciones, r diario 0,95–0,99 |
| Histórico de modelos vs MERRA-2 | ✅ | Los modelos calientan más que MERRA-2 en 1981–2014: se explica en Métodos |
| FRA T109 | ✅ | 262 descarrilamientos (2011–2025): percentil mediano 84; 40 % por encima del P90 (10 % esperado por azar) |
| Giovanni | ⛔👥 | Requiere cuenta Earthdata. Script listo: `pipeline/validate/giovanni_check.py` |
| KNMI Climate Explorer | ⛔ | Opcional; no usado |

## IA (§15)

| Punto | Estado | Nota |
|---|---|---|
| Ask / Explain / Describe your track | ✅ | Claude (`claude-opus-5-5`) con herramientas sobre catálogo cerrado, fallbacks de servidor, esfuerzo bajo; modo por reglas sin clave |
| Proxy serverless | 🟡👥 | `proxy/worker.js` (Cloudflare) escrito, sin desplegar |
| `strict: true` en herramientas | ⛔ | Las entradas se validan con Zod en el tool runner |
| Modo SI probado contra la API real | ⛔👥 | Sin clave disponible aquí; el modo por reglas sí está probado |

## Entrega (§19)

👥 Nombre del proyecto, vídeo de ≤30 s, diapositivas y texto honesto de uso de IA: borradores en `SUBMISSION.md` y `SI_DISCLOSURE.md`.
