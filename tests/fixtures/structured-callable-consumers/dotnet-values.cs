// Independent public C# values. No generated layouts or constructor tags.
using System;
using System.Linq;
using System.Numerics;
using LeanBridge.Structured;

internal static class StructuredValues
{
    internal static readonly string[] Shapes = { "array", "list", "option", "result", "tuple", "record", "variant", "alias" };
    internal static string Text(int seed) => new[] { "", "a\0λ🌿", "\U0010ffff", "e\u0301" }[seed % 4] + seed;
    internal static BigInteger Huge(int seed) => (BigInteger.One << (256 + seed)) + (BigInteger.One << 64) + seed;
    internal static Option<string>[] Array(int seed) => seed % 5 == 0 ? System.Array.Empty<Option<string>>() : new[]
    {
        Option<string>.None, Option<string>.Some(Text(seed)), Option<string>.Some(""), Option<string>.Some("\0")
    };
    internal static Result<(uint, string), string>[] List(int seed) => seed % 5 == 0
        ? System.Array.Empty<Result<(uint, string), string>>() : new[]
    {
        Result<(uint, string), string>.Ok((uint.MaxValue, Text(seed))),
        Result<(uint, string), string>.Err(Text(seed)),
        Result<(uint, string), string>.Ok(((uint)seed, "")),
        Result<(uint, string), string>.Err("")
    };
    internal static Option<Option<Unit>> Option(int seed) => (seed % 3) switch
    {
        0 => Option<Option<Unit>>.None,
        1 => Option<Option<Unit>>.Some(Option<Unit>.None),
        _ => Option<Option<Unit>>.Some(Option<Unit>.Some(default))
    };
    internal static Result<Option<uint>, string[]> Result(int seed) => (seed % 4) switch
    {
        0 => Result<Option<uint>, string[]>.Ok(Option<uint>.None),
        1 => Result<Option<uint>, string[]>.Ok(Option<uint>.Some((uint)seed)),
        2 => Result<Option<uint>, string[]>.Err(new[] { Text(seed), "", "\0" }),
        _ => Result<Option<uint>, string[]>.Err(System.Array.Empty<string>())
    };
    internal static (string, (byte[], BigInteger)) Tuple(int seed) => (Text(seed),
        (seed % 2 == 0 ? System.Array.Empty<byte>() : new byte[] { 0, 255, 128 }
            .Concat(Enumerable.Range(0, 256).Select(value => (byte)value)).ToArray(), Huge(seed)));
    internal static Payload Record(int seed) => new(Text(seed), Array(seed), Huge(seed), (seed % 3) switch
    {
        0 => Option<Result<(ulong, Unit), string>>.None,
        1 => Option<Result<(ulong, Unit), string>>.Some(Result<(ulong, Unit), string>.Ok((ulong.MaxValue, default))),
        _ => Option<Result<(ulong, Unit), string>>.Some(Result<(ulong, Unit), string>.Err(Text(seed)))
    });
    internal static Packet Variant(int seed) => (seed % 3) switch
    {
        0 => new PacketEmpty(),
        1 => new PacketPayload(Text(seed), Array(seed)),
        _ => new PacketCounts(Huge(seed), -Huge(seed))
    };

    // Mutate only host-owned buffers, including nested ones.
    internal static void Mutate(object? value)
    {
        if (value is System.Array array)
        {
            foreach (var child in array) Mutate(child);
            if (array.Length != 0)
            {
                if (array is byte[] bytes) bytes[0] ^= 0xff;
                else if (array is string[] strings) strings[0] = "changed";
                else if (array is Option<string>[] options) options[0] = Option<string>.Some("changed");
                else if (array is Result<(uint, string), string>[] results) results[0] = Result<(uint, string), string>.Err("changed");
            }
        }
        else if (value is Payload record) Mutate(record.Rows);
        else if (value is PacketPayload packet) Mutate(packet.Rows);
        else if (value is System.Runtime.CompilerServices.ITuple tuple)
            for (var index = 0; index < tuple.Length; ++index) Mutate(tuple[index]);
        else if (value is not null && value.GetType().IsGenericType)
        {
            var type = value.GetType();
            if (type.GetGenericTypeDefinition() == typeof(Option<>))
            {
                if ((bool)type.GetProperty("IsSome")!.GetValue(value)!) Mutate(type.GetProperty("Value")!.GetValue(value));
            }
            else if (type.GetGenericTypeDefinition() == typeof(Result<,>))
            {
                var branch = (bool)type.GetProperty("IsOk")!.GetValue(value)! ? "Value" : "Error";
                Mutate(type.GetProperty(branch)!.GetValue(value));
            }
        }
    }
}
