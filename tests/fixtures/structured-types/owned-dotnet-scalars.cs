using System;
using System.Numerics;
using System.Text;
using LeanBridge.OwnedAggregates;
using LeanBridge.OwnedAggregates.Interop;

internal static unsafe partial class Program
{
    private static void Exercise()
    {
        using var ticket = NewTicket(42, "A\0🌱"); Borrowed(ticket);
        var huge = (BigInteger.One << 128) + 1;
        var scalars = new Scalars(default, true, new Rune(0x1f331), huge, -huge,
            byte.MaxValue, ushort.MaxValue, uint.MaxValue, ulong.MaxValue,
            sbyte.MinValue, short.MinValue, int.MinValue, long.MinValue,
            ulong.MaxValue, long.MinValue, 1.5f, -2.25, "A\0🌱", new byte[] { 0, 255, 1 });
        var packet = new Packet(ticket, scalars, Option<Option<Unit>>.Some(Option<Unit>.Some(default)), new Empty());
        Check(Inspect(packet), "Lean observes every CLR scalar");
        var copied = Echo(packet);
        Check(copied.Scalars == scalars && Inspect(copied), "all nineteen scalars round trip");
        Check(!ReferenceEquals(copied.Scalars.Bytes, scalars.Bytes), "bytes copy independently");
        Check(copied.Optional == packet.Optional && copied.Empty == packet.Empty, "nested Unit and empty record");
        Drop(copied);
        var made = MakePacket(ticket); Check(made.Scalars == scalars, "Lean constructs nineteen scalars"); Drop(made);
        for (int choice = 0; choice < 3; choice++)
        {
            var option = choice == 0 ? Option<Option<Unit>>.None : Option<Option<Unit>>.Some(choice == 1 ? Option<Unit>.None : Option<Unit>.Some(default));
            var branch = packet with { Optional = option };
            Check(OptionCase(branch) == choice, "nested option discriminant");
            var result = Echo(branch); Check(result.Optional == option, "nested option return"); Drop(result);
        }
        foreach (uint bits in new uint[] { 0, 0x80000000, 1, 0x7f800000, 0xff800000, 0x7fc12345, 0x3f800001 })
        {
            var source = packet with { Scalars = scalars with { F32 = BitConverter.UInt32BitsToSingle(bits) } };
            // Lean toBits canonicalizes NaNs. Echo must still preserve the raw
            // NaN payload, as the existing native C transport tests require.
            uint expected = float.IsNaN(source.Scalars.F32) ? 0x7fc00000 : bits;
            Check(Bits32(source) == expected, "Float32 Lean toBits semantics");
            var result = Echo(source); Check(BitConverter.SingleToUInt32Bits(result.Scalars.F32) == bits, "Float32 output preserves bits"); Drop(result);
        }
        foreach (ulong bits in new ulong[] { 0, 0x8000000000000000, 1, 0x7ff0000000000000, 0xfff0000000000000, 0x7ff8123456789abc, 0x3ff0000000000001 })
        {
            var source = packet with { Scalars = scalars with { F64 = BitConverter.UInt64BitsToDouble(bits) } };
            ulong expected = double.IsNaN(source.Scalars.F64) ? 0x7ff8000000000000 : bits;
            Check(Bits64(source) == expected, "Float64 Lean toBits semantics");
            var result = Echo(source); Check(BitConverter.DoubleToUInt64Bits(result.Scalars.F64) == bits, "Float64 output preserves bits"); Drop(result);
        }
        foreach (int length in new[] { 0, 1, 31, 32, 33, 63, 64, 65, 127, 128, 129, 511, 4096 })
        {
            var number = (BigInteger.One << length) - 1;
            foreach (int sign in new[] { -1, 0, 1 })
            {
                var data = scalars with { Natural = number, Integer = number * sign };
                var result = Echo(packet with { Scalars = data });
                Check(result.Scalars == data, "GMP sign and limb boundaries"); Drop(result);
            }
        }
        Check(Units(new Unit[127]).Length == 127 && Units(Array.Empty<Unit>()).Length == 0, "list of Unit");
        Reject<ArgumentOutOfRangeException>(() => Echo(packet with { Scalars = scalars with { Natural = -1 } }));
        Reject<EncoderFallbackException>(() => Echo(packet with { Scalars = scalars with { Text = "\ud800" } }));
        Reject<ArgumentNullException>(() => Echo(packet with { Scalars = scalars with { Bytes = null! } }));
        var saved = ticket.Retain(); ticket.Dispose();
        Check(!saved.IsClosed, "independent owner survives disposal");
        Reject<LeanBridgeException>(() => Inspect(packet));
        var retainedPacket = packet with { Ticket = saved };
        Failures(() => Echo(retainedPacket));
        saved.Dispose(); Check(saved.IsClosed, "explicit resource disposal");
    }
}
