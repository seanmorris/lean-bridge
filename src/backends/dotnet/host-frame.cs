using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Runtime.ExceptionServices;
using System.Runtime.InteropServices;

namespace LeanBridge.GeneratedHost;

internal sealed unsafe class HostCall : IDisposable {
    internal unsafe delegate void Dispatcher(int slot, ulong* args, nuint count, ulong* result);
    [ThreadStatic] private static HostCall? top;
    [ThreadStatic] private static ulong sequence;
    [DllImport("libc")] private static extern int gettid();
    [DllImport("libc")] private static extern int getpid();
    private readonly HostCall? parent;
    private Dispatcher? dispatch;
    private HostMembers? binder;
    private readonly List<ulong> inputs=new();
    private ulong response;
    private readonly List<ExceptionDispatchInfo> faults = new();
    private Exception? fatal;
    private byte[]? outputBuffer;
    // The native caller copies a result before its next member dispatch. A nested
    // invocation has its own frame and cannot invalidate the outer result buffer.
    internal static byte[] AllocateResult(int size, ulong* words) {
        var f=top ?? throw new InvalidOperationException("Missing CLR host frame");
        var buffer=GC.AllocateArray<byte>(size,pinned:true); f.outputBuffer=buffer;
        fixed(byte* p=buffer) words[0]=(ulong)p;
        return buffer;
    }
    internal readonly ulong Id;
    internal HostCall(HostMembers members) : this(members.InvokeWire) { binder=members; }
    internal ulong Input(object value) {
        if(top!=this) throw new InvalidOperationException("Inactive CLR host call");
        var id=HostRefs.Add(value);
        try { inputs.Add(id); return id; } catch { HostRefs.Drop(id); throw; }
    }
    internal static ulong PublishObject(object value) {
        var f=top ?? throw new InvalidOperationException("Missing CLR host frame");
        if(f.response!=0) throw new InvalidOperationException("Overlapping CLR member responses");
        return f.response=HostRefs.Add(value);
    }
    private void ReferenceOp(int op,ulong* args,nuint count,ulong* result) {
        if(binder==null || args==null || result==null || count!=2) throw new InvalidOperationException("Invalid CLR reference operation");
        ulong a=args[0],b=args[1]; result[0]=op switch {
            -1=>HostRefs.Add(binder,true),
            -2=>HostRefs.Read(a) is null ? 0UL : 1UL,
            -3=>ReferenceEquals(HostRefs.Read(a),binder)?1UL:0UL,
            -4=>HostRefs.Add(binder.ClassAt(checked((int)a))),
            -5=>ReferenceEquals(HostRefs.Read(a),HostRefs.Read(b))?1UL:0UL,
            -6=>((Type)HostRefs.Read(b)!).IsInstanceOfType(HostRefs.Read(a))?1UL:0UL,
            -7=>HostRefs.Add(HostRefs.Read(a)!),
            -8=>Drop(a),
            // Keep the exported object valid until the public call returns,
            // even when releasing the last Lean reference sweeps its row.
            -9=>Input(HostRefs.Read(a)!),
            _=>throw new InvalidOperationException("Unknown CLR reference operation")
        };
    }
    private static ulong Drop(ulong id) { HostRefs.Drop(id); return 0; }
    internal HostCall(Dispatcher invoke) {
        if (getpid()!=gettid()) throw new InvalidOperationException("CLR host calls require the process main thread");
        ArgumentNullException.ThrowIfNull(invoke);
        if (top?.fatal != null) throw new InvalidOperationException("CLR host runtime retired");
        Id=checked(++sequence); parent=top; dispatch=invoke; top=this;
    }
    internal static delegate* unmanaged[Cdecl]<ulong,int,ulong*,nuint,ulong*,uint*,int> Entry => &Invoke;
    [UnmanagedCallersOnly(CallConvs = new[]{typeof(CallConvCdecl)})]
    private static int Invoke(ulong call, int slot, ulong* args, nuint count, ulong* result, uint* fault) {
        var frame=top;
        if (fault==null) return 2;
        *fault=0;
        if (frame==null || frame.Id!=call || frame.dispatch==null || (frame.fatal!=null && slot>=0)) return 2;
        try {
            if(slot<0) frame.ReferenceOp(slot,args,count,result);
            else {
                HostRefs.Drop(frame.response); frame.response=0;
                frame.outputBuffer=null; frame.dispatch(slot,args,count,result);
            }
            return 0;
        } catch (Exception e) {
            // No managed exception (including an exception capturing the first fault)
            // may unwind through an unmanaged callback. Never call virtual Message.
            if (slot>=0 && e is not (OutOfMemoryException or AccessViolationException or SEHException or StackOverflowException)) {
                try { frame.faults.Add(ExceptionDispatchInfo.Capture(e)); *fault=(uint)frame.faults.Count; return 1; }
                catch (Exception capture) { frame.fatal=capture; }
            } else frame.fatal=e;
            return 2;
        }
    }
    internal void Check(uint id) {
        if (top!=this) throw new InvalidOperationException("Inactive CLR host call");
        if (fatal!=null) ExceptionDispatchInfo.Throw(fatal);
        if (id==0) return;
        if (id>faults.Count) throw new InvalidOperationException("Invalid CLR host error identity");
        faults[(int)id-1].Throw();
    }
    public void Dispose() {
        if (dispatch==null) return;
        if (top!=this) throw new InvalidOperationException("Out-of-order CLR host call disposal");
        foreach(var id in inputs) HostRefs.Drop(id);
        inputs.Clear(); HostRefs.Drop(response); response=0;
        top=parent; dispatch=null; binder=null; fatal=null; outputBuffer=null; faults.Clear();
    }
}
