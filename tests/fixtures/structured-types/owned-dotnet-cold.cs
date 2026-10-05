using System;
using System.Numerics;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Threading;
using A = LeanBridge.OwnedAggregates;
using C = LeanBridge.CopiedPeer;
using D = LeanBridge.PlainPeer;

internal static class ColdState { internal static bool Initialized; }

// ColdAssets contains the exact common loader for the installed owned peer.
// Its explicit type initializer makes deferred initialization observable.
internal static unsafe class Program
{
    [UnmanagedCallersOnly(CallConvs = new[] { typeof(CallConvCdecl) })]
    private static int Child(int kind)
    {
        try
        {
            if (kind < 0) throw new InvalidOperationException("fresh process");
            if (kind == 0) _ = ColdAssets.Handle;
            else ColdAssets.EnsureProcess();
            return 1;
        }
        catch (InvalidOperationException error)
        { return error.Message.Contains("fresh process") ? 0 : 2; }
        catch { return 3; }
    }
    private static void Prepare(Type type)
    {
        foreach (var method in type.GetMethods(BindingFlags.Public | BindingFlags.NonPublic
            | BindingFlags.Static | BindingFlags.Instance | BindingFlags.DeclaredOnly))
            if (method.GetMethodBody() is not null) RuntimeHelpers.PrepareMethod(method.MethodHandle);
        if (type.TypeInitializer is not null) RuntimeHelpers.PrepareMethod(type.TypeInitializer.MethodHandle);
        foreach (var child in type.GetNestedTypes(BindingFlags.Public | BindingFlags.NonPublic)) Prepare(child);
    }
    private static void Initialize(string origin)
    {
        if (origin == "owned")
        {
            using var ticket = A.Api.NewTicket(42, "parent");
            if (A.Api.Serial(ticket) != 42) throw new Exception("owned parent call failed");
        }
        else if (origin == "copied")
        {
            if (C.Api.Answer() != (BigInteger.One << 200) + 31) throw new Exception("copied parent call failed");
        }
        else if (origin == "plain")
        {
            if (D.Api.Answer() != 42) throw new Exception("plain parent call failed");
        }
        else throw new Exception("unknown parent origin");
    }
    private static void Main(string[] args)
    {
        if (Environment.GetEnvironmentVariable("DOTNET_EnableWriteXorExecute") is not null
            || Environment.GetEnvironmentVariable("COMPlus_EnableWriteXorExecute") is not null)
            throw new Exception("The probe requires default CLR protections");
        Initialize(args[0]);
        if (!Equals(AppDomain.CurrentDomain.GetData("lean-bridge.native-library-v1.dotnet.process"), Environment.ProcessId))
            throw new Exception("The installed parent loader did not publish its process origin");
        Prepare(typeof(ColdAssets));
        if (((delegate* unmanaged[Cdecl]<int, int>)&Child)(-1) != 0) throw new Exception("exception path preparation failed");
        if (ColdState.Initialized) throw new Exception("The cold loader initialized before fork");
        var native = NativeLibrary.Load(System.IO.Path.Combine(AppContext.BaseDirectory, "cold-fork.so"));
        var fork = (delegate* unmanaged[Cdecl]<delegate* unmanaged[Cdecl]<int, int>, int, void>)NativeLibrary.GetExport(native, "probe_fork_exit");
        using var locked = new ManualResetEventSlim();
        using var release = new ManualResetEventSlim();
        var holder = new Thread(() => { lock (AppDomain.CurrentDomain) { locked.Set(); release.Wait(); } });
        holder.IsBackground = true;
        holder.Start();
        if (!locked.Wait(10000)) throw new Exception("registry lock not held");
        Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new {
            origin = args[0], kind = int.Parse(args[1]), installedOrigin = true,
            coldInParent = !ColdState.Initialized, registryLockHeld = true, defaultClrProtections = true
        }));
        Console.Out.Flush();
        // Native wait/_exit avoids returning to the parent's CLR after the
        // child's first use of a previously uninitialized generated class.
        fork(&Child, int.Parse(args[1]));
        throw new Exception("native fork probe returned unexpectedly");
    }
}
