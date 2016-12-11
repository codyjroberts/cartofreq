echo "Transpiling via babel"
npm run build

echo "Launching python server on ws://localhost:8088"
cd Server
python3 filecreator.py&
FILECREATOR_PID=$!
python3 socketioServer.py&
SOCKETIOSERVER_PID=$!
cd ../
echo "Launching app on http://localhost:8000"
python -m SimpleHTTPServer 8000
kill $FILECREATOR_PID
kill $SOCKETIOSERVER_PID
