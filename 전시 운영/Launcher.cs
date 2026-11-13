using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

internal static class Launcher
{
    [STAThread]
    private static int Main()
    {
        try
        {
            string folder = AppDomain.CurrentDomain.BaseDirectory;
            string script = Path.Combine(folder, "Exhibition.ps1");
            if (!File.Exists(script))
                throw new FileNotFoundException("전시 운영 ZIP의 압축을 모두 풀어 주세요.");

            string powerShell = Path.Combine(Environment.SystemDirectory,
                @"WindowsPowerShell\v1.0\powershell.exe");
            string arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"" + script + "\"";
#if STOP_EXHIBITION
            arguments += " -Stop";
#endif
            var settings = new ProcessStartInfo(powerShell, arguments)
            {
                WorkingDirectory = folder,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using (Process child = Process.Start(settings))
            {
                child.WaitForExit();
                return child.ExitCode;
            }
        }
        catch (Exception error)
        {
            MessageBox.Show(error.Message, "전시 운영");
            return 1;
        }
    }
}
