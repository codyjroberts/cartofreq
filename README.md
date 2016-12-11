# About
CartoFreq is a tool for visualizing RF Receiver data in real-time. Built for the
[Keysight N6841A RF Sensor](http://www.keysight.com/en/pdx-x201741-pn-N6841A/rf-sensor),
CartoFreq enables the user to quickly see signal strength and visualize trends live as well as
record and playback data for further review. To get an idea of what it does you can watch [this](#) video
where Mac Carter explains in more detail.

# Getting Started
The `Server` folder contains a python socketIO server and data spoofer.  When working directly with the
[Keysight N6841A RF Sensor](http://www.keysight.com/en/pdx-x201741-pn-N6841A/rf-sensor), the socketIO server
is hosted on the machine receiving the data.  Since not everyone has access to a $16k RF sensor there is
a data spoofer provided that mimics the output for testing and getting a feel for how the visualization works.
There is also a few recordings of capured data provided.

After installing the dependencies with `npm run deps`, running `npm run dev` will launch the python backend
server, data spoofer, as well as a server for running the frontend.  From there you can view it at
`http://localhost:8000`.

```
npm run deps
npm run dev
```

A manifest has been included in the project to enable quick and easy access to the tool via an Android device.
After opening the app in mobile Chrome at `http://server_ip:8000`, you can click on the more options icon in
top right and select add to homescreen.  A shorcut to the app will be placed on your homescreen.

# Requirements
Node ~> v6.9.1
Python3 ~> v3.4.3
Pip3 ~> 1.5.4
