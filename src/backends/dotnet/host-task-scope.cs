using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Runtime.ExceptionServices;

namespace LeanBridge.GeneratedIO;

// Each BindHosts creates one of these, even if two simultaneous bindings use
// the same application class. All registration and revocation runs on the
// CLR owner. Cancellation posted from a pool thread is still handled by Delivery.
internal sealed class HostTaskScope : IDisposable
{
    private readonly LinkedList<Action> active = new();
    private interface IDeferred { void Revoke(); }
    private readonly ConditionalWeakTable<IDeferred, object> deferred = new();
    private static readonly object Present = new();
    private int depth;
    private bool closed;

    internal void Check()
    {
        LeanRuntime.CheckThread();
        if (closed) throw new ObjectDisposedException("CLR host binding");
    }
    internal TResult Invoke<TResult>(Func<TResult> call)
    {
        Check();
        ++depth;
        try { return call(); } finally { --depth; }
    }
    internal void Invoke(Action call) => Invoke(() => { call(); return 0; });
    internal Action Track(Action close)
    {
        Check();
        // Allocate the detach callback before making the registration visible.
        var node = new LinkedListNode<Action>(close);
        Action detach = () => { if (node.List != null) active.Remove(node); };
        active.AddLast(node);
        return detach;
    }
    // IAsyncEnumerable is cold and reusable. A retained, never-enumerated
    // sequence must relinquish its arguments at unbind, and an abandoned
    // sequence must not keep them alive until that binding is disposed.
    private sealed class Deferred<T>(HostTaskScope scope, Func<T> create) : IDeferred
    {
        private Func<T>? factory = create;
        public void Revoke() => factory = null;
        internal T Open() { scope.Check(); return factory!(); }
    }
    internal Func<T> Defer<T>(Func<T> create)
    {
        Check();
        var cell = new Deferred<T>(this, create);
        deferred.Add(cell, Present);
        return cell.Open;
    }
    internal void CheckDisposal()
    {
        LeanRuntime.CheckThread();
        if (depth != 0) throw new InvalidOperationException("Cannot dispose a binding inside its active call");
    }
    public void Dispose()
    {
        CheckDisposal();
        if (closed) return;
        closed = true;
        foreach (var cell in deferred) cell.Key.Revoke();
        deferred.Clear();
        ExceptionDispatchInfo? first = null;
        while (active.First is { } node)
        {
            active.RemoveFirst();
            try { node.Value(); }
            catch (Exception e) { first ??= ExceptionDispatchInfo.Capture(e); }
        }
        first?.Throw();
    }
}
