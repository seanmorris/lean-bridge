using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using Services = System.Tuple<System.Action<System.Action>, System.Func<int, System.Action, System.Action>, System.Func<System.Action, System.Action>>;

namespace LeanBridge.GeneratedIO;

/// <summary>Runs an asynchronous application on the original Lean owner thread.
/// All installed task components in this process share this loop.</summary>
public static class LeanRuntime
{
    private const string Key = "lean-bridge.dotnet.linux-owner-loop.v1";
    [DllImport("libc")] private static extern int getpid();
    [DllImport("libc")] private static extern int gettid();
    internal static void CheckThread()
    {
        if (getpid() != gettid()) throw new WrongContextException();
    }
    internal static Services Current()
    {
        CheckThread();
        return AppDomain.CurrentDomain.GetData(Key) as Services ??
            throw new InvalidOperationException("Call LeanRuntime.Run from the process main thread before starting Lean tasks or streams.");
    }
    private const string NestedKey = Key + ".nested-v1";
    internal static HashSet<Task>? ActiveCallbacks =>
        (AppDomain.CurrentDomain.GetData(NestedKey) as Tuple<Action<Task>, HashSet<Task>>)?.Item2;

    // A synchronous retained delegate may need a second Lean task in order to
    // answer its worker. Pump readiness on the same owner, never block on .Result.
    private static void WaitFor(Task task)
    {
        ArgumentNullException.ThrowIfNull(task);
        Current();
        if (task.IsCompleted) return;
        var nested = AppDomain.CurrentDomain.GetData(NestedKey) as Tuple<Action<Task>, HashSet<Task>> ??
            throw new InvalidOperationException("Start LeanRuntime.Run from a package with nested callback support");
        if (nested.Item2.Contains(task)) throw new InvalidOperationException("A callback cannot wait on its own active Lean task");
        nested.Item1(task);
    }
    /// <summary>Wait for independent work inside a synchronous owner-thread callback.</summary>
    public static T Await<T>(Task<T> task) { WaitFor(task); return task.GetAwaiter().GetResult(); }
    public static void Await(Task task) { WaitFor(task); task.GetAwaiter().GetResult(); }

    public static void Run(Func<Task> application)
    {
        ArgumentNullException.ThrowIfNull(application);
        CheckThread();
        var domain = AppDomain.CurrentDomain;
        if (domain.GetData(Key) != null) throw new InvalidOperationException("A Lean owner loop is already running.");
        var previous = SynchronizationContext.Current;
        using var loop = new Loop();
        // Only BCL delegates cross assemblies; no generated class identity is shared.
        var services = new Services(loop.Enqueue, loop.Watch, loop.Track);
        domain.SetData(Key, services);
        domain.SetData(NestedKey, Tuple.Create<Action<Task>, HashSet<Task>>(loop.Until, new()));
        SynchronizationContext.SetSynchronizationContext(loop);
        try
        {
            var task = application() ?? throw new InvalidOperationException("The application returned no Task");
            loop.Until(task);
            task.GetAwaiter().GetResult();
        }
        finally
        {
            domain.SetData(NestedKey, null); domain.SetData(Key, null);
            SynchronizationContext.SetSynchronizationContext(previous);
        }
    }

    private sealed class Loop : SynchronizationContext, IDisposable
    {
        [StructLayout(LayoutKind.Sequential)]
        private struct PollFd { public int fd; public short events, revents; }
        [DllImport("libc", SetLastError = true)] private static extern int eventfd(uint initial, int flags);
        [DllImport("libc", SetLastError = true)] private static extern int poll([In, Out] PollFd[] fds, nuint count, int timeout);
        [DllImport("libc", SetLastError = true)] private static extern nint write(int fd, ref ulong data, nuint size);
        [DllImport("libc", SetLastError = true)] private static extern nint read(int fd, out ulong data, nuint size);
        [DllImport("libc")] private static extern int close(int fd);
        private readonly Dictionary<int, Action> readers = new();
        private readonly HashSet<Action> owners = new();
        private readonly Queue<Action> pending = new();
        private int wake = eventfd(0, 0x80000 | 0x800); // CLOEXEC | NONBLOCK (linux-x64)
        internal Loop() { if (wake < 0) throw new System.IO.IOException("Cannot open Lean owner wake descriptor"); }
        internal Action Watch(int fd, Action ready)
        {
            readers.Add(fd, ready);
            return () => readers.Remove(fd);
        }
        internal Action Track(Action finish)
        {
            owners.Add(finish);
            return () => owners.Remove(finish);
        }
        // Posting and closing the wake fd share one lock: a late cancellation or
        // continuation can never signal a descriptor that the OS has since reused.
        private void WakeLocked()
        {
            ulong one = 1;
            while (write(wake, ref one, 8) < 0 && Marshal.GetLastPInvokeError() == 4) { }
        }
        internal void Signal() { lock (pending) { if (wake >= 0) WakeLocked(); } }
        internal void Enqueue(Action action)
        {
            lock (pending) { if (wake < 0) return; pending.Enqueue(action); WakeLocked(); }
        }
        public override void Post(SendOrPostCallback callback, object? state) => Enqueue(() => callback(state));
        public override SynchronizationContext CreateCopy() => this;

        internal void Until(Task task)
        {
            if (task.IsCompleted) return;
            _ = task.ContinueWith(_ => Signal(), CancellationToken.None,
                TaskContinuationOptions.ExecuteSynchronously, TaskScheduler.Default);
            while (!task.IsCompleted) Turn();
        }
        internal void Turn()
        {
            var snapshot = readers.ToArray();
            var fds = new PollFd[snapshot.Length + 1];
            fds[0] = new PollFd { fd = wake, events = 1 };
            for (int i = 0; i < snapshot.Length; i++) fds[i + 1] = new PollFd { fd = snapshot[i].Key, events = 1 };
            // An outer turn may already have consumed the wake counter while
            // another posted continuation is still queued behind this callback.
            int timeout; lock (pending) timeout = pending.Count == 0 ? -1 : 0;
            if (poll(fds, (nuint)fds.Length, timeout) < 0)
            {
                if (Marshal.GetLastPInvokeError() == 4) return;
                throw new System.IO.IOException("Waiting on Lean descriptors failed");
            }
            if (fds[0].revents != 0 || timeout == 0)
            {
                if (fds[0].revents != 0)
                    while (read(wake, out _, 8) < 0 && Marshal.GetLastPInvokeError() == 4) { }
                // Bound each batch so an active producer cannot starve native completions.
                for (int k = 0; k < 64; k++)
                {
                    Action? a;
                    lock (pending) { if (!pending.TryDequeue(out a)) break; }
                    a();
                }
                lock (pending) { if (pending.Count != 0) WakeLocked(); }
            }
            for (int i = 0; i < snapshot.Length; i++)
                if (fds[i + 1].revents != 0 && readers.TryGetValue(snapshot[i].Key, out var current) &&
                    ReferenceEquals(current, snapshot[i].Value)) current();
        }
        public void Dispose()
        {
            try { foreach (var finish in owners.ToArray()) finish(); }
            finally { lock (pending) { close(wake); wake = -1; pending.Clear(); } }
        }
    }
}
