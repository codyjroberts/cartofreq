import os
from threading import Timer
import time #import time, sleep #time libraries
import random

def background_thread():
	"""Example of how to send server generated events to clients."""
	count = 0
	for file in os.listdir("./"):
		if file.endswith(".txt"):
			count+=1
	if count<50:
		currenttime = time.time()
		currenttime = ("%.3f" % currenttime).replace(".","")
		currenttime = float(currenttime)
		f = open(str(currenttime).replace(".0","")+".txt", 'w')
		f.write('{"name":"flare","lat":"41.8713644660119","lng":"-87.6484761742445","children":[{"name":"RF2449.188MHZ","size":"'+str(random.randrange(100+1)*-1)+'"},{"name":"RF2401.938MHZ","size":"'+str(random.randrange(100+1)*-1)+'"},{"name":"RF101.719MHZ","size":"'+str(random.randrange(100+1)*-1)+'"},{"name":"RF105MHZ","size":"'+str(random.randrange(100+1)*-1)+'"},{"name":"RF93.625MHZ","size":"'+str(random.randrange(100+1)*-1)+'"}]}')
		f.close()
			
	Timer(1, background_thread).start()

		
	 
if __name__ == '__main__':

	Timer(1, background_thread).start()

