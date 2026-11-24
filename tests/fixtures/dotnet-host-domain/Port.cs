using System;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using LeanBridge.GeneratedHost;
using LeanBridge.GeneratedIO;

// Compiled into two separate test assemblies. Only BCL types cross the ALC.
public static unsafe class Port {
    public static Func<int,int,object?,object?> Connect(string native, Type box, Type key) {
        var binding=HostContract.Bind(box,key);
        var lib=NativeLibrary.Load(native);
        var visit=NativeLibrary.GetExport(lib,"test_visit");
        var objectFn=NativeLibrary.GetExport(lib,"test_object");
        var entry=(delegate* unmanaged[Cdecl]<ulong,delegate* unmanaged[Cdecl]<ulong,int,ulong*,nuint,ulong*,uint*,int>,int,uint,ulong,ulong*,uint*,int>)
            NativeLibrary.GetExport(lib,"test_call");
        return (op,kind,value)=>{
            if(op==12) return HostWorkerFrame.Run(binding,visit,objectFn,
                s=>new InvalidOperationException("CLR worker transport: "+s),(Func<object?>)value!);
            if(op==13) {
                ulong* words=stackalloc ulong[3]; new Span<ulong>(words,3).Clear();
                HostWorkerFrame.Input((uint)kind,value!,words);
                return new ulong[]{words[0],words[1]};
            }
            if(op==14) {
                var token=(ulong[])value!;
                ulong* words=stackalloc ulong[4]{token[0],token[1],0,3+(uint)kind};
                return HostWorkerFrame.Output<object>((uint)kind,3+(uint)kind,words);
            }
            using var f=new HostCall(binding);
            if(op==11) return HostRefs.Count;
            ulong input=value is null ? 0 : f.Input(value), output=0; uint error=0;
            int status=entry(f.Id,HostCall.Entry,op,checked((uint)kind),input,&output,&error);
            f.Check(error);
            if(status==1) throw new ArgumentException("Incompatible host type or value");
            if(status!=0) throw new InvalidOperationException("Unavailable CLR host binding: "+status);
            return op switch { 2 or 3 or 5 or 8 or 10 => HostRefs.Read(output),
                4 => output!=0, 9 => checked((int)output), _ => null };
        };
    }
}
