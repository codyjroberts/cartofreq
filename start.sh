echo "Transpiling via babel"
npm run build

echo "Launching python server on ws://localhost:8088"
python filecreater.py &
FILECREATER_PID=$!

python socketioServer.py &
SOCKETIOSERVER_PID=$!

echo "Launching app on http://localhost:8000"
live-server --port=8000
kill $FILECREATER_PID
kill $SOCKETIOSERVER_PID
