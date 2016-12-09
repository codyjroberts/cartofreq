echo "Transpiling via babel"
npm run build

echo "Launching python server on ws://localhost:8088"
python3 ./backend/fileCreator.py &
FILECREATOR_PID=$!

python3 ./backend/socketioServer.py &
SOCKETIOSERVER_PID=$!

echo "Launching app on http://localhost:8000"
live-server --port=8000
kill $FILECREATOR_PID
kill $SOCKETIOSERVER_PID
