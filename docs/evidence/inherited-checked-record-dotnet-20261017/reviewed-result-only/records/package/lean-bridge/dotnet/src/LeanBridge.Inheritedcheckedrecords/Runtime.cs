using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace LeanBridge.Inheritedcheckedrecords.Interop;


[StructLayout(LayoutKind.Sequential)]
internal struct N0
{
    internal nint Data;
    internal nuint Length;
    internal nint Context;
    internal nint Release;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N1
{
    internal N0 F0;
    internal N0 F1;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N2
{
    internal N1 F0;
    internal N0 F1;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N3
{
    internal N2 F0;
    internal N0 F1;
}
[StructLayout(LayoutKind.Sequential)]
internal struct NativeError
{
    internal int Code;
    internal nint Message;
    internal nuint Length;
}

internal sealed unsafe class Scope : IDisposable
{
    private readonly global::System.Collections.Generic.List<nint> allocations = new();
    private int remaining = 16 * 1024 * 1024;
    internal void Charge(int count, int width)
    {
        if (count < 0 || width <= 0 || count > remaining / width) throw new ArgumentException("Lean Bridge copy budget exceeded (16 MiB per call)");
        remaining -= count * width;
    }
    internal nint Allocate(int count, int width, int chargeWidth = 0)
    {
        Charge(count, chargeWidth == 0 ? width : chargeWidth);
        if (count == 0) return 0;
        var data = (nint)NativeMemory.AllocZeroed(checked((nuint)count * (nuint)width));
        if (data == 0) throw new OutOfMemoryException();
        try { allocations.Add(data); }
        catch { NativeMemory.Free((void*)data); throw; }
        return data;
    }
    public void Dispose()
    {
        foreach (var data in allocations) NativeMemory.Free((void*)data);
        allocations.Clear();
    }
}



internal static unsafe class Runtime
{
    private static readonly UTF8Encoding Utf8 = new(false, true);
    private static void Check(int status, NativeError error)
    {
        if (status == 0) return;
        var message = error.Message == 0 ? "Lean call failed" : Utf8.GetString(new ReadOnlySpan<byte>((void*)error.Message, checked((int)error.Length)));
        if (status == 1) throw new ArgumentException(message);
        throw new LeanBridgeException(status, message);
    }
    private static ReadOnlySpan<T> CheckedBuffer<T>(nint data, nuint length, int alignment) where T : unmanaged
    {
        if (length > (nuint)((16 * 1024 * 1024) / sizeof(T)))
            throw new ArgumentException("Lean Bridge native buffer exceeds the 16 MiB copy limit");
        if (length == 0) return ReadOnlySpan<T>.Empty;
        if (data == 0 || (nuint)data % (nuint)alignment != 0)
            throw new InvalidOperationException("Invalid native buffer");
        return new ReadOnlySpan<T>((void*)data, checked((int)length));
    }
    private static N0 To0(global::System.Numerics.BigInteger value, Scope scope)
    {
        if (value.Sign < 0) throw new ArgumentOutOfRangeException(nameof(value), "Lean Nat cannot be negative");
        var magnitude = global::System.Numerics.BigInteger.Abs(value);
        var limbs = value.IsZero ? 0 : checked((magnitude.GetByteCount(isUnsigned: true) + 3) / 4);
        var data = scope.Allocate(limbs, sizeof(uint));
        if (limbs != 0 && !magnitude.TryWriteBytes(new global::System.Span<byte>((void*)data, checked(limbs * 4)), out _, isUnsigned: true, isBigEndian: false)) throw new InvalidOperationException("Integer conversion failed");
        return new N0 { Data = data, Length = (nuint)limbs };
    }
    private static global::System.Numerics.BigInteger From0(N0 value)
    {
        var digits = CheckedBuffer<uint>(value.Data, value.Length, 4);
        if (!digits.IsEmpty && digits[^1] == 0) throw new InvalidOperationException("Invalid native integer magnitude");
        var result = new global::System.Numerics.BigInteger(global::System.Runtime.InteropServices.MemoryMarshal.AsBytes(digits), isUnsigned: true, isBigEndian: false);
        return result;
    }
    private static N1 To1(Span value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        scope.Charge(1, sizeof(N1));
        return new N1 { F0 = To0(value.Lo, scope), F1 = To0(value.Hi, scope) };
    }
    private static Span From1(N1 value)
    {
        return new Span(From0(value.F0), From0(value.F1));
    }
    private static N2 To2(Ticket value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        scope.Charge(1, sizeof(N2));
        return new N2 { F0 = To1(value.ToSpan, scope), F1 = To0(value.Word, scope) };
    }
    private static Ticket From2(N2 value)
    {
        return new Ticket(From1(value.F0), From0(value.F1));
    }
    private static N3 To3(Stamped value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        scope.Charge(1, sizeof(N3));
        return new N3 { F0 = To2(value.ToTicket, scope), F1 = To0(value.Mark, scope) };
    }
    private static Stamped From3(N3 value)
    {
        return new Stamped(From2(value.F0), From0(value.F1));
    }

    internal static Ticket Call0(global::System.Numerics.BigInteger arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To0(arg0, scope);
        N2 output = default;
        try
        {
            var status = Native.Call0(in input0, ref output, out var error);
            
            Check(status, error);
            return From2(output);
        }
        finally { Native.Clear2(ref output); }
    }
    internal static Stamped Call1(global::System.Numerics.BigInteger arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To0(arg0, scope);
        N3 output = default;
        try
        {
            var status = Native.Call1(in input0, ref output, out var error);
            
            Check(status, error);
            return From3(output);
        }
        finally { Native.Clear3(ref output); }
    }
}

internal static class Native
{
    private const string Library = "libinheritedcheckedrecords.so";
    static Native() => NativeLibrary.SetDllImportResolver(typeof(Native).Assembly, (name, assembly, searchPath) => name == Library ? Assets.Handle : 0);
    internal static void EnsureProcess() => Assets.EnsureProcess();
    private static class Assets
    {
    [global::System.Runtime.InteropServices.DllImport("libc", EntryPoint = "getpid", ExactSpelling = true)]
    private static extern int CurrentProcess();
    [global::System.Runtime.InteropServices.DllImport("libdl.so.2", EntryPoint = "dlopen", ExactSpelling = true)]
    private static extern nint Open([global::System.Runtime.InteropServices.MarshalAs(global::System.Runtime.InteropServices.UnmanagedType.LPUTF8Str)] string path, int flags);
    [global::System.Runtime.InteropServices.DllImport("libdl.so.2", EntryPoint = "dlclose", ExactSpelling = true)]
    private static extern int Close(nint handle);
    private const string ProcessKey = "lean-bridge.native-library-v1.dotnet.process";
    // A package first touched in a forked child must retain the origin of a
    // peer's already loaded runtime, rather than adopting the child's PID.
    private static readonly int Process = global::System.OperatingSystem.IsLinux()
        ? global::System.AppDomain.CurrentDomain.GetData(ProcessKey) is int original ? original : CurrentProcess()
        : 0;
    private static nint handle;
    internal static bool IsLoaded { get { EnsureProcess(); return global::System.Threading.Volatile.Read(ref handle) != 0; } }
    internal static void EnsureProcess()
    {
        if (!global::System.OperatingSystem.IsLinux()) throw new global::System.PlatformNotSupportedException("This Lean package requires Linux x86-64 with glibc");
        if (Process != CurrentProcess()) throw new global::System.InvalidOperationException("Lean calls after fork require a fresh process");
    }
    internal static nint Handle
    {
        get
        {
            EnsureProcess();
            var ready = global::System.Threading.Volatile.Read(ref handle);
            if (ready != 0) return ready;
            if (!global::System.OperatingSystem.IsLinux()
                || global::System.Runtime.InteropServices.RuntimeInformation.ProcessArchitecture != global::System.Runtime.InteropServices.Architecture.X64
                || !global::System.BitConverter.IsLittleEndian)
                throw new global::System.PlatformNotSupportedException("This Lean package requires Linux x86-64 with glibc");
            const string library = "libinheritedcheckedrecords.so";
            var roots = new[] { global::System.IO.Path.Combine(global::System.AppContext.BaseDirectory, "runtimes", "linux-x64", "native"), global::System.AppContext.BaseDirectory };
            var root = global::System.Array.Find(roots, path => global::System.IO.File.Exists(global::System.IO.Path.Combine(path, library)))
                ?? throw new global::System.DllNotFoundException("The installed Lean native assets are missing");
            VerifyDirectory(root);
            if (root == roots[0]) { VerifyDirectory(global::System.IO.Path.GetDirectoryName(root)!); VerifyDirectory(global::System.IO.Path.GetDirectoryName(global::System.IO.Path.GetDirectoryName(root)!)!); }
            var libraries = new global::System.Collections.Generic.Dictionary<string, string>(global::System.StringComparer.Ordinal)
            {
                ["libcomponent_95491bb762dabafaf0ed.so"] = "e183f646c9ebeddc2ef01799f4e7480c27b6bcba74b7b0b4e61025277eee15cf",
                ["libinheritedcheckedrecords.so"] = "78d759244f7cefb25951d4139e12d8ceb26217ac7b1b9201c4e364310ee32450",
                ["liblean_bridge_native.so"] = "459fcd2098d4b646ab6ae0f4cdccd1f222908cb162562bfc3940a533cd4e4e21",
                ["libleanshared.so"] = "d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4",
            };
            foreach (var item in libraries) Verify(global::System.IO.Path.Combine(root, item.Key), item.Value);
            var domain = global::System.AppDomain.CurrentDomain;
            lock (domain)
            {
                ready = global::System.Threading.Volatile.Read(ref handle);
                if (ready != 0) return ready;
                var origin = domain.GetData(ProcessKey);
                if (origin is not null && !global::System.Object.Equals(origin, Process))
                    throw new global::System.InvalidOperationException("Lean runtime process origin differs; start a fresh process");
                if (origin is null) domain.SetData(ProcessKey, Process);
                const string key = "lean-bridge.native-library-v1.dotnet";
                var registry = domain.GetData(key) as global::System.Collections.Generic.Dictionary<string, object>;
                if (registry is null)
                {
                    registry = new(global::System.StringComparer.Ordinal);
                    domain.SetData(key, registry);
                }
                const string identity = "4b5a7fdf0cb11d4bb429181cfd50b330c5622ed8f5f5382a293955a439b595b5";
                const string policy = "linux-x64-deepbind-v1";
                if (registry.TryGetValue("runtime", out var existing) && !global::System.Object.Equals(existing, identity))
                    throw new global::System.InvalidOperationException("Incompatible Lean runtime identities in one process");
                if (existing is not null && (!registry.TryGetValue("policy", out var oldPolicy) || !global::System.Object.Equals(oldPolicy, policy)))
                    throw new global::System.InvalidOperationException("Incompatible Lean native loading policy");
                if (registry.ContainsKey("failed")) throw new global::System.InvalidOperationException("Lean native loading failed earlier in this process");
                const string component = "component:inheritedcheckedrecords@1.0.0";
                const string receipt = "96bbc41bcdf49367b67278302091c7bd5bf48584da85c64f4f5ad54caf8554eb";
                if (registry.TryGetValue(component, out var loaded))
                {
                    var entry = (global::System.Tuple<string, nint>)loaded;
                    if (entry.Item1 != receipt) throw new global::System.InvalidOperationException("Conflicting builds of the same Lean component");
                    global::System.Threading.Volatile.Write(ref handle, entry.Item2);
                    return entry.Item2;
                }
                var known = registry.TryGetValue("libraries", out var values)
                    ? (global::System.Collections.Generic.Dictionary<string, global::System.Tuple<string, nint>>)values
                    : new(global::System.StringComparer.Ordinal);
                foreach (var item in libraries)
                {
                    if (known.TryGetValue(item.Key, out var previous))
                    {
                        if (previous.Item1 != item.Value) throw new global::System.InvalidOperationException("Conflicting builds of the same native library: " + item.Key);
                        continue;
                    }
                    // RTLD_NOLOAD checks both soname and installed pathname.
                    foreach (var candidate in new[] { item.Key, global::System.IO.Path.Combine(root, item.Key) })
                    {
                        var prior = Open(candidate, 2 | 4);
                        if (prior == 0) continue;
                        Close(prior);
                        throw new global::System.InvalidOperationException("Unverified native library is already loaded: " + item.Key);
                    }
                }
                try
                {
                    registry["libraries"] = known;
                    foreach (var name in new[] { "libleanshared.so", "liblean_bridge_native.so", "libcomponent_95491bb762dabafaf0ed.so", "libinheritedcheckedrecords.so" })
                    {
                        if (known.ContainsKey(name)) continue;
                        // RTLD_NOW | RTLD_GLOBAL | RTLD_DEEPBIND isolates Lean
                        // and private GMP from a host's earlier global symbols.
                        var value = Open(global::System.IO.Path.Combine(root, name), 2 | 256 | 8);
                        if (value == 0) throw new global::System.DllNotFoundException("Cannot load verified Lean native library: " + name);
                        known[name] = global::System.Tuple.Create(libraries[name], value);
                    }
                    ready = known[library].Item2;
                    registry["runtime"] = identity; registry["policy"] = policy;
                    registry["lean"] = known["libleanshared.so"].Item2;
                    registry["broker"] = known["liblean_bridge_native.so"].Item2;
                    registry[component] = global::System.Tuple.Create(receipt, ready);
                    global::System.Threading.Volatile.Write(ref handle, ready);
                    return ready;
                }
                catch { registry["failed"] = true; throw; }
            }
        }
    }
    private static void VerifyDirectory(string path)
    {
        var attributes = global::System.IO.File.GetAttributes(path);
        if ((attributes & global::System.IO.FileAttributes.ReparsePoint) != 0 || (attributes & global::System.IO.FileAttributes.Directory) == 0)
            throw new global::System.InvalidOperationException("Native library directory must be a regular directory");
    }
    private static void Verify(string path, string expected)
    {
        var attributes = global::System.IO.File.GetAttributes(path);
        if ((attributes & (global::System.IO.FileAttributes.ReparsePoint | global::System.IO.FileAttributes.Directory)) != 0)
            throw new global::System.InvalidOperationException("Installed Lean native library must be a regular file: " + global::System.IO.Path.GetFileName(path));
        using var file = global::System.IO.File.OpenRead(path);
        if (!string.Equals(global::System.Convert.ToHexString(global::System.Security.Cryptography.SHA256.HashData(file)), expected, global::System.StringComparison.OrdinalIgnoreCase))
            throw new global::System.InvalidOperationException("Installed Lean native library differs from the compiled package: " + global::System.IO.Path.GetFileName(path));
    }

    }
    [DllImport(Library, EntryPoint = "inheritedcheckedrecords_produce", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call0(in N0 input0, ref N2 output, out NativeError error);
    [DllImport(Library, EntryPoint = "inheritedcheckedrecords_produce_stamped", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call1(in N0 input0, ref N3 output, out NativeError error);

    [DllImport(Library, EntryPoint = "inheritedcheckedrecords_nat_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear0(ref N0 value);
    [DllImport(Library, EntryPoint = "inheritedcheckedrecords_span_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear1(ref N1 value);
    [DllImport(Library, EntryPoint = "inheritedcheckedrecords_ticket_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear2(ref N2 value);
    [DllImport(Library, EntryPoint = "inheritedcheckedrecords_stamped_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear3(ref N3 value);
}
