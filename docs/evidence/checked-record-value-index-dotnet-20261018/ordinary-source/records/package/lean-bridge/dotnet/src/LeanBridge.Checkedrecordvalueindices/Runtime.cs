using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace LeanBridge.Checkedrecordvalueindices.Interop;


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
internal struct N3
{
    internal N2 F0;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N4
{
    internal N0 F0;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N5
{
    internal N0 F0;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N6
{
    internal N0 F0;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N7
{
    internal N0 F0;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N8
{
    internal N0 F0;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N9
{
    internal N0 F0;
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
    private static N1 To1(Ab value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        scope.Charge(1, sizeof(N1));
        return new N1 { F0 = To0(value.Size, scope) };
    }
    private static Ab From1(N1 value)
    {
        return new Ab(From0(value.F0));
    }
    private static N2 To2(global::System.Numerics.BigInteger[] value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        var data = scope.Allocate(value.Length, sizeof(N0), Math.Max(sizeof(N0), IntPtr.Size));
        for (var index = 0; index < value.Length; index++) ((N0*)data)[index] = To0(value[index], scope);
        return new N2 { Data = data, Length = (nuint)value.Length };
    }
    private static global::System.Numerics.BigInteger[] From2(N2 value)
    {
        if (value.Length > (nuint)((16 * 1024 * 1024) / Math.Max(sizeof(N0), IntPtr.Size)))
            throw new ArgumentException("Lean Bridge native sequence exceeds the 16 MiB copy limit");
        if (value.Length != 0 && (value.Data == 0 || (nuint)value.Data % 8 != 0))
            throw new InvalidOperationException("Invalid native sequence buffer");
        var result = global::System.GC.AllocateUninitializedArray<global::System.Numerics.BigInteger>(checked((int)value.Length));
        for (var index = 0; index < result.Length; index++) result[index] = From0(((N0*)value.Data)[index]);
        return result;
    }
    private static N3 To3(EmptySized value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        scope.Charge(1, sizeof(N3));
        return new N3 { F0 = To2(value.Data, scope) };
    }
    private static EmptySized From3(N3 value)
    {
        return new EmptySized(From2(value.F0));
    }
    private static N4 To4(EmptyToken value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        scope.Charge(1, sizeof(N4));
        return new N4 { F0 = To0(value.Count, scope) };
    }
    private static EmptyToken From4(N4 value)
    {
        return new EmptyToken(From0(value.F0));
    }
    private static N5 To5(Off value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        scope.Charge(1, sizeof(N5));
        return new N5 { F0 = To0(value.Count, scope) };
    }
    private static Off From5(N5 value)
    {
        return new Off(From0(value.F0));
    }
    private static N6 To6(On value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        scope.Charge(1, sizeof(N6));
        return new N6 { F0 = To0(value.Count, scope) };
    }
    private static On From6(N6 value)
    {
        return new On(From0(value.F0));
    }
    private static N7 To7(UnicodeToken value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        scope.Charge(1, sizeof(N7));
        return new N7 { F0 = To0(value.Count, scope) };
    }
    private static UnicodeToken From7(N7 value)
    {
        return new UnicodeToken(From0(value.F0));
    }
    private static N8 To8(WideToken value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        scope.Charge(1, sizeof(N8));
        return new N8 { F0 = To0(value.Count, scope) };
    }
    private static WideToken From8(N8 value)
    {
        return new WideToken(From0(value.F0));
    }
    private static N9 To9(ZeroToken value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        scope.Charge(1, sizeof(N9));
        return new N9 { F0 = To0(value.Count, scope) };
    }
    private static ZeroToken From9(N9 value)
    {
        return new ZeroToken(From0(value.F0));
    }

    internal static global::System.Numerics.BigInteger Call0(Ab arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To1(arg0, scope);
        N0 output = default;
        try
        {
            var status = Native.Call0(in input0, ref output, out var error);
            
            Check(status, error);
            return From0(output);
        }
        finally { Native.Clear0(ref output); }
    }
    internal static global::System.Numerics.BigInteger Call1(EmptySized arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To3(arg0, scope);
        N0 output = default;
        try
        {
            var status = Native.Call1(in input0, ref output, out var error);
            
            Check(status, error);
            return From0(output);
        }
        finally { Native.Clear0(ref output); }
    }
    internal static global::System.Numerics.BigInteger Call2(EmptyToken arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To4(arg0, scope);
        N0 output = default;
        try
        {
            var status = Native.Call2(in input0, ref output, out var error);
            
            Check(status, error);
            return From0(output);
        }
        finally { Native.Clear0(ref output); }
    }
    internal static global::System.Numerics.BigInteger Call3(Off arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To5(arg0, scope);
        N0 output = default;
        try
        {
            var status = Native.Call3(in input0, ref output, out var error);
            
            Check(status, error);
            return From0(output);
        }
        finally { Native.Clear0(ref output); }
    }
    internal static Ab Call4()
    {
        Native.EnsureProcess();
        
        
        

        N1 output = default;
        try
        {
            var status = Native.Call4(ref output, out var error);
            
            Check(status, error);
            return From1(output);
        }
        finally { Native.Clear1(ref output); }
    }
    internal static EmptySized Call5()
    {
        Native.EnsureProcess();
        
        
        

        N3 output = default;
        try
        {
            var status = Native.Call5(ref output, out var error);
            
            Check(status, error);
            return From3(output);
        }
        finally { Native.Clear3(ref output); }
    }
    internal static EmptyToken Call6(global::System.Numerics.BigInteger arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To0(arg0, scope);
        N4 output = default;
        try
        {
            var status = Native.Call6(in input0, ref output, out var error);
            
            Check(status, error);
            return From4(output);
        }
        finally { Native.Clear4(ref output); }
    }
    internal static Off Call7()
    {
        Native.EnsureProcess();
        
        
        

        N5 output = default;
        try
        {
            var status = Native.Call7(ref output, out var error);
            
            Check(status, error);
            return From5(output);
        }
        finally { Native.Clear5(ref output); }
    }
    internal static On Call8()
    {
        Native.EnsureProcess();
        
        
        

        N6 output = default;
        try
        {
            var status = Native.Call8(ref output, out var error);
            
            Check(status, error);
            return From6(output);
        }
        finally { Native.Clear6(ref output); }
    }
    internal static UnicodeToken Call9(global::System.Numerics.BigInteger arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To0(arg0, scope);
        N7 output = default;
        try
        {
            var status = Native.Call9(in input0, ref output, out var error);
            
            Check(status, error);
            return From7(output);
        }
        finally { Native.Clear7(ref output); }
    }
    internal static WideToken Call10(global::System.Numerics.BigInteger arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To0(arg0, scope);
        N8 output = default;
        try
        {
            var status = Native.Call10(in input0, ref output, out var error);
            
            Check(status, error);
            return From8(output);
        }
        finally { Native.Clear8(ref output); }
    }
    internal static ZeroToken Call11(global::System.Numerics.BigInteger arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To0(arg0, scope);
        N9 output = default;
        try
        {
            var status = Native.Call11(in input0, ref output, out var error);
            
            Check(status, error);
            return From9(output);
        }
        finally { Native.Clear9(ref output); }
    }
    internal static global::System.Numerics.BigInteger Call12(On arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To6(arg0, scope);
        N0 output = default;
        try
        {
            var status = Native.Call12(in input0, ref output, out var error);
            
            Check(status, error);
            return From0(output);
        }
        finally { Native.Clear0(ref output); }
    }
    internal static global::System.Numerics.BigInteger Call13(UnicodeToken arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To7(arg0, scope);
        N0 output = default;
        try
        {
            var status = Native.Call13(in input0, ref output, out var error);
            
            Check(status, error);
            return From0(output);
        }
        finally { Native.Clear0(ref output); }
    }
    internal static global::System.Numerics.BigInteger Call14(WideToken arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To8(arg0, scope);
        N0 output = default;
        try
        {
            var status = Native.Call14(in input0, ref output, out var error);
            
            Check(status, error);
            return From0(output);
        }
        finally { Native.Clear0(ref output); }
    }
    internal static global::System.Numerics.BigInteger Call15(ZeroToken arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To9(arg0, scope);
        N0 output = default;
        try
        {
            var status = Native.Call15(in input0, ref output, out var error);
            
            Check(status, error);
            return From0(output);
        }
        finally { Native.Clear0(ref output); }
    }
}

internal static class Native
{
    private const string Library = "libcheckedrecordvalueindices.so";
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
            const string library = "libcheckedrecordvalueindices.so";
            var roots = new[] { global::System.IO.Path.Combine(global::System.AppContext.BaseDirectory, "runtimes", "linux-x64", "native"), global::System.AppContext.BaseDirectory };
            var root = global::System.Array.Find(roots, path => global::System.IO.File.Exists(global::System.IO.Path.Combine(path, library)))
                ?? throw new global::System.DllNotFoundException("The installed Lean native assets are missing");
            VerifyDirectory(root);
            if (root == roots[0]) { VerifyDirectory(global::System.IO.Path.GetDirectoryName(root)!); VerifyDirectory(global::System.IO.Path.GetDirectoryName(global::System.IO.Path.GetDirectoryName(root)!)!); }
            var libraries = new global::System.Collections.Generic.Dictionary<string, string>(global::System.StringComparer.Ordinal)
            {
                ["libcheckedrecordvalueindices.so"] = "5cfe7d6326c0bdfd323d394261e6e9aa161de72a33dfccb0f18488c59a3e9e15",
                ["libcomponent_767c615eabad08d77709.so"] = "39941bbf2ec5f61793b17581a6f4e1e79725ec63f2fd2a6d5a5cbfa7274ae1e6",
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
                const string component = "component:checkedrecordvalueindices@1.0.0";
                const string receipt = "3d59df8809a587b8d3c92354262721ec1002f2622671681bf58241f9f07ad3e5";
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
                    foreach (var name in new[] { "libleanshared.so", "liblean_bridge_native.so", "libcomponent_767c615eabad08d77709.so", "libcheckedrecordvalueindices.so" })
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
    [DllImport(Library, EntryPoint = "checkedrecordvalueindices_ab_string_index", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call0(in N1 input0, ref N0 output, out NativeError error);
    [DllImport(Library, EntryPoint = "checkedrecordvalueindices_empty_sized_index", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call1(in N3 input0, ref N0 output, out NativeError error);
    [DllImport(Library, EntryPoint = "checkedrecordvalueindices_empty_string_index", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call2(in N4 input0, ref N0 output, out NativeError error);
    [DllImport(Library, EntryPoint = "checkedrecordvalueindices_false_bool_index", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call3(in N5 input0, ref N0 output, out NativeError error);
    [DllImport(Library, EntryPoint = "checkedrecordvalueindices_produce_ab", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call4(ref N1 output, out NativeError error);
    [DllImport(Library, EntryPoint = "checkedrecordvalueindices_produce_empty_sized", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call5(ref N3 output, out NativeError error);
    [DllImport(Library, EntryPoint = "checkedrecordvalueindices_produce_empty_string", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call6(in N0 input0, ref N4 output, out NativeError error);
    [DllImport(Library, EntryPoint = "checkedrecordvalueindices_produce_false_bool", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call7(ref N5 output, out NativeError error);
    [DllImport(Library, EntryPoint = "checkedrecordvalueindices_produce_true_bool", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call8(ref N6 output, out NativeError error);
    [DllImport(Library, EntryPoint = "checkedrecordvalueindices_produce_unicode_string", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call9(in N0 input0, ref N7 output, out NativeError error);
    [DllImport(Library, EntryPoint = "checkedrecordvalueindices_produce_wide_nat", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call10(in N0 input0, ref N8 output, out NativeError error);
    [DllImport(Library, EntryPoint = "checkedrecordvalueindices_produce_zero_nat", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call11(in N0 input0, ref N9 output, out NativeError error);
    [DllImport(Library, EntryPoint = "checkedrecordvalueindices_true_bool_index", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call12(in N6 input0, ref N0 output, out NativeError error);
    [DllImport(Library, EntryPoint = "checkedrecordvalueindices_unicode_string_index", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call13(in N7 input0, ref N0 output, out NativeError error);
    [DllImport(Library, EntryPoint = "checkedrecordvalueindices_wide_nat_index", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call14(in N8 input0, ref N0 output, out NativeError error);
    [DllImport(Library, EntryPoint = "checkedrecordvalueindices_zero_nat_index", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call15(in N9 input0, ref N0 output, out NativeError error);

    [DllImport(Library, EntryPoint = "checkedrecordvalueindices_nat_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear0(ref N0 value);
    [DllImport(Library, EntryPoint = "checkedrecordvalueindices_ab_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear1(ref N1 value);
    [DllImport(Library, EntryPoint = "checkedrecordvalueindices_array_nat_span_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear2(ref N2 value);
    [DllImport(Library, EntryPoint = "checkedrecordvalueindices_empty_sized_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear3(ref N3 value);
    [DllImport(Library, EntryPoint = "checkedrecordvalueindices_empty_token_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear4(ref N4 value);
    [DllImport(Library, EntryPoint = "checkedrecordvalueindices_off_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear5(ref N5 value);
    [DllImport(Library, EntryPoint = "checkedrecordvalueindices_on_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear6(ref N6 value);
    [DllImport(Library, EntryPoint = "checkedrecordvalueindices_unicode_token_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear7(ref N7 value);
    [DllImport(Library, EntryPoint = "checkedrecordvalueindices_wide_token_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear8(ref N8 value);
    [DllImport(Library, EntryPoint = "checkedrecordvalueindices_zero_token_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear9(ref N9 value);
}
