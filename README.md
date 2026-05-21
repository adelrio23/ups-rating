# Parcel Pricing Engine

A full-stack web app for building optimized carrier pricing proposals.

## Quick Start

```bash
bash start.sh
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs (Swagger): http://localhost:8000/docs

## Manual Setup

### Backend (Python 3.10+)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend (Node 18+)
```bash
cd frontend
npm install
npm start   # dev server with proxy to backend
```

## Rate Card Format

Excel file where:
- Column A = weight (1–150 lbs)
- Columns = zones 2–8
- Sheet tabs named: Ground, Ground Residential, 2nd Day Air, Next Day Air

## Invoice Format

Any carrier invoice Excel. Auto-detects columns for weight, zone, service, base charge, fuel surcharge, DAS, residential, address correction, etc. Manual mapping available if auto-detect fails.

## Workflow

1. **Setup tab**: Upload rate cards + customer invoice
2. **Pricing Engine tab**: Configure fuel %, adjust markup slider, run scenario
3. **Rate Grids tab**: View sell base / our cost / carrier source per cell
4. **Package Detail tab**: See every package colored green/grey/red, click any row to audit
5. **Export tab**: Generate customer Excel proposal, internal Excel workbook, Word deal brief
6. **Scenarios tab**: Compare saved scenarios side by side
