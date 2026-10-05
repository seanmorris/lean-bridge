// Public generated values only. This program never calls a Lean export.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Numerics;
using System.Text;
using System.Text.Json;
using A = LeanBridge.Aliases;
using C = LeanBridge.Collections;
using L = LeanBridge.Lists;
using O = LeanBridge.Compounds;
using V = LeanBridge.Variants;

static class Program
{
    static int checks;
    static void Check(bool value) { if (!value) throw new Exception($"equality check {checks + 1} failed"); ++checks; }
    static void Equal<T>(T left, T right) where T : notnull
    {
        Check(EqualityComparer<T>.Default.Equals(left, right));
        Check(EqualityComparer<T>.Default.Equals(right, left));
        Check(left.Equals(right)); Check(right.Equals(left));
        Check(object.Equals(left, right));
        Check(left.GetHashCode() == right.GetHashCode());
        Check(new HashSet<T> { left }.Contains(right));
        Check(new Dictionary<T, int> { [left] = 42 }[right] == 42);
        Check(StructuralComparisons.StructuralEqualityComparer.Equals(left, right));
    }
    static void Different<T>(T left, T right) where T : notnull
    {
        Check(!EqualityComparer<T>.Default.Equals(left, right));
        Check(!EqualityComparer<T>.Default.Equals(right, left));
        Check(!object.Equals(left, right));
        Check(!new HashSet<T> { left }.Contains(right));
    }
    static C.Primitives Primitives() => new(default, true, byte.MaxValue, ushort.MaxValue, uint.MaxValue, ulong.MaxValue,
        sbyte.MinValue, short.MinValue, int.MinValue, long.MinValue, BigInteger.One << 5120, -(BigInteger.One << 5120),
        -0.0f, double.NaN, "\ufeff🌱\0", new byte[] { 0, 255, 128 }, new Rune(0x1f331), ulong.MaxValue, long.MinValue);
    static C.Packet Collection() => new("parcel\0", new[] { new[] { Primitives() }, Array.Empty<C.Primitives>(), new[] { Primitives() } },
        new C.Empty(), new C.Single(ulong.MaxValue), new C.Count(BigInteger.One << 5120), new C.Pair(17, "a\0"), new C.Reversed("b\0", 23));
    static V.Packet Variant() => new(new V.SignalData(42, "🌱\0"),
        new V.Signal[] { new V.SignalIdle(), new V.SignalMarker(default), new V.SignalData(7, "end") },
        V.Option<V.Signal>.Some(new V.SignalStopped()), new V.Mode[] { new V.ModeFirst(), new V.ModeThird() });
    static A.Packet Alias() => new(41, "packet\0", new[] { new uint[] { 1, 2 }, Array.Empty<uint>() },
        A.Option<A.Option<A.Unit>>.Some(A.Option<A.Unit>.None), A.Result<(uint, byte[]), string>.Ok((7, new byte[] { 0, 255 })));
    static L.Packet List() => new(new[] { new uint[] { 1, 2 }, Array.Empty<uint>() },
        new[] { L.Option<L.Result<(BigInteger, L.Unit), string>>.Some(L.Result<(BigInteger, L.Unit), string>.Ok((BigInteger.One << 5120, default))), L.Option<L.Result<(BigInteger, L.Unit), string>>.None },
        new[] { new byte[] { 0, 255 }, Array.Empty<byte>() },
        new[] { new[] { (true, new Rune(0x1f331)), (false, new Rune(0)) } });
    static O.Packet Compound() => new(O.Option<O.Result<(BigInteger, O.Unit), string>>.Some(O.Result<(BigInteger, O.Unit), string>.Ok((42, default))),
        ((7, "text\0"), (true, new Rune(0x1f331))),
        new[] { O.Option<O.Result<(string, ulong), (byte[], BigInteger)>>.Some(O.Result<(string, ulong), (byte[], BigInteger)>.Err((new byte[] { 0, 255 }, -17))) },
        O.Result<O.Option<O.Result<(uint, O.Unit), string>>, O.Option<BigInteger>>.Ok(O.Option<O.Result<(uint, O.Unit), string>>.Some(O.Result<(uint, O.Unit), string>.Err("nested"))));
    static void Records()
    {
        Equal(Collection(), Collection()); Equal(new C.Empty(), new C.Empty()); Equal(Primitives(), Primitives());
        Check(Collection() == Collection()); Check(!(Collection() != Collection()));
        Check(!Collection().Equals(null)); Check(!new C.Single(1).Equals((object)new C.Count(1)));
        var value = Primitives();
        foreach (var changed in new[] {
            value with { Flag = false }, value with { U8 = 0 }, value with { U16 = 0 }, value with { U32 = 0 }, value with { U64 = 0 },
            value with { I8 = 0 }, value with { I16 = 0 }, value with { I32 = 0 }, value with { I64 = 0 },
            value with { Natural = 0 }, value with { Integer = 0 }, value with { F32 = 1 }, value with { F64 = 1 },
            value with { Text = "different" }, value with { Bytes = new byte[] { 1, 255, 128 } }, value with { Char = new Rune(0) },
            value with { Usize = 0 }, value with { Isize = 0 } }) Different(value, changed);
        // Floating equality follows .NET: signed zero and NaN payloads compare equal.
        Equal(value, Primitives() with { F32 = 0.0f, F64 = BitConverter.Int64BitsToDouble(unchecked((long)0x7ff8000000000001)) });
        Equal(Collection() with { Label = null! }, Collection() with { Label = null! });
        Different(Collection(), Collection() with { Label = null! });
        var left = Collection(); var right = Collection();
        left.Values[0][0].Bytes[0] = 7; Different(left, right);
        right.Values[0][0].Bytes[0] = 7; Equal(left, right);
        Equal(left with { Values = Array.Empty<C.Primitives[]>() }, right with { Values = Array.Empty<C.Primitives[]>() });
        Different(left with { Values = Array.Empty<C.Primitives[]>() }, right with { Values = new[] { Array.Empty<C.Primitives>() } });
        var pair = new C.Pair(17, "a"); var (first, second) = pair; Check(first == 17 && second == "a");
        Equal(pair with { First = 19 }, new C.Pair(19, "a"));
    }
    static void Wrappers()
    {
        Equal(O.Option<byte[]>.Some(new byte[] { 0, 255 }), O.Option<byte[]>.Some(new byte[] { 0, 255 }));
        Check(O.Option<byte[]>.Some(new byte[] { 1 }) == O.Option<byte[]>.Some(new byte[] { 1 }));
        Check(O.Option<byte[]>.Some(new byte[] { 1 }) != O.Option<byte[]>.Some(new byte[] { 2 }));
        Equal(O.Option<byte[]>.None, default(O.Option<byte[]>));
        Different(O.Option<byte[]>.None, O.Option<byte[]>.Some(Array.Empty<byte>()));
        Different(O.Option<O.Option<O.Unit>>.None, O.Option<O.Option<O.Unit>>.Some(O.Option<O.Unit>.None));
        Different(O.Option<O.Option<O.Unit>>.Some(O.Option<O.Unit>.None), O.Option<O.Option<O.Unit>>.Some(O.Option<O.Unit>.Some(default)));
        // Null payload wrappers can be compared, but still reject at a Lean call boundary.
        Equal(O.Option<byte[]>.Some(null!), O.Option<byte[]>.Some(null!));
        Different(O.Option<byte[]>.None, O.Option<byte[]>.Some(null!));
        Different(O.Option<byte[]>.Some(Array.Empty<byte>()), O.Option<byte[]>.Some(null!));
        Equal(O.Result<byte[], byte[]>.Ok(new byte[] { 1, 2 }), O.Result<byte[], byte[]>.Ok(new byte[] { 1, 2 }));
        Equal(O.Result<byte[], byte[]>.Err(new byte[] { 1, 2 }), O.Result<byte[], byte[]>.Err(new byte[] { 1, 2 }));
        Check(O.Result<byte[], string>.Ok(new byte[] { 1 }) == O.Result<byte[], string>.Ok(new byte[] { 1 }));
        Different(O.Result<byte[], byte[]>.Ok(Array.Empty<byte>()), O.Result<byte[], byte[]>.Err(Array.Empty<byte>()));
        Equal(default(O.Result<byte[], byte[]>), default(O.Result<byte[], byte[]>));
        Different(default(O.Result<byte[], byte[]>), O.Result<byte[], byte[]>.Ok(null!));
        Different(default(O.Result<byte[], byte[]>), O.Result<byte[], byte[]>.Err(null!));
        Equal(O.Result<byte[], byte[]>.Ok(null!), O.Result<byte[], byte[]>.Ok(null!));
        Equal(O.Result<byte[], byte[]>.Err(null!), O.Result<byte[], byte[]>.Err(null!));
        Equal(O.Option<((uint[], bool), byte[])>.Some(((new uint[] { 1, 2 }, true), new byte[] { 255 })),
            O.Option<((uint[], bool), byte[])>.Some(((new uint[] { 1, 2 }, true), new byte[] { 255 })));
        Different(O.Option<((uint[], bool), byte[])>.Some(((new uint[] { 1, 2 }, true), new byte[] { 255 })),
            O.Option<((uint[], bool), byte[])>.Some(((new uint[] { 2, 1 }, true), new byte[] { 255 })));
    }
    static void Variants()
    {
        Equal<V.Signal>(new V.SignalIdle(), new V.SignalIdle());
        Different<V.Signal>(new V.SignalIdle(), new V.SignalStopped());
        Different<V.Signal>(new V.SignalIdle(), new V.SignalMarker(default));
        Different<V.Signal>(new V.SignalData(1, "a"), new V.SignalData(2, "a"));
        Equal<V.Nested>(new V.NestedPacket(Variant()), new V.NestedPacket(Variant()));
        Equal<V.Buffers>(new V.BuffersPair(new byte[] { 0, 255 }, new byte[] { 1 }), new V.BuffersPair(new byte[] { 0, 255 }, new byte[] { 1 }));
        Check(new V.BuffersPair(new byte[] { 1 }, Array.Empty<byte>()) == new V.BuffersPair(new byte[] { 1 }, Array.Empty<byte>()));
        Different<V.Buffers>(new V.BuffersEmpty(), new V.BuffersPair(Array.Empty<byte>(), Array.Empty<byte>()));
        var a = Variant(); var b = Variant(); a.Events[0] = new V.SignalStopped(); Different(a, b);
        b.Events[0] = new V.SignalStopped(); Equal(a, b);
        Equal(a with { Fallback = V.Option<V.Signal>.None }, b with { Fallback = V.Option<V.Signal>.None });
        Different(a, b with { Fallback = V.Option<V.Signal>.None });
    }
    static Array Deep(uint leaf)
    {
        object value = leaf;
        for (int depth = 0; depth < 24; ++depth) { var array = Array.CreateInstance(value.GetType(), 1); array.SetValue(value, 0); value = array; }
        return (Array)value;
    }
    static void Run()
    {
        Records(); Wrappers(); Variants();
        for (int repeat = 0; repeat < 64; ++repeat)
        {
            Equal(Collection(), Collection()); Equal(Compound(), Compound()); Equal(List(), List()); Equal(Alias(), Alias()); Equal(Variant(), Variant());
        }
        Different(Alias(), Alias() with { Outcome = A.Result<(uint, byte[]), string>.Ok((7, new byte[] { 1, 255 })) });
        Different(List(), List() with { Buffers = new[] { new byte[] { 1, 255 }, Array.Empty<byte>() } });
        var deep = Deep(42); var twin = Deep(42); var different = Deep(43);
        var comparer = StructuralComparisons.StructuralEqualityComparer;
        Check(comparer.Equals(deep, twin)); Check(comparer.GetHashCode(deep) == comparer.GetHashCode(twin)); Check(!comparer.Equals(deep, different));
        var a = (new uint[] { 1, 2 }, new byte[] { 0, 255 }); var b = (new uint[] { 1, 2 }, new byte[] { 0, 255 });
        Check(comparer.Equals(a, b)); Check(comparer.GetHashCode(a) == comparer.GetHashCode(b));
        Check(!Equals(a, b)); Check(!Equals(a.Item1, b.Item1));
        Console.WriteLine(JsonSerializer.Serialize(new { checks, generatedProfiles = 5, fixedArrayDepth = 24, nativeCalls = 0 }));
    }
    static int Main()
    {
        try { Run(); return 0; }
        catch (Exception error) { Console.Error.WriteLine(error); return 1; }
    }
}
