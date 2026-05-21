#!/bin/bash
set -e

echo "=== Installing backend dependencies ==="
cd /home/user/ups-rating/backend
pip install -r requirements.txt -q

echo "=== Installing frontend dependencies ==="
cd /home/user/ups-rating/frontend
npm install --legacy-peer-deps -q

echo "=== Starting backend (port 8000) ==="
cd /home/user/ups-rating/backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

echo "=== Building frontend ==="
cd /home/user/ups-rating/frontend
npm run build

echo "=== Serving frontend on port 3000 (via npx serve) ==="
npx serve -s build -l 3000 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "=== App running ==="
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:8000"
echo "  API docs: http://localhost:8000/docs"
echo ""

wait $BACKEND_PID
