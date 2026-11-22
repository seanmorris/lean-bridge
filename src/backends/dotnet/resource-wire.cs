using System;
using System.Collections.Concurrent;
using System.Runtime.InteropServices;

namespace LeanBridge.GeneratedIO;

internal static unsafe partial class Wire
{
    [DllImport("libc", EntryPoint = "gettid")] private static extern int ResourceThread();
    private const string LeaseQueueKey = "lean-bridge.dotnet.resource-finalizers.v1";
    private static ConcurrentQueue<Action> ResourceQueue()
    {
        Assets.EnsureProcess();
        if (Environment.ProcessId != ResourceThread()) throw new WrongContextException();
        var domain = AppDomain.CurrentDomain;
        if (domain.GetData(LeaseQueueKey) is ConcurrentQueue<Action> existing) return existing;
        var queue = new ConcurrentQueue<Action>(); domain.SetData(LeaseQueueKey, queue);
        return queue;
    }
    private static void DrainResources()
    {
        var q = ResourceQueue();
        while (q.TryDequeue(out var close)) close();
    }
    private delegate T CreateLease<T>(Func<string, (ulong, ulong)> borrow, Action dispose,
        Func<bool> closed, Func<T> retain, Func<T, bool> same) where T : class;
    private sealed class LeaseOps<T>(string ledger, ulong tag, string symbol, CreateLease<T> make,
        Func<T, string, (ulong, ulong)> read) where T : class
    {
        private void Check(int s)
        {
            if (s == 6) throw new ObjectDisposedException(typeof(T).Name, "Stale or foreign Lean resource");
            if (s != 0) throw Failure(s);
        }
        internal void Input(T value, ulong* destination)
        {
            ArgumentNullException.ThrowIfNull(value);
            (destination[0], destination[1]) = read(value, ledger);
        }
        internal T Take(ulong* source)
        {
            if (source[3] != tag || source[0] == 0 || source[1] == 0) throw new InvalidOperationException("Invalid native resource lease");
            var slot = new Slot(this, ResourceQueue());
            T value = make(slot.Borrow, slot.Dispose, slot.Closed, slot.Retain, slot.Same);
            // No managed allocation between taking ownership and disarming the
            // native output frame. On any earlier failure the caller clears it.
            slot.First = source[0]; slot.Domain = source[1];
            source[0] = source[1] = source[3] = 0;
            return value;
        }
        private void Release(ulong* pair)
        {
            int s = ((delegate* unmanaged[Cdecl]<ulong*, int>)Symbol(symbol + "_close"))(pair);
            if (s != 6) Check(s);
        }
        private T Clone(ulong* key)
        {
            ulong* output = stackalloc ulong[4]; new Span<ulong>(output, 4).Clear();
            try
            {
                Check(((delegate* unmanaged[Cdecl]<ulong*, ulong*, int>)Symbol(symbol + "_retain"))(key, output));
                output[3] = tag;
                return Take(output);
            }
            finally { if (output[0] != 0) Release(output); }
        }
        private bool Equal(ulong* key, T other)
        {
            ulong* second = stackalloc ulong[2]; Input(other, second);
            byte same = 0;
            Check(((delegate* unmanaged[Cdecl]<ulong*, ulong*, byte*, int>)Symbol(symbol + "_same"))(key, second, &same));
            GC.KeepAlive(other);
            return Tag(same);
        }
        private sealed class Slot
        {
            private readonly LeaseOps<T> ops;
            private readonly ConcurrentQueue<Action> queue;
            private readonly Action abandoned;
            internal ulong First, Domain;
            internal Slot(LeaseOps<T> ops, ConcurrentQueue<Action> queue)
            { this.ops = ops; this.queue = queue; abandoned = CloseNative; }
            internal (ulong, ulong) Borrow(string expected)
            {
                DrainResources();
                if (expected != ops.Ledger) throw new ArgumentException("Incompatible Lean resource ledger");
                if (First == 0) throw new ObjectDisposedException(typeof(T).Name);
                return (First, Domain);
            }
            internal bool Closed() { DrainResources(); return First == 0; }
            internal void Dispose() { DrainResources(); CloseNative(); GC.SuppressFinalize(this); }
            private void CloseNative()
            {
                if (First == 0) return;
                ulong* key = stackalloc ulong[2] { First, Domain }; ops.Release(key);
                First = Domain = 0;
            }
            internal T Retain()
            {
                var (a, b) = Borrow(ops.Ledger); ulong* key = stackalloc ulong[2] { a, b };
                try { return ops.Clone(key); } finally { GC.KeepAlive(this); }
            }
            internal bool Same(T other)
            {
                var (a, b) = Borrow(ops.Ledger); ulong* key = stackalloc ulong[2] { a, b };
                try { return ops.Equal(key, other); } finally { GC.KeepAlive(this); }
            }
            // The CLR finalizer thread may enqueue work, never enter Lean.
            ~Slot() { if (First != 0) queue.Enqueue(abandoned); }
        }
        private string Ledger => ledger;
    }
}
