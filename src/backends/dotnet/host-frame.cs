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
    private readonly List<ExceptionDispatchInfo> faults = new();
    private Exception? fatal;
    internal readonly ulong Id;
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
        if (frame==null || frame.Id!=call || frame.dispatch==null || frame.fatal!=null) return 2;
        try {
            frame.dispatch(slot,args,count,result); return 0;
        } catch (Exception e) {
            // No managed exception (including an exception capturing the first fault)
            // may unwind through an unmanaged callback. Never call virtual Message.
            if (e is not (OutOfMemoryException or AccessViolationException or SEHException or StackOverflowException)) {
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
        top=parent; dispatch=null; fatal=null; faults.Clear();
    }
}
