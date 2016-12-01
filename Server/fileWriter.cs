using System;
using System.IO;
using System.Text;

class Test
{
	public static void Main()
	{
		while (true){
//			

			DirectoryInfo di = new DirectoryInfo("./");
			FileInfo[] TXTFiles = di.GetFiles("*.txt");
			Console.WriteLine(TXTFiles.Length);
			if(100>TXTFiles.Length){
				

				DateTime dateValue = new DateTime();
				dateValue = DateTime.Now;
				string b = dateValue.ToString("fff");
				
							
				Int32 unixTimestamp = (Int32)(DateTime.UtcNow.Subtract(new DateTime(1970, 1, 1))).TotalSeconds;
				string s = unixTimestamp.ToString();
				string path = s+b+".txt";

				// This text is added only once to the file.
				if (!File.Exists(path))
				{
					// Create a file to write to.
					string createText = "{\"name\": \"Sensor1\",\"lat\": \"lat\",\"lng\": \"lng\",\"children\": [{\"name\": \"freqname\",\"size\": \"signalstr in dBm\"},]}" + Environment.NewLine;
					File.WriteAllText(path, createText);
				}
			}
				
			System.Threading.Thread.Sleep(500);
		}
	}
}