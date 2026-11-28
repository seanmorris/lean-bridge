using System;
using System.Collections.Generic;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.ExceptionServices;
using System.Runtime.InteropServices;
using System.Text;

namespace LeanBridge.GeneratedIO;

/// <summary>Optional revocable registration. Disposing during a call lets that
/// invocation finish and rejects later requests, including in another component.</summary>
public sealed class RetainedCallback<T> : IDisposable where T : Delegate
{
    private T? handler;
    public T Callback { get; }
    public bool IsClosed { get { LeanRuntime.CheckThread(); return handler == null; } }
    internal RetainedCallback(T callback, Func<Func<T>, T> wrap)
    {
        LeanRuntime.CheckThread(); Wire.CheckDelegate(callback); handler = callback;
        Callback = wrap(() => {
            LeanRuntime.CheckThread();
            return handler ?? throw new ObjectDisposedException("Retained Lean callback");
        });
    }
    public void Dispose() { LeanRuntime.CheckThread(); handler = null; }
}
public static class RetainedCallback
{
    public static RetainedCallback<Func<A, B>> Create<A, B>(Func<A, B> callback) =>
        new(callback, get => value => get()(value));
    public static RetainedCallback<Action<A>> Create<A>(Action<A> callback) =>
        new(callback, get => value => get()(value));
}

internal static unsafe partial class Wire
{
    internal static void CheckDelegate(Delegate callback)
    {
        ArgumentNullException.ThrowIfNull(callback);
        foreach (var part in callback.GetInvocationList())
            if (part.Method.ReturnType == typeof(void) && part.Method.IsDefined(typeof(AsyncStateMachineAttribute), false))
                throw new ArgumentException("A retained Lean callback must be synchronous; async void cannot report completion");
    }
    private delegate void Dispatch(Requests requests, uint slot, ulong* h, Func<bool> active);
    private delegate T DecodeArg<T>(ulong* output);
    private delegate void EncodeReply(Frame frame, ulong* input);
    private sealed class Requests(string callbacks, string next, string arg, string reply, string fail,
        string trap, string clear, Dispatch dispatch) : IRequests
    {
        private Dispatch? invoke = dispatch;
        private readonly List<ExceptionDispatchInfo> faults = new();
        private readonly nint fdFn = Symbol(callbacks), nextFn = Symbol(next), argFn = Symbol(arg), replyFn = Symbol(reply),
            failFn = Symbol(fail), trapFn = Symbol(trap), clearFn = Symbol(clear);
        public int Descriptor(ulong* h)
        {
            int fd = -1, s = ((delegate* unmanaged[Cdecl]<ulong*, int*, int>)fdFn)(h, &fd);
            return s == 0 && fd >= 0 ? fd : throw Failure(s);
        }
        public void Pump(ulong* h, Func<bool> active)
        {
            for (int i = 0; i < 16 && active(); i++)
            {
                uint slot = 0;
                int s = ((delegate* unmanaged[Cdecl]<ulong*, uint*, int>)nextFn)(h, &slot);
                if (s == 1) return;
                if (s != 0) throw Failure(s);
                invoke!(this, slot, h, active);
            }
        }
        internal T Argument<T>(ulong* h, uint slot, DecodeArg<T> decode)
        {
            ulong* output = stackalloc ulong[4]; new Span<ulong>(output, 4).Clear();
            try
            {
                int s = ((delegate* unmanaged[Cdecl]<ulong*, uint, ulong*, int>)argFn)(h, slot, output);
                return s == 0 ? decode(output) : throw Failure(s);
            }
            finally { ((delegate* unmanaged[Cdecl]<ulong*, void>)clearFn)(output); }
        }
        internal void Reply(ulong* h, uint slot, EncodeReply encode)
        {
            using var frame = new Frame();
            ulong* input = stackalloc ulong[3]; new Span<ulong>(input, 3).Clear();
            encode(frame, input);
            int s = ((delegate* unmanaged[Cdecl]<ulong*, uint, ulong*, int>)replyFn)(h, slot, input);
            if (s != 0) throw Failure(s);
        }
        private static bool Fatal(Exception e) => e is OutOfMemoryException or AccessViolationException or SEHException or StackOverflowException;
        private void Retire() => ((delegate* unmanaged[Cdecl]<void>)trapFn)();
        internal void InvalidSlot() { Retire(); throw new InvalidOperationException("Unknown Lean callback slot"); }
        internal Exception Original(ulong id)
        {
            if (id == 0 || id > (ulong)faults.Count) { Retire(); throw new InvalidOperationException("Unknown Lean callback failure identity"); }
            faults[(int)id - 1].Throw();
            throw new InvalidOperationException("Unreachable callback failure");
        }
        private static string Diagnostic(Exception error)
        {
            const string fallback = "C# callback failed";
            try
            {
                string text = error.Message;
                return text != null && text.Length <= Limit && Utf8.GetByteCount(text) <= Limit ? text : fallback;
            }
            catch (Exception e) when (!Fatal(e)) { return fallback; }
        }
        internal bool Invoke<T>(ulong* h, Func<bool> active, Func<T> callback, out T answer)
        {
            // The only user-code call: all native frames and argument buffers
            // have already returned. Conversion failures are not callback errors.
            try { answer = callback(); }
            catch (Exception e)
            {
                if (Fatal(e)) { Retire(); throw; }
                answer = default!;
                if (!active()) return false;
                // A virtual Message getter can even rethrow this very object.
                // Snapshot its dispatch stack before any user formatting runs.
                var original = ExceptionDispatchInfo.Capture(e);
                string message;
                try { message = Diagnostic(e); } catch { Retire(); throw; }
                // Even the exception's virtual Message getter can cancel/reenter.
                if (!active()) return false;
                RecordFailure(h, original, message);
                return false;
            }
            return active();
        }
        private void RecordFailure(ulong* h, ExceptionDispatchInfo original, string message)
        {
            using var frame = new Frame();
            ulong* input = stackalloc ulong[3]; new Span<ulong>(input, 3).Clear();
            frame.Copy(message, input);
            faults.Add(original);
            uint id = 0;
            int s = ((delegate* unmanaged[Cdecl]<ulong*, ulong*, uint*, int>)failFn)(h, input, &id);
            if (s != 0) throw Failure(s);
            if (id != faults.Count) { Retire(); throw new InvalidOperationException("Inconsistent Lean callback failure identity"); }
        }
        public void Clear() { invoke = null; faults.Clear(); }
    }
}
