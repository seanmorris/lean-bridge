using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Services = System.Tuple<System.Action<System.Action>, System.Func<int, System.Action, System.Action>, System.Func<System.Action, System.Action>>;

namespace LeanBridge.GeneratedIO;

public sealed class TaskIOException(string declaration, string message) : System.IO.IOException(message)
{ public string Declaration { get; } = declaration; }

internal static unsafe partial class Wire
{
    internal delegate void Start(ulong* handle);
    internal delegate (bool, T) Take<T>(ulong* handle);
    internal sealed class Port<T>(Start start, Take<T> take, string poll, string close, string? pull)
    {
        private readonly ulong[] handle = new ulong[2];
        private readonly int[] gate = { -1, -1 };
        private readonly nint pollFn = Symbol(poll), closeFn = Symbol(close), pullFn = pull == null ? 0 : Symbol(pull);
        private readonly nint gateOpen = Symbol(WaitOpen), gateClose = Symbol(WaitClose);
        internal void Open() { fixed (ulong* h = handle) start(h); }
        internal void Pull()
        {
            if (pullFn != 0) fixed (ulong* h = handle)
            { int s = ((delegate* unmanaged[Cdecl]<ulong*, int>)pullFn)(h); if (s != 0) throw Failure(s); }
        }
        internal int Poll()
        {
            fixed (ulong* h = handle)
            {
                int fd = -1, s = ((delegate* unmanaged[Cdecl]<ulong*, int*, int>)pollFn)(h, &fd);
                return s == 0 ? -1 : s == 1 && fd >= 0 ? fd : throw Failure(s);
            }
        }
        internal int Watch(int fd)
        {
            fixed (int* g = gate)
            {
                int s = ((delegate* unmanaged[Cdecl]<int, int, int*, int>)gateOpen)(fd, -1, g);
                return s == 0 ? g[0] : throw Failure(s);
            }
        }
        internal void Unwatch()
        {
            if (gate[0] >= 0) fixed (int* g = gate) ((delegate* unmanaged[Cdecl]<int*, void>)gateClose)(g);
        }
        internal (bool, T) Read() { fixed (ulong* h = handle) return take(h); }
        internal void Close()
        {
            Unwatch();
            if (handle[0] != 0) fixed (ulong* h = handle) ((delegate* unmanaged[Cdecl]<ulong*, int>)closeFn)(h);
        }
    }
}

internal sealed class Delivery<T> : IDisposable
{
    private readonly Services owner;
    private readonly Wire.Port<T> port;
    private readonly CancellationToken token;
    private readonly bool single;
    private CancellationTokenRegistration registration;
    private TaskCompletionSource<(bool, T)>? pending;
    private Action? untrack, unwatch;
    private bool ended;
    private Delivery(Func<Wire.Port<T>> make, CancellationToken token, bool single)
    {
        owner = LeanRuntime.Current();
        token.ThrowIfCancellationRequested();
        this.token = token;
        this.single = single;
        port = make();
        untrack = owner.Item3(Dispose);
        try
        {
            registration = token.UnsafeRegister(_ => owner.Item1(Dispose), null);
            token.ThrowIfCancellationRequested();
            port.Open();
        }
        catch { Dispose(); throw; }
    }
    internal static async Task<T> Value(Func<Wire.Port<T>> make, CancellationToken token)
    {
        var delivery = new Delivery<T>(make, token, true);
        var (present, value) = await delivery.Next().ConfigureAwait(false);
        if (!present) throw new InvalidOperationException("Unexpected end of Lean task");
        return value;
    }
    internal static IAsyncEnumerable<T> Sequence(Func<Wire.Port<T>> make) => new SequenceImpl(make);
    private sealed class SequenceImpl(Func<Wire.Port<T>> make) : IAsyncEnumerable<T>
    {
        public IAsyncEnumerator<T> GetAsyncEnumerator(CancellationToken token = default) => new Cursor(make, token);
    }
    private sealed class Cursor(Func<Wire.Port<T>> make, CancellationToken token) : IAsyncEnumerator<T>
    {
        private Delivery<T>? delivery;
        private int busy;
        private volatile bool ended;
        public T Current { get; private set; } = default!;
        public async ValueTask<bool> MoveNextAsync()
        {
            LeanRuntime.CheckThread();
            if (Interlocked.Exchange(ref busy, 1) != 0) throw new InvalidOperationException("A Lean stream pull is already pending");
            try
            {
                if (ended) return false;
                delivery ??= new Delivery<T>(make, token, false);
                var (present, value) = await delivery.Next().ConfigureAwait(false);
                if (!present) ended = true;
                Current = value;
                return present;
            }
            catch { ended = true; throw; }
            finally { Volatile.Write(ref busy, 0); }
        }
        public ValueTask DisposeAsync()
        {
            LeanRuntime.CheckThread();
            ended = true;
            delivery?.Dispose();
            return ValueTask.CompletedTask;
        }
    }
    private Task<(bool, T)> Next()
    {
        if (token.IsCancellationRequested) { Dispose(); token.ThrowIfCancellationRequested(); }
        if (ended) throw new ObjectDisposedException("Lean delivery");
        var next = new TaskCompletionSource<(bool, T)>(TaskCreationOptions.RunContinuationsAsynchronously);
        pending = next;
        try { port.Pull(); Ready(); }
        catch (Exception e) { Fail(e); }
        return next.Task;
    }
    private void Ready()
    {
        if (pending == null) return;
        try
        {
            if (token.IsCancellationRequested) { Dispose(); return; }
            int fd = port.Poll();
            if (fd >= 0) { unwatch ??= owner.Item2(port.Watch(fd), Ready); return; }
            Unwatch();
            var item = port.Read();
            var done = pending; pending = null;
            if (single || !item.Item1) Dispose();
            done.TrySetResult(item);
        }
        catch (Exception e) { Fail(e); }
    }
    private void Unwatch()
    {
        unwatch?.Invoke(); unwatch = null;
        port.Unwatch();
    }
    private void Fail(Exception e)
    {
        var done = pending; pending = null;
        Dispose(); done?.TrySetException(e);
    }
    public void Dispose()
    {
        if (ended) return;
        ended = true;
        registration.Dispose(); Unwatch(); port.Close();
        untrack?.Invoke(); untrack = null;
        var done = pending; pending = null;
        done?.TrySetCanceled(token.IsCancellationRequested ? token : new CancellationToken(true));
    }
}
