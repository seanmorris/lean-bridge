using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace LeanBridge.Nominalsubtypes.Interop;


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
    internal nint Data;
    internal nuint Length;
    internal nint Context;
    internal nint Release;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N2
{
    internal byte Flag;
    internal N0 F0;
    internal N0 F1;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N3
{
    internal N0 F0;
    internal N0 F1;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N4
{
    internal byte Flag;
    internal N2 F0;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N5
{
    internal nint Data;
    internal nuint Length;
    internal nint Context;
    internal nint Release;
}

[StructLayout(LayoutKind.Sequential)]
internal struct C6_0
{
    internal byte Empty;
}
[StructLayout(LayoutKind.Sequential)]
internal struct C6_1
{
    internal N3 F0;
}
[StructLayout(LayoutKind.Sequential)]
internal struct C6_2
{
    internal N5 F0;
}
[StructLayout(LayoutKind.Explicit)]
internal struct V6
{
    [FieldOffset(0)] internal C6_0 Case0;
    [FieldOffset(0)] internal C6_1 Case1;
    [FieldOffset(0)] internal C6_2 Case2;
}
[StructLayout(LayoutKind.Sequential)]
internal struct N6
{
    internal uint Kind;
    internal V6 Cases;
}


[StructLayout(LayoutKind.Sequential)]
internal struct N7
{
    internal byte Flag;
    internal N3 F0;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N8
{
    internal nint Data;
    internal nuint Length;
    internal nint Context;
    internal nint Release;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N9
{
    internal nint Data;
    internal nuint Length;
    internal nint Context;
    internal nint Release;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N10
{
    internal byte Flag;
    internal N0 F0;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N11
{
    internal N8 F0;
    internal N8 F1;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N12
{
    internal N0 F0;
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
    private static N1 To1(global::System.Numerics.BigInteger[] value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        var data = scope.Allocate(value.Length, sizeof(N0), Math.Max(sizeof(N0), IntPtr.Size));
        for (var index = 0; index < value.Length; index++) ((N0*)data)[index] = To0(value[index], scope);
        return new N1 { Data = data, Length = (nuint)value.Length };
    }
    private static global::System.Numerics.BigInteger[] From1(N1 value)
    {
        if (value.Length > (nuint)((16 * 1024 * 1024) / Math.Max(sizeof(N0), IntPtr.Size)))
            throw new ArgumentException("Lean Bridge native sequence exceeds the 16 MiB copy limit");
        if (value.Length != 0 && (value.Data == 0 || (nuint)value.Data % 8 != 0))
            throw new InvalidOperationException("Invalid native sequence buffer");
        var result = global::System.GC.AllocateUninitializedArray<global::System.Numerics.BigInteger>(checked((int)value.Length));
        for (var index = 0; index < result.Length; index++) result[index] = From0(((N0*)value.Data)[index]);
        return result;
    }
    private static N2 To2(Result<global::System.Numerics.BigInteger, global::System.Numerics.BigInteger> value, Scope scope)
    {
        scope.Charge(1, sizeof(N2));
        if (value.IsOk) return new N2 { Flag = 1, F0 = To0(value.Value, scope) };
        if (value.IsError) return new N2 { F1 = To0(value.Error, scope) };
        throw new ArgumentException("Lean Except requires Result.Ok or Result.Err; default(Result) has no branch", nameof(value));
    }
    private static Result<global::System.Numerics.BigInteger, global::System.Numerics.BigInteger> From2(N2 value)
    {
        return value.Flag switch { 1 => Result<global::System.Numerics.BigInteger, global::System.Numerics.BigInteger>.Ok(From0(value.F0)), 0 => Result<global::System.Numerics.BigInteger, global::System.Numerics.BigInteger>.Err(From0(value.F1)), _ => throw new InvalidOperationException("Invalid native Except flag") };
    }
    private static N3 To3(Envelope value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        scope.Charge(1, sizeof(N3));
        return new N3 { F0 = To0(value.Payload, scope), F1 = To0(value.Digit, scope) };
    }
    private static Envelope From3(N3 value)
    {
        return new Envelope(From0(value.F0), From0(value.F1));
    }
    private static N4 To4(Option<Result<global::System.Numerics.BigInteger, global::System.Numerics.BigInteger>> value, Scope scope)
    {
        scope.Charge(1, sizeof(N4));
        return value.IsSome ? new N4 { Flag = 1, F0 = To2(value.Value, scope) } : default;
    }
    private static Option<Result<global::System.Numerics.BigInteger, global::System.Numerics.BigInteger>> From4(N4 value)
    {
        return value.Flag switch { 0 => Option<Result<global::System.Numerics.BigInteger, global::System.Numerics.BigInteger>>.None, 1 => Option<Result<global::System.Numerics.BigInteger, global::System.Numerics.BigInteger>>.Some(From2(value.F0)), _ => throw new InvalidOperationException("Invalid native Option flag") };
    }
    private static N5 To5(Option<Result<global::System.Numerics.BigInteger, global::System.Numerics.BigInteger>>[] value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        var data = scope.Allocate(value.Length, sizeof(N4), Math.Max(sizeof(N4), IntPtr.Size));
        for (var index = 0; index < value.Length; index++) ((N4*)data)[index] = To4(value[index], scope);
        return new N5 { Data = data, Length = (nuint)value.Length };
    }
    private static Option<Result<global::System.Numerics.BigInteger, global::System.Numerics.BigInteger>>[] From5(N5 value)
    {
        if (value.Length > (nuint)((16 * 1024 * 1024) / Math.Max(sizeof(N4), IntPtr.Size)))
            throw new ArgumentException("Lean Bridge native sequence exceeds the 16 MiB copy limit");
        if (value.Length != 0 && (value.Data == 0 || (nuint)value.Data % 8 != 0))
            throw new InvalidOperationException("Invalid native sequence buffer");
        var result = global::System.GC.AllocateUninitializedArray<Option<Result<global::System.Numerics.BigInteger, global::System.Numerics.BigInteger>>>(checked((int)value.Length));
        for (var index = 0; index < result.Length; index++) result[index] = From4(((N4*)value.Data)[index]);
        return result;
    }
    private static N6 To6(Event value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        scope.Charge(1, sizeof(N6));
        return value switch
        {
            EventEmpty => new N6 { Kind = 0 },
            EventBox branch => new N6 { Kind = 1, Cases = new V6 { Case1 = new C6_1 { F0 = To3(branch.Value, scope) } } },
            EventChoices branch => new N6 { Kind = 2, Cases = new V6 { Case2 = new C6_2 { F0 = To5(branch.Values, scope) } } },
            _ => throw new ArgumentException("Expected a named Event constructor", nameof(value))
        };
    }
    private static Event From6(N6 value)
    {
        return value.Kind switch
        {
            0 => new EventEmpty(),
            1 => new EventBox(From3(value.Cases.Case1.F0)),
            2 => new EventChoices(From5(value.Cases.Case2.F0)),
            _ => throw new InvalidOperationException("Invalid native Event constructor")
        };
    }
    private static N7 To7(Option<Envelope> value, Scope scope)
    {
        scope.Charge(1, sizeof(N7));
        return value.IsSome ? new N7 { Flag = 1, F0 = To3(value.Value, scope) } : default;
    }
    private static Option<Envelope> From7(N7 value)
    {
        return value.Flag switch { 0 => Option<Envelope>.None, 1 => Option<Envelope>.Some(From3(value.F0)), _ => throw new InvalidOperationException("Invalid native Option flag") };
    }
    private static N8 To8(Option<Envelope>[] value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        var data = scope.Allocate(value.Length, sizeof(N7), Math.Max(sizeof(N7), IntPtr.Size));
        for (var index = 0; index < value.Length; index++) ((N7*)data)[index] = To7(value[index], scope);
        return new N8 { Data = data, Length = (nuint)value.Length };
    }
    private static Option<Envelope>[] From8(N8 value)
    {
        if (value.Length > (nuint)((16 * 1024 * 1024) / Math.Max(sizeof(N7), IntPtr.Size)))
            throw new ArgumentException("Lean Bridge native sequence exceeds the 16 MiB copy limit");
        if (value.Length != 0 && (value.Data == 0 || (nuint)value.Data % 8 != 0))
            throw new InvalidOperationException("Invalid native sequence buffer");
        var result = global::System.GC.AllocateUninitializedArray<Option<Envelope>>(checked((int)value.Length));
        for (var index = 0; index < result.Length; index++) result[index] = From7(((N7*)value.Data)[index]);
        return result;
    }
    private static N9 To9(global::System.Numerics.BigInteger[] value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        var data = scope.Allocate(value.Length, sizeof(N0), Math.Max(sizeof(N0), IntPtr.Size));
        for (var index = 0; index < value.Length; index++) ((N0*)data)[index] = To0(value[index], scope);
        return new N9 { Data = data, Length = (nuint)value.Length };
    }
    private static global::System.Numerics.BigInteger[] From9(N9 value)
    {
        if (value.Length > (nuint)((16 * 1024 * 1024) / Math.Max(sizeof(N0), IntPtr.Size)))
            throw new ArgumentException("Lean Bridge native sequence exceeds the 16 MiB copy limit");
        if (value.Length != 0 && (value.Data == 0 || (nuint)value.Data % 8 != 0))
            throw new InvalidOperationException("Invalid native sequence buffer");
        var result = global::System.GC.AllocateUninitializedArray<global::System.Numerics.BigInteger>(checked((int)value.Length));
        for (var index = 0; index < result.Length; index++) result[index] = From0(((N0*)value.Data)[index]);
        return result;
    }
    private static N10 To10(Option<global::System.Numerics.BigInteger> value, Scope scope)
    {
        scope.Charge(1, sizeof(N10));
        return value.IsSome ? new N10 { Flag = 1, F0 = To0(value.Value, scope) } : default;
    }
    private static Option<global::System.Numerics.BigInteger> From10(N10 value)
    {
        return value.Flag switch { 0 => Option<global::System.Numerics.BigInteger>.None, 1 => Option<global::System.Numerics.BigInteger>.Some(From0(value.F0)), _ => throw new InvalidOperationException("Invalid native Option flag") };
    }
    private static N11 To11(AliasPair value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        scope.Charge(1, sizeof(N11));
        return new N11 { F0 = To8(value.Left, scope), F1 = To8(value.Right, scope) };
    }
    private static AliasPair From11(N11 value)
    {
        return new AliasPair(From8(value.F0), From8(value.F1));
    }
    private static N12 To12((global::System.Numerics.BigInteger, global::System.Numerics.BigInteger) value, Scope scope)
    {
        scope.Charge(1, sizeof(N12));
        return new N12 { F0 = To0(value.Item1, scope), F1 = To0(value.Item2, scope) };
    }
    private static (global::System.Numerics.BigInteger, global::System.Numerics.BigInteger) From12(N12 value)
    {
        return (From0(value.F0), From0(value.F1));
    }

    internal static global::System.Numerics.BigInteger[] Call0(global::System.Numerics.BigInteger arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To0(arg0, scope);
        N1 output = default;
        try
        {
            var status = Native.Call0(in input0, ref output, out var error);
            
            Check(status, error);
            return From1(output);
        }
        finally { Native.Clear1(ref output); }
    }
    internal static Result<global::System.Numerics.BigInteger, global::System.Numerics.BigInteger> Call1(global::System.Numerics.BigInteger arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To0(arg0, scope);
        N2 output = default;
        try
        {
            var status = Native.Call1(in input0, ref output, out var error);
            
            Check(status, error);
            return From2(output);
        }
        finally { Native.Clear2(ref output); }
    }
    internal static Event Call2(global::System.Numerics.BigInteger arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To0(arg0, scope);
        N6 output = default;
        try
        {
            var status = Native.Call2(in input0, ref output, out var error);
            
            Check(status, error);
            return From6(output);
        }
        finally { Native.Clear6(ref output); }
    }
    internal static Event Call3(global::System.Numerics.BigInteger arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To0(arg0, scope);
        N6 output = default;
        try
        {
            var status = Native.Call3(in input0, ref output, out var error);
            
            Check(status, error);
            return From6(output);
        }
        finally { Native.Clear6(ref output); }
    }
    internal static Event Call4(global::System.Numerics.BigInteger arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To0(arg0, scope);
        N6 output = default;
        try
        {
            var status = Native.Call4(in input0, ref output, out var error);
            
            Check(status, error);
            return From6(output);
        }
        finally { Native.Clear6(ref output); }
    }
    internal static Option<Envelope>[] Call5(global::System.Numerics.BigInteger arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To0(arg0, scope);
        N8 output = default;
        try
        {
            var status = Native.Call5(in input0, ref output, out var error);
            
            Check(status, error);
            return From8(output);
        }
        finally { Native.Clear8(ref output); }
    }
    internal static global::System.Numerics.BigInteger[] Call6(global::System.Numerics.BigInteger arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To0(arg0, scope);
        N9 output = default;
        try
        {
            var status = Native.Call6(in input0, ref output, out var error);
            
            Check(status, error);
            return From9(output);
        }
        finally { Native.Clear9(ref output); }
    }
    internal static global::System.Numerics.BigInteger[] Call7(global::System.Numerics.BigInteger arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To0(arg0, scope);
        N1 output = default;
        try
        {
            var status = Native.Call7(in input0, ref output, out var error);
            
            Check(status, error);
            return From1(output);
        }
        finally { Native.Clear1(ref output); }
    }
    internal static Option<global::System.Numerics.BigInteger> Call8(global::System.Numerics.BigInteger arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To0(arg0, scope);
        N10 output = default;
        try
        {
            var status = Native.Call8(in input0, ref output, out var error);
            
            Check(status, error);
            return From10(output);
        }
        finally { Native.Clear10(ref output); }
    }
    internal static AliasPair Call9(global::System.Numerics.BigInteger arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To0(arg0, scope);
        N11 output = default;
        try
        {
            var status = Native.Call9(in input0, ref output, out var error);
            
            Check(status, error);
            return From11(output);
        }
        finally { Native.Clear11(ref output); }
    }
    internal static Envelope Call10(global::System.Numerics.BigInteger arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To0(arg0, scope);
        N3 output = default;
        try
        {
            var status = Native.Call10(in input0, ref output, out var error);
            
            Check(status, error);
            return From3(output);
        }
        finally { Native.Clear3(ref output); }
    }
    internal static (global::System.Numerics.BigInteger, global::System.Numerics.BigInteger) Call11(global::System.Numerics.BigInteger arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To0(arg0, scope);
        N12 output = default;
        try
        {
            var status = Native.Call11(in input0, ref output, out var error);
            
            Check(status, error);
            return From12(output);
        }
        finally { Native.Clear12(ref output); }
    }
    internal static global::System.Numerics.BigInteger Call12(global::System.Numerics.BigInteger arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To0(arg0, scope);
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
    private const string Library = "libnominalsubtypes.so";
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
            const string library = "libnominalsubtypes.so";
            var roots = new[] { global::System.IO.Path.Combine(global::System.AppContext.BaseDirectory, "runtimes", "linux-x64", "native"), global::System.AppContext.BaseDirectory };
            var root = global::System.Array.Find(roots, path => global::System.IO.File.Exists(global::System.IO.Path.Combine(path, library)))
                ?? throw new global::System.DllNotFoundException("The installed Lean native assets are missing");
            VerifyDirectory(root);
            if (root == roots[0]) { VerifyDirectory(global::System.IO.Path.GetDirectoryName(root)!); VerifyDirectory(global::System.IO.Path.GetDirectoryName(global::System.IO.Path.GetDirectoryName(root)!)!); }
            var libraries = new global::System.Collections.Generic.Dictionary<string, string>(global::System.StringComparer.Ordinal)
            {
                ["libcomponent_7f8bfe55e5831a9133c5.so"] = "2e275d73caf7f0f531dac887cee6833e3bb953d5098bc94483c2e82a04171990",
                ["liblean_bridge_native.so"] = "25bb83c98a7f86c15c8f5a5181457943beae8e9052ce059cf11df47060cdb5f7",
                ["libleanshared.so"] = "d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4",
                ["libnominalsubtypes.so"] = "ca835c86669d3cfcdb28cb28807d6e76d516c5671171729a85d17e25d0683570",
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
                const string component = "component:nominalsubtypes@1.0.0";
                const string receipt = "fc90674b3abc628bc03779a428c9f20f8229ec96fc81e7010ace5510cb92af30";
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
                    foreach (var name in new[] { "libleanshared.so", "liblean_bridge_native.so", "libcomponent_7f8bfe55e5831a9133c5.so", "libnominalsubtypes.so" })
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
    [DllImport(Library, EntryPoint = "nominalsubtypes_array_values", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call0(in N0 input0, ref N1 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nominalsubtypes_branch", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call1(in N0 input0, ref N2 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nominalsubtypes_event_choices", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call2(in N0 input0, ref N6 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nominalsubtypes_event_empty", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call3(in N0 input0, ref N6 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nominalsubtypes_event_value", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call4(in N0 input0, ref N6 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nominalsubtypes_group_values", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call5(in N0 input0, ref N8 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nominalsubtypes_list_values", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call6(in N0 input0, ref N9 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nominalsubtypes_no_items", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call7(in N0 input0, ref N1 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nominalsubtypes_optional", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call8(in N0 input0, ref N10 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nominalsubtypes_pair_values", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call9(in N0 input0, ref N11 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nominalsubtypes_produce_envelope", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call10(in N0 input0, ref N3 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nominalsubtypes_product", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call11(in N0 input0, ref N12 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nominalsubtypes_scalar", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call12(in N0 input0, ref N0 output, out NativeError error);

    [DllImport(Library, EntryPoint = "nominalsubtypes_nat_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear0(ref N0 value);
    [DllImport(Library, EntryPoint = "nominalsubtypes_array_nat_span_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear1(ref N1 value);
    [DllImport(Library, EntryPoint = "nominalsubtypes_result_nat_nat_value_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear2(ref N2 value);
    [DllImport(Library, EntryPoint = "nominalsubtypes_envelope_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear3(ref N3 value);
    [DllImport(Library, EntryPoint = "nominalsubtypes_option_result_nat_nat_value_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear4(ref N4 value);
    [DllImport(Library, EntryPoint = "nominalsubtypes_array_option_result_nat_nat_span_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear5(ref N5 value);
    [DllImport(Library, EntryPoint = "nominalsubtypes_event_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear6(ref N6 value);
    [DllImport(Library, EntryPoint = "nominalsubtypes_option_lean_nominal_subtypes_envelope_value_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear7(ref N7 value);
    [DllImport(Library, EntryPoint = "nominalsubtypes_array_option_lean_nominal_subtypes_envelope_span_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear8(ref N8 value);
    [DllImport(Library, EntryPoint = "nominalsubtypes_list_nat_span_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear9(ref N9 value);
    [DllImport(Library, EntryPoint = "nominalsubtypes_option_nat_value_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear10(ref N10 value);
    [DllImport(Library, EntryPoint = "nominalsubtypes_alias_pair_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear11(ref N11 value);
    [DllImport(Library, EntryPoint = "nominalsubtypes_tuple_nat_nat_value_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear12(ref N12 value);
}
