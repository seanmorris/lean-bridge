using System;
using System.Collections;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Runtime.InteropServices;

namespace LeanBridge.GeneratedIO;

/// <summary>A single-pass, synchronous Lean cursor. Foreach and using close it on the owner thread.</summary>
public sealed class LeanCursor<T> : IEnumerable<T>, IEnumerator<T>
{
    private readonly Wire.ImmediateSlot<T> slot;
    private bool started;
    internal LeanCursor(Wire.Start open, Wire.Take<T> pull, string close)
        => slot = new(open, pull, close);
    public IEnumerator<T> GetEnumerator()
    {
        Wire.DrainCursors();
        if (started) throw new InvalidOperationException("A Lean cursor is single pass");
        started = true; return this;
    }
    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
    public bool MoveNext() { Wire.DrainCursors(); started = true; return slot.Move(); }
    public T Current { get { Wire.DrainCursors(); return slot.Current(); } }
    object? IEnumerator.Current => Current;
    void IEnumerator.Reset() => throw new NotSupportedException();
    public void Dispose() { Wire.DrainCursors(); slot.Close(); }
}

internal static unsafe partial class Wire
{
    internal delegate void Start(ulong* handle);
    internal delegate (bool, T) Take<T>(ulong* handle);
    [DllImport("libc", EntryPoint = "getpid")] private static extern int CursorPid();
    [DllImport("libc", EntryPoint = "gettid")] private static extern int CursorTid();
    private const string CursorQueueKey = "lean-bridge.dotnet.direct-cursor-finalizers.v1";
    private static ConcurrentQueue<Action> CursorQueue()
    {
        Assets.EnsureProcess();
        if (CursorTid() != CursorPid()) throw new WrongContextException();
        var domain = AppDomain.CurrentDomain;
        if (domain.GetData(CursorQueueKey) is ConcurrentQueue<Action> existing) return existing;
        var queue = new ConcurrentQueue<Action>(); domain.SetData(CursorQueueKey, queue); return queue;
    }
    internal static void DrainCursors()
    {
        var queue = CursorQueue();
        while (queue.TryDequeue(out var close)) close();
    }
    internal sealed class ImmediateSlot<T>
    {
        private readonly ulong[] handle = new ulong[2];
        private readonly int pid;
        private readonly ConcurrentQueue<Action> queue;
        private readonly Action cleanup;
        private readonly Take<T> pull;
        private readonly nint close;
        private T current = default!;
        private bool has, claimed;
        internal ImmediateSlot(Start open, Take<T> pull, string close)
        {
            queue = CursorQueue(); DrainCursors(); pid = CursorPid();
            this.pull = pull; this.close = Symbol(close); cleanup = Close;
            fixed (ulong* h = handle) open(h);
        }
        internal T Current()
        {
            if (!has) throw new InvalidOperationException("The Lean cursor has no current item");
            claimed = true; return current;
        }
        private void ReleaseCurrent()
        {
            // A pulled lease belongs to the cursor until Current hands it to the caller.
            if (has && !claimed && current is IDisposable lease) lease.Dispose();
            current = default!; has = claimed = false;
        }
        internal bool Move()
        {
            ReleaseCurrent();
            if (handle[0] == 0) return false;
            try
            {
                fixed (ulong* h = handle) (has, current) = pull(h);
                if (!has) Close();
                return has;
            }
            catch { Close(); throw; }
            finally { GC.KeepAlive(this); }
        }
        internal void Close()
        {
            ReleaseCurrent();
            if (handle[0] != 0) fixed (ulong* h = handle)
            {
                int status = ((delegate* unmanaged[Cdecl]<ulong*, int>)close)(h);
                if (status != 0) throw Failure(status);
            }
            GC.SuppressFinalize(this);
        }
        ~ImmediateSlot()
        {
            // A finalizer is not the Lean owner. The next owner call drains this
            // queue; normal process shutdown can reclaim native cursors directly.
            if (pid != 0 && CursorPid() == pid && (handle[0] != 0 || has)) queue.Enqueue(cleanup);
        }
    }
}
