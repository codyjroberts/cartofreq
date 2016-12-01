import socketio
import eventlet
import eventlet.wsgi
from flask import Flask, render_template, make_response, request, current_app
from flask_cors import CORS, cross_origin
import math
import threading
import os
import time #import time, sleep #time libraries 
from random import randint
import json

kwargs = {"async_mode": "threading","cors_allowed_origins": "*" ,"cors_credentials":True,"engineio_logger":False}
sio = socketio.Server(async_handlers=True)
app = Flask(__name__)
cors = CORS(app, resources={r"/*": {"origins": "*"}})


@app.route('/')
@cross_origin()
def index():
	"""Serve the client-side application."""
	return render_template('index.html')

@sio.on('connect')
def connect(sid, environ):
	print("connect ", sid)
	
#	while True:
	currenttime = time.time()
	currenttime = ("%.3f" % currenttime).replace(".","")
#	print(currenttime)
	currenttime = float(currenttime)	
	for file in os.listdir("./"):
		if file.endswith(".txt"):
			fileNameNumber = (float) (file.replace(".txt",""))
			if(fileNameNumber+1000<currenttime):
				with open(file, 'r') as myfile:
					data=myfile.read().replace('\n', '')
					data=json.loads(data)
#					print(data)
#						for x in range(0, 10):
					sio.emit('t',data,**kwargs)
#					sio.emit(event, data=None, room=None, skip_sid=None, namespace=None, callback=None, **kwargs)
#					send(data, room=None, skip_sid=None, namespace=None, callback=None, **kwargs)
#					self.write_message(data)
	

@sio.on('chat message')
def message(sid, data):
	print("message ", data)
	sio.emit('t', room=sid)

@sio.on('disconnect')
def disconnect(sid):
	print('disconnect ', sid)

if __name__ == '__main__':
#	app.run(threaded=True)
	# wrap Flask application with engineio's middleware
	app = socketio.Middleware(sio, app)

	# deploy as an eventlet WSGI server
	eventlet.wsgi.server(eventlet.listen(('', 8080)), app)