/**
 * Retain callback reply storage and generation-checked owned C# closures.
 *
 * @file
 */
export const state = `
internal static class ProcessGuard
{
    [global::System.Runtime.InteropServices.DllImport("libc", EntryPoint = "getpid", CallingConvention = global::System.Runtime.InteropServices.CallingConvention.Cdecl)]
    private static extern int GetPid();
    private static readonly int Process = GetPid();
    internal static bool IsCurrent => Process == GetPid();
    internal static void Ensure()
    {
        if (!IsCurrent) throw new global::System.InvalidOperationException("Start a fresh process after fork to use Lean");
    }
}
internal sealed class CallbackFrame : global::System.IDisposable
{
    internal global::System.Exception? Failure;
    internal readonly GraphScope Replies;
    private readonly global::System.Threading.Thread thread = global::System.Threading.Thread.CurrentThread;
    private readonly global::System.Collections.Generic.List<global::System.Delegate> roots = new();
    internal CallbackFrame(GraphScope scope) { Replies = scope; }
    internal void Keep(global::System.Delegate callback) => roots.Add(callback);
    internal static void Validate(global::System.Delegate callback)
    {
        global::System.ArgumentNullException.ThrowIfNull(callback);
        foreach (var entry in callback.GetInvocationList())
            if (entry.Method.IsDefined(typeof(global::System.Runtime.CompilerServices.AsyncStateMachineAttribute), false))
                throw new global::System.ArgumentException("Lean callbacks must return synchronously");
    }
    internal void Before()
    {
        ProcessGuard.Ensure();
        if (!global::System.Object.ReferenceEquals(thread, global::System.Threading.Thread.CurrentThread))
            throw new global::System.InvalidOperationException("A callback must run on its initiating thread");
    }
    internal void Fail(global::System.Exception failure) => global::System.Threading.Interlocked.CompareExchange(ref Failure, failure, null);
    internal void Finish(uint status)
    {
        if (Failure is not null) global::System.Runtime.ExceptionServices.ExceptionDispatchInfo.Throw(Failure);
        if (status == 6) throw new LeanBridgeException(6, "Host callback failed");
        GraphRuntime.Status(status);
    }
    public void Dispose() { global::System.GC.KeepAlive(roots); roots.Clear(); }
}
internal sealed unsafe class ClosureLease : global::System.IDisposable
{
    private readonly delegate* unmanaged[Cdecl]<ulong, void> release;
    private readonly object gate = new();
    private readonly global::System.Threading.Thread thread = global::System.Threading.Thread.CurrentThread;
    private ulong token;
    private int active;
    private bool closed;
    internal ClosureLease(delegate* unmanaged[Cdecl]<ulong, void> release)
    { ProcessGuard.Ensure(); this.release = release; }
    internal void Adopt(ref ulong value)
    {
        if (value == 0) throw new GraphInvalidNative("Missing returned Lean closure");
        token = value; value = 0;
    }
    internal bool IsClosed { get { ProcessGuard.Ensure(); lock (gate) return closed; } }
    internal ActiveCall Enter()
    {
        ProcessGuard.Ensure();
        lock (gate)
        {
            if (closed || token == 0) throw new global::System.ObjectDisposedException("LeanClosure");
            if (!global::System.Object.ReferenceEquals(thread, global::System.Threading.Thread.CurrentThread))
                throw new global::System.InvalidOperationException("Lean closure must be invoked on its creating thread");
            if (active == 64) throw new GraphLimit("Lean closure reentry limit exceeded");
            ++active; return new ActiveCall(this, token);
        }
    }
    private void Drop()
    {
        if (active == 0 && token != 0) { var saved = token; token = 0; release(saved); }
    }
    internal void Leave() { lock (gate) { --active; if (closed) Drop(); } }
    public void Dispose()
    {
        ProcessGuard.Ensure();
        lock (gate) { closed = true; Drop(); }
        global::System.GC.SuppressFinalize(this);
    }
    ~ClosureLease() { try { if (ProcessGuard.IsCurrent) Dispose(); } catch (global::System.Exception) { } }
}
internal readonly struct ActiveCall : global::System.IDisposable
{
    private readonly ClosureLease lease;
    internal readonly ulong Token;
    internal ActiveCall(ClosureLease lease, ulong token) { this.lease = lease; Token = token; }
    public void Dispose() => lease.Leave();
}
`;

export const publicClosure = `
public sealed class LeanClosure<TDelegate> : global::System.IDisposable where TDelegate : global::System.Delegate
{
    private readonly Interop.ClosureLease lease;
    public TDelegate Invoke { get; }
    public bool IsClosed => lease.IsClosed;
    internal LeanClosure(TDelegate invoke, Interop.ClosureLease lease) { Invoke = invoke; this.lease = lease; }
    public void Dispose() => lease.Dispose();
}
`;
