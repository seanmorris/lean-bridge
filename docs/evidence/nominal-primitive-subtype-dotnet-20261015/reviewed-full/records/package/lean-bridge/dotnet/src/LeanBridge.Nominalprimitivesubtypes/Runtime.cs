using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace LeanBridge.Nominalprimitivesubtypes.Interop;


[StructLayout(LayoutKind.Sequential)]
internal struct N10
{
    internal nint Data;
    internal nuint Length;
    internal nint Context;
    internal nint Release;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N11
{
    internal nint Data;
    internal nuint Length;
    internal nint Context;
    internal nint Release;
    internal byte Negative;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N14
{
    internal nint Data;
    internal nuint Length;
    internal nint Context;
    internal nint Release;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N15
{
    internal nint Data;
    internal nuint Length;
    internal nint Context;
    internal nint Release;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N19
{
    internal byte F0;
    internal byte F1;
    internal byte F2;
    internal ushort F3;
    internal uint F4;
    internal ulong F5;
    internal sbyte F6;
    internal short F7;
    internal int F8;
    internal long F9;
    internal N10 F10;
    internal N11 F11;
    internal float F12;
    internal double F13;
    internal N14 F14;
    internal N15 F15;
    internal uint F16;
    internal ulong F17;
    internal long F18;
    internal N10 F19;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N20
{
    internal byte Flag;
    internal N19 F0;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N21
{
    internal nint Data;
    internal nuint Length;
    internal nint Context;
    internal nint Release;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N22
{
    internal N19 F0;
    internal N19 F1;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N23
{
    internal byte Flag;
    internal N19 F0;
    internal N19 F1;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N24
{
    internal byte Flag;
    internal N23 F0;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N25
{
    internal nint Data;
    internal nuint Length;
    internal nint Context;
    internal nint Release;
}

[StructLayout(LayoutKind.Sequential)]
internal struct C26_0
{
    internal byte Empty;
}
[StructLayout(LayoutKind.Sequential)]
internal struct C26_1
{
    internal N19 F0;
}
[StructLayout(LayoutKind.Sequential)]
internal struct C26_2
{
    internal N25 F0;
}
[StructLayout(LayoutKind.Explicit)]
internal struct V26
{
    [FieldOffset(0)] internal C26_0 Case0;
    [FieldOffset(0)] internal C26_1 Case1;
    [FieldOffset(0)] internal C26_2 Case2;
}
[StructLayout(LayoutKind.Sequential)]
internal struct N26
{
    internal uint Kind;
    internal V26 Cases;
}


[StructLayout(LayoutKind.Sequential)]
internal struct N27
{
    internal N21 F0;
    internal N21 F1;
}

[StructLayout(LayoutKind.Sequential)]
internal struct N28
{
    internal byte F0;
    internal byte F1;
    internal byte F2;
    internal ushort F3;
    internal uint F4;
    internal ulong F5;
    internal sbyte F6;
    internal short F7;
    internal int F8;
    internal long F9;
    internal N10 F10;
    internal N11 F11;
    internal float F12;
    internal double F13;
    internal N14 F14;
    internal N15 F15;
    internal uint F16;
    internal ulong F17;
    internal long F18;
    internal N10 F19;
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
    private static byte To0(Unit value)
    {
        return 0;
    }
    private static Unit From0(byte value)
    {
        if (value != 0) throw new InvalidOperationException("Invalid native Unit marker");
        return default;
    }
    private static byte To1(bool value)
    {
        return value ? (byte)1 : (byte)0;
    }
    private static bool From1(byte value)
    {
        return value switch { 0 => false, 1 => true, _ => throw new InvalidOperationException("Invalid native Bool value") };
    }
    private static byte To2(byte value)
    {
        return value;
    }
    private static byte From2(byte value)
    {
        return value;
    }
    private static ushort To3(ushort value)
    {
        return value;
    }
    private static ushort From3(ushort value)
    {
        return value;
    }
    private static uint To4(uint value)
    {
        return value;
    }
    private static uint From4(uint value)
    {
        return value;
    }
    private static ulong To5(ulong value)
    {
        return value;
    }
    private static ulong From5(ulong value)
    {
        return value;
    }
    private static sbyte To6(sbyte value)
    {
        return value;
    }
    private static sbyte From6(sbyte value)
    {
        return value;
    }
    private static short To7(short value)
    {
        return value;
    }
    private static short From7(short value)
    {
        return value;
    }
    private static int To8(int value)
    {
        return value;
    }
    private static int From8(int value)
    {
        return value;
    }
    private static long To9(long value)
    {
        return value;
    }
    private static long From9(long value)
    {
        return value;
    }
    private static N10 To10(global::System.Numerics.BigInteger value, Scope scope)
    {
        if (value.Sign < 0) throw new ArgumentOutOfRangeException(nameof(value), "Lean Nat cannot be negative");
        var magnitude = global::System.Numerics.BigInteger.Abs(value);
        var limbs = value.IsZero ? 0 : checked((magnitude.GetByteCount(isUnsigned: true) + 3) / 4);
        var data = scope.Allocate(limbs, sizeof(uint));
        if (limbs != 0 && !magnitude.TryWriteBytes(new Span<byte>((void*)data, checked(limbs * 4)), out _, isUnsigned: true, isBigEndian: false)) throw new InvalidOperationException("Integer conversion failed");
        return new N10 { Data = data, Length = (nuint)limbs };
    }
    private static global::System.Numerics.BigInteger From10(N10 value)
    {
        var digits = CheckedBuffer<uint>(value.Data, value.Length, 4);
        if (!digits.IsEmpty && digits[^1] == 0) throw new InvalidOperationException("Invalid native integer magnitude");
        var result = new global::System.Numerics.BigInteger(global::System.Runtime.InteropServices.MemoryMarshal.AsBytes(digits), isUnsigned: true, isBigEndian: false);
        return result;
    }
    private static N11 To11(global::System.Numerics.BigInteger value, Scope scope)
    {
        var magnitude = global::System.Numerics.BigInteger.Abs(value);
        var limbs = value.IsZero ? 0 : checked((magnitude.GetByteCount(isUnsigned: true) + 3) / 4);
        var data = scope.Allocate(limbs, sizeof(uint));
        if (limbs != 0 && !magnitude.TryWriteBytes(new Span<byte>((void*)data, checked(limbs * 4)), out _, isUnsigned: true, isBigEndian: false)) throw new InvalidOperationException("Integer conversion failed");
        return new N11 { Data = data, Length = (nuint)limbs, Negative = value.Sign < 0 ? (byte)1 : (byte)0 };
    }
    private static global::System.Numerics.BigInteger From11(N11 value)
    {
        if (value.Negative > 1) throw new InvalidOperationException("Invalid native Int sign");
        var digits = CheckedBuffer<uint>(value.Data, value.Length, 4);
        if (!digits.IsEmpty && digits[^1] == 0) throw new InvalidOperationException("Invalid native integer magnitude");
        if (digits.IsEmpty && value.Negative != 0) throw new InvalidOperationException("Invalid native negative zero");
        var result = new global::System.Numerics.BigInteger(global::System.Runtime.InteropServices.MemoryMarshal.AsBytes(digits), isUnsigned: true, isBigEndian: false);
        return value.Negative != 0 ? -result : result;
    }
    private static float To12(float value)
    {
        return value;
    }
    private static float From12(float value)
    {
        return value;
    }
    private static double To13(double value)
    {
        return value;
    }
    private static double From13(double value)
    {
        return value;
    }
    private static N14 To14(string value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        var length = Utf8.GetByteCount(value);
        var data = scope.Allocate(length, 1);
        Utf8.GetBytes(value, new Span<byte>((void*)data, length));
        return new N14 { Data = data, Length = (nuint)length };
    }
    private static string From14(N14 value)
    {
        return Utf8.GetString(CheckedBuffer<byte>(value.Data, value.Length, 1));
    }
    private static N15 To15(byte[] value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        var data = scope.Allocate(value.Length, 1);
        value.AsSpan().CopyTo(new Span<byte>((void*)data, value.Length));
        return new N15 { Data = data, Length = (nuint)value.Length };
    }
    private static byte[] From15(N15 value)
    {
        return CheckedBuffer<byte>(value.Data, value.Length, 1).ToArray();
    }
    private static uint To16(global::System.Text.Rune value)
    {
        return (uint)value.Value;
    }
    private static global::System.Text.Rune From16(uint value)
    {
        return new global::System.Text.Rune(value);
    }
    private static ulong To17(ulong value)
    {
        return value;
    }
    private static ulong From17(ulong value)
    {
        return value;
    }
    private static long To18(long value)
    {
        return value;
    }
    private static long From18(long value)
    {
        return value;
    }
    private static N19 To19(Packet value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        scope.Charge(1, sizeof(N19));
        return new N19 { F0 = To0(value.UnitValue), F1 = To1(value.BoolValue), F2 = To2(value.Uint8Value), F3 = To3(value.Uint16Value), F4 = To4(value.Uint32Value), F5 = To5(value.Uint64Value), F6 = To6(value.Int8Value), F7 = To7(value.Int16Value), F8 = To8(value.Int32Value), F9 = To9(value.Int64Value), F10 = To10(value.NatValue, scope), F11 = To11(value.IntValue, scope), F12 = To12(value.Float32Value), F13 = To13(value.Float64Value), F14 = To14(value.TextValue, scope), F15 = To15(value.BytesValue, scope), F16 = To16(value.CharValue), F17 = To17(value.UsizeValue), F18 = To18(value.IsizeValue), F19 = To10(value.Digit, scope) };
    }
    private static Packet From19(N19 value)
    {
        return new Packet(From0(value.F0), From1(value.F1), From2(value.F2), From3(value.F3), From4(value.F4), From5(value.F5), From6(value.F6), From7(value.F7), From8(value.F8), From9(value.F9), From10(value.F10), From11(value.F11), From12(value.F12), From13(value.F13), From14(value.F14), From15(value.F15), From16(value.F16), From17(value.F17), From18(value.F18), From10(value.F19));
    }
    private static N20 To20(Option<Packet> value, Scope scope)
    {
        scope.Charge(1, sizeof(N20));
        return value.IsSome ? new N20 { Flag = 1, F0 = To19(value.Value, scope) } : default;
    }
    private static Option<Packet> From20(N20 value)
    {
        return value.Flag switch { 0 => Option<Packet>.None, 1 => Option<Packet>.Some(From19(value.F0)), _ => throw new InvalidOperationException("Invalid native Option flag") };
    }
    private static N21 To21(Option<Packet>[] value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        var data = scope.Allocate(value.Length, sizeof(N20), Math.Max(sizeof(N20), IntPtr.Size));
        for (var index = 0; index < value.Length; index++) ((N20*)data)[index] = To20(value[index], scope);
        return new N21 { Data = data, Length = (nuint)value.Length };
    }
    private static Option<Packet>[] From21(N21 value)
    {
        if (value.Length > (nuint)((16 * 1024 * 1024) / Math.Max(sizeof(N20), IntPtr.Size)))
            throw new ArgumentException("Lean Bridge native sequence exceeds the 16 MiB copy limit");
        if (value.Length != 0 && (value.Data == 0 || (nuint)value.Data % 8 != 0))
            throw new InvalidOperationException("Invalid native sequence buffer");
        var result = global::System.GC.AllocateUninitializedArray<Option<Packet>>(checked((int)value.Length));
        for (var index = 0; index < result.Length; index++) result[index] = From20(((N20*)value.Data)[index]);
        return result;
    }
    private static N22 To22((Packet, Packet) value, Scope scope)
    {
        scope.Charge(1, sizeof(N22));
        return new N22 { F0 = To19(value.Item1, scope), F1 = To19(value.Item2, scope) };
    }
    private static (Packet, Packet) From22(N22 value)
    {
        return (From19(value.F0), From19(value.F1));
    }
    private static N23 To23(Result<Packet, Packet> value, Scope scope)
    {
        scope.Charge(1, sizeof(N23));
        if (value.IsOk) return new N23 { Flag = 1, F0 = To19(value.Value, scope) };
        if (value.IsError) return new N23 { F1 = To19(value.Error, scope) };
        throw new ArgumentException("Lean Except requires Result.Ok or Result.Err; default(Result) has no branch", nameof(value));
    }
    private static Result<Packet, Packet> From23(N23 value)
    {
        return value.Flag switch { 1 => Result<Packet, Packet>.Ok(From19(value.F0)), 0 => Result<Packet, Packet>.Err(From19(value.F1)), _ => throw new InvalidOperationException("Invalid native Except flag") };
    }
    private static N24 To24(Option<Result<Packet, Packet>> value, Scope scope)
    {
        scope.Charge(1, sizeof(N24));
        return value.IsSome ? new N24 { Flag = 1, F0 = To23(value.Value, scope) } : default;
    }
    private static Option<Result<Packet, Packet>> From24(N24 value)
    {
        return value.Flag switch { 0 => Option<Result<Packet, Packet>>.None, 1 => Option<Result<Packet, Packet>>.Some(From23(value.F0)), _ => throw new InvalidOperationException("Invalid native Option flag") };
    }
    private static N25 To25(Option<Result<Packet, Packet>>[] value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        var data = scope.Allocate(value.Length, sizeof(N24), Math.Max(sizeof(N24), IntPtr.Size));
        for (var index = 0; index < value.Length; index++) ((N24*)data)[index] = To24(value[index], scope);
        return new N25 { Data = data, Length = (nuint)value.Length };
    }
    private static Option<Result<Packet, Packet>>[] From25(N25 value)
    {
        if (value.Length > (nuint)((16 * 1024 * 1024) / Math.Max(sizeof(N24), IntPtr.Size)))
            throw new ArgumentException("Lean Bridge native sequence exceeds the 16 MiB copy limit");
        if (value.Length != 0 && (value.Data == 0 || (nuint)value.Data % 8 != 0))
            throw new InvalidOperationException("Invalid native sequence buffer");
        var result = global::System.GC.AllocateUninitializedArray<Option<Result<Packet, Packet>>>(checked((int)value.Length));
        for (var index = 0; index < result.Length; index++) result[index] = From24(((N24*)value.Data)[index]);
        return result;
    }
    private static N26 To26(Event value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        scope.Charge(1, sizeof(N26));
        return value switch
        {
            EventEmpty => new N26 { Kind = 0 },
            EventBox branch => new N26 { Kind = 1, Cases = new V26 { Case1 = new C26_1 { F0 = To19(branch.Value, scope) } } },
            EventChoices branch => new N26 { Kind = 2, Cases = new V26 { Case2 = new C26_2 { F0 = To25(branch.Values, scope) } } },
            _ => throw new ArgumentException("Expected a named Event constructor", nameof(value))
        };
    }
    private static Event From26(N26 value)
    {
        return value.Kind switch
        {
            0 => new EventEmpty(),
            1 => new EventBox(From19(value.Cases.Case1.F0)),
            2 => new EventChoices(From25(value.Cases.Case2.F0)),
            _ => throw new InvalidOperationException("Invalid native Event constructor")
        };
    }
    private static N27 To27(Pair value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        scope.Charge(1, sizeof(N27));
        return new N27 { F0 = To21(value.Left, scope), F1 = To21(value.Right, scope) };
    }
    private static Pair From27(N27 value)
    {
        return new Pair(From21(value.F0), From21(value.F1));
    }
    private static N28 To28(RawPacket value, Scope scope)
    {
        ArgumentNullException.ThrowIfNull(value);
        scope.Charge(1, sizeof(N28));
        return new N28 { F0 = To0(value.UnitValue), F1 = To1(value.BoolValue), F2 = To2(value.Uint8Value), F3 = To3(value.Uint16Value), F4 = To4(value.Uint32Value), F5 = To5(value.Uint64Value), F6 = To6(value.Int8Value), F7 = To7(value.Int16Value), F8 = To8(value.Int32Value), F9 = To9(value.Int64Value), F10 = To10(value.NatValue, scope), F11 = To11(value.IntValue, scope), F12 = To12(value.Float32Value), F13 = To13(value.Float64Value), F14 = To14(value.TextValue, scope), F15 = To15(value.BytesValue, scope), F16 = To16(value.CharValue), F17 = To17(value.UsizeValue), F18 = To18(value.IsizeValue), F19 = To10(value.Digit, scope) };
    }
    private static RawPacket From28(N28 value)
    {
        return new RawPacket(From0(value.F0), From1(value.F1), From2(value.F2), From3(value.F3), From4(value.F4), From5(value.F5), From6(value.F6), From7(value.F7), From8(value.F8), From9(value.F9), From10(value.F10), From11(value.F11), From12(value.F12), From13(value.F13), From14(value.F14), From15(value.F15), From16(value.F16), From17(value.F17), From18(value.F18), From10(value.F19));
    }

    internal static Option<Packet>[] Call0(Option<Packet>[] arg0, Option<Packet>[] arg1)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To21(arg0, scope);
        var input1 = To21(arg1, scope);
        N21 output = default;
        try
        {
            var status = Native.Call0(in input0, in input1, ref output, out var error);
            
            Check(status, error);
            return From21(output);
        }
        finally { Native.Clear21(ref output); }
    }
    internal static (Packet, Packet) Call1(Packet arg0, Packet arg1)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To19(arg0, scope);
        var input1 = To19(arg1, scope);
        N22 output = default;
        try
        {
            var status = Native.Call1(in input0, in input1, ref output, out var error);
            
            Check(status, error);
            return From22(output);
        }
        finally { Native.Clear22(ref output); }
    }
    internal static Packet Call2(Packet arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To19(arg0, scope);
        N19 output = default;
        try
        {
            var status = Native.Call2(in input0, ref output, out var error);
            
            Check(status, error);
            return From19(output);
        }
        finally { Native.Clear19(ref output); }
    }
    internal static Packet Call3(Packet arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To19(arg0, scope);
        N19 output = default;
        try
        {
            var status = Native.Call3(in input0, ref output, out var error);
            
            Check(status, error);
            return From19(output);
        }
        finally { Native.Clear19(ref output); }
    }
    internal static Event Call4(Event arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To26(arg0, scope);
        N26 output = default;
        try
        {
            var status = Native.Call4(in input0, ref output, out var error);
            
            Check(status, error);
            return From26(output);
        }
        finally { Native.Clear26(ref output); }
    }
    internal static Event Call5(Event arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To26(arg0, scope);
        N26 output = default;
        try
        {
            var status = Native.Call5(in input0, ref output, out var error);
            
            Check(status, error);
            return From26(output);
        }
        finally { Native.Clear26(ref output); }
    }
    internal static Pair Call6(Pair arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To27(arg0, scope);
        N27 output = default;
        try
        {
            var status = Native.Call6(in input0, ref output, out var error);
            
            Check(status, error);
            return From27(output);
        }
        finally { Native.Clear27(ref output); }
    }
    internal static Option<Packet> Call7(RawPacket arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To28(arg0, scope);
        N20 output = default;
        try
        {
            var status = Native.Call7(in input0, ref output, out var error);
            
            Check(status, error);
            return From20(output);
        }
        finally { Native.Clear20(ref output); }
    }
    internal static Event Call8(RawPacket arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To28(arg0, scope);
        N26 output = default;
        try
        {
            var status = Native.Call8(in input0, ref output, out var error);
            
            Check(status, error);
            return From26(output);
        }
        finally { Native.Clear26(ref output); }
    }
    internal static Event Call9(RawPacket arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To28(arg0, scope);
        N26 output = default;
        try
        {
            var status = Native.Call9(in input0, ref output, out var error);
            
            Check(status, error);
            return From26(output);
        }
        finally { Native.Clear26(ref output); }
    }
    internal static Option<Packet>[] Call10(RawPacket arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To28(arg0, scope);
        N21 output = default;
        try
        {
            var status = Native.Call10(in input0, ref output, out var error);
            
            Check(status, error);
            return From21(output);
        }
        finally { Native.Clear21(ref output); }
    }
    internal static Pair Call11(RawPacket arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To28(arg0, scope);
        N27 output = default;
        try
        {
            var status = Native.Call11(in input0, ref output, out var error);
            
            Check(status, error);
            return From27(output);
        }
        finally { Native.Clear27(ref output); }
    }
    internal static Packet Call12(Packet arg0)
    {
        Native.EnsureProcess();
        
        using var scope = new Scope();
        
        var input0 = To19(arg0, scope);
        N19 output = default;
        try
        {
            var status = Native.Call12(in input0, ref output, out var error);
            
            Check(status, error);
            return From19(output);
        }
        finally { Native.Clear19(ref output); }
    }
    internal static uint Call13()
    {
        Native.EnsureProcess();
        
        
        

        uint output = default;
        try
        {
            var status = Native.Call13(ref output, out var error);
            
            Check(status, error);
            return From4(output);
        }
        finally {  }
    }
}

internal static class Native
{
    private const string Library = "libnominalprimitivesubtypes.so";
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
            const string library = "libnominalprimitivesubtypes.so";
            var roots = new[] { global::System.IO.Path.Combine(global::System.AppContext.BaseDirectory, "runtimes", "linux-x64", "native"), global::System.AppContext.BaseDirectory };
            var root = global::System.Array.Find(roots, path => global::System.IO.File.Exists(global::System.IO.Path.Combine(path, library)))
                ?? throw new global::System.DllNotFoundException("The installed Lean native assets are missing");
            VerifyDirectory(root);
            if (root == roots[0]) { VerifyDirectory(global::System.IO.Path.GetDirectoryName(root)!); VerifyDirectory(global::System.IO.Path.GetDirectoryName(global::System.IO.Path.GetDirectoryName(root)!)!); }
            var libraries = new global::System.Collections.Generic.Dictionary<string, string>(global::System.StringComparer.Ordinal)
            {
                ["libcomponent_19ad06f04a0c2d39db76.so"] = "58a916198cb50e5bb7fab57554591812a8381960749e100c43effecedd0a3672",
                ["liblean_bridge_native.so"] = "25bb83c98a7f86c15c8f5a5181457943beae8e9052ce059cf11df47060cdb5f7",
                ["libleanshared.so"] = "d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4",
                ["libnominalprimitivesubtypes.so"] = "a4605311dc238fe198ce7162b5379fa64b34e2e6bf98e544eb6b2c5de60bb4f0",
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
                const string component = "component:nominalprimitivesubtypes@1.0.0";
                const string receipt = "2dd9c29a403172311e634904897684be48d45345cdcd1fb3b76ccea2c5b9f323";
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
                    foreach (var name in new[] { "libleanshared.so", "liblean_bridge_native.so", "libcomponent_19ad06f04a0c2d39db76.so", "libnominalprimitivesubtypes.so" })
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
    [DllImport(Library, EntryPoint = "nominalprimitivesubtypes_aliases", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call0(in N21 input0, in N21 input1, ref N21 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nominalprimitivesubtypes_combine", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call1(in N19 input0, in N19 input1, ref N22 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nominalprimitivesubtypes_echo_a", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call2(in N19 input0, ref N19 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nominalprimitivesubtypes_echo_b", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call3(in N19 input0, ref N19 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nominalprimitivesubtypes_echo_event_a", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call4(in N26 input0, ref N26 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nominalprimitivesubtypes_echo_event_b", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call5(in N26 input0, ref N26 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nominalprimitivesubtypes_echo_pair", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call6(in N27 input0, ref N27 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nominalprimitivesubtypes_produce", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call7(in N28 input0, ref N20 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nominalprimitivesubtypes_produce_choices", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call8(in N28 input0, ref N26 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nominalprimitivesubtypes_produce_event", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call9(in N28 input0, ref N26 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nominalprimitivesubtypes_produce_group", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call10(in N28 input0, ref N21 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nominalprimitivesubtypes_produce_pair", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call11(in N28 input0, ref N27 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nominalprimitivesubtypes_refuse_unit", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call12(in N19 input0, ref N19 output, out NativeError error);
    [DllImport(Library, EntryPoint = "nominalprimitivesubtypes_word_bits", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Call13(ref uint output, out NativeError error);

    [DllImport(Library, EntryPoint = "nominalprimitivesubtypes_nat_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear10(ref N10 value);
    [DllImport(Library, EntryPoint = "nominalprimitivesubtypes_int_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear11(ref N11 value);
    [DllImport(Library, EntryPoint = "nominalprimitivesubtypes_string_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear14(ref N14 value);
    [DllImport(Library, EntryPoint = "nominalprimitivesubtypes_bytes_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear15(ref N15 value);
    [DllImport(Library, EntryPoint = "nominalprimitivesubtypes_packet_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear19(ref N19 value);
    [DllImport(Library, EntryPoint = "nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear20(ref N20 value);
    [DllImport(Library, EntryPoint = "nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear21(ref N21 value);
    [DllImport(Library, EntryPoint = "nominalprimitivesubtypes_tuple_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear22(ref N22 value);
    [DllImport(Library, EntryPoint = "nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear23(ref N23 value);
    [DllImport(Library, EntryPoint = "nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear24(ref N24 value);
    [DllImport(Library, EntryPoint = "nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear25(ref N25 value);
    [DllImport(Library, EntryPoint = "nominalprimitivesubtypes_event_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear26(ref N26 value);
    [DllImport(Library, EntryPoint = "nominalprimitivesubtypes_pair_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear27(ref N27 value);
    [DllImport(Library, EntryPoint = "nominalprimitivesubtypes_raw_packet_clear", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern void Clear28(ref N28 value);
}
