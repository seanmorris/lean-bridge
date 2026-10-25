import java.math.BigInteger;
import org.leanbridge.owned_checked_records.*;
import static org.leanbridge.owned_checked_records.Api.*;

final class Consumer {
    private static int checks;
    private static BigInteger n(long value) { return BigInteger.valueOf(value); }
    private static Claim claim(Ticket holder, long quota) { return new Claim(holder, n(quota)); }
    private static Booking booking(Ticket holder, long lo, long hi) {
        return new Booking(holder, new Window(n(lo), n(hi)));
    }
    private static void check(boolean value, String message) {
        checks++; if (!value) throw new AssertionError("owned checked-record Java check " + checks + ": " + message);
    }
    private static <T extends Throwable> T reject(Class<T> kind, Runnable action) {
        try { action.run(); } catch (Throwable error) {
            if (kind.isInstance(error)) return kind.cast(error);
            throw new AssertionError("wrong exception", error);
        }
        throw new AssertionError("expected " + kind.getName());
    }
    private static void serialIs(Ticket value, long expected, String message) {
        check(serial(value).equals(n(expected)), message);
    }
    private static void close(Claim value) { value.holder().close(); }
    private static void close(Booking value) { value.holder().close(); }
    private static void close(Grant value) { value.holder().close(); }
    private record Abandoned(java.lang.ref.WeakReference<Ticket> weak, Ticket retained) { }
    private static Abandoned abandon() {
        var value = newTicket(n(62), "finalized");
        return new Abandoned(new java.lang.ref.WeakReference<>(value), value.retain());
    }
    private static void collect(java.lang.ref.WeakReference<?> weak) {
        for (int index = 0; index < 100 && weak.get() != null; index++) {
            System.gc(); try { Thread.sleep(5); }
            catch (InterruptedException error) { throw new AssertionError(error); }
        }
        check(weak.get() == null, "Cleaner reaches abandoned owner");
    }

    private static void postTransfer(boolean throwsError) {
        try (var input = newTicket(n(91), "post-transfer"); var independent = input.retain()) {
            var transferred = claim(input, 7);
            int[] entered = {0}; Claim[] output = {null};
            var sentinel = new IllegalStateException("post-transfer callback");
            TransferWithClaimCallbackArgument1ClosureCallback reply = incoming -> {
                entered[0]++; check(incoming.quota().equals(n(7)), "post-transfer callback input");
                if (throwsError) throw sentinel;
                return claim(incoming.holder(), 99);
            };
            var callback = OwnedCallbacks.withRecovery(reply, claim(independent, 7));
            if (throwsError)
                check(reject(IllegalStateException.class, () ->
                    output[0] = transferWithClaimCallback(transferred, callback)) == sentinel,
                    "post-transfer callback exception identity");
            else
                check(reject(LeanBridgeException.class, () ->
                    output[0] = transferWithClaimCallback(transferred, callback)).status() == 1,
                    "post-transfer invalid callback reply rejects");
            check(output[0] == null && entered[0] == 1 && input.isClosed() && transferred.holder().isClosed(),
                "post-transfer failure consumes input without publishing output");
            serialIs(independent, 91, "post-transfer failure preserves independent retain");
            var recovered = transferWithClaimCallback(claim(independent, 7), OwnedCallbacks.withRecovery(
                (TransferWithClaimCallbackArgument1ClosureCallback)(incoming -> claim(incoming.holder(), 9)),
                claim(independent, 7)));
            check(independent.isClosed() && recovered.quota().equals(n(9)), "post-transfer failure recovers");
            serialIs(recovered.holder(), 91, "recovered transfer resource"); close(recovered);
        }
    }

    private static void exercise() {
        try (var ticket = newTicket(n(41), "java\0checked"); var retained = ticket.retain()) {
            serialIs(ticket, 41, "fresh resource"); serialIs(retained, 41, "retained resource");
            var valid = claim(ticket, 7); var validBooking = booking(ticket, 3, 8);
            for (int index = 0; index < 25; index++) {
                var echoed = echoClaim(valid);
                check(echoed.quota().equals(n(7)), "claim field"); serialIs(echoed.holder(), 41, "claim resource");
                var nested = echoBooking(validBooking);
                check(nested.window().hi().equals(n(8)), "nested field"); serialIs(nested.holder(), 41, "nested resource");
                close(echoed); close(nested);
            }
            var invalidBooking = booking(ticket, 8, 3);
            for (int index = 0; index < 10; index++) {
                reject(LeanBridgeException.class, () -> echoBooking(invalidBooking));
                check(invalidBooking.window().lo().equals(n(8)) && invalidBooking.window().hi().equals(n(3)),
                    "nested copied rejection preserves input fields");
                serialIs(invalidBooking.holder(), 41, "nested copied rejection preserves owner");
            }
            var equalBooking = echoBooking(booking(ticket, 3, 3));
            check(equalBooking.window().lo().equals(n(3)) && equalBooking.window().hi().equals(n(3)),
                "nested copied equality and recovery");
            serialIs(equalBooking.holder(), 41, "nested copied recovery resource"); close(equalBooking);
            check(bookingSpan(validBooking).equals(n(5)), "copied payload consumed");
            check(claimQuota(valid).equals(n(7)), "owned payload consumed");
            var grant = echoGrant(new Grant(ticket, n(7), n(8)));
            check(grant.weight().equals(n(7)) && grant.limit().equals(n(8)), "nested Subtype and outer record accepted");
            serialIs(grant.holder(), 41, "grant resource"); close(grant);
            reject(LeanBridgeException.class, () -> echoGrant(new Grant(ticket, n(0), n(8))));
            reject(LeanBridgeException.class, () -> echoGrant(new Grant(ticket, n(7), n(3))));
            serialIs(ticket, 41, "both grant rejections preserve owner");
            var claims = echoClaims(new Claim[] {valid, valid});
            check(claims.length == 2 && claims[0].quota().equals(n(7)) && claims[1].quota().equals(n(7)), "owned array");
            close(claims[0]); serialIs(claims[1].holder(), 41, "array element owners are independent"); close(claims[1]);
            for (int index = 0; index < 10; index++) {
                Claim[][] partial = {null};
                reject(LeanBridgeException.class, () -> partial[0] = echoClaims(new Claim[] {valid, claim(ticket, 99)}));
                check(partial[0] == null && !ticket.isClosed(), "late array rejection publishes no partial result");
            }
            check(echoClaims(new Claim[0]).length == 0, "empty owned array");
            var arrayRecovery = echoClaims(new Claim[] {valid});
            check(arrayRecovery.length == 1 && arrayRecovery[0].quota().equals(n(7)), "array recovery"); close(arrayRecovery[0]);
            var invalid = claim(ticket, 99);
            reject(LeanBridgeException.class, () -> echoClaim(invalid));
            reject(LeanBridgeException.class, () -> pairClaim(validBooking, invalid));
            check(!ticket.isClosed(), "borrowed rejection preserves input"); serialIs(ticket, 41, "rejection recovery");

            try (var moving = newTicket(n(51), "moving"); var kept = moving.retain()) {
                var rejected = claim(moving, 99);
                reject(LeanBridgeException.class, () -> transferClaim(rejected));
                check(!moving.isClosed() && !rejected.holder().isClosed(), "prevalidate transfer");
                var accepted = claim(moving, 9); var moved = transferClaim(accepted);
                check(moving.isClosed() && accepted.holder().isClosed(), "consume transfer");
                serialIs(moved.holder(), 51, "moved result"); serialIs(kept, 51, "retain survives"); close(moved);
            }

            try (var first = newTicket(n(71), "first"); var second = newTicket(n(81), "second");
                 var firstKept = first.retain(); var secondKept = second.retain()) {
                var firstInput = booking(first, 3, 8); var secondInput = claim(second, 99);
                reject(LeanBridgeException.class, () -> transferPairClaim(firstInput, secondInput));
                check(!first.isClosed() && !second.isClosed(), "late failure aborts both transfers");
                serialIs(first, 71, "first rejected transfer intact"); serialIs(second, 81, "second rejected transfer intact");
                var pair = transferPairClaim(firstInput, claim(second, 7));
                check(first.isClosed() && second.isClosed() && pair.quota().equals(n(7)), "both transfers commit");
                serialIs(pair.holder(), 81, "pair transfer result"); serialIs(firstKept, 71, "first independent retain survives");
                serialIs(secondKept, 81, "second independent retain survives"); close(pair);
            }
            postTransfer(false); postTransfer(true);

            int[] calls = {0};
            TransferWithClaimCallbackArgument1ClosureCallback reply = incoming -> { calls[0]++; return claim(incoming.holder(), 10); };
            var output = withClaimCallback(valid, OwnedCallbacks.withRecovery(reply, valid));
            check(calls[0] == 1 && output.quota().equals(n(10)), "callback result"); close(output);
            output = withClaimCallback(valid, reply); check(calls[0] == 2, "bare callback"); close(output);
            reject(LeanBridgeException.class, () -> withClaimCallback(valid, OwnedCallbacks.withRecovery(reply, invalid)));
            check(calls[0] == 2, "invalid recovery prevents callback");
            reject(LeanBridgeException.class, () -> withClaimCallback(valid,
                OwnedCallbacks.withRecovery(
                    (TransferWithClaimCallbackArgument1ClosureCallback)(incoming -> claim(ticket, 99)),
                    valid)));
            var sentinel = new IllegalStateException("java callback");
            check(reject(IllegalStateException.class, () -> withClaimCallback(valid,
                OwnedCallbacks.withRecovery(
                    (TransferWithClaimCallbackArgument1ClosureCallback)(incoming -> { throw sentinel; }),
                    valid))) == sentinel,
                "callback exception identity");

            try (var closure = claimClosure()) {
                var first = closure.invoke(valid); check(first.quota().equals(n(7)), "closure result"); close(first);
                reject(LeanBridgeException.class, () -> closure.invoke(invalid));
                var again = closure.invoke(claim(ticket, 6)); check(again.quota().equals(n(6)), "closure recovery"); close(again);
                closure.close(); closure.close(); check(closure.isClosed(), "idempotent close");
            }
            var produced = claimFor(retained);
            check(produced.isSome() && produced.value().quota().equals(BigInteger.ZERO), "Lean-produced checked record");
            serialIs(produced.value().holder(), 41, "produced resource"); close(produced.value());

            Throwable[] foreignFailure = {null};
            var foreign = new Thread(() -> { try { serial(ticket); }
                catch (Throwable error) { foreignFailure[0] = error; } });
            foreign.start(); try { foreign.join(); }
            catch (InterruptedException error) { throw new AssertionError(error); }
            check(foreignFailure[0] instanceof LeanBridgeException error
                && error.status() == 5, "foreign thread rejects without closing owner");
            serialIs(ticket, 41, "owner survives foreign-thread rejection");

            var abandoned = abandon(); collect(abandoned.weak());
            serialIs(abandoned.retained(), 62, "Cleaner preserves independent retain");
            abandoned.retained().close();
        }
    }
    public static void main(String[] args) throws Exception {
        Throwable[] failure = {null};
        var worker = new Thread(() -> { try { exercise(); } catch (Throwable error) { failure[0] = error; } });
        worker.start(); worker.join(); if (failure[0] != null) throw new AssertionError("worker failed", failure[0]);
        System.out.println("owned-checked-record-java:" + checks);
    }
}
