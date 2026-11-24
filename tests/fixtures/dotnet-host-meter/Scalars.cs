using System;
using System.Linq;
using System.Numerics;
using System.Text;

public sealed partial class Box {
    public static int Units; public static bool InvalidNat, InvalidText;
    static void Check(bool p) => Program.Check(p);
    public static void EchoUnit() { Units++; }
    public static bool EchoBool(bool v) { Check(v); return false; }
    public static Rune EchoChar(Rune v) { Check(v.Value==0x1f41d); return new Rune(0x1f98b); }
    public static byte EchoUint8(byte v) { Check(v==byte.MaxValue); return (byte)(v-1); }
    public static ushort EchoUint16(ushort v) { Check(v==ushort.MaxValue); return (ushort)(v-1); }
    public static uint EchoUint32(uint v) { Check(v==uint.MaxValue); return v-1; }
    public static ulong EchoUint64(ulong v) { Check(v==ulong.MaxValue); return v-1; }
    public static nuint EchoUsize(nuint v) { Check(v==nuint.MaxValue); return v-1; }
    public static sbyte EchoInt8(sbyte v) { Check(v==sbyte.MinValue); return (sbyte)(v+1); }
    public static short EchoInt16(short v) { Check(v==short.MinValue); return (short)(v+1); }
    public static int EchoInt32(int v) { Check(v==int.MinValue); return v+1; }
    public static long EchoInt64(long v) { Check(v==long.MinValue); return v+1; }
    public static nint EchoIsize(nint v) { Check(v==nint.MinValue); return v+1; }
    public static float EchoFloat32(float v) {
        uint b=BitConverter.SingleToUInt32Bits(v); Check(b==1 || b==0x80000000);
        return BitConverter.UInt32BitsToSingle(b==1?0x80000001U:0x7fc00042U);
    }
    public static double EchoFloat64(double v) {
        ulong b=BitConverter.DoubleToUInt64Bits(v); Check(b==1 || b==0x8000000000000000UL);
        return BitConverter.UInt64BitsToDouble(b==1?0x8000000000000001UL:0x7ff8000000000042UL);
    }
    public static string EchoString(string v) { Check(v=="🐝\0a"); return InvalidText ? "\ud800" : v+"!"; }
    public static byte[] EchoBytes(byte[] v) { Check(v.SequenceEqual(new byte[]{0,128,255})); v[0]=42; return v; }
    public static BigInteger EchoNat(BigInteger v) { Check(v.IsZero || v==BigInteger.One<<160); return InvalidNat ? -1 : v+7; }
    public static BigInteger EchoInt(BigInteger v) { Check(v==-(BigInteger.One<<160)); return v-7; }
}
