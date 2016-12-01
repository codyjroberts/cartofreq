echo "Transpiling via babel"
npm run build
echo "Launching node server on ws://localhost:8080"
node simulate.js&
SIMULATE_PID=$!
echo "Launching app on http://localhost:8000"
live-server --port=8000
kill $SIMULATE_PID
