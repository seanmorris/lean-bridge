using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Runtime.ExceptionServices;
using System.Runtime.InteropServices;
using LeanBridge.GeneratedHost;

namespace LeanBridge.GeneratedIO;

// Each Run brackets one synchronous ABI operation, never await, polling, or
// application callback code. A worker neither calls CLR nor sees this frame.
internal sealed unsafe class HostWorkerFrame
{
    [ThreadStatic] private static HostWorkerFrame? top;
    private readonly HostCall call;
    private readonly nint objectFn;
    private readonly Func<int,Exception> failure;
    private readonly Action body;
    private readonly List<(uint kind,ulong first,ulong second)> inputs=new();
    private Exception? error;
    private bool entered, running;

    private HostWorkerFrame(HostCall call,nint objectFn,Func<int,Exception> failure,Action body)
    { this.call=call; this.objectFn=objectFn; this.failure=failure; this.body=body; }
    internal static T Run<T>(HostMembers binding,nint visit,nint objectFn,Func<int,Exception> failure,Func<T> operation,bool cleanup=false)
    {
        using var call=new HostCall(binding);
        T result=default!;
        var f=new HostWorkerFrame(call,objectFn,failure,()=>{result=operation();});
        var parent=top; top=f;
        try
        {
            var invoke=(delegate* unmanaged[Cdecl]<ulong,delegate* unmanaged[Cdecl]<ulong,int,ulong*,nuint,ulong*,uint*,int>,int,delegate* unmanaged[Cdecl]<ulong,int>,int>)visit;
            int status=invoke(call.Id,HostCall.Entry,cleanup?1:0,&Invoke);
            if(f.error is {} original) ExceptionDispatchInfo.Throw(original);
            call.Check(0);
            if(status!=0) throw failure(status);
            if(!f.entered) throw new InvalidOperationException("CLR transport did not visit its frame");
            return result;
        }
        finally { top=parent; }
    }
    [UnmanagedCallersOnly(CallConvs=new[]{typeof(CallConvCdecl)})]
    private static int Invoke(ulong id)
    {
        var f=top;
        if(f==null || f.call.Id!=id || f.entered) return -1;
        f.entered=true; f.running=true;
        try { f.body(); return 0; }
        catch(Exception e)
        {
            f.error=e;
            return e is OutOfMemoryException or AccessViolationException or SEHException or StackOverflowException ? -1 : 5;
        }
        finally { f.running=false; }
    }
    private static HostWorkerFrame Current => top is {running:true} f ? f : throw new InvalidOperationException("No active CLR worker frame");
    private ulong Object(int op,uint kind,ulong input,ulong* h)
    {
        ulong result=0;
        int status=((delegate* unmanaged[Cdecl]<int,uint,ulong,ulong*,ulong*,int>)objectFn)(op,kind,input,h,&result);
        if(status!=0) throw failure(status);
        return result;
    }
    internal static void Input(uint kind,object value,ulong* input)
    {
        var f=Current;
        f.Object(0,kind,f.call.Input(value),input);
        f.inputs.Add((kind,input[0],input[1]));
    }
    internal static void Admit()
    {
        var f=Current;
        ulong* h=stackalloc ulong[2];
        foreach(var (kind,first,second) in f.inputs) { h[0]=first; h[1]=second; f.Object(2,kind,0,h); }
        f.inputs.Clear();
    }
    internal static T Output<T>(uint kind,ulong tag,ulong* output) where T:class
    {
        if(output[3]!=tag || output[2]!=0) throw new InvalidOperationException("Invalid CLR worker output tag");
        return (T)(HostRefs.Read(Current.Object(1,kind,0,output)) ?? throw new InvalidOperationException("Missing CLR worker result"));
    }
}
