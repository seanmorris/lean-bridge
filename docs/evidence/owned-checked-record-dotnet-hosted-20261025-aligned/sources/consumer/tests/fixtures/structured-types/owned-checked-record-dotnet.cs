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
    private static void Close(Grant value) => value.Holder.Dispose();
    [MethodImpl(MethodImplOptions.NoInlining)]
    private static (WeakReference Weak, Ticket Retained) Abandon()
    {
        var abandoned = Api.NewTicket(N(62), "finalized");
        return (new WeakReference(abandoned), abandoned.Retain());
    }

    private static void PostTransfer(bool throws)
    {
        using var input = Api.NewTicket(N(91), "post-transfer");
        using var independent = input.Retain();
        var transferred = Claim(input, 7);
        var entered = 0;
        var sentinel = new InvalidOperationException("post-transfer callback");
        TransferWithClaimCallbackArgument1ClosureCallback reply = incoming => {
            entered++;
            Check(incoming.Quota == N(7), "post-transfer callback input");
            if (throws) throw sentinel;
            return Claim(incoming.Holder, 99);
        };
        var callback = OwnedCallbacks.WithRecovery(reply, Claim(independent, 7));
        Claim? output = null;
        if (throws)
            Check(ReferenceEquals(Reject<InvalidOperationException>(() =>
                output = Api.TransferWithClaimCallback(transferred, callback)), sentinel),
                "post-transfer callback exception identity");
        else
            Check(Reject<LeanBridgeException>(() =>
                output = Api.TransferWithClaimCallback(transferred, callback)).Status == 1,
                "post-transfer invalid callback reply rejects");
        Check(output is null && entered == 1 && input.IsClosed && transferred.Holder.IsClosed,
            "post-transfer failure consumes input without publishing output");
        SerialIs(independent, 91, "post-transfer failure preserves independent retain");
        var recovered = Api.TransferWithClaimCallback(Claim(independent, 7),
            OwnedCallbacks.WithRecovery(
                (TransferWithClaimCallbackArgument1ClosureCallback)(incoming => Claim(incoming.Holder, 9)),
                Claim(independent, 7)));
        Check(independent.IsClosed && recovered.Quota == N(9), "post-transfer failure recovers");
        SerialIs(recovered.Holder, 91, "recovered transfer resource");
        Close(recovered);
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

        var invalidBooking = Booking(ticket, 8, 3);
        for (var index = 0; index < 10; index++)
        {
            Reject<LeanBridgeException>(() => Api.EchoBooking(invalidBooking));
            Check(invalidBooking.Window.Lo == N(8) && invalidBooking.Window.Hi == N(3),
                "nested copied rejection preserves input fields");
            SerialIs(invalidBooking.Holder, 41, "nested copied rejection preserves owner");
        }
        var equalBooking = Api.EchoBooking(Booking(ticket, 3, 3));
        Check(equalBooking.Window.Lo == N(3) && equalBooking.Window.Hi == N(3),
            "nested copied equality and recovery");
        SerialIs(equalBooking.Holder, 41, "nested copied recovery resource");
        Close(equalBooking);
        Check(Api.BookingSpan(validBooking) == N(5), "copied payload consumed");
        Check(Api.ClaimQuota(valid) == N(7), "owned payload consumed");
        var grant = Api.EchoGrant(new Grant(ticket, N(7), N(8)));
        Check(grant.Weight == N(7) && grant.Limit == N(8), "nested Subtype and outer record accepted");
        SerialIs(grant.Holder, 41, "grant resource"); Close(grant);
        Reject<LeanBridgeException>(() => Api.EchoGrant(new Grant(ticket, N(0), N(8))));
        Reject<LeanBridgeException>(() => Api.EchoGrant(new Grant(ticket, N(7), N(3))));
        SerialIs(ticket, 41, "both grant rejections preserve owner");
        var claims = Api.EchoClaims(new[] { valid, valid });
        Check(claims.Length == 2 && claims[0].Quota == N(7) && claims[1].Quota == N(7), "owned array");
        Close(claims[0]); SerialIs(claims[1].Holder, 41, "array element owners are independent");
        Close(claims[1]);
        for (var index = 0; index < 10; index++)
        {
            Claim[]? partial = null;
            Reject<LeanBridgeException>(() => partial = Api.EchoClaims(new[] { valid, Claim(ticket, 99) }));
            Check(partial is null && !ticket.IsClosed, "late array rejection publishes no partial result");
        }
        Check(Api.EchoClaims(Array.Empty<Claim>()).Length == 0, "empty owned array");
        var arrayRecovery = Api.EchoClaims(new[] { valid });
        Check(arrayRecovery.Length == 1 && arrayRecovery[0].Quota == N(7), "array recovery");
        Close(arrayRecovery[0]);

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

        using (var first = Api.NewTicket(N(71), "first"))
        using (var second = Api.NewTicket(N(81), "second"))
        using (var firstKept = first.Retain())
        using (var secondKept = second.Retain())
        {
            var firstInput = Booking(first, 3, 8);
            var secondInput = Claim(second, 99);
            Reject<LeanBridgeException>(() => Api.TransferPairClaim(firstInput, secondInput));
            Check(!first.IsClosed && !second.IsClosed, "late failure aborts both transfers");
            SerialIs(first, 71, "first rejected transfer intact");
            SerialIs(second, 81, "second rejected transfer intact");
            var pair = Api.TransferPairClaim(firstInput, Claim(second, 7));
            Check(first.IsClosed && second.IsClosed && pair.Quota == N(7), "both transfers commit");
            SerialIs(pair.Holder, 81, "pair transfer result");
            SerialIs(firstKept, 71, "first independent retain survives");
            SerialIs(secondKept, 81, "second independent retain survives");
            Close(pair);
        }
        PostTransfer(false); PostTransfer(true);

        TransferWithClaimCallbackArgument1ClosureCallback reply = incoming => {
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
                (TransferWithClaimCallbackArgument1ClosureCallback)(_ => Claim(ticket, 99)),
                valid)));
        SerialIs(ticket, 41, "invalid host reply recovers");
        var sentinel = new InvalidOperationException("owned checked callback");
        Check(ReferenceEquals(Reject<InvalidOperationException>(() =>
            Api.WithClaimCallback(valid, OwnedCallbacks.WithRecovery(
                (TransferWithClaimCallbackArgument1ClosureCallback)(_ => throw sentinel),
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
