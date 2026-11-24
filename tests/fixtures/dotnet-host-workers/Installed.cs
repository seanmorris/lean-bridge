using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Threading;
using System.Threading.Tasks;
using A = LeanBridge.Workshop;
using B = LeanBridge.Peer;

public sealed class Box(uint level)
{
    public uint Level { get; set; } = level;
    public Box Identity() => this;
    public uint Read() => Level;
}

internal static class InstalledWorkers
{
    static void Check(bool value, [CallerArgumentExpression("value")] string expr = "")
    { if (!value) throw new Exception(expr); }
    static async Task<E> Fails<E>(Func<Task> call) where E : Exception
    {
        try { await call(); } catch (E e) { return e; }
        throw new Exception("Expected " + typeof(E));
    }
    [MethodImpl(MethodImplOptions.NoInlining)]
    static (IAsyncEnumerable<Box>, WeakReference) Cold(A.Bound<Box> a)
    {
        var value = new Box(88);
        return (a.Series(value), new WeakReference(value));
    }
    static void Collect() { GC.Collect(); GC.WaitForPendingFinalizers(); GC.Collect(); }
    static async Task Exercise(string order)
    {
        if (order == "ab") Check(await A.Api.Scalar(4) == 5 && await B.Api.Scalar(4) == 6);
        else Check(await B.Api.Scalar(4) == 6 && await A.Api.Scalar(4) == 5);
        A.Bound<Box> a; B.Bound<Box> b;
        if (order == "ab") { a = A.Api.BindHosts<Box>(); b = B.Api.BindHosts<Box>(); }
        else { b = B.Api.BindHosts<Box>(); a = A.Api.BindHosts<Box>(); }
        using(a) using(b) using(var sibling = A.Api.BindHosts<Box>())
        {
            var x = a.Make(17);
            Check(ReferenceEquals(await a.Echo(x), x) && ReferenceEquals(await b.Echo(x), x));
            Check(ReferenceEquals(a.IdentityNow(x), b.IdentityBase(x)));
            var result = await a.Outcome(x);
            Check(ReferenceEquals(result.Error, x));
            var eio = await Fails<B.DeclaredError<Box>>(() => b.Reject(x));
            Check(eio.Declaration == "Workers.reject" && ReferenceEquals(eio.Payload, x));
            int owner = Environment.CurrentManagedThreadId, calls = 0;
            var reply = await a.Relay(x, v => {
                Check(Environment.CurrentManagedThreadId == owner && ReferenceEquals(v, x)); ++calls;
                Collect();
                var nested = B.LeanRuntime.Await(b.Echo(v));
                Check(b.Update(nested, 42) == 42);
                try { a.Dispose(); } catch(InvalidOperationException) { return nested; }
                throw new Exception("binding disposed during callback");
            });
            Check(ReferenceEquals(reply, x) && calls == 1 && x.Level == 42);
            var original = new FormatException("application callback");
            Check(ReferenceEquals(await Fails<FormatException>(() => a.Relay(x, _ => throw original)), original));
            Check(ReferenceEquals(await b.Recover(x, _ => throw original), x));
            // An invalid CLR return is a conversion failure, not an exception Lean can catch.
            await Fails<ArgumentNullException>(() => a.Recover(x, _ => null!));
            await Fails<ArgumentNullException>(() => a.Echo(null!));
            await using(var c = a.Series(x).GetAsyncEnumerator()) {
                Check(await c.MoveNextAsync() && ReferenceEquals(c.Current, x));
                var terminal = await Fails<A.DeclaredError<Box>>(() => c.MoveNextAsync().AsTask());
                Check(terminal.Declaration == "Workers.next" && ReferenceEquals(terminal.Payload, x));
                Check(!await c.MoveNextAsync());
            }
            await using(var c = b.SeriesIo(x).GetAsyncEnumerator()) {
                Check(await c.MoveNextAsync() && ReferenceEquals(c.Current, x));
                var io = await Fails<B.TaskIOException>(() => c.MoveNextAsync().AsTask());
                Check(io.Declaration == "Workers.nextIO" && io.Message.Contains("CLR cursor ended"));
            }
            await foreach(var v in a.Series(x)) { Check(ReferenceEquals(v,x)); break; }
            using var token = new CancellationTokenSource(); bool ran = false;
            var cancelled = a.Relay(x, v => { ran = true; return v; }, token.Token);
            token.Cancel(); await Fails<OperationCanceledException>(() => cancelled); Check(!ran);
            var (cold, weak) = Cold(a); Collect(); Check(weak.IsAlive);
            var revoked = a.Relay(x, v => { ran = true; return v; });
            var live = sibling.Relay(x, v => v);
            a.Dispose(); a.Dispose(); await Fails<OperationCanceledException>(() => revoked); Check(!ran);
            Check(ReferenceEquals(await live, x) && ReferenceEquals(await b.Echo(x), x));
            Collect(); Check(!weak.IsAlive);
            using var reopened = A.Api.BindHosts<Box>();
            await Fails<ObjectDisposedException>(() => a.Echo(x));
            await using(var stale = cold.GetAsyncEnumerator())
                await Fails<ObjectDisposedException>(() => stale.MoveNextAsync().AsTask());
            Check(ReferenceEquals(await reopened.Echo(x), x));
            for(int i = 0; i < 200 && Audit.Read()[5] != 0; ++i) await Task.Delay(10);
            Check(Audit.Read()[5] == 0);
            var fatal = new OutOfMemoryException("injected fatal callback");
            Check(ReferenceEquals(await Fails<OutOfMemoryException>(() => reopened.Relay(x, _ => throw fatal)), fatal));
            await Fails<B.RuntimeUnavailableException>(() => b.Echo(x));
        }
        Check(Audit.Read()[5] == 0);
        var refs = AppDomain.CurrentDomain.GetData("lean-bridge.dotnet.private-host-references.v1")
            as Tuple<Dictionary<ulong,object>,Dictionary<ulong,WeakReference<object>>,StrongBox<ulong>>;
        Check(refs != null && refs.Item1.Count == 0 && refs.Item2.Count == 0);
    }
    public static void Main(string[] args)
    {
        if(args[0] == "shutdown") {
            Task<Box> orphan = null!; bool invoked = false;
            using var bound = A.Api.BindHosts<Box>();
            A.LeanRuntime.Run(() => {
                orphan = bound.Relay(new Box(3), v => { invoked = true; return v; });
                return Task.CompletedTask;
            });
            Check(orphan.IsCanceled && !invoked);
            B.LeanRuntime.Run(async () => {
                using var peer = B.Api.BindHosts<Box>();
                var x = new Box(5); Check(ReferenceEquals(await peer.Echo(x), x));
                Check(ReferenceEquals(await bound.Echo(x), x) && !invoked);
            });
            Console.WriteLine("owner shutdown cancelled outstanding work; both bindings survived"); return;
        }
        if(args[0] == "tampered") {
            try { A.Api.BindHosts<Box>(); }
            catch (InvalidOperationException e) when (e.Message.Contains("differs from the compiled package")) {
                Console.WriteLine("tampered domain refused"); return;
            }
            throw new Exception("modified asset accepted");
        }
        A.LeanRuntime.Run(() => Exercise(args[0]));
        Console.WriteLine(args[0] + ": worker identity, callbacks, errors, cursors, cancellation, binding isolation and shared retirement");
    }
}
