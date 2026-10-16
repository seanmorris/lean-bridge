using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace LeanBridge.Nestedcheckedrecords.Interop;


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
    internal nint Data;
    internal nuint Length;
    internal nint Context;
    internal nint Release;
}

[StructLayout(LayoutKind.Sequential)]
internal struct C3_0
{
    internal byte Empty;
}
[StructLayout(LayoutKind.Sequential)]
internal struct C3_1
{
    internal N1 F0;
}
[StructLayout(LayoutKind.Explicit)]
internal struct V3
{
    [FieldOffset(0)] internal C3_0 Case0;
    [FieldOffset(0)] internal C3_1 Case1;
}
[StructLayout(LayoutKind.Sequential)]
internal struct N3
{
    internal uint Kind;
    internal V3 Cases;
}


[StructLayout(LayoutKind.Sequential)]
internal struct N4
{
    internal byte Flag;
    internal N1 F0;
    internal N1 F1;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N5
{
    internal N1 F0;
    internal N0 F1;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N6
{
    internal nint Data;
    internal nuint Length;
    internal nint Context;
    internal nint Release;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N7
{
    internal byte Flag;
    internal N1 F0;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N8
{
    internal N1 F0;
    internal N1 F1;
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
        if (limbs != 0 && !magnitude.TryWriteBytes(new Span<byte>((void*)data, checked(limbs * 4)), out _, isUnsigned: true, isBigEndian: false)) throw new InvalidOperationException("Integer conversion failed");
        return new N0 { Data = data, Length = (nuint)limbs };
    }
    private static global::System.Numerics.BigInteger From0(N0 value)
    {
        var digits = CheckedBuffer<uint>(value.Data, value.Length, 4);
        if (!digits.IsEmpty && digits[^1] == 0) throw new InvalidOperationException("Invalid native integer magnitude");
        var result = new global::System.Numerics.BigInteger(global::System.Runtime.InteropServices.MemoryMarshal.AsBytes(digits), isUnsigned: true, isBigEndian: false);
        return result;
    }
    private static N1 To1(Packet value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        scope.Charge(1, sizeof(N1));
        return new N1 { F0 = To0(value.Digit, scope), F1 = To0(value.Word, scope) };
    }
    private static Packet From1(N1 value)
    {
        return new Packet(From0(value.F0), From0(value.F1));
    }
    private static N2 To2(Packet[] value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        var data = scope.Allocate(value.Length, sizeof(N1), Math.Max(sizeof(N1), IntPtr.Size));
        for (var index = 0; index < value.Length; index++) ((N1*)data)[index] = To1(value[index], scope);
        return new N2 { Data = data, Length = (nuint)value.Length };
    }
    private static Packet[] From2(N2 value)
    {
        if (value.Length > (nuint)((16 * 1024 * 1024) / Math.Max(sizeof(N1), IntPtr.Size)))
            throw new ArgumentException("Lean Bridge native sequence exceeds the 16 MiB copy limit");
        if (value.Length != 0 && (value.Data == 0 || (nuint)value.Data % 8 != 0))
            throw new InvalidOperationException("Invalid native sequence buffer");
        var result = global::System.GC.AllocateUninitializedArray<Packet>(checked((int)value.Length));
        for (var index = 0; index < result.Length; index++) result[index] = From1(((N1*)value.Data)[index]);
        return result;
    }
    private static N3 To3(Choice value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        scope.Charge(1, sizeof(N3));
        return value switch
        {
            ChoiceEmpty => new N3 { Kind = 0 },
            ChoicePacket branch => new N3 { Kind = 1, Cases = new V3 { Case1 = new C3_1 { F0 = To1(branch.Value, scope) } } },
            _ => throw new ArgumentException("Expected a named Choice constructor", nameof(value))
        };
    }
    private static Choice From3(N3 value)
    {
        return value.Kind switch
        {
            0 => new ChoiceEmpty(),
            1 => new ChoicePacket(From1(value.Cases.Case1.F0)),
            _ => throw new InvalidOperationException("Invalid native Choice constructor")
        };
    }
    private static N4 To4(Result<Packet, Packet> value, Scope scope)
    {
        scope.Charge(1, sizeof(N4));
        if (value.IsOk) return new N4 { Flag = 1, F0 = To1(value.Value, scope) };
        if (value.IsError) return new N4 { F1 = To1(value.Error, scope) };
        throw new ArgumentException("Lean Except requires Result.Ok or Result.Err; default(Result) has no branch", nameof(value));
    }
    private static Result<Packet, Packet> From4(N4 value)
    {
        return value.Flag switch { 1 => Result<Packet, Packet>.Ok(From1(value.F0)), 0 => Result<Packet, Packet>.Err(From1(value.F1)), _ => throw new InvalidOperationException("Invalid native Except flag") };
    }
    private static N5 To5(Holder value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        scope.Charge(1, sizeof(N5));
        return new N5 { F0 = To1(value.Packet, scope), F1 = To0(value.Tag, scope) };
    }
    private static Holder From5(N5 value)
    {
        return new Holder(From1(value.F0), From0(value.F1));
    }
    private static N6 To6(Packet[] value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        var data = scope.Allocate(value.Length, sizeof(N1), Math.Max(sizeof(N1), IntPtr.Size));
        for (var index = 0; index < value.Length; index++) ((N1*)data)[index] = To1(value[index], scope);
        return new N6 { Data = data, Length = (nuint)value.Length };
    }
    private static Packet[] From6(N6 value)
    {
        if (value.Length > (nuint)((16 * 1024 * 1024) / Math.Max(sizeof(N1), IntPtr.Size)))
            throw new ArgumentException("Lean Bridge native sequence exceeds the 16 MiB copy limit");
        if (value.Length != 0 && (value.Data == 0 || (nuint)value.Data % 8 != 0))
            throw new InvalidOperationException("Invalid native sequence buffer");
        var result = global::System.GC.AllocateUninitializedArray<Packet>(checked((int)value.Length));
        for (var index = 0; index < result.Length; index++) result[index] = From1(((N1*)value.Data)[index]);
        return result;
    }
    private static N7 To7(Option<Packet> value, Scope scope)
    {
        scope.Charge(1, sizeof(N7));
        return value.IsSome ? new N7 { Flag = 1, F0 = To1(value.Value, scope) } : default;
    }
    private static Option<Packet> From7(N7 value)
    {
        return value.Flag switch { 0 => Option<Packet>.None, 1 => Option<Packet>.Some(From1(value.F0)), _ => throw new InvalidOperationException("Invalid native Option flag") };
    }
    private static N8 To8((Packet, Packet) value, Scope scope)
    {
        scope.Charge(1, sizeof(N8));
        return new N8 { F0 = To1(value.Item1, scope), F1 = To1(value.Item2, scope) };
    }
    private static (Packet, Packet) From8(N8 value)
    {
        return (From1(value.F0), From1(value.F1));
    }

    internal static Packet[] Call0(Packet[] arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To2(arg0, scope);
        N2 output = default;
        try
        {
            var status = Native.Call0(in input0, ref output, out var error);
            
            Check(status, error);
            return From2(output);
        }
        finally { Native.Clear2(ref output); }
    }
    internal static global::System.Numerics.BigInteger Call1(Packet arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To1(arg0, scope);
        N0 output = default;
        try
        {
            var status = Native.Call1(in input0, ref output, out var error);
            
            Check(status, error);
            return From0(output);
        }
        finally { Native.Clear0(ref output); }
    }
    internal static global::System.Numerics.BigInteger Call2(Packet[] arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To2(arg0, scope);
        N0 output = default;
        try
        {
            var status = Native.Call2(in input0, ref output, out var error);
            
            Check(status, error);
            return From0(output);
        }
        finally { Native.Clear0(ref output); }
    }
    internal static global::System.Numerics.BigInteger Call3(Choice arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To3(arg0, scope);
        N0 output = default;
        try
        {
            var status = Native.Call3(in input0, ref output, out var error);
            
            Check(status, error);
            return From0(output);
        }
        finally { Native.Clear0(ref output); }
    }
    internal static global::System.Numerics.BigInteger Call4(Result<Packet, Packet> arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To4(arg0, scope);
        N0 output = default;
        try
        {
            var status = Native.Call4(in input0, ref output, out var error);
            
            Check(status, error);
            return From0(output);
        }
        finally { Native.Clear0(ref output); }
    }
    internal static global::System.Numerics.BigInteger Call5(Holder arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To5(arg0, scope);
        N0 output = default;
        try
        {
            var status = Native.Call5(in input0, ref output, out var error);
            
            Check(status, error);
            return From0(output);
        }
        finally { Native.Clear0(ref output); }
    }
    internal static global::System.Numerics.BigInteger Call6(Packet[] arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To6(arg0, scope);
        N0 output = default;
        try
        {
            var status = Native.Call6(in input0, ref output, out var error);
            
            Check(status, error);
            return From0(output);
        }
        finally { Native.Clear0(ref output); }
    }
    internal static global::System.Numerics.BigInteger Call7(Option<Packet> arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To7(arg0, scope);
        N0 output = default;
        try
        {
            var status = Native.Call7(in input0, ref output, out var error);
            
            Check(status, error);
            return From0(output);
        }
        finally { Native.Clear0(ref output); }
    }
    internal static global::System.Numerics.BigInteger Call8((Packet, Packet) arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To8(arg0, scope);
        N0 output = default;
        try
        {
            var status = Native.Call8(in input0, ref output, out var error);
            
            Check(status, error);
            return From0(output);
        }
        finally { Native.Clear0(ref output); }
    }
    internal static global::System.Numerics.BigInteger Call9(Packet arg0, Packet arg1)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To1(arg0, scope);
        var input1 = To1(arg1, scope);
        N0 output = default;
        try
        {
            var status = Native.Call9(in input0, in input1, ref output, out var error);
            
            Check(status, error);
            return From0(output);
        }
        finally { Native.Clear0(ref output); }
    }
    internal static Packet[] Call10(global::System.Numerics.BigInteger arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To0(arg0, scope);
        N2 output = default;
        try
        {
            var status = Native.Call10(in input0, ref output, out var error);
            
            Check(status, error);
            return From2(output);
        }
        finally { Native.Clear2(ref output); }
    }
    internal static Option<Packet> Call11(global::System.Numerics.BigInteger arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To0(arg0, scope);
        N7 output = default;
        try
        {
            var status = Native.Call11(in input0, ref output, out var error);
            
            Check(status, error);
            return From7(output);
        }
        finally { Native.Clear7(ref output); }
    }
    internal static global::System.Numerics.BigInteger Call12(Packet arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To1(arg0, scope);
        N0 output = default;
        try
        {
            var status = Native.Call12(in input0, ref output, out var error);
            
            Check(status, error);
            return From0(output);
        }
        finally { Native.Clear0(ref output); }
    }
}

internal static class Native
{
    private const string Library = "libnestedcheckedrecords.so";
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
            const string library = "libnestedcheckedrecords.so";
            var roots = new[] { global::System.IO.Path.Combine(global::System.AppContext.BaseDirectory, "runtimes", "linux-x64", "native"), global::System.AppContext.BaseDirectory };
            var root = global::System.Array.Find(roots, path => global::System.IO.File.Exists(global::System.IO.Path.Combine(path, library)))
                ?? throw new global::System.DllNotFoundException("The installed Lean native assets are missing");
            VerifyDirectory(root);
            if (root == roots[0]) { VerifyDirectory(global::System.IO.Path.GetDirectoryName(root)!); VerifyDirectory(global::System.IO.Path.GetDirectoryName(global::System.IO.Path.GetDirectoryName(root)!)!); }
            var libraries = new global::System.Collections.Generic.Dictionary<string, string>(global::System.StringComparer.Ordinal)
            {
                ["libcomponent_a63244d529ededa079e7.so"] = "7a51096a6523a1acdba21e0b16615f76a47e84003762cc1c967948248cbd09f4",
                ["liblean_bridge_native.so"] = "25bb83c98a7f86c15c8f5a5181457943beae8e9052ce059cf11df47060cdb5f7",
                ["libleanshared.so"] = "d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4",
                ["libnestedcheckedrecords.so"] = "6f9eaa272b05eac0847b153e9834f4b44766eb58eaf51770dd34804a1e3f3b2b",
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
                const string identity = "137cb2975ffded21021afe95f6e4cd7d33d6c5d9e605a9e0f28fd950136decdf";
                const string policy = "linux-x64-deepbind-v1";
                if (registry.TryGetValue("runtime", out var existing) && !global::System.Object.Equals(existing, identity))
                    throw new global::System.InvalidOperationException("Incompatible Lean runtime identities in one process");
                if (existing is not null && (!registry.TryGetValue("policy", out var oldPolicy) || !global::System.Object.Equals(oldPolicy, policy)))
                    throw new global::System.InvalidOperationException("Incompatible Lean native loading policy");
                if (registry.ContainsKey("failed")) throw new global::System.InvalidOperationException("Lean native loading failed earlier in this process");
                const string component = "component:nestedcheckedrecords@1.0.0";
                const string receipt = "104bd62c7e812223b0fd9289f5dd87fdf5cda12514d87f39ae632de56b3fd1ef";
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
                    foreach (var name in new[] { "libleanshared.so", "liblean_bridge_native.so", "libcomponent_a63244d529ededa079e7.so", "libnestedcheckedrecords.so" })
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
    [DllImport(Library, EntryPoint = "nestedcheckedrecords_echo_array", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call0(in N2 input0, ref N2 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nestedcheckedrecords_first", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call1(in N1 input0, ref N0 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nestedcheckedrecords_in_array", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call2(in N2 input0, ref N0 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nestedcheckedrecords_in_choice", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call3(in N3 input0, ref N0 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nestedcheckedrecords_in_except", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call4(in N4 input0, ref N0 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nestedcheckedrecords_in_holder", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call5(in N5 input0, ref N0 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nestedcheckedrecords_in_list", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call6(in N6 input0, ref N0 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nestedcheckedrecords_in_option", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call7(in N7 input0, ref N0 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nestedcheckedrecords_in_product", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call8(in N8 input0, ref N0 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nestedcheckedrecords_pair", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call9(in N1 input0, in N1 input1, ref N0 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nestedcheckedrecords_produce_array", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call10(in N0 input0, ref N2 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nestedcheckedrecords_produce_option", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call11(in N0 input0, ref N7 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nestedcheckedrecords_second", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call12(in N1 input0, ref N0 output, out NativeError error);

    [DllImport(Library, EntryPoint = "nestedcheckedrecords_nat_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear0(ref N0 value);
    [DllImport(Library, EntryPoint = "nestedcheckedrecords_packet_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear1(ref N1 value);
    [DllImport(Library, EntryPoint = "nestedcheckedrecords_array_lean_nested_checked_records_packet_span_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear2(ref N2 value);
    [DllImport(Library, EntryPoint = "nestedcheckedrecords_choice_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear3(ref N3 value);
    [DllImport(Library, EntryPoint = "nestedcheckedrecords_result_lean_nested_checked_records_packet_lean_nested_checked_records_packet_value_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear4(ref N4 value);
    [DllImport(Library, EntryPoint = "nestedcheckedrecords_holder_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear5(ref N5 value);
    [DllImport(Library, EntryPoint = "nestedcheckedrecords_list_lean_nested_checked_records_packet_span_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear6(ref N6 value);
    [DllImport(Library, EntryPoint = "nestedcheckedrecords_option_lean_nested_checked_records_packet_value_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear7(ref N7 value);
    [DllImport(Library, EntryPoint = "nestedcheckedrecords_tuple_lean_nested_checked_records_packet_lean_nested_checked_records_packet_value_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear8(ref N8 value);
}
