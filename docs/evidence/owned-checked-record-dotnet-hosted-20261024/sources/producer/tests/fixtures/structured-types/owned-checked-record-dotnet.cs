// Installed NuGet consumer for owned proof-erased checked records.
using System;
using System.Numerics;
using System.Runtime.CompilerServices;
using System.Threading;
using LeanBridge.OwnedCheckedRecords;

static class Consumer
{
    private static int checks;
    private static int calls;
    private static BigInteger N(int value) => new(value);
    private static Claim Claim(Ticket holder, int quota) => new(holder, N(quota));
    private static Booking Booking(Ticket holder, int lo, int hi) =>
        new(holder, new Window(N(lo), N(hi)));
    private static void Check(bool value, string message)
    {
        checks++;
        if (!value) throw new InvalidOperationException(
            $"owned checked-record .NET check {checks}: {message}");
    }
    private static T Reject<T>(Action operation) where T : Exception
    {
        try { operation(); }
        catch (T error) { return error; }
        throw new InvalidOperationException("expected " + typeof(T).Name);
    }
    private static void SerialIs(Ticket ticket, int value, string message) =>
        Check(Api.Serial(ticket) == N(value), message);
    private static void Close(Claim value) => value.Holder.Dispose();
    private static void Close(Booking value) => value.Holder.Dispose();
    [MethodImpl(MethodImplOptions.NoInlining)]
    private static (WeakReference Weak, Ticket Retained) Abandon()
    {
        var abandoned = Api.NewTicket(N(62), "finalized");
        return (new WeakReference(abandoned), abandoned.Retain());
    }

    private static void Exercise()
    {
        using var ticket = Api.NewTicket(N(41), "dotnet\0checked");
        using var retained = ticket.Retain();
        SerialIs(ticket, 41, "fresh resource is usable");
        SerialIs(retained, 41, "explicit retain is independent");
        var valid = Claim(ticket, 7);
        var validBooking = Booking(ticket, 3, 8);
        for (var index = 0; index < 25; index++)
        {
            var echoed = Api.EchoClaim(valid);
            Check(echoed.Quota == N(7), "selected constructor accepts the claim");
            SerialIs(echoed.Holder, 41, "claim preserves its resource");
            var booking = Api.EchoBooking(validBooking);
            Check(booking.Window.Hi == N(8), "nested checked record preserves fields");
            SerialIs(booking.Holder, 41, "booking preserves its resource");
            Close(echoed); Close(booking);
        }

        var invalid = Claim(ticket, 99);
        Check(Reject<LeanBridgeException>(() => Api.EchoClaim(invalid)).Status == 1,
            "early constructor rejection");
        Reject<LeanBridgeException>(() => Api.PairClaim(validBooking, invalid));
        Check(!ticket.IsClosed, "borrowed rejection preserves input");
        SerialIs(ticket, 41, "borrowed rejection recovers");

        using var moving = Api.NewTicket(N(51), "moving");
        using var kept = moving.Retain();
        var rejected = Claim(moving, 99);
        Reject<LeanBridgeException>(() => Api.TransferClaim(rejected));
        Check(!moving.IsClosed && !rejected.Holder.IsClosed,
            "transfer rejection precedes movement");
        SerialIs(moving, 51, "rejected transfer remains usable");
        var accepted = Claim(moving, 9);
        var moved = Api.TransferClaim(accepted);
        Check(moving.IsClosed && accepted.Holder.IsClosed,
            "successful transfer consumes shared owner");
        Check(moved.Quota == N(9), "successful transfer preserves payload");
        SerialIs(moved.Holder, 51, "transferred result is usable");
        SerialIs(kept, 51, "independent retain survives transfer");

        WithClaimCallbackArgument1ClosureCallback reply = incoming => {
            calls++;
            Check(incoming.Quota == N(7), "callback receives proof-free claim");
            return Claim(incoming.Holder, 10);
        };
        var callback = Api.WithClaimCallback(valid,
            OwnedCallbacks.WithRecovery(reply, valid));
        Check(calls == 1 && callback.Quota == N(10),
            "valid callback reply accepted");
        Close(callback);
        var before = calls;
        var bare = Api.WithClaimCallback(valid, reply);
        Check(calls == before + 1 && bare.Quota == N(10),
            "successful callback needs no recovery value");
        Close(bare); before = calls;
        Reject<LeanBridgeException>(() => Api.WithClaimCallback(valid,
            OwnedCallbacks.WithRecovery(reply, invalid)));
        Check(calls == before, "invalid recovery stops callback");
        Reject<LeanBridgeException>(() => Api.WithClaimCallback(valid,
            OwnedCallbacks.WithRecovery(
                (WithClaimCallbackArgument1ClosureCallback)(_ => Claim(ticket, 99)),
                valid)));
        SerialIs(ticket, 41, "invalid host reply recovers");
        var sentinel = new InvalidOperationException("owned checked callback");
        Check(ReferenceEquals(Reject<InvalidOperationException>(() =>
            Api.WithClaimCallback(valid, OwnedCallbacks.WithRecovery(
                (WithClaimCallbackArgument1ClosureCallback)(_ => throw sentinel),
                valid))), sentinel),
            "callback exception identity preserved");

        using (var closure = Api.ClaimClosure())
        {
            var output = closure.Invoke(valid);
            Check(output.Quota == N(7), "returned closure accepts valid claim");
            Close(output);
            Reject<LeanBridgeException>(() => closure.Invoke(invalid));
            var reused = closure.Invoke(Claim(ticket, 6));
            Check(reused.Quota == N(6), "returned closure recovers and reuses");
            Close(reused); closure.Dispose(); closure.Dispose();
            Check(closure.IsClosed, "closure closes idempotently");
        }

        var produced = Api.ClaimFor(retained);
        Check(produced.IsSome, "Lean-produced claim is present");
        Check(produced.Value.Quota == BigInteger.Zero, "proof is erased");
        SerialIs(produced.Value.Holder, 41, "produced resource is usable");
        Close(produced.Value);

        Exception? foreignFailure = null;
        var foreign = new Thread(() => {
            try { Api.Serial(ticket); }
            catch (Exception error) { foreignFailure = error; }
        });
        foreign.Start(); foreign.Join();
        Check(foreignFailure is LeanBridgeException { Status: 5 },
            "foreign thread rejects without closing owner");
        SerialIs(ticket, 41, "owner survives foreign-thread rejection");

        var abandoned = Abandon();
        for (var index = 0; index < 3; index++)
        { GC.Collect(); GC.WaitForPendingFinalizers(); }
        Check(!abandoned.Weak.IsAlive, "finalizer reaches abandoned owner");
        SerialIs(abandoned.Retained, 62, "finalizer preserves independent retain");
        abandoned.Retained.Dispose();
        Check(abandoned.Retained.IsClosed, "explicit cleanup follows finalizer");
        Close(moved);
        Check(ticket.IsClosed == false && retained.IsClosed == false,
            "independent root owners remain open until cleanup");
    }

    public static void Main()
    {
        Exception? failure = null;
        var thread = new Thread(() => {
            try { Exercise(); }
            catch (Exception error) { failure = error; }
        });
        thread.Start(); thread.Join();
        if (failure is not null) throw new InvalidOperationException(
            "owned checked-record worker failed", failure);
        Console.WriteLine($"owned-checked-record-dotnet:{checks}");
    }
}
