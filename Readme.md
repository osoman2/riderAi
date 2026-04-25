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
