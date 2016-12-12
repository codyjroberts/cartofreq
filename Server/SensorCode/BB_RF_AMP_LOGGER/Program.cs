using System;
using System.Collections.Generic;
using System.Linq;
using AgSal;
using System.Net;
using System.Runtime.InteropServices;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Timers;
using System.IO.Ports;

namespace BB_RF_AMP_LOGGER
{
    class Program
    {

        private static Sweeper sweeper = new Sweeper();

        static void Main(string[] args)
        {
            int theInt = 0;
            bool result = Int32.TryParse(args[0], out theInt);
            string filename = "sensorLog";
            // string ipAddress = "131.193.76.91";
            bool externalGPS = false;

            string portName = "COM3";
            int baudRate = 9600;


            if (args.Length > 10)
            {
                Console.WriteLine("Too many arguments. Press enter to quit");
                Console.ReadLine();
                System.Environment.Exit(1);
            }

            if (args.Length == 1 && args[0] == "-h")
            {
                Console.WriteLine("---Keysight n6841 Logger Help---");
                Console.WriteLine();
                Console.WriteLine("-f filename w/o extension");
                Console.WriteLine("-i ip address of sensor");
                Console.WriteLine("-t logging interval in milliseconds");
                Console.WriteLine("-p com port of GPS");
                Console.WriteLine("-b baud rate of GPS");
                Console.WriteLine();
                Console.WriteLine("---Press <enter> to exit---");
                Console.ReadLine();
                System.Environment.Exit(1);
            }


            for (int i = 0; i < args.Length; i++)
            {
                if (args[i] == "-f")
                {
                    filename = args[i + 1];
                }
                if (args[i] == "-t")
                {
                   // theInt = Int32.Parse(args[i + 1]);
                }
                if (args[i] == "-i")
                {
                    // ipAddress = args[i + 1];
                }
                if (args[i] == "-p")
                {
                    portName = args[i + 1];
                }
                if (args[i] == "-b")
                {
                    baudRate = Int32.Parse(args[i + 1]);
                }

            }




            //nmeaDevice.ReceiveSentence += new EventHandler(nmeaDevice_ReceiveSentence);
            //nmeaDevice.OpenPort(3, 9600);
            //nmeaDevice.Start();

            filename = filename + DateTime.Now.ToString("yyyyMMddHHmmss") + ".csv";


            //using (StreamWriter writer = File.AppendText(filename))
            //{
            sweeper.init();
            Console.WriteLine();
            Console.WriteLine("Logging with an interval of " + theInt + " ms to file " + filename);
            Console.WriteLine();
            Console.WriteLine("Press any key to start...");
            Console.ReadLine();
            Console.WriteLine("Starting");
            sweeper.setFileName(filename);
            // sweeper.setIp(ipAddress);
            // Console.WriteLine(ipAddress);
            sweeper.setTimer(theInt);
            //sweeper.setWriter(writer);
            if (externalGPS)
            {
                sweeper.startGps(portName, baudRate);
            }
            sweeper.setSweep();
            sweeper.start();
            Console.WriteLine("Logging...");
            //Console.Clear();
            Console.ReadLine();
            if (externalGPS)
            {
                sweeper.stopGps();
            }
            sweeper.stop();
            // writer.Flush();
            //}
        }
    }

    class ConsoleSpiner
    {
        int counter;
        public ConsoleSpiner()
        {
            counter = 0;
        }
        public void Turn(int c, string t, string lat, string lon)
        {
            //Console.Clear();
            //Console.SetCursorPosition(0, 0);
            counter++;
            switch (counter % 4)
            {
                case 0: Console.Write("/"); break;
                case 1: Console.Write("-"); break;
                case 2: Console.Write("\\"); break;
                case 3: Console.Write("|"); break;
            }
            Console.WriteLine(" Writing row: " + c);
            Console.WriteLine("TIME " + t + " LAT " + lat + " LON " + lon);
        }
    }

    class Sweeper{
        string sensorIp = "131.193.76.157";
        string appName = "rf-vis";
        IntPtr sensorHandle;

        AgSalLib.SweepParms sweepParams;
        AgSalLib.salFlowControl flowControl;
        AgSalLib.FrequencySegment[] pSegmentTable;
        AgSalLib.SensorCapabilities sensorCapabilities;

        string fileName;
        IntPtr measurementHandle;

        System.Timers.Timer sweepTimer;
        private AgSalLib.SAL_SEGMENT_CALLBACK segmentCallback;
        const int fftBlockSize = 64;
        int numPoints = 0;
        float[] amplitudeData;
        // Centers for frequencies.
        //e3 is KHZ
        //e6 is MHZ
        //e9 is GHZ
        //5ghz wifi 4915mhz  to  5825mhz center = 5,370MHZ delta +- 455MHZ
        //2.4ghz wifi 2412mhz to  2484mhz center = 2,448MHZ  +- 36MHZ
        //fm 88.1mhz to 108.1mhz center 981MHZ delta 100MHz
        //am 540khz to 1600khz center = 1,070 KHZ delta 535 kHZ
        //TV1 54mhz to 88mhz center = 71MHZ delta 17MHZ
        //TV2 175mhz to 216mhz center = 195.5MHZ delta 20.5MHZ


        double[] segments = new double[] { 5370e6, 2448e6, 981e6, 1070e3, 71e6, 195.5e6 };
        double[] segmentRange = new double[] { 445e6, 36e6, 100e6, 535e3, 17e6, 20.5e6 };
        string[] segmentNames = new string[] { "5GHZ wifi", "2.4GHZ wifi", "FM Radio", "AM Radio", "Tv 1", "Tv 2" };

        //double[] segments = new double[] {71e6};
        //double[] segmentRange = new double[] {17e6};
        //string[] segmentNames = new string[] { "Tv 1" };
        double[] fftFreqAverage;

        double freqSpan = 10e6;
        StreamWriter writer;
        ConsoleSpiner spin = new ConsoleSpiner();
        int rowCounter = 0;
        bool firstRow;
        CsvRow tempRow = new CsvRow();
        AgSalLib.TimeInfo timestamp;
        AgSalLib.Location location;
        AgSalLib.SweepStatus status;
        double elapsed;
        SerialPort gpsPort;
        string extLat = "NULL";
        string extLon = "NULL";
        string extTime = "NULL";

        public void init() {
            fftFreqAverage = new double[segments.Length];
            for (int i = 0; i < fftFreqAverage.Length; i++)
            {
                fftFreqAverage[i] = 0;
            }
        }

        public void setFileName(string f)
        {
            fileName = f;
            firstRow = true;
        }

        public void setIp(string i)
        {
            sensorIp = i;
        }

        public void setTimer(int t)
        {
            sweepTimer = new System.Timers.Timer((int) 1);
            sweepTimer.Elapsed += Sweep;
        }

        public void setWriter(StreamWriter w)
        {
            writer = w;
        }

        public void start()
        {
            sweepTimer.AutoReset = true;
            sweepTimer.Enabled = true;
        }

        public void stop()
        {
            sweepTimer.Stop();
            sweepTimer.Dispose();
        }

        public void startGps(string p, int b)
        {
            Console.WriteLine("port: " + p);
            Console.WriteLine("baud: " + b);

            gpsPort = new SerialPort();
            gpsPort.PortName = p;
            gpsPort.BaudRate = b;
            gpsPort.NewLine = "\r\n";

            try
            {
                gpsPort.Open();
            }
            catch (System.IO.IOException)
            {
                Console.WriteLine("Failed to Open GPS port");
            };

            Console.WriteLine("GPS Started");
        }

        public void stopGps()
        {
            gpsPort.Close();
            gpsPort.Dispose();
        }

        public void readNmeaSentence()
        {
            string nmeaSentence;
            string[] nmeaSplitResult;
            nmeaSentence = gpsPort.ReadLine();
            Console.WriteLine(nmeaSentence);
            if (nmeaSentence.StartsWith("$"))
            {
                nmeaSplitResult = Regex.Split(nmeaSentence, ",");
                if (nmeaSplitResult[0].Equals("$GPRMC"))
                {
                    if (!nmeaSplitResult[1].Equals(""))
                    {
                        extTime = nmeaSplitResult[1];
                    }
                    else
                    {
                        extLat = "NULL";
                    }
                    if (!nmeaSplitResult[3].Equals(""))
                    {
                        extLat = nmeaSplitResult[3];
                    }
                    else
                    {
                        extLat = "NULL";
                    }
                    if (!nmeaSplitResult[5].Equals(""))
                    {
                        extLon = nmeaSplitResult[5];
                    }
                    else
                    {
                        extLon = "NULL";
                    }
                }
                else
                {
                    Console.WriteLine("");
                    Console.WriteLine("No FIX");
                }
            }
        }

        public void WriteRow(CsvRow row)
        {


            DirectoryInfo di = new DirectoryInfo("./t");
            FileInfo[] TXTFiles = di.GetFiles("*.txt");
            Console.WriteLine(TXTFiles.Length);
            if (50 > TXTFiles.Length){

                DateTime dateValue = new DateTime();
                dateValue = DateTime.Now;
                string b = dateValue.ToString("fff");


                Int32 unixTimestamp = (Int32)(DateTime.UtcNow.Subtract(new DateTime(1970, 1, 1))).TotalSeconds;
                string s = unixTimestamp.ToString();
                string path ="./t/"+ s + b + ".txt";

                // This text is added only once to the file.
                if (!File.Exists(path))
                {
                    string createText="";
                    if (location.longitude.ToString() != "0" && location.longitude.ToString() != "0")
                    {
                        // Create a file to write to.
                        createText += "{\"name\": \"Sensor1\",\"lat\": \"" + location.longitude.ToString() + "\",\"lng\": \"" + location.longitude.ToString() + "\",\"children\": [";
                        for (int i = 0; i < segments.Length; i++)
                        {
                            createText += "{\"name\": \"" + segmentNames[i] + "\",\"size\": \"" + fftFreqAverage[i] + "\"}";
                            if (i < segments.Length - 1)
                            {
                                createText += ",";
                            }
                        }
                    }
                    else
                    {
                        // Create a file to write to.
                        createText += "{\"name\": \"Sensor1\",\"lat\": \"41.870484\",\"lng\": \"-87.648857\",\"children\": [";
                        for (int i = 0; i < segments.Length; i++)
                        {
                            createText += "{\"name\": \"" + segmentNames[i] + "\",\"size\": \"" + fftFreqAverage[i] + "\"}";
                            if (i < segments.Length - 1)
                            {
                                createText += ",";
                            }
                        }


                    }

                    createText+="]}" + Environment.NewLine;

                    File.WriteAllText(path, createText);
                }
            }

            rowCounter++;

        }

        public void setSweep()
        {

            double[] fftFreqAverage = new double[segments.Length];
            for (int i = 0; i < fftFreqAverage.Length; i++) {
                fftFreqAverage[i] = 0;
            }

            sweepParams = new AgSalLib.SweepParms();
            sweepParams.numSweeps = 1; // 0 = sweep forever
            sweepParams.numSegments = (uint)segments.Length;

            flowControl = new AgSalLib.salFlowControl();

            float maxBytesPerSec = 500e3F;
            flowControl.pacingPolicy = 1;
            flowControl.maxBacklogSeconds = 0.5F;
            flowControl.maxBacklogMessages = 50;
            flowControl.maxBytesPerSec = maxBytesPerSec;


            connectToSensor();
            getSensorCapibilities();



            pSegmentTable = new AgSalLib.FrequencySegment[segments.Length];
            numPoints = (int)(fftBlockSize * freqSpan / sensorCapabilities.maxSampleRate);
            amplitudeData = new float[numPoints];
            int firstPoint = (fftBlockSize - numPoints) / 2;

            for (var i = 0; i < segments.Length; i++)
            {
               //numPoints = (int)(fftBlockSize * segmentRange[i] / sensorCapabilities.maxSampleRate);

               //amplitudeData = new float[numPoints];

               //int firstPoint = (fftBlockSize - numPoints) / 2;

                pSegmentTable[i].numFftPoints = (uint)fftBlockSize;
                pSegmentTable[i].numPoints = (uint)numPoints;
                pSegmentTable[i].firstPoint = (uint)firstPoint;
                pSegmentTable[i].centerFrequency = segments[i];
                pSegmentTable[i].sampleRate = sensorCapabilities.maxSampleRate;
            }

            Console.WriteLine("323");


            segmentCallback = new AgSalLib.SAL_SEGMENT_CALLBACK(callback);

            tempRow.Add("INT_TIME");
            tempRow.Add("INT_LAT");
            tempRow.Add("INT_LON");
            tempRow.Add("EXT_TIME");
            tempRow.Add("EXT_LAT");
            tempRow.Add("EXT_LON");


        }

        public void Sweep(Object source, ElapsedEventArgs e)
        {
            Console.WriteLine("SWEEP");

            AgSalLib.salGetSensorTime(sensorHandle, out timestamp);
            AgSalLib.salGetSensorLocation(sensorHandle, out location);


            if (!firstRow)
            {
                tempRow.Add(timestamp.ToString());
                tempRow.Add(location.latitude.ToString());
                tempRow.Add(location.longitude.ToString());
                tempRow.Add(extTime);
                tempRow.Add(extLat);
                tempRow.Add(extLon);
            }

            spin.Turn(rowCounter, timestamp.ToString(), location.latitude.ToString(), location.longitude.ToString());

            AgSalLib.SalError sweepError = AgSalLib.salStartSweep2(
                out measurementHandle,
                sensorHandle,
                ref sweepParams,
                ref pSegmentTable,
                ref flowControl,
                segmentCallback
                );

            getStatus();
        }


        private int callback(ref AgSalLib.SegmentData dataHeader, IntPtr data){
            Marshal.Copy(data, amplitudeData, 0, (int)dataHeader.numPoints);

            //Leaving for CSV writier, not needed in new implementation. can remove later.
            for (int i = 0; i < dataHeader.numPoints; i++){
                if (firstRow == true) {
                    double mhz = (dataHeader.startFrequency + (i * dataHeader.frequencyStep)) / 1e6;
                    double rndMhz = Math.Round(mhz, 3);
                    tempRow.Add("RF" + rndMhz.ToString() + "MHZ");
                }
                else{
                    //Console.WriteLine("adding data to string");
                    tempRow.Add(amplitudeData[i].ToString());
                }
            }
            //For Writing Json and taking average FFT value for given freq.
            double TotalFreq = 0;
            for (int i = 0; i < dataHeader.numPoints; i++){
                    TotalFreq += amplitudeData[i];
            }

            double totalFreqRounded = Math.Round(TotalFreq/dataHeader.numPoints, 3);
            fftFreqAverage[dataHeader.segmentIndex]=totalFreqRounded;


            if (dataHeader.segmentIndex == segments.Length - 1){
                if (firstRow == true){
                    firstRow = false;
                    Console.WriteLine("firstRow=false");
                }
                Console.WriteLine("Writing line");
                WriteRow(tempRow);
                tempRow.Clear();
            }
            return 1;
        }
        public void connectToSensor(){

            Console.Write("Connecting to sensor...");

            AgSalLib.SalError connectionError = AgSalLib.salConnectSensor3(out sensorHandle, default(IntPtr), sensorIp, 0, appName, 0);
            if (connectionError != AgSalLib.SalError.SAL_ERR_NONE){
                Console.WriteLine("***");
                Console.WriteLine("Aborting at connectToSensor() : salConnectSensor3 ");
                Console.WriteLine("-----------------------------------------------");
                Console.WriteLine("SensorHandle: " + sensorHandle.ToString());
                Console.WriteLine("sensorIp: " + sensorIp.ToString());
                Console.WriteLine("appName: " + appName.ToString());
                Console.WriteLine("ERROR: " + connectionError);
            }

            AgSalLib.SalError abortError = AgSalLib.salAbortAll(sensorHandle);
            if (abortError != AgSalLib.SalError.SAL_ERR_NONE) {
                Console.WriteLine("***");
                Console.WriteLine("abborting at connectoToSensor() : SalAbortALL");
                Console.WriteLine("-----------------------------------------------");
                Console.WriteLine("SensorHandle: " + sensorHandle.ToString());
                Console.WriteLine("ERROR: " + abortError);
            }

            if (connectionError == AgSalLib.SalError.SAL_ERR_NONE && abortError == AgSalLib.SalError.SAL_ERR_NONE){
                Console.WriteLine("Connection Sucess!");
            }
        }

        public void getSensorCapibilities()
        {
            Console.Write("Getting capabilities...");

            AgSalLib.SalError capabilitiesError = AgSalLib.salGetSensorCapabilities(sensorHandle, out sensorCapabilities);
            if (capabilitiesError != AgSalLib.SalError.SAL_ERR_NONE){
                Console.WriteLine("***");
                Console.WriteLine("abborting at getSensorCapibilities() : salGetSensorCapabilities");
                Console.WriteLine("-----------------------------------------------");
                Console.WriteLine("SensorHandle: " + sensorHandle.ToString());
                Console.WriteLine("sensorCapabilities: " + sensorCapabilities.ToString());
                Console.WriteLine("ERROR: " + capabilitiesError);
            }
            else{
                Console.WriteLine("Capabilities Sucess!");
            }
        }
        public void getStatus() {
            AgSalLib.SalError statusError = AgSalLib.salGetSweepStatus2(sensorHandle, 0, out status, out elapsed);
            Console.WriteLine("STATUS: " + status.ToString());
            if (status == AgSalLib.SweepStatus.SweepStatus_stopped) {
                Console.WriteLine("STOPPED");
            }
        }

    }
}



public class CsvRow : List<string>
{
    public string LineText { get; set; }
}

