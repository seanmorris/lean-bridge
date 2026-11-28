namespace DirectTariff
{
    using System;
    using System.Collections.Generic;
    using System.Runtime.InteropServices;
    using System.Text.Json;
    using System.Threading;

    internal static class Observer
    {
        [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
        private delegate void SnapshotRead(nint output);
        static int Live()
        {
            var registry = (Dictionary<string,object>)AppDomain.CurrentDomain.GetData("lean-bridge.native-library-v1.dotnet")!;
            nint broker = (nint)registry["broker"];
            var read = Marshal.GetDelegateForFunctionPointer<SnapshotRead>(NativeLibrary.GetExport(broker,"lean_bridge_native_snapshot_read"));
            var buffer = Marshal.AllocHGlobal(40);
            try {
                read(buffer);
                if (Marshal.ReadInt32(buffer) != 1) throw new Exception("wrong broker");
                return Marshal.ReadInt32(buffer,20);
            } finally { Marshal.FreeHGlobal(buffer); }
        }
        static void Main()
        {
            var counts = new Dictionary<string,int>();
            Exception? failed = null;
            var owner = new Thread(() => {
                try {
                    Application.Run(name => {
                        int count = Live(); counts.Add(name,count);
                        if (name == "held" ? count <= counts["baseline"] : count != counts["baseline"])
                            throw new Exception(name + ": unexpected native ownership count " + count);
                    });
                } catch (Exception e) { failed = e; }
            });
            owner.Start(); owner.Join();
            if (failed != null) throw new Exception("owner thread failed",failed);
            if (!SpinWait.SpinUntil(() => Live() == 0,TimeSpan.FromSeconds(10)))
                throw new Exception("native owners survived thread exit");
            counts.Add("afterThreadExit",Live());
            Console.WriteLine(JsonSerializer.Serialize(counts));
        }
    }
}
