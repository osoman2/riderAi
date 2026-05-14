# DriverCoach

Interfaz formalizada para DriverCoach con separación clara entre backend y frontend.

## Estructura

- `backend/` - API FastAPI que reutiliza el pipeline actual de análisis
- `frontend/` - interfaz React/Vite sobria inspirada en la referencia visual
- `streamlit/` - shell y pipeline legado que sigue siendo reutilizado por el backend

## Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

## Notas

- El frontend consulta la API en `/api`.
- El procesamiento downhill usa el pipeline existente.
- Si no hay weights del modelo, la UI deja visible el shell pero no ejecuta el análisis.

## Metodologia actual

- `downhill` base usa YOLO pose sobre el rider, suavizado temporal, metricas posturales, trayectoria proxy y contexto de terreno inferido por reglas de velocidad/postura.
- En `downhill`, `Premium SAM` intenta generar artefactos de mascara/overlay de sendero (`sam_trail_mask.png`, `sam_trail_overlay.mp4`) usando el helper SAM3 disponible. Si SAM falla por checkpoint/GPU/dependencias, el analisis base sigue funcionando y el meta guarda el estado en `sam`.
- Para `downhill` con dron de seguimiento, si tiene sentido combinar deteccion de postura + SAM: el cuerpo suele ser visible y la mascara de sendero permite medir trayectoria respecto al corredor.
- Para `downhill` con GoPro/casco, SAM tambien tiene sentido, pero para sendero, obstaculos y linea proxima; no conviene prometer postura completa porque el cuerpo casi no se ve.
- Para `downhill` con GoPro/casco, el backend no corre el pipeline de pose/deteccion corporal. El resultado util es el overlay SAM del corredor transitable, obstaculos visibles y decisiones de linea desde la vista del rider.
- Para `downhill` con dron frontal/cenital, conviene separarlo del dron de seguimiento: es mejor para geometria de trayectoria, secciones y mapa; peor para detalle fino de postura.
- En la UI, `downhill` permite seleccionar dron de seguimiento, GoPro/casco y dron frontal/cenital como entradas distintas. GoPro/casco y frontal/cenital pueden correr por el pipeline DH general; `Premium SAM` agrega el intento de aislamiento visual del sendero.
- Estrategia SAM3 para DH: primero segmentar sendero/corredor transitable y obstaculos. La bici/rider solo debe segmentarse como capa secundaria cuando la camara lo permite; en GoPro suele ser parcial y puede contaminar la mascara del sendero.
- `karting` si usa la logica SAM3/SAM2/HSV: SAM calibra la superficie de pista y HSV propaga la mascara al resto del video.
- En `karting`, pose humana no aporta mucho. Lo importante es detectar karts, segmentar pista, medir posicion lateral, kerbs y gap. En GoPro se detectan karts visibles adelante; la posicion propia se infiere por geometria de la pista. En dron/cenital la deteccion y trayectoria son mas directas.
- Reutilizar SAM de karting en downhill directamente no es buena idea sin adaptar prompts, regiones de interes, clases de superficie y scoring: asfalto de karting es una superficie homogenea; un trail DH mezcla tierra, pasto, madera, sombra, raices y partes de la bici.
