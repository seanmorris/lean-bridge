using System;
using System.IO;
using System.Collections.Generic;
using System.Threading.Tasks;
using A = LeanBridge.Workshop;

public sealed class Box(uint level) {
    public uint Level { get; set; } = level;
    public Box Identity() => this;
    public uint Read() => Level;
}

public static class Client {
    static void Check(bool ok, string operation) { if (!ok) throw new Exception(operation); }
    static async Task Run() {
        using var binding = A.Api.BindHosts<Box>();
        Check(binding.Read(new Box(41)) == 41, "host binding");
        string boot = binding.ReadBoot();
        Check(boot == "from-app", "startup");
        const string path = "state";
        File.WriteAllText(path, "open");
        uint ordinary = binding.Observe(path);
        Task<uint> task = A.Api.Worker(path);
        Check(ordinary == 37 && await task == 37, "sync IO and worker");
        IAsyncEnumerable<uint> stream = A.Api.Walk(path);
        var cursor = stream.GetAsyncEnumerator();
        try {
            Check(await cursor.MoveNextAsync() && cursor.Current == 37, "first pull");
            File.WriteAllText(path, "changed");
            Check(await cursor.MoveNextAsync() && cursor.Current == 0, "second pull");
            Check(File.ReadAllText(path) == "changed", "close ran before disposal");
        } finally { await cursor.DisposeAsync(); }
        Check(File.ReadAllText(path) == "closed", "DisposeAsync skipped finalizer");
        File.WriteAllText(path, "after-close");
        Check(!await cursor.MoveNextAsync(), "disposed cursor yielded");
        await cursor.DisposeAsync();
        Check(File.ReadAllText(path) == "after-close", "second disposal repeated IO");
        Console.WriteLine("CLR startup, sync IO, Task, IAsyncEnumerable and early disposal passed");
    }
    public static void Main() => A.LeanRuntime.Run(Run);
}
