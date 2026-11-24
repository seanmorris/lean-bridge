using System;
using System.Numerics;
using System.Text;

namespace LeanBridge.GeneratedHost;

internal sealed unsafe partial class HostMembers {
    private const int Limit=16*1024*1024;
    private static ReadOnlySpan<byte> Buffer(ulong* w, int width, ref int budget) {
        if(w[1]>(uint)(budget/width) || (w[1]!=0 && w[0]==0)) throw new ArgumentException("Invalid CLR host buffer");
        int length=(int)w[1]*width; budget-=length;
        return new ReadOnlySpan<byte>((void*)w[0],length);
    }
    private static object? Decode(Site site, ulong* w, ref int budget) {
        var k=site.Kind; ulong bits=w[0];
        if(k is "int" or "nat") {
            var bytes=Buffer(w,8,ref budget);
            var v=new BigInteger(bytes,isUnsigned:true,isBigEndian:false);
            if(w[2]>1 || (w[2]!=0 && (k=="nat" || v.IsZero))) throw new ArgumentException("Invalid integer sign");
            return w[2]==0?v:-v;
        }
        if(w[2]!=0 || (k is not ("bytes" or "string") && w[1]!=0)) throw new ArgumentException("Invalid CLR host scalar");
        return k switch {
            "unit" when bits==0=>null, "bool" when bits<2=>bits!=0, "char"=>new Rune(checked((int)bits)),
            "uint8"=>checked((byte)bits), "int8"=>unchecked((sbyte)checked((byte)bits)),
            "uint16"=>checked((ushort)bits), "int16"=>unchecked((short)checked((ushort)bits)),
            "uint32"=>checked((uint)bits), "int32"=>unchecked((int)checked((uint)bits)),
            "uint64"=>bits, "int64"=>unchecked((long)bits), "usize"=>(nuint)bits, "isize"=>unchecked((nint)bits),
            "float32"=>BitConverter.UInt32BitsToSingle(checked((uint)bits)), "float64"=>BitConverter.UInt64BitsToDouble(bits),
            "string"=>Utf8.GetString(Buffer(w,1,ref budget)), "bytes"=>Buffer(w,1,ref budget).ToArray(),
            _=>throw new ArgumentException("Unsupported CLR host wire site: " + k)
        };
    }
    private static void Encode(Site site, object? v, ulong* w) {
        w[0]=0; w[1]=0; w[2]=0;
        switch(site.Kind) {
        case "unit": return;
        case "bool": w[0]=(bool)v! ? 1UL : 0UL; return;
        case "char": w[0]=(uint)((Rune)v!).Value; return;
        case "uint8": w[0]=(byte)v!; return; case "int8": w[0]=unchecked((byte)(sbyte)v!); return;
        case "uint16": w[0]=(ushort)v!; return; case "int16": w[0]=unchecked((ushort)(short)v!); return;
        case "uint32": w[0]=(uint)v!; return; case "int32": w[0]=unchecked((uint)(int)v!); return;
        case "uint64": w[0]=(ulong)v!; return; case "int64": w[0]=unchecked((ulong)(long)v!); return;
        case "usize": w[0]=(nuint)v!; return; case "isize": w[0]=unchecked((ulong)(nint)v!); return;
        case "float32": w[0]=BitConverter.SingleToUInt32Bits((float)v!); return;
        case "float64": w[0]=BitConverter.DoubleToUInt64Bits((double)v!); return;
        case "string": {
            var s=(string)v!; int n=Utf8.GetByteCount(s);
            if(n>Limit) throw new ArgumentOutOfRangeException(nameof(v));
            Utf8.GetBytes(s.AsSpan(),HostCall.AllocateResult(n,w)); w[1]=(uint)n; return;
        }
        case "bytes": {
            var bytes=(byte[])v!; if(bytes.Length>Limit) throw new ArgumentOutOfRangeException(nameof(v));
            bytes.AsSpan().CopyTo(HostCall.AllocateResult(bytes.Length,w)); w[1]=(uint)bytes.Length; return;
        }
        case "int": case "nat": {
            var n=(BigInteger)v!; if(n.IsZero) return;
            var mag=BigInteger.Abs(n); int size=mag.GetByteCount(isUnsigned:true);
            if(size>Limit) throw new ArgumentOutOfRangeException(nameof(v));
            int count=(size+7)/8;
            if(!mag.TryWriteBytes(HostCall.AllocateResult(count*8,w),out _,isUnsigned:true,isBigEndian:false)) throw new InvalidOperationException();
            w[1]=(uint)count; w[2]=n.Sign<0 ? 1UL : 0UL; return;
        }
        default: throw new ArgumentException("Unsupported CLR host wire site");
        }
    }
    internal void InvokeWire(int slot, ulong* input, nuint count, ulong* output) {
        var m=members[slot];
        if(count!=(uint)m.Args.Length || output==null || (input==null && count!=0)) throw new ArgumentException("Invalid CLR argument vector");
        var args=new object?[m.Args.Length]; int budget=Limit;
        for(int i=0;i<args.Length;i++) args[i]=Decode(m.Args[i],input+3*i,ref budget);
        Encode(m.Result,Invoke(slot,args),output);
    }
}
