using System;
using System.Numerics;
using System.Text;
using A = LeanBridge.Workshop;

internal static class InstalledScalars {
    internal static void Test(A.Bound<Meter> a) {
        a.EchoUnit(default);
        if(!a.EchoBool(true) || a.EchoChar(new Rune(0x1f98b)).Value!=0x1f98b ||
            a.EchoUint8(byte.MaxValue)!=byte.MaxValue || a.EchoUint16(ushort.MaxValue)!=ushort.MaxValue ||
            a.EchoUint32(uint.MaxValue)!=uint.MaxValue || a.EchoUint64(ulong.MaxValue)!=ulong.MaxValue || a.EchoUsize(nuint.MaxValue)!=nuint.MaxValue ||
            a.EchoInt8(sbyte.MinValue)!=sbyte.MinValue || a.EchoInt16(short.MinValue)!=short.MinValue ||
            a.EchoInt32(int.MinValue)!=int.MinValue || a.EchoInt64(long.MinValue)!=long.MinValue || a.EchoIsize(nint.MinValue)!=nint.MinValue)
            throw new Exception("integer or scalar representation changed");
        if(BitConverter.SingleToUInt32Bits(a.EchoFloat32(BitConverter.UInt32BitsToSingle(0x80000000)))!=0x80000000 ||
            BitConverter.DoubleToUInt64Bits(a.EchoFloat64(BitConverter.UInt64BitsToDouble(0x8000000000000001)))!=0x8000000000000001)
            throw new Exception("floating-point bits changed");
        string text="a\0🦋"; byte[] bytes={0,128,255}; var big=BigInteger.One<<180;
        var copy=a.EchoBytes(bytes); copy[0]=8;
        if(a.EchoString(text)!=text || a.EchoNat(big)!=big || a.EchoInt(-big)!=-big || bytes[0]!=0 || copy[1]!=128 || copy[2]!=255)
            throw new Exception("owned result was not an exact copy");
        try { a.EchoNat(-1); throw new Exception("negative Nat accepted"); } catch(ArgumentOutOfRangeException) {}
        try { a.EchoString("\ud800"); throw new Exception("unpaired surrogate accepted"); } catch(EncoderFallbackException) {}
        try { a.EchoBytes(new byte[16*1024*1024+1]); throw new Exception("copy budget ignored"); } catch(ArgumentOutOfRangeException) {}
        if(a.EchoInt(big)!=big) throw new Exception("failed call leaked into next result");
        var box=new Meter(17);
        if(!ReferenceEquals(a.ChooseBox(box,true).Value,box) || !ReferenceEquals(a.ChooseBox(box,false).Error,box))
            throw new Exception("returned Except changed object identity");
        try { a.RejectBox(box); throw new Exception("missing declared host-object error"); }
        catch(A.DeclaredError<Meter> e) { if(!ReferenceEquals(box,e.Payload)) throw; }
    }
}
