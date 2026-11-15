# Especificación técnica completa — NASA Space Apps 2026 · «Be An Earth System Trend Detective!»
## Proyecto: detective de tendencias climáticas con la red ferroviaria española como caso estrella

> **Cómo usar este documento:** pásalo entero a la IA o al equipo que va a construir el proyecto. Contiene las bases del hackathon, el texto oficial del reto con todos sus recursos, la especificación funcional y técnica de cada módulo, los datos (con endpoints y licencias), los modelos científicos (estadística, temperatura del carril, pandeo y proyecciones futuras), la arquitectura, el plan de trabajo, los textos de entrega y las pruebas de aceptación.
>
> **Leyenda:** ✓ = verificado en la fuente (13–14 nov 2026) · ⚠️ = pendiente de verificar o decisión del equipo · **[MUST]** obligatorio · **[SHOULD]** muy recomendable · **[COULD]** extra si da tiempo.

---

## Índice

0. Instrucciones para quien construye
1. Bases del hackathon
2. El reto (texto oficial y recursos)
3. Visión del producto
4. Trazabilidad: requisitos del reto → funcionalidades → prueba para el jurado
5. Requisitos funcionales por módulo
6. Requisitos no funcionales
7. Datos: fuentes, variables, accesos y licencias
8. Indicadores climáticos
9. Estadística de tendencias
10. Proyecciones futuras (NEX-GDDP-CMIP6)
11. Modelo de temperatura del carril
12. Modelo de pandeo (basado en la FRA)
13. Procesado geográfico de la red
14. Arquitectura, repositorio y esquemas de datos
15. Módulo de IA («SI»)
16. Diseño visual e interfaz
17. Validación científica y pruebas
18. Plan de trabajo y roles
19. Entrega: formulario, vídeo y diapositivas
20. Lista de puntuación máxima
21. Riesgos y mitigaciones
22. Glosario
23. Referencias
24. Primera respuesta esperada de la IA constructora

---

## 0. Instrucciones para quien construye

Actúa como un equipo senior con cinco roles: científico de datos climáticos, ingeniero de datos, desarrollador front-end, ingeniero ferroviario (modelo de pandeo) y diseñador de producto y narrativa.

**Reglas que no se pueden romper:**

1. **No inventes datos, cifras, citas ni referencias.** Si algo no está marcado ✓ aquí y no lo puedes comprobar en la fuente, márcalo «por verificar» y no lo pongas en la interfaz ni en el pitch.
2. **Todo número que muestre la app sale del pipeline** a partir de datos reales: de NASA, o de los parámetros de modelo citados en este documento. Nada escrito a mano en la interfaz.
3. **Interfaz, formulario, diapositivas y vídeo en inglés.** Si el vídeo se graba en español, lleva subtítulos en inglés. El código y los comentarios, en inglés.
4. **El concepto de este documento lo ha definido el equipo.** Tú implementas y propones mejoras técnicas; las decisiones de producto las toma el equipo. Todo uso de IA se declara con honestidad (§19.6).
5. **Sin logos ni marcas** de NASA, Adif, Renfe, SNCF ni FRA. Sin imágenes de menores. Las imágenes o vídeos generados con IA llevan marca de agua visible.
6. **Prudencia:** no digas que un tramo «es peligroso» ni atribuyas accidentes reales al clima. La herramienta mide **peligro climático** y **margen térmico en escenarios definidos por el usuario**; no evalúa la seguridad de ninguna línea real.
7. **Funciona sin servidor:** datos precalculados y web estática desplegada. Lo único en vivo (POWER para cualquier punto e IA) tiene que tener un modo de respaldo.
8. **Entregas incrementales:** primero una versión mínima completa de punta a punta, desplegada y probada en ventana privada. Después, los extras, por orden de prioridad (§18).

---

## 1. Bases del hackathon (oficiales, 2026) ✓

Fuentes: Judging & Awards Guide, Project Submission Guide y Participant FAQs (spaceappschallenge.org).

### 1.1 Calendario
- Hackathon: **sábado 14 y domingo 15 de noviembre de 2026**.
- Envío: abre el 14 nov a las 9:00 y cierra el **15 nov a las 23:59, hora local de la sede**. ⚠️ Confirmar en la sede y enviar **con horas de margen**.
- Fases:
  - nominados globales el 3 dic 2026;
  - finalistas el 17 dic 2026;
  - ganadores el 26 ene 2027.
- No se puede trabajar en el reto antes del hackathon.

### 1.2 Equipo
- Máximo 6 personas, todas inscritas en la misma sede local.
- No se pueden añadir miembros después del cierre.

### 1.3 Campos del formulario (en inglés)
1. Project Name
2. High-Level Project Summary
3. Link to Project Demo
4. Link to Final Project
5. Detailed Project Description
6. **Use of Super Intelligence (SI)**
7. **NASA Data**: al menos un dato o recurso de NASA es obligatorio para optar a premios globales.
8. Space Agency Partner Data and Other References: todo lo usado, aunque sea abierto (datos, código, librerías, imágenes).

Se recomienda mucho usar datos de agencias socias, entre ellas **ESA**, **JAXA** y la **Agencia Espacial Española**.

### 1.4 Demo (obligatoria)
- **Vídeo de 30 s como máximo** o **7 diapositivas como máximo** (incluidas la portada y la introducción).
- **Si se supera, el proyecto queda fuera de la fase global.**
- Enlace público sin login (YouTube, Drive, GitHub…). Probarlo en ventana privada.

### 1.5 Reglas sobre IA ("SI")
- Permitido usarla para acelerar: código, análisis o un chatbot dentro del producto.
- **Prohibido usarla para generar la idea central.**
- Lo generado con IA se declara.
- Imágenes y vídeos generados con IA: marca de agua visible.
- Sin marcas de NASA en contenido generado.
- Los jueces no ven el campo SI del formulario, pero **sí ven los indicadores de IA dentro del proyecto**.

### 1.6 Criterios (1–5 cada uno, mismo peso)

| Criterio | Qué significa un 5 |
|---|---|
| Impact | Problema significativo, gran alcance |
| Creativity | Enfoque nuevo o mejora significativa de ideas existentes |
| Validity | Totalmente desarrollado, científicamente sólido, listo para usarse y **fácil de usar** |
| Relevance | Responde al reto y **los datos de NASA son parte integral** |
| Presentation | Comunicación excepcional; se juzgan la demo y el proyecto |

**Premios objetivo:** Best Use of Data, Best Use of Science, Galactic Impact, Best Storytelling y Local Impact.

---

## 2. El reto: «Be An Earth System Trend Detective!» ✓

Página oficial: https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/

### 2.1 Background (texto oficial)
> Instruments on satellites observe many different aspects of the Earth system: on land, in the atmosphere, and in the oceans. Global models also use satellite instrument data and other kinds of data to examine and analyze the Earth system. One important reason for doing this is to observe and characterize changes in the Earth system. Changes, especially those moving in a particular direction over time – a trend – indicate both the processes causing such changes and the processes that will respond to them.
> One complicating factor in this work is the wide variety of variables that can be studied. Another is that changes in a particular variable can move in one direction in one region and in the opposite direction in another, even when both trends are caused by the same process! So there are two important parts to this problem: finding variables that are trending, from simple ones like temperature and rainfall to more complex ones like evaporation or streamflow; and analyzing trends in particular regions of the land, ocean, or even levels of the atmosphere.
> Instruments such as the Moderate Resolution Imaging Spectroradiometer (MODIS), the Ozone Monitoring Instrument (OMI), the Atmospheric Infrared Sounder (AIRS), and the Global Precipitation Measurement (GPM) provide analyzable variables. Global models – notably the Modern Era Retrospective analysis for Research and Applications, Version 2 (MERRA-2) and the Global Land Data Assimilation System (GLDAS) – provide many more. Finding, analyzing, and relating significant trends to the processes causing them is one of the most important uses of NASA Earth science data.

### 2.2 Objectives (texto oficial)
> A successful response to this challenge will bring together several important elements.
> The first is to identify Earth science variables of interest that can be investigated for potential trends. As the Background notes, NASA and other space agencies offer numerous variables, some familiar and some more specialized for use by particular branches of science.
> The second is to acquire the data variables for a particular region, since most trends in the data will not be global – though some trends can be!
> The third is to generate and visualize a time series for the variable and region of interest over a long enough period of time to allow statistical analysis.
> The final element of the challenge is to perform a basic statistical analysis of that time series, indicating the rate of change over time, and to test the trend's significance using methods such as a t-test, the Mann-Kendall test, or confidence intervals.
> Data sites offer tools that generate time series, and statistical analysis packages provide basic significance testing. A response that does both the visualization and the analysis meets the full scope of this challenge.

### 2.3 Potential Considerations (texto oficial)
> **Audience** — This challenge involves science data and statistical analysis, so the likely audience is high school and college students, along with members of the public who have some scientific background. Providing simple definitions of the variables would help these users considerably. The concept is to help the users become data detectives – finding variables of interest, then determining whether those variables show a trend and whether that trend is significant.
> **Approach** — Users could potentially respond to a short series of questions about what or where they would like to investigate, and then the answers to the questions would allow searching of related data variables. It would be highly useful to provide a couple of demonstration examples that the user could watch and would help them understand how the tool works. While not required, SI could be useful here to identify data with the potential to show trends in particular areas, drawing on either news articles and research papers or the characteristics of a region such as a desert, rain forest, tidal estuary, or the atmosphere above a large city.
> **Working with the data** — Earth science data are available at several different temporal resolutions – hourly, 3-hourly, daily, and monthly. For this challenge, daily and monthly data are likely the easiest to process. Finding a trend is interesting even if it doesn't reach the level of significance. Sometimes all a trend needs to become significant is a longer period for the data to be acquired. Consider looking for publicly available tools for plotting hydrological data offered by outside organizations like the Consortium of Universities for the Advancement of Hydrologic Science, Inc. (CUAHSI).
> Trend analysis with Earth science data can be complex. Trends can be non-linear, and some are not evident unless regular cycles, such as the seasonal cycle, are removed. More complex trend analyses are beyond the scope envisioned for this challenge; detecting and analyzing linear trends would be a great start.

### 2.4 Recursos oficiales del reto (pestaña Resources) ✓

**NASA Data & Resources**

| Recurso | Uso en el proyecto | URL |
|---|---|---|
| Giovanni | Validación cruzada de series (MERRA-2) y series de ejemplo del modo detective (GPM, MODIS, AIRS, OMI) | https://giovanni.gsfc.nasa.gov/ |
| Hydrology Time Series (GES DISC) | Series hidrológicas (GLDAS) para ejemplos de evaporación o humedad del suelo | https://disc.gsfc.nasa.gov/information/tools?title=Hydrology%20Time%20Series |
| AppEEARS | Extracción de MODIS LST o NDVI en puntos y áreas (requiere cuenta Earthdata) | https://appeears.earthdatacloud.nasa.gov/ |
| Climate Data Online (NOAA) | Estaciones GHCN-Daily para validar MERRA-2 en España | https://www.ncei.noaa.gov/cdo-web/ |
| Time-Series Analysis of SeaWiFS Chlorophyll… (NTRS) | Referencia metodológica de series y significancia; citar en Methods | https://ntrs.nasa.gov/api/citations/20090042747/downloads/20090042747.pdf |

**Space Agency Partner Resources**

| Recurso | Uso | URL |
|---|---|---|
| KNMI Climate Explorer | Contraste de tendencias o proyecciones en 1–2 puntos (opcional) | https://climexp.knmi.nl/ |
| Statistical test methods to detect trends… | Lectura de apoyo (pruebas de tendencia) | https://medium.com/@snp.kriss/statistical-test-methods-to-detect-trends-in-time-series-data-b361a0ec530b |
| A Comprehensive Guide to Statistical Significance | Lectura de apoyo (significancia) | https://www.statsig.com/perspectives/a-comprehensive-guide-to-statistical-significance |
| CSA: RCM, Geo.ca, SWOT, ecosistemas, tutorial SAR | No aplican al caso ferroviario; no hace falta usarlos | (ver la página del reto) |

**Regla:** cita en Methods y en References todos los recursos oficiales que uséis de verdad (como mínimo Giovanni y, si se usan, AppEEARS y CDO).

---

## 3. Visión del producto

### 3.1 Nombre
⚠️ **Lo decide el equipo.** Nombre de trabajo: **OutOfSpec**, con el lema *"Railways built for a climate that no longer exists."* Guarda el nombre y el lema en una sola constante (`APP_NAME`, `APP_TAGLINE`).

### 3.2 Problema
- La vía de carril soldado se diseña y se mantiene para el clima de cada zona: Adif asigna temperaturas de neutralización por zonas, algunas de ~50 km, con valores actualizados hasta 2019 ✓ (Público, 2022).
- Si el clima de la zona cambia, ese diseño puede quedarse desfasado.
- Eso es un problema de **detección de tendencias**: qué variable cambia, dónde, cuánto, si es significativo y qué viene después.

### 3.3 Propuesta de valor
Una herramienta abierta que:
1. permite a **cualquiera** detectar tendencias en variables de NASA para cualquier región (lo que pide el reto);
2. aplica ese método a la **red ferroviaria española** para mostrar:
   - dónde ha cambiado el clima relevante para la vía;
   - cómo afecta a **tu trayecto**;
   - cuánto **margen térmico** le queda a una vía según sus características (con un modelo publicado por la FRA);
   - qué cabe esperar hacia **2050 y 2100**.

### 3.4 Usuarios
| Persona | Necesidad | Módulos |
|---|---|---|
| Estudiante o público informado (audiencia oficial del reto) | Aprender a detectar tendencias | Detective, Explorador, tours |
| Viajero | Entender su trayecto | Mi trayecto |
| Técnico o gestor de infraestructura | Margen, futuro y prioridades | ¿Aguanta esta vía?, La red en 2050, modo gestor |
| Jurado | Rigor y uso de NASA | Methods & Data, validación |

### 3.5 El «ajá» (30 s)
> "Spain's railway was tuned to its local climate. We used 45 years of NASA data to find where that climate has moved, test if it's real, and show what it means for the rails, your trip, and 2050."

### 3.6 Alcance
- **Dentro:** España peninsular (Baleares y Canarias opcionales); variables de NASA; tendencias 1981–2025; proyecciones a 2041–2060 y 2081–2100; modelo de margen térmico basado en la FRA con supuestos visibles.
- **Fuera:** predecir incidentes concretos; previsión del tiempo para un día real; evaluar la seguridad de líneas reales; datos internos de Adif (salvo que el gestor los suba en local).

---

## 4. Trazabilidad: reto → funcionalidad → prueba visible

| Requisito oficial | ID | Funcionalidad | Prueba visible para el jurado |
|---|---|---|---|
| Obj. 1: identificar variables | FR-DET-2 | Catálogo de variables NASA con definición sencilla, unidad, fuente y «por qué podría tener tendencia», filtrado por las respuestas del usuario | Pantalla «Choose a variable» |
| Obj. 2: obtener datos de una región | FR-DET-3, FR-EXP-1 | Clic en el mapa o búsqueda → descarga en vivo de NASA POWER para cualquier punto del mundo; red española precalculada | Mapa y región resaltada |
| Obj. 3: serie temporal larga | FR-EXP-5 | 1981–2025 (45 años), indicadores anuales, media móvil de 10 años | Gráfico de la serie |
| Obj. 4: ritmo de cambio y significancia | FR-STAT-* | Pendiente de Sen por década con IC 95 %, Mann-Kendall (Hamed-Rao), t-test de OLS y FDR en mapas | Ficha de resultado y vista avanzada |
| Audiencia | FR-UX-1 | Lenguaje llano, glosario, tooltips, «Explain this» | Glosario y explicaciones |
| Preguntas guiadas | FR-DET-1 | Flujo de 3 preguntas (qué, dónde, cuándo) | Asistente paso a paso |
| Ejemplos de demostración | FR-TOUR-1 | Tours: ferrocarril, «mi trayecto» y uno clásico (lluvia o calor en otra región) | Botones «Watch a demo» |
| IA para encontrar datos (opcional) | FR-AI-* | «Ask the detective»: propone región, variable y periodo desde un catálogo cerrado | Etiqueta «SI-assisted» |
| Tendencia no significativa también interesa | FR-STAT-6 | Aviso «not significant yet» y años necesarios estimados | Mensaje explícito |
| Ciclo estacional | FR-STAT-7 | Indicadores anuales; Mann-Kendall estacional en series mensuales | Nota en Methods |
| No linealidad | FR-STAT-8 | Sen y Mann-Kendall son robustos a tendencias monótonas; media móvil como guía | Nota en Methods |
| Tendencias opuestas por un mismo proceso | FR-EXP-7 | Calor ↑ (riesgo de pandeo) frente a heladas ↓ (riesgo de rotura): mismo calentamiento, riesgos opuestos | Panel «Same process, opposite risks» |
| CUAHSI y herramientas externas | FR-VAL-* | Validación con Giovanni; estaciones NOAA CDO; KNMI opcional | Sección «Cross-checked» |

---

## 5. Requisitos funcionales por módulo

Formato: **ID · prioridad · requisito · criterio de aceptación (CA)**.

### 5.0 Portada (HOME)
- **FR-HOME-1 [MUST]:** mapa de la red a pantalla completa con animación automática de 1981 a 2025 y luego a 2041–2060, coloreada por días de calor extremo.
  - CA: arranca en menos de 3 s con red cacheada y se puede pausar.
  - CA: con `prefers-reduced-motion`, la animación no arranca sola.
- **FR-HOME-2 [MUST]:** titular, lema y tres botones: «Explore the network», «Be a trend detective» y «Watch a demo».
- **FR-HOME-3 [SHOULD]:** cifra resumen nacional, por ejemplo *"X km of track now see significantly more days ≥40 °C than in the 1980s"*.
  - CA: sale del pipeline e indica el periodo y la corrección FDR.

### 5.1 Explorador (EXP)
- **FR-EXP-1 [MUST]:** mapa de España con:
  - capa de celdas MERRA-2 (0,5° × 0,625°) semitransparente;
  - capa de tramos de vía coloreados por el indicador elegido;
  - leyenda siempre visible.
- **FR-EXP-2 [MUST]:** selector de indicador: HOT35/38/40/42, TXP95, HOTSPELL, TN20, FROST, COLD5, R20 (§8).
- **FR-EXP-3 [MUST]:** selector de vista **Now | Trend | Future**:
  - *Now*: media 1996–2025.
  - *Trend*: pendiente de Sen por década, con paleta divergente.
  - *Future*: valor del periodo y escenario elegidos (§10).
- **FR-EXP-4 [MUST]:** **punteado** sobre las celdas con tendencia significativa tras FDR, e interruptor **«Before / after false-discovery correction»** que muestra cuántas celdas dejan de ser significativas.
- **FR-EXP-5 [MUST]:** panel del tramo al hacer clic:
  - nombre de la línea, tipo (alta velocidad o convencional), año de apertura si se conoce (con fuente) y radio mínimo de curva;
  - cifras clave: media de 1981–1990 frente a 2016–2025, tendencia por década con IC 95 %, ✓ o ✗ tras FDR, y valor futuro con rango entre modelos;
  - **gráfico de pasado y futuro** (§16.4);
  - frase en lenguaje llano generada desde los números (§9.10);
  - botones «Explain this» (IA o plantilla) y «Test this track →» (abre el laboratorio con el tramo).
- **FR-EXP-6 [SHOULD]:** línea de tiempo inferior con reproducción (1981 → 2025 → 2041–60 → 2081–2100).
- **FR-EXP-7 [SHOULD]:** panel «Same process, opposite risks»: km con aumento significativo de HOT40 frente a km con descenso significativo de FROST.
- **FR-EXP-8 [SHOULD]:** umbral configurable de 35 a 42 °C. Nunca se presenta como límite oficial de Adif.
- **FR-EXP-9 [COULD]:** capa de temperatura de superficie MODIS (1 km, 2000–2025) para 2–3 zonas de ejemplo, con la aclaración «clear-sky only».

### 5.2 Modo detective general (DET) — el núcleo del reto
- **FR-DET-1 [MUST]:** flujo guiado en 3 pasos:
  1. **What are you curious about?** Heat, cold, rain, drought, wind, sunshine, humidity, soil moisture.
  2. **Where?** Clic en el mapa mundial, búsqueda de lugar o tipo de región (desert, rainforest, estuary, big city, mountains, coast).
  3. **When?** Rango de años, por defecto 1981–último año completo.
- **FR-DET-2 [MUST]:** catálogo de variables (`catalog.json`). Cada tarjeta lleva:
  - nombre llano y definición en una o dos frases;
  - unidad, fuente NASA (producto e instrumento o modelo) y resolución;
  - «Why it might trend here», generado por reglas según el tipo de región, o por la IA desde el catálogo.
- **FR-DET-3 [MUST]:** **datos en vivo de NASA POWER para cualquier punto.**
  - La API admite llamadas desde el navegador ✓ (cabecera `access-control-allow-origin: *`, comprobada el 14 nov 2026).
  - Caché en `IndexedDB` y respaldo con 6–8 ubicaciones precalculadas por si POWER no responde.
  - Una sola petición por punto con todos los parámetros (máximo 20).
- **FR-DET-4 [MUST]:** resultado:
  - serie anual o mensual;
  - Sen con IC 95 %, p-valor de Mann-Kendall (Hamed-Rao) y t-test de OLS en la vista avanzada;
  - frase llana y «What could cause this?» con los procesos físicos del catálogo, sin especular;
  - si no es significativa: «Not significant yet — about N more years of data would be needed at this rate and noise level (approximate)».
- **FR-DET-5 [SHOULD]:** 3–4 ejemplos clásicos precalculados con productos del reto, por ejemplo:
  - precipitación GPM IMERG en una región tropical;
  - temperatura de superficie MODIS en una gran ciudad;
  - humedad del suelo GLDAS en una zona semiárida.

  Descargados de Giovanni o AppEEARS, con su procedencia.
- **FR-DET-6 [SHOULD]:** las series mensuales usan anomalías mensuales o Mann-Kendall estacional (§9.7).

### 5.3 Mi trayecto (ROUTE)
- **FR-ROUTE-1 [MUST]:** selector de origen y destino entre **20–30 trayectos precalculados** (§13.6); la IA puede elegir el trayecto desde texto libre.
- **FR-ROUTE-2 [MUST]:** **tira del trayecto**, un diagrama lineal de origen a destino con las estaciones principales y una banda coloreada por kilómetro según el indicador elegido. Debajo, una segunda banda con el margen de seguridad (§12).
- **FR-ROUTE-3 [MUST]:** fecha de viaje (día y mes) → **probabilidad climatológica** de máxima ≥ umbral en el tramo más caliente:
  - fracción de años con al menos un día ≥ umbral en la ventana de ±7 días alrededor de la fecha;
  - mostrada para 1981–1990, 2016–2025 y 2041–2060 por escenario.
  - CA: el texto dice *"climatological probability, not a weather forecast"*.
- **FR-ROUTE-4 [MUST]:** tres tarjetas: tramo más caliente, probabilidad en la fecha y % del trayecto sin margen (hoy y 2050) con los supuestos de vía mostrados.
- **FR-ROUTE-5 [SHOULD]:** tipo de vía por defecto según la línea (alta velocidad → «fuerte»; convencional → «media»), editable.
- **FR-ROUTE-6 [COULD]:** compartir el trayecto con una URL de parámetros en el hash.

### 5.4 ¿Aguanta esta vía? Laboratorio de pandeo (LAB)
- **FR-LAB-1 [MUST]:** entradas con **etiqueta de procedencia**:
  - 🛰 NASA: temperatura del carril estimada;
  - 👤 usuario: temperatura neutra, estado del balasto o resistencia lateral;
  - 🗺 OSM o Adif: curvatura y tipo de línea.
- **FR-LAB-2 [MUST]:** perfiles predefinidos «Strong», «Average», «Weak / recently tamped» y «I don't know» (este último usa distribuciones completas, §12.4), y controles avanzados para la temperatura neutra (valor o rango) y la resistencia lateral.
- **FR-LAB-3 [MUST]:** gráfico **carga frente a resistencia**: distribución de (T_carril − T_neutra) en verano, hoy y en 2050, frente a la banda de ΔT admisible. La zona de excedencia va sombreada.
- **FR-LAB-4 [MUST]:** barra del **margen de seguridad frente al pandeo (BSM)** con las bandas de la FRA (§12.2) y marcas de hoy y 2050.
- **FR-LAB-5 [MUST]:** resultados:
  - días al año sin margen (media y rango);
  - probabilidad de al menos un día sin margen al año;
  - BSM típico (mediana, p10–p90).
  - CA: el título dice *"under your assumptions"*.
- **FR-LAB-6 [SHOULD]:** **pregunta inversa:** cambio de temperatura neutra necesario en 2050 para conservar el margen de hoy, y **ventana recomendada** por calor y frío (§12.6).
- **FR-LAB-7 [SHOULD]:** animación SVG de una vía que se deforma en «S» cuando el BSM es menor que 0. Respeta `prefers-reduced-motion`.
- **FR-LAB-8 [SHOULD]:** «Describe your track» (IA) traduce texto libre a perfiles y controles, siempre editables.
- **FR-LAB-9 [MUST]:** caja de supuestos visible: modelo de la FRA (vía estadounidense, desalineación de 38 mm, etc.), incertidumbre de la temperatura del carril de ±4 °C y que el resultado no es una predicción de incidentes.

### 5.5 La red en 2050 (NET)
- **FR-NET-1 [MUST]:** control de escenario (SSP2-4.5 / SSP5-8.5; SSP1-2.6 opcional) y de periodo (2041–2060 / 2081–2100).
- **FR-NET-2 [MUST]:** cifras clave:
  - km con más de N días ≥40 °C, hoy frente al futuro;
  - km sin margen con el perfil «Average»;
  - cambio en días de helada;
  - cambio necesario de temperatura neutra (mediana de la red).
- **FR-NET-3 [MUST]:** gráfico de **áreas apiladas** con los km de red por categoría de calor (de 0 a más de 30 días ≥40 °C), de 1981 a 2100: observado anual hasta 2025 y periodos futuros como columnas.
- **FR-NET-4 [SHOULD]:** **mapa de climas gemelos:** *"In 2041–2060, section A will have the climate that section B has today"*, con flechas. Si no hay análogo dentro de la red: *"no present-day analog in the network"*. Método en §10.6, inspirado en Bastin et al. (2019) ✓.
- **FR-NET-5 [SHOULD]:** **matriz antigüedad × calor futuro**: un punto por línea, año de apertura frente a cambio de HOT40; el cuadrante prioritario resaltado. CA: aclara que es el año de apertura, no el de la última renovación.
- **FR-NET-6 [SHOULD]:** ranking de los 10 tramos donde el clima cambia más rápido, enlazados al laboratorio.

### 5.6 Métodos y datos (METHODS)
- **FR-MET-1 [MUST]:**
  - fuentes con enlaces, marcando cuáles son de NASA;
  - estadística en dos niveles (llano y técnico);
  - modelos (carril, pandeo y futuro) con ecuaciones y supuestos;
  - validación (§17) con gráficos;
  - limitaciones, referencias, licencias, atribuciones y declaración de IA.
- **FR-MET-2 [MUST]:** descarga de los datos procesados (JSON y CSV) y enlace al repositorio con instrucciones para reproducir.

### 5.7 Tours (TOUR)
- **FR-TOUR-1 [MUST]:** al menos 2 tours guiados (superposición paso a paso): «The railway story» y «Be a detective in 60 seconds».
- **FR-TOUR-2 [SHOULD]:** tour «Your trip in July».

### 5.8 Modo gestor (MGR) [COULD]
- **FR-MGR-1:** subir un CSV o GeoJSON con tramos propios (id, coordenadas o id de tramo, temperatura neutra, resistencia o perfil).
- **FR-MGR-2:** todo se calcula **en el navegador**; los datos no salen del dispositivo. CA: no hay peticiones de red con ese contenido (comprobable en DevTools).
- **FR-MGR-3:** exportar los resultados a CSV.

### 5.9 Experiencia de usuario general (UX)
- **FR-UX-1 [MUST]:** glosario (§22) con tooltips en los términos técnicos.
- **FR-UX-2 [MUST]:** la primera pantalla de cada vista muestra un estado útil (un ejemplo cargado), nunca una pantalla vacía.
- **FR-UX-3 [SHOULD]:** idioma inglés por defecto; selector ES/EN opcional.
- **FR-UX-4 [MUST]:** cada gráfico tiene una vista de tabla accesible.

---

## 6. Requisitos no funcionales

| ID | Requisito | Criterio |
|---|---|---|
| NFR-1 | Web estática desplegada (GitHub Pages u otro hosting estático) | Enlace público; funciona en ventana privada |
| NFR-2 | Rendimiento | Primera carga útil < 3 s con 4G; JS inicial < ~500 KB gzip; red simplificada < 3 MB; series cargadas bajo demanda |
| NFR-3 | Accesibilidad | Contraste WCAG AA, teclado completo, foco visible, `prefers-reduced-motion`, paletas aptas para daltónicos y tablas alternativas |
| NFR-4 | Responsive | Funciona a 360 px de ancho sin scroll horizontal; en móvil los paneles son hojas inferiores |
| NFR-5 | Reproducibilidad | `make all` (o un script equivalente) regenera todos los JSON; cada JSON lleva metadatos de procedencia (§14.4) |
| NFR-6 | Determinismo | Monte Carlo con PRNG con semilla (por ejemplo mulberry32) y semilla fija documentada |
| NFR-7 | Robustez | Sin datos o sin IA, la app sigue funcionando con precalculados y reglas, y lo indica |
| NFR-8 | Seguridad | Ninguna clave de API en el repositorio ni en el bundle; IA mediante proxy o con clave del usuario (§15) |
| NFR-9 | Licencias | Código MIT; atribución a NASA POWER, OSM (ODbL) y NEX-GDDP-CMIP6; lista de librerías |
| NFR-10 | Calidad | Tests de estadística (Python y TS) en verde; lint y typecheck limpios; sin errores en consola |

---

## 7. Datos: fuentes, variables, accesos y licencias

### 7.1 Tabla maestra

| Variable | Uso | Producto | ¿NASA? | Resolución | Periodo | Acceso |
|---|---|---|---|---|---|---|
| T2M_MAX, T2M_MIN, T2M | Calor, frío, temperatura del carril | NASA POWER ← MERRA-2 (GMAO) | ✅ | 0,5° × 0,625°, diaria | 1981–hoy | API POWER |
| ALLSKY_SFC_SW_DWN | Radiación solar → temperatura del carril | NASA POWER ← SRB / CERES | ✅ | ~1°/0,5°, diaria | ~1984–hoy ⚠️ | API POWER |
| WS2M (y WS2M_MAX) | Viento → enfriamiento del carril | NASA POWER ← MERRA-2 | ✅ | 0,5° × 0,625° | 1981–hoy | API POWER |
| PRECTOTCORR | Lluvia intensa, modo detective | NASA POWER ← MERRA-2 | ✅ | 0,5° × 0,625° | 1981–hoy | API POWER |
| RH2M, QV2M | Secundaria (modo detective) | NASA POWER ← MERRA-2 | ✅ | 0,5° × 0,625° | 1981–hoy | API POWER |
| CLOUD_AMT, GWETROOT | Modo detective (nubosidad, humedad del suelo) ⚠️ verificar nombres | NASA POWER | ✅ | — | — | API POWER |
| tasmax, tasmin (+ pr, rsds, sfcWind opcionales) | Futuro | **NEX-GDDP-CMIP6** | ✅ | 0,25°, diaria | 1950–2014 histórico; 2015–2100 SSP | Google Earth Engine `NASA/GDDP-CMIP6` ✓ o NCCS THREDDS |
| LST de día y noche | Detalle local de 1 km (opcional) | MODIS MOD11A1 / MYD11A1 v061 | ✅ | 1 km, diaria | 2000/2002–hoy | AppEEARS (Earthdata) |
| Precipitación | Ejemplos del detective | GPM IMERG (NASA–JAXA) | ✅ + JAXA | 0,1° | 2000–hoy | Giovanni |
| Humedad del suelo y evaporación | Ejemplos del detective | GLDAS | ✅ | 0,25° | 2000–hoy | Giovanni o Hydrology Time Series |
| Red ferroviaria | Mapa y tramos | Adif INSPIRE (datos.gob.es) ✓ u OpenStreetMap | ❌ | Vectorial | Actual | Descarga |
| Atributos de línea | Tipo, ancho, electrificación, velocidad | OSM (`highspeed`, `gauge`, `electrified`, `maxspeed`, `usage`) | ❌ | — | — | Geofabrik + osmium |
| Año de apertura de líneas | Matriz de antigüedad | Fuentes públicas (Adif, Wikipedia), tabla manual con cita | ❌ | Por línea | — | Manual (§13.5) |
| Estaciones meteorológicas | Validación de MERRA-2 | NOAA CDO / GHCN-Daily (recurso del reto) o AEMET OpenData | ❌ | Puntual | — | API con token gratuito |
| Accidentes por vía pandeada (EE. UU.) | Validación opcional del componente de calor | FRA Rail Equipment Accidents (código de causa **T109**) | ❌ | Puntual (lat/lon) | 1975–hoy | data.transportation.gov ✓ |
| Temperatura de superficie europea | Dato de agencia socia (opcional) | ESA CCI LST o Sentinel-3 SLSTR | ESA | 1 km | — | ⚠️ verificar acceso y licencia |

### 7.2 NASA POWER ✓

**Endpoint diario por punto:**
```
https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN,T2M,WS2M,ALLSKY_SFC_SW_DWN,PRECTOTCORR,RH2M&community=RE&longitude={lon}&latitude={lat}&start=19810101&end=20251231&format=JSON&time-standard=LST
```

- Hasta 20 parámetros por petición de punto. Valores ausentes = `-999` (conviértelos a `NaN`).
- **Una petición por celda:** deduplica por celda MERRA-2 antes de pedir. Pide en secuencia, con reintentos, espera exponencial y caché en disco.
- **Unidades:** léelas de la cabecera `parameters` del JSON; con `community=RE`, la radiación diaria viene en kWh/m²/día ⚠️ comprobar.
- **Desde el navegador:** se puede llamar directamente (cabecera `access-control-allow-origin: *`, comprobada el 14 nov 2026).
- **Agradecimiento:** usa el texto oficial que pide POWER en su web ⚠️ (copiarlo literalmente).

### 7.3 NEX-GDDP-CMIP6 ✓
- Proyecciones diarias reducidas de escala estadísticamente (BCSD), a 0,25°.
- 35 modelos; en Google Earth Engine figuran 34 ✓.
- Escenarios SSP1-2.6, SSP2-4.5, SSP3-7.0 y SSP5-8.5.
- Periodo histórico: 1950–2014.
- Licencia **CC0-1.0** según el catálogo de Earth Engine ✓ (otras fuentes antiguas dicen CC-BY-SA 4.0; cita a Thrasher et al., 2022, en cualquier caso).
- **En Earth Engine:** `ee.ImageCollection("NASA/GDDP-CMIP6")`, filtrar por las propiedades `model` y `scenario`. Las temperaturas vienen en **kelvin**. Algunos modelos no tienen todas las variables: compruébalo con un filtro antes de elegir.
- **Modelos sugeridos** (6), ⚠️ verificar que estén para tasmax, tasmin, historical, ssp245 y ssp585:
  - ACCESS-CM2, EC-Earth3, MPI-ESM1-2-HR, MRI-ESM2-0, NorESM2-MM;
  - **GISS-E2-1-G**, el modelo del NASA GISS: buen detalle para la historia.
- **Alternativa sin Earth Engine:** el servicio de recorte NetCDF del THREDDS de NCCS (solo la caja de España).

### 7.4 Red ferroviaria
- **Opción A (preferida):** dataset INSPIRE «Red de Transporte Ferroviario» de Adif en datos.gob.es ✓. Descarga GML o Shapefile y comprueba la licencia ⚠️.
- **Opción B:** extracto de España de Geofabrik + `osmium tags-filter` con `railway=rail` y `usage=main|branch`.
- No dependas de Overpass: el 13 nov devolvió errores 406, 502 y 504.
- Atribución OSM: «© OpenStreetMap contributors, ODbL».

---

## 8. Indicadores climáticos (anuales, 1981–2025)

| Código | Definición | Uso |
|---|---|---|
| HOT35, HOT38, HOT40, HOT42 | Días con T2M_MAX ≥ 35, 38, 40 o 42 °C | Calor (pandeo) |
| TXP95 | Percentil 95 anual de T2M_MAX | Calor relativo |
| HOTSPELL | Racha más larga del año con T2M_MAX ≥ 38 °C | Olas de calor |
| TN20 | Noches tropicales: T2M_MIN ≥ 20 °C | Calor nocturno (la vía no se enfría) |
| FROST | Días con T2M_MIN < 0 °C | Frío (rotura) |
| COLD5 | Días con T2M_MIN ≤ −5 °C | Frío intenso |
| ICE | Días con T2M_MAX < 0 °C | Hielo |
| TNN | Mínima absoluta anual de T2M_MIN | Ventana de temperatura neutra |
| TXX | Máxima absoluta anual de T2M_MAX | Calor extremo |
| R20 | Días con PRECTOTCORR ≥ 20 mm | Lluvia intensa (terraplenes) |
| RAIL_AM | Máxima anual de la temperatura estimada del carril (§11) | Laboratorio de pandeo |
| NOMARGIN | Días con T_carril − T_neutra > ΔT admisible (§12) | Laboratorio y red |

**Reglas:**
- Los umbrales absolutos son configurables y se justifican así: con sol, el carril puede estar unos **14–19 °C** por encima del aire (FRA, 2013, 25–35 °F ✓) y **~20 °C** en una ola de calor en España (Adif en Público, 2022 ✓). Por tanto, 40 °C de aire equivalen aproximadamente a 55–60 °C de carril.
- Las series con más del 50 % de años en cero llevan la marca «too rare for a reliable trend».

---

## 9. Estadística de tendencias

Implementación de referencia en Python (`pymannkendall`, `scipy`, `statsmodels`) y **versión TypeScript** para el modo detective en vivo, con paridad comprobada por tests (§17.3).

1. **Serie:** un valor por año (n = 45 entre 1981 y 2025). Solo años completos.
2. **Pendiente de Sen** (Sen, 1968) con IC 95 % no paramétrico, expresada **por década**.
3. **Mann-Kendall modificado de Hamed y Rao (1998)**, que corrige la varianza por autocorrelación. En Python: `pymannkendall.hamed_rao_modification_test`. En TS, implementar:
   - estadístico S con empates y varianza con corrección de empates;
   - cálculo de la serie sin tendencia (restando la pendiente de Sen);
   - autocorrelaciones de sus rangos en los retardos significativos;
   - factor de corrección n/n*.
4. **t-test de OLS** de la pendiente (vista avanzada; el reto lo menciona).
5. **Pruebas múltiples (FDR):** Benjamini-Hochberg sobre todas las celdas o tramos de un indicador, con **α_FDR = 0,10** (Wilks, 2016 ✓). Se muestra el antes y el después.
6. **Tendencia no significativa:** estima los años necesarios por simulación. Genera series con la pendiente de Sen y la varianza residual (AR(1) si hay autocorrelación), alarga n hasta que el 50 % de las simulaciones salga significativo y muestra «≈ N years (approximate)».
7. **Ciclo estacional:** los indicadores anuales lo eliminan. Las series mensuales usan anomalías respecto al ciclo medio, o Mann-Kendall estacional (Hirsch et al., 1982).
8. **No linealidad:** Mann-Kendall y Sen sirven para tendencias monótonas. Muestra la media móvil de 10 años como guía visual y declara que el análisis no lineal queda fuera de alcance.
9. **Significancia en la interfaz:** p < 0,05 sin corregir → «significant (single test)»; tras FDR → «significant after correcting for N tests».
10. **Frase llana generada** con una plantilla y solo números del motor. Ejemplo: *"Days above 40 °C on this section rose by +3.4 per decade (95% CI +2.1 to +4.8) since 1981 — significant even after correcting for testing 412 sections at once."*

---

## 10. Proyecciones futuras (NEX-GDDP-CMIP6)

### 10.1 Periodos y escenarios
- **Referencia:** 1995–2014, el periodo de referencia del IPCC AR6, que coincide con el final del histórico de los modelos.
- **Futuro:** 2041–2060 y 2081–2100.
- **Escenarios:** SSP2-4.5 (central) y SSP5-8.5 (alto). SSP1-2.6 opcional.

### 10.2 Método delta diario (MUST)
Usarlo garantiza que el pasado observado y el futuro sean coherentes, sin saltos entre MERRA-2 y los modelos.

1. Para cada celda MERRA-2, modelo m, escenario s, periodo P y mes k:
   - Δ_k(m, s, P) = media de tasmax del modelo en P y en el mes k − media del modelo en el histórico 1995–2014 y en el mes k.
   - Lo mismo para tasmin.
2. Serie futura sintética: T_fut,d = T_obs,d (MERRA-2, días de 1995–2014) + Δ_{mes(d)}.
3. Recalcula todos los indicadores de §8 sobre esa serie → valor futuro por modelo.
4. **Conjunto de modelos:** mediana y rango (mínimo–máximo de 6 modelos). Muestra ambos.
5. Limitación (ponla en Methods): el método delta desplaza la media mensual, pero no cambia la variabilidad diaria.

### 10.3 Extracción en Earth Engine
- `reduceRegions` sobre los centroides o polígonos de las celdas que tocan la red.
- Medias **mensuales** por periodo: el volumen es pequeño.
- Exporta un CSV con las columnas `cell_id, model, scenario, period, month, var, value_K`.
- Convierte de kelvin a grados Celsius en el pipeline.

### 10.4 Radiación y viento en el futuro
Por defecto, se mantienen los observados: solo cambian las temperaturas. Indícalo en Methods. [COULD] aplicar también los deltas de `rsds` y `sfcWind`.

### 10.5 Validación (SHOULD)
Compara la tendencia de HOT40 del **histórico de los modelos** (1981–2014) con la observada en MERRA-2 en el mismo periodo. Muestra el gráfico en Methods.

### 10.6 Climas gemelos (FR-NET-4)
- Vector climático por tramo: [HOT40, TXP95, TN20, FROST], cada uno **estandarizado** con la media y la desviación del presente en toda la red.
- Para cada tramo A con su vector futuro f_A, busca el tramo B con el vector presente p_B más cercano (distancia euclídea).
- Si la distancia es menor que un umbral d* (por ejemplo, el percentil 10 de las distancias entre tramos del presente), se muestra el análogo. Si no: «no present-day analog in the network».
- Método inspirado en Bastin et al. (2019, *PLOS ONE*) ✓, que encontró, por ejemplo, que el clima de Madrid en 2050 se parecerá al actual de Marrakech.

---

## 11. Modelo de temperatura del carril

**Objetivo:** estimar la temperatura máxima diaria del carril (T_r) a partir de datos de NASA. Se implementan dos niveles: v0 es obligatorio y v1 es recomendable.

### 11.1 v0 [MUST]: desplazamiento constante
- T_r = T2M_MAX + ΔT_sol, con **ΔT_sol = 17 °C** por defecto e incertidumbre de 14–19 °C.
- Fuente: FRA 2013, 25–35 °F por encima del aire según datos de campo ✓; Adif en Público, ~20 °C en ola de calor ✓.

### 11.2 v1 [SHOULD]: escalado con sol y viento (balance de energía simplificado)
El calentamiento sobre el aire es proporcional a la radiación absorbida e inversamente proporcional a la convección:

```
ΔT_sol = ΔT_ref · (G_pico / G_ref) · (h(v_ref) / h(v))
h(v)   = 5,7 + 3,8 · v                 [W/m²K]; v = WS2M en m/s
G_pico ≈ π · H · 1000 / (2 · N)        [W/m²]; H = ALLSKY_SFC_SW_DWN (kWh/m²/día); N = horas de sol
```

- La correlación h(v) es la clásica de McAdams para convección forzada sobre una superficie ⚠️ (citar una fuente de transferencia de calor).
- N es la duración astronómica del día según la latitud y el día del año (fórmula estándar).
- **Anclaje:** G_ref y v_ref son las **medianas de G_pico y WS2M en los días con T2M_MAX ≥ 35 °C** de todas las celdas de la red, calculadas en el pipeline. ΔT_ref = 17 °C (rango 14–19 °C, FRA). Así el modelo reproduce el valor típico de la FRA en un día caluroso típico, y redistribuye el calentamiento según haya más o menos sol y viento.
- **Límites:** ΔT_sol se acota a [0, 25] °C. Los días nublados tienden a 0.
- **Incertidumbre:** σ = **4 °C**. Los modelos termodinámicos publicados tienen un RMSE de ~3,8 °C y los lineales de ~5,9 °C (Sensors 21(13):4606, 2021 ✓).
- **Absortividad de referencia:** 0,81 para carril usado y 0,99 para carril nuevo (mismo estudio ✓). Va implícita en ΔT_ref; se documenta.

### 11.3 Temperatura mínima del carril (lado frío)
T_r,min ≈ T2M_MIN: de noche el carril está cerca de la temperatura del aire. Limitación: el enfriamiento radiativo puede bajarla algo; indícalo.

### 11.4 Lo que se declara en Methods
Es una estimación a escala de celda de ~50 km; no incluye orientación, sombra, color ni el estado real del carril.

---

## 12. Modelo de pandeo (basado en la FRA)

Base: **Kish y Samavedam (2013), *Track Buckling Prevention: Theory, Safety Concepts, and Applications*, DOT/FRA/ORD-13/16** ✓, con su módulo probabilístico CWR-RISK ✓. En este documento, todas las cifras en °F se han convertido a °C.

### 12.1 Conceptos
- **T_N:** temperatura neutra (sin tensiones).
- **Carga:** ΔT = T_r − T_N.
- **ΔT_Bmax:** subida de temperatura a la que la vía pandea sin energía externa.
- **ΔT_Bmin:** subida a la que puede pandear si recibe energía externa, por ejemplo al pasar un tren.
- **ΔT admisible (ΔT_all)** según la FRA ✓:
  - si (ΔT_Bmax − ΔT_Bmin) > 10 °F (5,6 °C) → ΔT_all = ΔT_Bmin;
  - si es menor → ΔT_all = ΔT_Bmax − SF, con SF entre 0 y 10 °F (usamos SF = 10 °F, el valor conservador);
  - pandeo progresivo (ΔT_Bmax = ΔT_Bmin = ΔT_P) → ΔT_all = ΔT_P − 10 °F.

### 12.2 Margen de seguridad frente al pandeo ✓

**BSM = ΔT_all − (T_r − T_N)**

| BSM | Banda FRA | Color |
|---|---|---|
| < 0 °C | Sin margen | Rojo |
| 0–11 °C | Mínimo | Ámbar |
| 11–22 °C | Adecuado | Verde |
| > 22 °C | Deseable | Verde intenso |

### 12.3 Perfiles de vía (de los resultados paramétricos de la FRA ✓)

| Perfil | Resistencia lateral máxima F_P | ΔT_Bmax / ΔT_Bmin (FRA) | **ΔT_all usado** |
|---|---|---|---|
| Strong | 180 lb/in ≈ **31,5 kN/m** | 140 / 100 °F | 100 °F → **55,6 °C** |
| Average | 120 lb/in ≈ **21,0 kN/m** | 96 / 93 °F (diferencia < 10 °F) | 96 − 10 = 86 °F → **47,8 °C** |
| Weak / recently tamped | 70 lb/in ≈ **12,3 kN/m** | pandeo progresivo ~70 °F | 70 − 10 = 60 °F → **33,3 °C** |

- **Conversión:** 1 lb/in = 0,1751 kN/m. ΔT en °C = ΔT en °F × 5/9.
- **Interpolación:** ΔT_all(F_P) es lineal a trozos entre los tres puntos y se acota fuera de ellos.
- **Condiciones de esos resultados (FRA):** carril 136 RE, traviesas de madera, desalineación de 1,5 in (**38 mm**, conservadora) y semilongitud de onda de 180 in. ⚠️ Comprueba en el capítulo 4 si son de vía recta o en curva y anótalo en Methods.
- **Curvas:** la FRA muestra que la curvatura reduce mucho el margen; por ejemplo, en vía débil puede haber pandeo progresivo en curvas de unos 7° o más (radio ≈ 250 m). **Tarea:** extraer del informe de 2013 (cap. 4) o del DOT/FRA/ORD-93/26 una tabla de ΔT_all frente a curvatura. Si no hay tiempo, la curvatura se muestra **solo como aviso cualitativo** (radio < 800 m: «higher buckling vulnerability»), sin cambiar el cálculo.
  - Conversión: R (m) ≈ 1746,4 / D (grados de curva, cuerda de 100 ft).
  - Las líneas de alta velocidad tienen radios muy grandes, así que para ellas aplican los perfiles de vía recta.

### 12.4 Distribuciones por defecto («I don't know»), del caso A de CWR-RISK ✓

| Variable | Valores (probabilidad) |
|---|---|
| T_N | 15,6 °C (4 %) · 21,1 °C (21 %) · 26,7 °C (50 %) · 32,2 °C (21 %) · 37,8 °C (4 %) |
| F_P | 14,9 (5 %) · 17,5 (25 %) · 20,1 (40 %) · 22,8 (25 %) · 25,4 kN/m (5 %) |
| Desalineación | 0 (29 %) · 6,4 (35 %) · 12,7 (22 %) · 25,4 (8 %) · 31,8 (4 %) · 38,1 mm (2 %) — *informativa; los perfiles ya asumen 38 mm* |

Son valores de vía de EE. UU.; se declara en Methods. El usuario puede sustituirlos (por ejemplo, T_N como rango uniforme).

### 12.5 Cálculo (Monte Carlo) [MUST]
Para cada tramo, periodo y escenario:

1. Serie diaria de T_r de los meses de mayo a septiembre (§11), observada o con el delta futuro.
2. N = 5000 muestras (en un Web Worker, con semilla fija). Cada muestra toma:
   - T_N de su distribución (o del valor o rango del usuario);
   - F_P de su distribución o perfil → ΔT_all(F_P);
   - el error del carril ε ~ Normal(0; 4 °C), uno por año y muestra.
3. Por año y muestra: días con (T_r + ε − T_N) > ΔT_all.
4. Salidas:
   - **días al año sin margen** (media, p10–p90);
   - **P(≥1 día sin margen al año)**;
   - **BSM típico** = ΔT_all − (RAIL_AM − T_N), en mediana y p10–p90, donde RAIL_AM es la mediana entre años de la máxima anual de T_r.
5. Etiquetas obligatorias: *"under your assumptions"*, *"FRA-based model, US track parameters"*, *"not an incident prediction"*.
6. **[COULD]** Expected buckles de la FRA: e_b = 0,365×10⁶ · P_b · P_T por 100 millas y año (100 vagones, 10 trenes al día) ✓. Solo como curiosidad en Methods, sin mostrarlo como resultado.

### 12.6 Pregunta inversa y ventana de temperatura neutra [SHOULD]
- **Cambio necesario por calor:** ΔT_N,calor = RAIL_AM(futuro) − RAIL_AM(1995–2014). Subir T_N esa cantidad mantiene el BSM de hoy.
- **Cambio permitido por frío:** ΔT_N,frío = TNN(futuro) − TNN(1995–2014). Subir T_N esa cantidad mantiene la tracción máxima de hoy.
- **Ventana:** si ΔT_N,calor ≤ ΔT_N,frío → «window exists: raise T_N by [ΔT_N,calor, ΔT_N,frío] °C». Si no → «trade-off: heat needs more than cold allows».
- Es un cambio **relativo** a la T_N actual, que no conocemos. Se dice explícitamente.
- **Tracción informativa:** F = E·α·A·(T_N − T_r,min).
  - Con E = 210 GPa, α = 11,5×10⁻⁶ /°C (valores típicos del acero de carril ⚠️) y A = 76,8 cm² (UIC60, FRA ✓), salen ≈ **18,5 kN por °C** y por carril.

### 12.7 Validación opcional con incidentes reales (FRA T109) [COULD]
- **Datos:** FRA Rail Equipment Accidents (formulario 6180.54) en data.transportation.gov ✓. El catálogo indica latitud y longitud ✓ ⚠️ (comprueba los nombres de campo en el diccionario de datos). Filtra la causa **T109**, «Track alignment irregular (buckled/sunkink)» ✓.
- **Prueba:** para cada evento, toma T2M_MAX de POWER ese día y en ese punto (agrupando por celda), y calcula su **percentil** dentro de la distribución local de días de mayo a septiembre (1991–2020).
- **Resultado esperado:** los percentiles se concentran en valores altos. Es coherente con *Accident Analysis & Prevention* (2026) ✓, donde el 62 % de los pandeos ocurrieron con el carril por encima del percentil 90.
- Se muestra como «consistency check» del componente de calor, no como calibración.

---

## 13. Procesado geográfico de la red

1. **Carga** de la red (Adif INSPIRE u OSM), reproyección a EPSG:3035 para medir longitudes y a WGS84 para la web.
2. **Limpieza:** solo líneas en servicio (`usage=main|branch`, sin `abandoned`, `disused` ni `construction`). Une los ways por línea (`name` o `ref`).
3. **Segmentación:** tramos de **~5–10 km**, para dar resolución a la tira del trayecto y a la curvatura. Cada tramo lleva:
   - `segment_id`, `line_name`, `line_type` (HSL / conventional / metric), `gauge`, `electrified` y `maxspeed`;
   - `cell_id`: la celda MERRA-2 con mayor solape; el clima se hereda de la celda;
   - `km_from` y `km_to` dentro de la línea.
4. **Curvatura:**
   - remuestrea la geometría cada 50 m y calcula el radio del círculo que pasa por puntos separados ±100 m (ajústalo);
   - `min_radius_m` = percentil 5 de los radios del tramo;
   - clases: tangent/large (≥2000 m), medium (800–2000 m) y tight (<800 m).
5. **Año de apertura:** tabla manual por línea **con fuente**. Puntos de partida conocidos, ⚠️ todos a verificar y citar:

   | Línea | Año |
   |---|---|
   | Madrid–Sevilla (alta velocidad) | 1992 |
   | Madrid–Lleida | 2003 (Barcelona en 2008) |
   | Madrid–Toledo | 2005 |
   | Córdoba–Málaga | 2007 |
   | Madrid–Valladolid | 2007 |
   | Madrid–Valencia y Madrid–Albacete | 2010 |
   | Ourense–Santiago | 2011 |
   | Barcelona–Figueres | 2013 |
   | Albacete–Alicante | 2013 |
   | Valladolid–León | 2015 |
   | Antequera–Granada | 2019 |
   | Zamora–Ourense (completa) | 2021 |
   | Venta de Baños–Burgos | 2022 |
   | Monforte–Murcia | 2022 |
   | Variante de Pajares | 2023 |

   Las líneas convencionales se agrupan como «pre-1950» o según su apertura documentada.
6. **Trayectos (§5.3):** grafo de la red con `networkx` y ruta más corta entre las estaciones de cada par, calculada en el pipeline. Exporta la secuencia de `segment_id` y los puntos kilométricos de las estaciones intermedias. Lista orientativa (el equipo elige):

   | | | |
   |---|---|---|
   | Madrid–Sevilla | Madrid–Málaga | Madrid–Barcelona |
   | Barcelona–Figueres | Madrid–Valencia | Madrid–Alicante |
   | Madrid–Murcia | Madrid–Granada | Madrid–León |
   | León–Gijón | Madrid–Burgos | Madrid–Santiago/A Coruña |
   | Madrid–Zaragoza–Huesca | Madrid–Toledo | Sevilla–Cádiz |
   | Sevilla–Huelva | Córdoba–Málaga | Barcelona–Valencia |
   | Valencia–Alicante | Madrid–Badajoz | Zaragoza–Pamplona |
   | Algeciras–Bobadilla | Almería–Granada | Madrid–Salamanca |

7. **Simplificación para la web:** GeoJSON de tramos < 3 MB (mapshaper o `shapely.simplify`), con coordenadas de 5 decimales.

---

## 14. Arquitectura, repositorio y esquemas de datos

### 14.1 Stack
- **Pipeline:** Python 3.11+ con `requests`, `pandas`, `numpy`, `scipy`, `statsmodels`, `pymannkendall`, `geopandas`, `shapely`, `pyproj`, `networkx`, `earthengine-api` y `pytest`.
- **Web:**
  - React + Vite + TypeScript con `HashRouter` (GitHub Pages);
  - mapa con **MapLibre GL JS** (fija una versión exacta) sin mapa base comercial: contorno de países de Natural Earth (dominio público) + capas propias; mapa base libre sin clave opcional ⚠️ (verifica las condiciones);
  - gráficos con **d3** (escalas y formas) en SVG;
  - Monte Carlo en un **Web Worker**;
  - tests con **Vitest**.
- **IA (opcional):** SDK oficial `@anthropic-ai/sdk` (§15).
- **Hosting:** GitHub Pages; para el proxy de IA, Cloudflare Workers u otro serverless equivalente.

### 14.2 Repositorio
```
/pipeline
  config.yaml              periodos, umbrales, modelos, escenarios, semillas
  01_network.py            red → tramos → curvatura → celdas
  02_fetch_power.py        POWER por celda (caché, reintentos)
  03_indicators.py         diario → indicadores anuales
  04_trends.py             Sen, Mann-Kendall Hamed-Rao, OLS, FDR, años necesarios
  05_future_gee.py         Earth Engine → deltas mensuales → indicadores futuros
  06_rail_model.py         temperatura del carril v0/v1, RAIL_AM, ventanas de T_N
  07_routes.py             trayectos con networkx
  08_analogs.py            climas gemelos
  09_export.py             → web/public/data/* (+ procedencia)
  validate/
    giovanni_check.py      comparación con CSV de Giovanni
    stations_check.py      NOAA CDO / AEMET
    fra_t109_check.py      validación opcional
  tests/                   series sintéticas y golden files para el TS
/web
  src/
    app/                   rutas: home, explore, detective, route, lab, network, methods
    components/            Map, TimeSeriesChart, RouteStrip, LoadStrengthChart,
                           BsmBar, StackedArea, AnalogMap, AgeMatrix, ProvenanceChip
    stats/                 sen.ts, mannKendall.ts, ols.ts, fdr.ts (paridad con Python)
    model/                 railTemp.ts, buckling.ts, monteCarlo.worker.ts, prng.ts
    data/                  loaders con caché y IndexedDB (POWER en vivo)
    ai/                    assistant.ts, tools.ts, rules.ts (respaldo sin IA)
    content/               catalog.json, glossary.json, tours.json
  public/data/             JSON precalculados
README.md  LICENSE (MIT)  DATA_LICENSES.md  SI_DISCLOSURE.md
```

### 14.3 Esquemas de datos (TypeScript)
```ts
// public/data/segments.geojson -> Feature<LineString, SegmentProps>
interface SegmentProps {
  segment_id: string; line_name: string;
  line_type: "HSL" | "conventional" | "metric";
  gauge_mm?: number; electrified?: boolean; maxspeed_kmh?: number;
  opened_year?: number; opened_source?: string;
  min_radius_m?: number; curve_class: "tangent" | "medium" | "tight";
  cell_id: string; length_km: number;
}

// public/data/cells/{cell_id}.json (bajo demanda)
interface CellSeries {
  cell_id: string; lat: number; lon: number;
  years: number[];                                   // 1981..2025
  indicators: Record<IndicatorCode, (number | null)[]>;
  trends: Record<IndicatorCode, TrendResult>;
  future: Record<IndicatorCode, FutureResult[]>;
  rail: { rail_am_obs: number; tnn_obs: number; delta_tn_heat: Range; delta_tn_cold: Range };
  doy_hot_prob?: Record<"1981-1990" | "2016-2025" | string, number[]>; // 366 valores, ±7 días
  provenance: Provenance;
}
interface TrendResult {
  sen_per_decade: number; ci95: [number, number];
  p_mk_hr: number; p_ols: number;
  significant_raw: boolean; significant_fdr: boolean;
  too_rare: boolean; years_needed?: number;
}
interface FutureResult {
  scenario: "ssp245" | "ssp585" | "ssp126"; period: "2041-2060" | "2081-2100";
  median: number; min: number; max: number; per_model: Record<string, number>;
}
interface Provenance {
  source: string; product: string; parameters: string[];
  api_url_template: string; retrieved_at: string; pipeline_version: string;
}

// public/data/routes.json
interface Route {
  route_id: string; name: string;
  stations: { name: string; km: number }[];
  segments: string[];                                // segment_id en orden
  length_km: number;
}
```

### 14.4 Procedencia
Todo JSON lleva `provenance`. La página Methods la muestra.

---

## 15. Módulo de IA («SI»)

### 15.1 Funciones
1. **«Ask the detective»** (barra superior): convierte una pregunta libre en **acciones propuestas**, mostradas como chips confirmables (región, variable, periodo, vista y escenario).
2. **«Describe your track»** (laboratorio): texto → perfil y controles.
3. **«Explain this»** (cada resultado): explicación para estudiantes con **solo números del motor**, resaltados.

### 15.2 Reglas de diseño
- **Catálogo cerrado:** la IA solo puede elegir variables, regiones de ejemplo, trayectos y perfiles que existen en `catalog.json`, `routes.json` y la tabla de perfiles.
- **No inventa cifras:** las obtiene llamando a herramientas que devuelven los números del motor.
- **El usuario confirma** cada acción propuesta antes de que cambie la vista.
- **Etiqueta «SI-assisted»** en todo lo generado. Sin clave, el modo de reglas muestra «rule-based suggestion».
- **Respaldo sin IA [MUST]:** reglas tipo de región → variables (desierto → HOT40, TXP95, radiación; gran ciudad → TN20; costa → R20, humedad; montaña → FROST) y plantillas de explicación.

### 15.3 Herramientas (tool use)
| Herramienta | Entrada | Salida |
|---|---|---|
| `list_catalog` | `{kind: "variables" \| "routes" \| "regions" \| "presets"}` | Lista cerrada |
| `propose_view` | `{region_id \| lat/lon, variable, years, view, scenario?, period?}` | Propuesta (no aplica nada) |
| `select_route` | `{route_id, travel_date?}` | Propuesta |
| `set_track_params` | `{preset?, neutral_temp_c? \| range, lateral_resistance_kn_m?}` | Propuesta con valores acotados |
| `get_result` | `{segment_id \| cell_id \| point, variable}` | Números del motor (tendencia, IC, p, FDR, futuro, BSM) |

### 15.4 Implementación (información verificada en la documentación del SDK)
- **SDK:** `@anthropic-ai/sdk` (TypeScript). Herramientas con `betaZodTool` (de `@anthropic-ai/sdk/helpers/beta/zod`) y bucle con `client.beta.messages.toolRunner(...)`.
- **Modelo:** `claude-opus-5-5`.
- **Fallbacks:** activar `fallbacks: "default"` con la beta `server-side-fallback-2026-07-01`. Comprobar siempre `stop_reason` (incluido `"refusal"`) antes de leer el contenido.
- **Esfuerzo:** `output_config: { effort: "low" }` para el chat. El valor por defecto en este modelo es `medium`; mide y ajusta.
- **El pensamiento no se puede desactivar** en este modelo: no envíes `thinking: {type: "disabled"}` ni `budget_tokens`, porque dan error 400.
- **`tool_choice` forzado** (`any` o `tool`) da error 400 en este modelo. Usa `auto` + `strict: true` en las herramientas y pide en el prompt de sistema que use las herramientas.
- **Clave de API, dos opciones:**
  1. **[SHOULD] Proxy serverless** (Cloudflare Worker): reenvía `POST /v1/messages` añadiendo la clave del lado del servidor, con lista de orígenes permitidos y límite de peticiones. El cliente usa el SDK con `baseURL` apuntando al proxy. Las herramientas se ejecutan en el navegador, porque solo leen JSON y proponen cambios de vista.
  2. **[COULD] Clave del usuario** (BYOK): campo opcional, guardado solo en `sessionStorage`, cliente con `dangerouslyAllowBrowser: true` y aviso claro.
- **Nunca** pongas una clave en el repositorio ni en el bundle.
- **Para la demo:** graba la IA funcionando en el vídeo; los jueces pueden no tener clave.

### 15.5 Prompt de sistema (resumen de su contenido)
- Rol: guía de «data detectives» para estudiantes.
- Lenguaje llano.
- Usar solo herramientas y el catálogo; nunca inventar números ni fuentes.
- Si la pregunta no encaja en el catálogo, decirlo y proponer la variable más cercana.
- No hacer afirmaciones de seguridad ferroviaria.
- Responder en el idioma del usuario.

---

## 16. Diseño visual e interfaz

### 16.1 Principios
1. **El mapa primero.** Primero impacta (la red se calienta), después se investiga (un clic en un tramo) y al final se juega (el laboratorio).
2. **Los colores siempre significan lo mismo.**
3. **Cada dato dice de dónde viene.**

### 16.2 Paletas (tokens CSS; tema claro y oscuro)
- **Secuencial de calor** (valores): de amarillo a rojo oscuro, perceptualmente uniforme.
- **Divergente de tendencia** (por década): azul (baja) · gris (sin cambio o no significativo) · rojo (sube). Apta para daltónicos.
- **BSM:** rojo, ámbar, verde y verde intenso, con patrón o etiqueta además del color.
- **Procedencia:** 🛰 NASA, 👤 usuario y 🗺 OSM/Adif, con un color fijo cada uno.
- Mapa con fondo oscuro por defecto; paneles neutros.

### 16.3 Pantallas (bocetos; las cifras son de ejemplo)

**Explorador**
```
┌────────────────────────────────────────────────────────────────────────┐
│ OutOfSpec   [Detective] [Railways] [My trip] [2050]   ✨ Ask…          │
├──────────────┬────────────────────────────────────┬────────────────────┤
│ VARIABLE     │                                    │ MADRID–SEVILLA HSL │
│ ● Days ≥40°C │        MAP OF SPAIN                │ opened 1992        │
│ ○ Hot nights │   track coloured by variable       │ 4 → 11 days/yr     │
│ ○ Frost days │   NASA cells semi-transparent      │ +2.1/decade        │
│ ○ Heavy rain │   dots = significant after FDR     │ ✓ significant      │
│ VIEW         │                                    │ 2050: 18 [12–25]   │
│ [Now|Trend|Future]                                │ ▁▂▂▃▃▅▄▆▇│▒▓       │
│ SCENARIO ▾   │                                    │ ✨ Explain this    │
│ ☑ FDR        │                                    │ [Test this track →]│
├──────────────┴────────────────────────────────────┴────────────────────┤
│ ▶ 1981 ━━━━━━━━━━━━━━━━━━━━━●━━━━━━━━ 2025 ┆ 2041–60 ┆ 2081–2100       │
└────────────────────────────────────────────────────────────────────────┘
```

**Mi trayecto**
```
Madrid → Sevilla · 471 km · HSL (1992) · Date: 15 Jul · [Now | 2050] · Track: Strong ▾
Madrid    Ciudad Real   Puertollano        Córdoba            Sevilla
  ●━━━━━━━━━━●━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━●
  ░░░▒▒▒▒▒▒▒▒▒▒▓▓▓▓▒▒▒▒▒▒▒▓▓▓▓▓▓▓▓█████████████████▓▓▓▓▓▓██████████   days ≥40 °C
  🟢🟢🟢🟢🟢🟢🟡🟡🟡🟡🟡🟡🟠🟠🟠🔴🔴🟠🟠🟡🟡🟠🔴                              safety margin
[Hottest section]  [P(≥40 °C on 15 Jul): 8 % → 22 % → ~35 %]  [% of trip without margin]
```

**¿Aguanta esta vía?**
```
┌───────────────────────────┬────────────────────────────────────────────┐
│ YOUR TRACK                │  LOAD vs STRENGTH                          │
│ [Strong][Average]         │        now        2050                     │
│ [Weak/tamped][Don't know] │      ▁▃▆█▆▃▁    ▁▃▆█▆▃▁   ┃                │
│ Neutral T  ━━●━━ 25 °C 👤 │  ─────────────────────────┃▓▓ no margin   │
│ Ballast    ━━━●━ avg   👤 │   rail T − neutral T (°C)                  │
│ Curve      R 900 m     🗺 │  SAFETY MARGIN [none|min|adequate|desired] │
│ Rail T     NASA        🛰 │          ▲2050        ▲now                 │
│ ✨ Describe your track…   │  Days/yr without margin: 0.3 → 2.1         │
│                           │  ═══╗╔═══  (bends if margin < 0)           │
├───────────────────────────┴────────────────────────────────────────────┤
│ 🎯 Keep today's margin in 2050: raise neutral T by ≈ +3 °C             │
│ Window (heat ↔ cold): +2.6 … +4.1 °C   · under your assumptions        │
└────────────────────────────────────────────────────────────────────────┘
```

**La red en 2050**
```
Scenario: [SSP2-4.5 ━━●━━ SSP5-8.5]   Period: [2041–2060 | 2081–2100]
[km >10 days ≥40 °C]  [km without margin (Average)]  [Frost days Δ]  [Neutral T shift]
Stacked area: km by heat class 1981 → 2100
Twin-climates map: arrows "A in 2050 ≈ B today"
Age × future-heat matrix  ·  Top-10 fastest-changing sections
```

**Detective**
```
1 What are you curious about?   2 Where?                 3 When?
[🔥 Heat][🌧 Rain][❄ Cold][💨 Wind] [map / search / type]  [1981 ━━━━━━ 2025]
✨ or type it: "Is it raining less in Almería?"
→ Result card: series + Sen + CI + Mann-Kendall + t-test + plain sentence
```

### 16.4 Gráfico de pasado y futuro (componente clave)
- **Eje x:** de 1981 a 2100. **Eje y:** el indicador.
- **De 1981 a 2025:** puntos anuales, media móvil de 10 años, recta de Sen con banda IC 95 % y una línea vertical «today».
- **Futuro:** por escenario, una **barra horizontal** a lo largo de cada periodo (2041–2060 y 2081–2100) con la mediana, y un sombreado del mínimo al máximo entre modelos. **No se dibujan años futuros sueltos**, porque el método delta da climatologías de periodo.
- Tooltip con los valores, vista de tabla y leyenda.

### 16.5 Accesibilidad
- Todos los gráficos tienen un `aria-label` con la frase llana y una tabla alternativa.
- El punteado de significancia se acompaña de texto en el tooltip.
- Las animaciones respetan `prefers-reduced-motion`.

---

## 17. Validación científica y pruebas

### 17.1 Validación de datos
1. **Giovanni [MUST]:** serie de T2M_MAX de MERRA-2 en 2–3 celdas (sur, centro y norte), comparada con POWER. Gráfico superpuesto y correlación en Methods.
2. **Estaciones [SHOULD]:** 3–5 estaciones GHCN-Daily (NOAA CDO) o AEMET cerca de líneas del sur y del norte.
   - Sesgo de HOT40 y TXX (MERRA-2 suaviza los extremos a ~50 km) y comparación de tendencias.
   - Se publica tal cual, aunque el resultado no sea favorable.
3. **Histórico de los modelos frente a lo observado [SHOULD]:** §10.5.
4. **FRA T109 [COULD]:** §12.7.

### 17.2 Tests de estadística (Python)
- Series sintéticas:
  - tendencia conocida + ruido → Sen recupera la pendiente con un error pequeño;
  - ruido blanco → tasa de falsos positivos ≈ nominal;
  - AR(1) con φ = 0,5 → Hamed-Rao reduce los falsos positivos frente a Mann-Kendall clásico.
- FDR: casos de prueba con p-valores conocidos.

### 17.3 Paridad TS ↔ Python [MUST]
El pipeline exporta *golden files* (20 series con su Sen, IC, p de Mann-Kendall Hamed-Rao y p de OLS). Vitest compara la implementación TS con tolerancia de 1e-6 para Sen y 1e-3 para p.

### 17.4 Tests del modelo
- `buckling.ts`:
  - ΔT_all(31,5 kN/m) = 55,6 °C;
  - ΔT_all(21,0 kN/m) = 47,8 °C;
  - ΔT_all(12,3 kN/m) = 33,3 °C;
  - la interpolación es monótona;
  - las bandas del BSM coinciden con §12.2.
- Monte Carlo: misma semilla → mismo resultado. Si ΔT_all es enorme → 0 días; si es 0 → todos los días con T_r > T_N.
- `railTemp.ts`: en el día de referencia, ΔT_sol = ΔT_ref; ΔT_sol baja con el viento y sube con la radiación, y queda acotado entre 0 y 25 °C.

### 17.5 Pruebas de aceptación de punta a punta (manuales o con Playwright)
1. La portada se anima y los tres botones llevan a su vista.
2. Clic en un tramo de Andalucía → panel con serie, Sen, IC, p, FDR, futuro y frase; «Test this track» abre el laboratorio con ese tramo.
3. Detective: «Heat» → clic en un punto de otro continente → la serie se carga en vivo desde POWER; con la red cortada, aparece el respaldo y un aviso.
4. Mi trayecto: Madrid–Sevilla, 15 jul → tira, tres tarjetas y el aviso de «climatological probability».
5. Laboratorio: pasar de «Strong» a «Weak» aumenta los días sin margen; la ventana de T_N se muestra con sus supuestos.
6. 2050: cambiar de SSP2-4.5 a SSP5-8.5 aumenta los km en las categorías altas.
7. IA desactivada → todo funciona con «rule-based». IA activada → las propuestas aparecen como chips y nada cambia sin confirmar.
8. Móvil a 360 px: sin scroll horizontal y con los paneles como hojas.
9. Ventana privada: carga correcta desde el enlace público.
10. Consola sin errores; Lighthouse de accesibilidad ≥ 90 ⚠️ (objetivo).

---

## 18. Plan de trabajo y roles

### 18.1 Roles (máximo 6; adaptad al equipo)
1. **Datos y pipeline:** red, POWER y exportación.
2. **Estadística y validación:** tendencias, FDR, tests, Giovanni y estaciones.
3. **Futuro y modelos:** Earth Engine, deltas, temperatura del carril y pandeo.
4. **Front-end del mapa:** MapLibre, capas, explorador y trayecto.
5. **Front-end de interfaz y gráficos:** detective, laboratorio, 2050 y gráficos.
6. **Narrativa y QA:** textos, tours, vídeo, diapositivas, formulario y pruebas.

### 18.2 Hitos (H0 = inicio; ~34 h útiles)
| Bloque | Entregable | Prioridad |
|---|---|---|
| H0–H2 | Repo, esqueleto web desplegado en Pages, nombre decidido | MUST |
| H2–H6 | Red → tramos → celdas; POWER con 5 celdas; estadística en Python con tests | MUST |
| H6–H10 | POWER completo, indicadores, tendencias y FDR; exportación de JSON | MUST |
| H10–H14 | Explorador (mapa, panel, gráfico, frase) **desplegado** = versión mínima | MUST |
| H14–H17 | Detective con POWER en vivo y estadística TS con paridad | MUST |
| H14–H18 | (en paralelo) Earth Engine: deltas → indicadores futuros | SHOULD |
| H17–H21 | Mi trayecto (rutas precalculadas, tira y probabilidad en la fecha) | SHOULD |
| H18–H23 | Laboratorio de pandeo (modelo, Monte Carlo y gráficos) | SHOULD |
| H23–H26 | La red en 2050 (áreas, análogos y matriz) | SHOULD |
| H24–H27 | IA con proxy y respaldo por reglas | COULD |
| H26–H29 | Methods, validación con Giovanni y estaciones, glosario y tours | MUST |
| H29–H32 | Vídeo de 30 s y 7 diapositivas; textos del formulario | MUST |
| H32–H34 | QA final y **envío con margen** | MUST |

**Regla de oro:** si en H14 la versión mínima no está desplegada, se congelan los extras.

---

## 19. Entrega: formulario, vídeo y diapositivas (borradores en inglés)

### 19.1 Project Name
⚠️ Lo decide el equipo.

### 19.2 High-Level Summary
> *[Name] is a data-detective tool that finds where Earth's climate is trending away from what our infrastructure was designed for. Anyone can pick a NASA variable and a place and get a 45-year time series with its rate of change and statistical significance (Sen's slope, Mann-Kendall, corrected for false discoveries). Our flagship case is Spain's railway network: using NASA POWER/MERRA-2 we map where days above 40 °C are rising and frost is falling, show what it means for your trip, estimate rail temperature, compute a FRA-based thermal safety margin under user-defined track assumptions, and project it to 2050 and 2100 with NASA NEX-GDDP-CMIP6.*

### 19.3 Detailed Description (estructura)
1. **What it does:** los módulos.
2. **How it works:** pipeline, estadística, modelos y web.
3. **Benefits:** estudiantes, viajeros y gestores.
4. **Validation:** Giovanni, estaciones e histórico de los modelos.
5. **Limitations:** celdas de ~50 km, temperatura del carril estimada, parámetros de la FRA de EE. UU., método delta.
6. **Tools, languages and software.**
7. **Future work:** datos reales del gestor, rutas libres, otros países con OSM, carreteras y aeropuertos.

### 19.4 NASA Data
- NASA POWER (MERRA-2/GMAO; SRB/CERES)
- NEX-GDDP-CMIP6
- Giovanni (validación)
- MODIS LST vía AppEEARS (si se usa)
- GPM IMERG y GLDAS (si se usan)

Cada uno con su enlace.

### 19.5 Partner data and references
- ESA (si se usa), KNMI Climate Explorer (si se usa)
- OpenStreetMap (ODbL), Adif INSPIRE
- NOAA CDO / AEMET, FRA (accidentes, si se usan)
- Artículos de §23 y librerías

### 19.6 Use of SI (plantilla honesta, ⚠️ completar con lo que haya pasado de verdad)
> *SI tools ([name the tools]) were used for: [literature search and fact-checking support / drafting technical documentation / code generation and review / copy editing / the in-app assistant]. [Describe any other use accurately.] All numbers shown in the app are computed by our open pipeline from NASA data and published model parameters. The in-app assistant only selects options from a closed catalog and never generates numbers; its outputs are labelled "SI-assisted".*

### 19.7 Vídeo de 30 s
| Segundo | Imagen | Voz o texto |
|---|---|---|
| 0–2 | Equipo y reto | "Trend Detective — is our railway out of date?" |
| 2–5 | La portada se pone roja de 1981 a 2050 | Título y lema |
| 5–13 | Clic en Madrid–Sevilla: gráfico de pasado y futuro, frase y FDR | "45 years of NASA data: real, significant change" |
| 13–23 | Laboratorio: un control se mueve y la vía se dobla; ventana de T_N | "What it means for the track — today and in 2050" |
| 23–28 | La IA convierte una pregunta en un mapa | "Any place, any NASA variable" |
| 28–30 | Lema final | — |

### 19.8 Siete diapositivas
1. Título y lema
2. El problema
3. Datos de NASA
4. Método (con el antes y después del FDR)
5. Demo (capturas)
6. Impacto y futuro
7. Equipo

---

## 20. Lista de puntuación máxima

- **Impact:**
  - km de red con cambio significativo;
  - viajeros, estudiantes y gestores;
  - aplicable a cualquier país (OSM);
  - ventana de temperatura neutra accionable.
- **Creativity:**
  - tendencias + modelo de pandeo de la FRA + proyecciones en una herramienta abierta;
  - climas gemelos de la red;
  - pregunta inversa calor/frío;
  - antes y después del FDR.
- **Validity:**
  - Mann-Kendall Hamed-Rao, Sen con IC y FDR;
  - paridad TS/Python;
  - validación con Giovanni, estaciones e histórico de los modelos;
  - supuestos visibles;
  - reproducible.
- **Relevance:**
  - los cuatro objetivos visibles;
  - NASA en todo: POWER/MERRA-2, NEX-GDDP-CMIP6, Giovanni y MODIS;
  - modo detective general, no solo trenes.
- **Presentation:**
  - el «ajá» de la portada;
  - frases llanas;
  - la vía que se dobla;
  - tours, móvil, enlaces probados y vídeo de ≤30 s.

---

## 21. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| POWER lento o caído | Caché, descarga temprana y precalculados en el repo; respaldo en el modo en vivo |
| Earth Engine sin cuenta o lento | Empezar pronto (H14); alternativa con THREDDS; si falla, la vista «Future» muestra solo SSP2-4.5 con 3 modelos |
| Red ferroviaria difícil de limpiar | Adif INSPIRE primero, Geofabrik como respaldo; 25 trayectos precalculados |
| MERRA-2 suaviza los extremos | Declararlo, validar con estaciones y usar umbrales relativos (TXP95) además de los absolutos |
| El modelo de la FRA es de vía de EE. UU. | Supuestos visibles, «under your assumptions» y controles editables |
| Curvatura sin tabla de la FRA | Aviso cualitativo hasta extraer los datos |
| Exceso de alcance | Prioridades MUST/SHOULD/COULD y congelación en H14 |
| IA sin clave en la demo | Modo de reglas y la IA grabada en el vídeo |
| Afirmaciones no verificadas | Solo datos ✓; los ⚠️ fuera de la interfaz hasta verificarlos |

---

## 22. Glosario (para el tooltip, en inglés en la interfaz)

| Término | Definición llana |
|---|---|
| Trend | Dirección sostenida del cambio a lo largo de los años |
| Sen's slope | Ritmo de cambio robusto: la mediana de las pendientes entre todos los pares de años |
| Mann-Kendall test | Prueba de si una serie sube o baja de forma consistente más de lo que daría el azar |
| p-value | Probabilidad de ver una tendencia así si en realidad no hubiera ninguna |
| False discovery rate (FDR) | Corrección que evita «encontrar» tendencias por casualidad al probar cientos de lugares |
| Reanalysis (MERRA-2) | Reconstrucción del clima pasado que combina observaciones con un modelo |
| CMIP6 / SSP | Modelos climáticos y escenarios de emisiones futuras |
| Continuous welded rail | Carril soldado sin juntas: no puede dilatarse libremente |
| Neutral temperature | Temperatura a la que el carril no tiene tensión |
| Track buckling | La vía se desplaza de lado por la compresión del calor |
| Safety margin (BSM) | Cuántos grados quedan antes del límite seguro de la vía |
| Climate analog | Lugar cuyo clima actual se parece al clima futuro de otro |

---

## 23. Referencias (con estado)

**Hackathon y reto**
- ✓ Página del reto «Be An Earth System Trend Detective!» y su pestaña Resources (consultada el 14 nov 2026).
- ✓ Space Apps 2026: Judging & Awards Guide, Project Submission Guide y Participant FAQs.

**Datos de NASA**
- ✓ NASA POWER, API diaria: https://power.larc.nasa.gov/docs/services/api/temporal/daily/ · fuentes: https://power.larc.nasa.gov/docs/methodology/data/sources/
- ✓ Gelaro, R., et al. (2017). The Modern-Era Retrospective Analysis for Research and Applications, Version 2 (MERRA-2). *Journal of Climate* 30, 5419–5454.
- ✓ Thrasher, B., et al. (2022). NASA Global Daily Downscaled Projections, CMIP6. *Scientific Data* 9, 262. https://www.nature.com/articles/s41597-022-01393-4
- ✓ Catálogo de Earth Engine `NASA/GDDP-CMIP6`: https://developers.google.com/earth-engine/datasets/catalog/NASA_GDDP-CMIP6
- ✓ NCCS NEX-GDDP-CMIP6: https://www.nccs.nasa.gov/?p=4728
- ✓ Giovanni · AppEEARS · Hydrology Time Series · NOAA CDO (URLs en §2.4)

**Estadística**
- ✓ Sen, P. K. (1968). *JASA* 63, 1379–1389.
- ✓ Hamed, K. H., y Rao, A. R. (1998). *Journal of Hydrology* 204, 182–196.
- ✓ Benjamini, Y., y Hochberg, Y. (1995). *JRSS B* 57, 289–300.
- ✓ Wilks, D. S. (2016). *BAMS* 97(12), 2263–2273.
- ✓ Hirsch, R. M., Slack, J. R., y Smith, R. A. (1982). Techniques of trend analysis for monthly water quality data. *Water Resources Research* 18(1), 107–121.

**Ferrocarril**
- ✓ Kish, A., y Samavedam, G. (2013). *Track Buckling Prevention: Theory, Safety Concepts, and Applications.* DOT/FRA/ORD-13/16. https://railroads.dot.gov/sites/fra.dot.gov/files/fra_net/3036/TR_Track_Buckling_Prevention_Theory_Safety_Concepts_Applications_20130321_final.pdf
- ✓ *Parametric Analysis and Safety Concepts of CWR Track Buckling*, DOT/FRA/ORD-93/26.
- ✓ *Risk analysis based CWR track buckling safety evaluations*: https://rosap.ntl.bts.gov/view/dot/8469
- ✓ Códigos de causa de la FRA (T109): https://railroads.dot.gov/sites/fra.dot.gov/files/2019-10/Appendix%20C%20-%20Track%20Roadbed%20and%20Structure%20-%20Numeric.pdf
- ✓ FRA Rail Equipment Accidents (formulario 6180.54): https://catalog.data.gov/dataset/rail-equipment-accidents
- ✓ Wolf, G. (2024). Presentación WRI 2024: 562 descarrilamientos T109 entre 2000 y 2023 (fuente secundaria).
- ✓ *A Rail-Temperature-Prediction Model Based on Machine Learning…* *Sensors* 21(13), 4606 (2021): RMSE de los modelos termodinámicos ~3,8 °C y de los lineales ~5,9 °C; absortividad 0,81–0,99.
- ⚠️ FRA (2008). Rail temperature prediction model (rr0806): no se ha podido leer; no citar cifras de él.
- ✓ *European Transport Research Review* (2025), doi 10.1186/s12544-025-00725-w (Chequia: frío → roturas, calor → pandeos).
- ✓ *Accident Analysis & Prevention* (2026), pii S0001457526002617 (EE. UU.: el 62 % de los pandeos con el carril por encima del percentil 90).
- ✓ Seminario Cátedra Adif-UPM (24/01/2024), con datos de **SNCF Réseau (Francia), no de Adif**.
- ✓ Público (22/07/2022), con declaraciones de Adif (carril ~20 °C sobre el aire; zonas de ~50 km).
- ✓ SPATRA (CORDIS), trabajo relacionado.
- ✓ Red de Transporte Ferroviario de Adif (INSPIRE): https://datos.gob.es/es/catalogo/e0dat0002-red-de-transporte-ferroviario-de-adif1

**Clima y comunicación**
- ✓ Bastin, J.-F., et al. (2019). Understanding climate change from a global analysis of city analogues. *PLOS ONE* 14(7): e0217592 (corrección en 14(10): e0224120).
- ✓ Coffel, E., Thompson, T., y Horton, R. (2017). *Climatic Change* (aeropuertos; solo si se añade esa demo).

---

## 24. Primera respuesta esperada de la IA constructora

1. Confirma el encuadre: detective general con el ferrocarril como caso estrella. Lista las **decisiones bloqueantes**:
   - nombre;
   - miembros y roles;
   - hora exacta de cierre en la sede;
   - cuenta de Earthdata (AppEEARS) y de Google Earth Engine;
   - si habrá IA con proxy.
2. Propón la estructura del repo (§14.2) y empieza por:
   - `01_network.py` y `02_fetch_power.py` con caché;
   - el esqueleto web desplegado en Pages.
3. No empieces los SHOULD hasta tener la versión mínima (H0–H14) desplegada y probada en ventana privada.
4. Al terminar cada bloque, informa de: qué funciona, qué falta, qué se ha verificado y qué sigue marcado ⚠️.
