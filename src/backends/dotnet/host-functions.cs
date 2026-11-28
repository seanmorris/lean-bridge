using System;
using System.Collections.Concurrent;
using System.Runtime.InteropServices;
using LeanBridge.GeneratedHost;

namespace LeanBridge.GeneratedIO;

// Only BCL values are shared between assemblies. Finalizers never enter Lean.
internal static class HostFunctionReleases
{
    private const string Key = "lean-bridge.dotnet.host-function-releases.v1";
    [DllImport("libc")] private static extern int getpid();
    [DllImport("libc")] private static extern int gettid();
    private static readonly int process = getpid();
    private static readonly ConcurrentQueue<Func<bool>> jobs = Queue();
    [ThreadStatic] private static bool draining;
    private static ConcurrentQueue<Func<bool>> Queue()
    {
        var domain = AppDomain.CurrentDomain;
        lock (domain)
        {
            if (domain.GetData(Key) is ConcurrentQueue<Func<bool>> q) return q;
            if (domain.GetData(Key) != null) throw new InvalidOperationException("Incompatible CLR release queue");
            q = new(); domain.SetData(Key, q); return q;
        }
    }
    internal static void Check()
    {
        if (process != getpid() || process != gettid()) throw new WrongContextException();
    }
    internal static void Post(Func<bool> job)
    {
        if (process == getpid()) jobs.Enqueue(job);
    }
    internal static void Drain()
    {
        Check();
        if (draining || jobs.IsEmpty) return;
        draining = true;
        try
        {
            for (int i=jobs.Count; i>0 && jobs.TryDequeue(out var job); --i)
                if (!job()) jobs.Enqueue(job);
        }
        finally { draining = false; }
    }
}

// A queued drop needs the native session, not a live Bound instance. Share
// this revocation cell with the leases; it has no back-reference to the owner.
// In particular, finalizer cleanup must not depend on a WeakReference which
// the CLR may already have finalized along with the abandoned lease.
internal sealed class HostFunctionSession
{
    internal HostMembers? Members;
    internal bool Closing;
    internal void Drop(int site,ulong id)
    {
        if (!Closing && Members is { } binding) Wire.DropReturned(binding,site,id);
    }
}

internal sealed class HostFunctionOwner : IDisposable
{
    internal readonly HostFunctionSession Session=new();
    private readonly Action? checkTasks, closeTasks;
    private GCHandle root;
    private readonly Func<bool> collect;
    private int depth;
    internal HostFunctionOwner(HostMembers binding, Action? checkTasks=null, Action? closeTasks=null)
    {
        HostFunctionReleases.Drain();
        this.checkTasks=checkTasks; this.closeTasks=closeTasks; collect=Collect;
        // The native session identifies its binder through a short weak
        // reference. Keep that binder (not this owner) alive until unbind,
        // including the interval between finalization and the owner's drain.
        root=GCHandle.Alloc(binding);
        try { Wire.Control(binding,-2); Session.Members=binding; }
        catch { root.Free(); throw; }
    }
    internal HostMembers Binding
    {
        get
        {
            HostFunctionReleases.Drain();
            if (Session.Closing || Session.Members is not { } binding) throw new ObjectDisposedException("CLR host binding");
            return binding;
        }
    }
    internal R Invoke<R>(Func<HostMembers,R> f)
    {
        var b=Binding; ++depth;
        try { return f(b); } finally { --depth; GC.KeepAlive(this); }
    }
    internal void Invoke(Action<HostMembers> f) => Invoke(b=>{f(b); return 0;});
    public void Dispose()
    {
        HostFunctionReleases.Check();
        if (Session.Members is not { } binding) return;
        if (Session.Closing || depth!=0) throw new InvalidOperationException("Cannot dispose a binding inside its active call");
        checkTasks?.Invoke(); Session.Closing=true;
        try
        {
            try { closeTasks?.Invoke(); }
            finally
            {
                Wire.Control(binding,-3);
                Wire.Control(binding,-1);
                Session.Members=null; root.Free(); GC.SuppressFinalize(this);
            }
        }
        finally { Session.Closing=false; }
    }
    private bool Collect()
    {
        try { Dispose(); } catch { return Session.Members is null; }
        return true;
    }
    ~HostFunctionOwner() { if (Session?.Members is not null) HostFunctionReleases.Post(collect); }
}

internal sealed class HostFunctionLease : IDisposable
{
    private readonly WeakReference<HostFunctionOwner> owner;
    private readonly HostFunctionSession session;
    private readonly int drop;
    private readonly Func<bool> collect;
    private ulong ticket;
    internal HostFunctionLease(HostFunctionOwner o,int op)
    { owner=new(o); session=o.Session; drop=op; collect=Collect; }
    internal void Attach(ulong id) => ticket=id!=0?id:throw new InvalidOperationException("Empty CLR function ticket");
    internal R Invoke<R>(Func<HostMembers,ulong,R> f)
    {
        HostFunctionReleases.Check();
        if (ticket==0 || !owner.TryGetTarget(out var h)) throw new ObjectDisposedException("returned Lean function");
        // The owner's entry drains pending releases. Re-check after that
        // drain and keep an ephemeral receiver alive until its call returns.
        try { return h.Invoke(b=>ticket!=0?f(b,ticket):throw new ObjectDisposedException("returned Lean function")); }
        finally { GC.KeepAlive(this); }
    }
    internal void Invoke(Action<HostMembers,ulong> f) => Invoke((b,id)=>{ f(b,id); return 0; });
    public void Dispose()
    {
        HostFunctionReleases.Check();
        var id=ticket; if (id==0) return;
        ticket=0;
        try { session.Drop(drop,id); }
        catch { ticket=id; throw; }
        GC.SuppressFinalize(this);
    }
    private bool Collect()
    {
        try { Dispose(); return true; } catch { return false; }
    }
    ~HostFunctionLease() { if (ticket!=0) HostFunctionReleases.Post(collect); }
}
