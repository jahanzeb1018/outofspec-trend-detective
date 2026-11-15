// MapLibre 6 runs its tile worker from a separate module file; let Vite bundle it and point MapLibre at it.
import * as maplibregl from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

maplibregl.setWorkerUrl(workerUrl);

export { maplibregl };
