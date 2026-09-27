/**
 * Managed leases over creator-thread native sessions and result owners.
 *
 * @file
 */
import { dotnetGraphException } from "./copied-graph-runtime.mjs";

/**
 * Emit private lifetime support without admitting unverified NuGet packages.
 * Finalizers only flag releases; C cleanup runs on the creating native thread.
 *
 * @param prefix - Checked public C package identifier.
 * @param options - Generated assembly composition options.
 * @param options.includeException - Emit the standalone probe's exception type.
 */
export const ownedDotnetRuntime = (prefix, { includeException = true } = {}) => {
	if(!/^[a-z][a-z0-9_]*$/u.test(prefix) || prefix.includes("__")) throw new TypeError("Invalid owned .NET prefix");
	return `${includeException ? dotnetGraphException : ""}
internal sealed unsafe partial class OwnedRuntime
{
    private readonly delegate* unmanaged[Cdecl]<int> processValid;
    internal bool IsProcessValid => processValid() != 0;
    internal readonly delegate* unmanaged[Cdecl]<nint*, uint> Open;
    internal readonly delegate* unmanaged[Cdecl]<nint*, uint> Close;
    internal readonly delegate* unmanaged[Cdecl]<nint*, uint> Release;
    private readonly global::System.Action? before;
    private readonly global::System.Threading.ThreadLocal<OwnedState> states;
    internal OwnedRuntime(nint library, global::System.Action? before = null)
    {
        if (!global::System.OperatingSystem.IsLinux() || sizeof(nint) != 8
            || !global::System.BitConverter.IsLittleEndian
            || global::System.Runtime.InteropServices.RuntimeInformation.ProcessArchitecture != global::System.Runtime.InteropServices.Architecture.X64)
            throw new global::System.PlatformNotSupportedException("This Lean package requires Linux x86-64");
        Open = (delegate* unmanaged[Cdecl]<nint*, uint>)global::System.Runtime.InteropServices.NativeLibrary.GetExport(library, "${prefix}_dotnet_session_open");
        Close = (delegate* unmanaged[Cdecl]<nint*, uint>)global::System.Runtime.InteropServices.NativeLibrary.GetExport(library, "${prefix}_session_close");
        Release = (delegate* unmanaged[Cdecl]<nint*, uint>)global::System.Runtime.InteropServices.NativeLibrary.GetExport(library, "${prefix}_result_release");
        processValid = (delegate* unmanaged[Cdecl]<int>)global::System.Runtime.InteropServices.NativeLibrary.GetExport(library, "lean_bridge_native_process_valid");
        this.before = before;
        states = new(() => new OwnedState(this));
    }
    internal void EnsureProcess()
    {
        // Environment.ProcessId is cached in .NET 8 and cannot detect fork.
        if (!IsProcessValid) Check(6);
        before?.Invoke();
    }
    internal OwnedState Current { get { EnsureProcess(); return states.Value!; } }
    internal static void Checkpoint() { }
    internal static void Check(uint status)
    {
        if (status == 0) return;
        throw new LeanBridgeException(checked((int)status), status switch {
            1 => "Invalid argument", 2 => "Ownership limit exceeded",
            3 => "Native allocation failed", 4 => "Resource is closed",
            5 => "Resource belongs to another thread", 6 => "Start a fresh process after fork",
            7 => "Lean runtime is unavailable", 8 => "Invalid native call order",
            9 => "Malformed native result", 10 => "Host callback failed",
            _ => "Unknown native ownership status"
        });
    }
}

internal sealed class OwnedSlot
{
    internal nint Value;
    internal int Pending;
    internal bool Releasing;
}

internal sealed unsafe class OwnedState : global::System.IDisposable
{
    internal readonly OwnedRuntime Runtime;
    internal readonly global::System.Threading.Thread Thread = global::System.Threading.Thread.CurrentThread;
    private readonly global::System.Collections.Generic.HashSet<OwnedSlot> slots = new();
    private nint session;
    private bool closed, draining;
    internal bool IsClosed => closed || !Thread.IsAlive || !Runtime.IsProcessValid;
    internal OwnedState(OwnedRuntime runtime)
    {
        Runtime = runtime; runtime.EnsureProcess();
        nint value = 0;
        OwnedRuntime.Check(runtime.Open(&value));
        if (value == 0) OwnedRuntime.Check(9);
        session = value;
    }
    internal void Affinity()
    {
        Runtime.EnsureProcess();
        if (!Thread.IsAlive) OwnedRuntime.Check(4);
        if (!global::System.Object.ReferenceEquals(Thread, global::System.Threading.Thread.CurrentThread)) OwnedRuntime.Check(5);
    }
    internal nint Require()
    {
        Affinity();
        if (closed || session == 0) OwnedRuntime.Check(4);
        Drain(); return session;
    }
    internal OwnedSlot Register()
    {
        Require(); OwnedRuntime.Checkpoint();
        var slot = new OwnedSlot();
        OwnedRuntime.Checkpoint(); slots.Add(slot);
        return slot;
    }
    internal void Release(OwnedSlot slot, bool finalizing)
    {
        // No managed lock or native call on the finalizer thread or after fork.
        global::System.Threading.Volatile.Write(ref slot.Pending, 1);
        if (!finalizing && Runtime.IsProcessValid
            && global::System.Object.ReferenceEquals(Thread, global::System.Threading.Thread.CurrentThread)) Drain();
    }
    internal void Drain()
    {
        Affinity();
        if (draining) return;
        draining = true;
        try
        {
            while (true)
            {
                OwnedSlot? selected = null;
                foreach (var slot in slots)
                    if (global::System.Threading.Volatile.Read(ref slot.Pending) != 0 && !slot.Releasing) { selected = slot; break; }
                if (selected is null) return;
                selected.Releasing = true;
                uint status;
                try
                {
                    fixed (nint* value = &selected.Value) status = Runtime.Release(value);
                }
                finally
                {
                    selected.Releasing = false;
                    if (selected.Value == 0) slots.Remove(selected);
                }
                OwnedRuntime.Check(status);
                if (selected.Value != 0) OwnedRuntime.Check(9);
            }
        }
        finally { draining = false; }
    }
    public void Dispose()
    {
        Affinity();
        if (!closed)
        {
            fixed (nint* value = &session) OwnedRuntime.Check(Runtime.Close(value));
            closed = true;
        }
        foreach (var slot in slots) global::System.Threading.Volatile.Write(ref slot.Pending, 1);
        Drain();
    }
}

internal sealed class OwnedBorrowScope { internal bool Active = true; }
internal sealed class OwnedLease
{
    internal readonly OwnedState State;
    internal readonly OwnedSlot? Slot;
    internal readonly OwnedBorrowScope? Scope;
    private int references, revoked;
    internal OwnedLease(OwnedState state, OwnedSlot? slot = null, OwnedBorrowScope? scope = null)
    { State = state; Slot = slot; Scope = scope; }
    internal bool IsClosed => State.IsClosed || global::System.Threading.Volatile.Read(ref revoked) != 0
        || (Scope is not null ? !Scope.Active : Slot is null || Slot.Value == 0
            || global::System.Threading.Volatile.Read(ref Slot.Pending) != 0 || Slot.Releasing);
    internal int References => global::System.Threading.Volatile.Read(ref references);
    internal void Require()
    {
        State.Require();
        if (IsClosed) OwnedRuntime.Check(4);
    }
    internal void Acquire()
    {
        Require();
        int old = global::System.Threading.Volatile.Read(ref references);
        while (true)
        {
            if (old == int.MaxValue) OwnedRuntime.Check(2);
            int actual = global::System.Threading.Interlocked.CompareExchange(ref references, old + 1, old);
            if (actual == old) return;
            old = actual;
        }
    }
    internal void Release(bool finalizing)
    {
        if (global::System.Threading.Interlocked.Decrement(ref references) == 0 && Slot is not null)
            State.Release(Slot, finalizing);
    }
    internal void Revoke(bool finalizing)
    {
        global::System.Threading.Volatile.Write(ref revoked, 1);
        if (Slot is not null) State.Release(Slot, finalizing);
    }
}

internal sealed class OwnedResult : global::System.IDisposable
{
    internal readonly OwnedState State;
    private OwnedSlot? slot;
    private OwnedLease? lease;
    private bool complete;
    internal OwnedResult(OwnedState state) { State = state; slot = state.Register(); }
    internal ref nint Value
    {
        get
        {
            if (slot is null) OwnedRuntime.Check(4);
            return ref slot!.Value;
        }
    }
    internal OwnedLease Adopt()
    {
        State.Require();
        if (slot is null || slot.Value == 0) OwnedRuntime.Check(9);
        if (lease is not null) return lease;
        OwnedRuntime.Checkpoint();
        lease = new OwnedLease(State, slot);
        return lease;
    }
    internal void Complete() { State.Require(); complete = true; }
    private void Close(bool finalizing)
    {
        var saved = slot; slot = null;
        if (saved is null) return;
        if (complete && lease is not null && lease.References > 0) { lease = null; return; }
        if (lease is not null) lease.Revoke(finalizing);
        else State.Release(saved, finalizing);
        lease = null;
    }
    public void Dispose() { State.Affinity(); Close(false); global::System.GC.SuppressFinalize(this); }
    ~OwnedResult() { try { Close(true); } catch { } }
}

internal sealed class OwnedBorrowFrame : global::System.IDisposable
{
    internal readonly OwnedLease Lease;
    private readonly OwnedBorrowScope scope;
    internal OwnedBorrowFrame(OwnedState state)
    {
        state.Require(); OwnedRuntime.Checkpoint(); scope = new OwnedBorrowScope();
        OwnedRuntime.Checkpoint(); Lease = new OwnedLease(state, scope: scope);
    }
    public void Dispose() { scope.Active = false; }
}

internal sealed class OwnedHandle : global::System.IDisposable
{
    internal readonly OwnedLease Lease;
    private readonly nint value;
    private readonly bool acquired;
    private int closed;
    internal OwnedHandle(OwnedLease lease, nint value)
    {
        if (value == 0) OwnedRuntime.Check(9);
        Lease = lease; this.value = value;
        OwnedRuntime.Checkpoint(); lease.Acquire(); acquired = true;
    }
    internal bool IsClosed => global::System.Threading.Volatile.Read(ref closed) != 0 || Lease.IsClosed;
    internal nint Raw(OwnedState state)
    {
        Lease.Require();
        if (IsClosed) OwnedRuntime.Check(4);
        if (!global::System.Object.ReferenceEquals(Lease.State, state)) OwnedRuntime.Check(1);
        return value;
    }
    public void Dispose()
    {
        Lease.State.Runtime.EnsureProcess();
        if (global::System.Threading.Interlocked.Exchange(ref closed, 1) == 0 && acquired) Lease.Release(false);
        global::System.GC.SuppressFinalize(this);
    }
    ~OwnedHandle()
    {
        try
        {
            if (global::System.Threading.Interlocked.Exchange(ref closed, 1) == 0 && acquired) Lease.Release(true);
        }
        catch { }
    }
}
`;
};
