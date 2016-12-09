import socketio
import eventlet
import eventlet.wsgi
from flask import Flask, render_template, make_response, request, current_app
from flask_cors import CORS, cross_origin
import math
import threading
from threading import Timer
import os
import time #import time, sleep #time libraries
from random import randint
import json
from shutil import copyfile
 
kwargs = {"async_mode": "threading","cors_allowed_origins": "*" ,"cors_credentials":True,"engineio_logger":False}
sio = socketio.Server(async_mode='eventlet')
app = Flask(__name__)
cors = CORS(app, resources={r"/*": {"origins": "*"}})
thread = None
#global command
 
command = "None"
recording = "None"

@app.route('/')
@cross_origin()
def index():
	"""Serve the client-side application."""
	return render_template('index.html')
 
@sio.on('connect')
def connect(sid, environ):
	global thread
#	global command
#	global recording
#	command = "None"
	if thread is None:
		thread = sio.start_background_task(background_thread)
	
	emitRecordings()

 
@sio.on('stop')
def message(sid):
	global command
	print("stopping recording")
	command = "stop"
 
@sio.on('record')
def message(sid):
	global command
	print("starting recording")
	command = "record"
#	sio.emit('r','Recording Started',**kwargs)

			
@sio.on('playback')
def message(sid, data):
	global recording
	global command
	print("playing back recording")
	recording = data
	command = "playBack"
#	sio.emit('r','Recording playing',**kwargs)


#@sio.on('recording_list')
#def message(sid, data):
#			emitRecordings()


@sio.on('disconnect')
def disconnect(sid):
	print('disconnect ', sid)
	
def background_thread():
	global command
	global recording
	if command is None:
		command =  "None"
		
	"""Example of how to send server generated events to clients."""
	count = 0
	fileNumber = 1
	writing = False
	recordingPath = "./"
	while True:
		sio.sleep(.25)
		
		print("Command "+ str(command))
		if (command == "None"):
			currenttime = time.time()
			currenttime = ("%.3f" % currenttime).replace(".","")
			currenttime = float(currenttime)
			
			allFiles = []
			
			for file in os.listdir("./"):
				if file.endswith(".txt"):
					fileNameNumber = (float) (file.replace(".txt",""))
					if (fileNameNumber+1000<currenttime):
						allFiles.append(fileNameNumber)
			
			if(len(allFiles)>0):
				with open(str(max(allFiles)).replace(".0","")+".txt", 'r') as myfile:
					data=myfile.read().replace('\n', '')
					data=json.loads(data)
					sio.emit('t',data,**kwargs)
				
				for f in allFiles:
					os.remove(str(f).replace(".0","")+".txt")
		
		if (command == "record"):
			count += 1
			currenttime = time.time()
			currenttime = ("%.3f" % currenttime).replace(".","")
			currenttime = float(currenttime)
			
			allFiles = []
			
			if not os.path.exists("./recordings/"):
				os.makedirs("./recordings/")
				
			if not writing:
				while os.path.exists("./recordings/recording" + str(fileNumber)):
					fileNumber+=1
				os.makedirs("./recordings/recording" + str(fileNumber))
				recordingPath = "./recordings/recording" + str(fileNumber)+"/"
				print(recording)
				writing = True
						
			
			for file in os.listdir("./"):
				if file.endswith(".txt"):
					fileNameNumber = (float) (file.replace(".txt",""))
					if (fileNameNumber+1000<currenttime):
						allFiles.append(fileNameNumber)
			
			if(len(allFiles)>0):
				with open(str(max(allFiles)).replace(".0","")+".txt", 'r') as myfile:
					data=myfile.read().replace('\n', '')
					data=json.loads(data)
					sio.emit('t',data,**kwargs)
				
				copyfile( str( max(allFiles)).replace(".0","") + ".txt", recordingPath + str( max(allFiles)).replace(".0","") + ".txt")
				print("Coppying A: "+str( max(allFiles)).replace(".0","") + ".txt"+"\t To B: "+recordingPath + str( max(allFiles)).replace(".0","") + ".txt")
				
				for f in allFiles:
					os.remove( str(f).replace(".0","") + ".txt")
				
			if count>100:
				count = 0
				emitRecordings()
				command = "None"
		
		if (command == "playBack"):
			count += 1
			currenttime = time.time()
			currenttime = ("%.3f" % currenttime).replace(".","")
			currenttime = float(currenttime)
			
			allFiles = []
			
			if not os.path.exists("./recordings/" + str(recording) + "/"):
				sio.emit('r',"Playback Failure, no Recording" + str(recording) ,**kwargs)
				command = "None"
				count = 0
				break
			
			for file in os.listdir("./recordings/" + str(recording) + "/"):
				if file.endswith(".txt"):
					fileNameNumber = (float) (file.replace(".txt",""))
					if (fileNameNumber+1000<currenttime):
						allFiles.append(fileNameNumber)
	
			allFiles.sort();
			
			if count-1<len(allFiles):
				with open( "./recordings/" + str(recording) + "/" + str(allFiles[count-1]).replace(".0","")+".txt", 'r') as myfile:
					data=myfile.read().replace('\n', '')
					data=json.loads(data)
					sio.emit('t',data,**kwargs)
			
			if count>100 or count > len(allFiles)-2:
				count = 0
				sio.emit('r','Playback Ended',**kwargs)
				command = "None"
				
		if (command == "stop"):
			count = 0
			command = "None"
			emitRecordings()
			
			
		
def emitRecordings():
	i=1
	if not os.path.exists("./recordings/"):
		os.makedirs("./recordings/")
		
	while os.path.exists("./recordings/recording"+str(i)+"/"):
		print("./recordings/recording"+str(i)+"/")
		i+=1
		
	stringBuilder = '{"recordings":['
	for n in range(1, i):
		stringBuilder += '{"name":"recording'+str(n)+'"}'
		if n < i-1:
			stringBuilder += ','
	stringBuilder += ']}'
	stringBuilder=json.loads(stringBuilder)
	print(stringBuilder)
	sio.emit('update_recordings',stringBuilder,**kwargs)
	

					
	 
if __name__ == '__main__':
#   app.run(threaded=True)
	# wrap Flask application with engineio's middleware
	app = socketio.Middleware(sio, app)
	
	if not os.path.exists("./recordings/"):
		os.makedirs("./recordings/")
 
	# deploy as an eventlet WSGI server
	eventlet.wsgi.server(eventlet.listen(('', 8088)), app)