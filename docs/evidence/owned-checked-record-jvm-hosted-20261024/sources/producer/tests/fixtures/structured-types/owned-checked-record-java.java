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

            int[] calls = {0};
            WithClaimCallbackArgument1ClosureCallback reply = incoming -> { calls[0]++; return claim(incoming.holder(), 10); };
            var output = withClaimCallback(valid, OwnedCallbacks.withRecovery(reply, valid));
            check(calls[0] == 1 && output.quota().equals(n(10)), "callback result"); close(output);
            output = withClaimCallback(valid, reply); check(calls[0] == 2, "bare callback"); close(output);
            reject(LeanBridgeException.class, () -> withClaimCallback(valid, OwnedCallbacks.withRecovery(reply, invalid)));
            check(calls[0] == 2, "invalid recovery prevents callback");
            reject(LeanBridgeException.class, () -> withClaimCallback(valid,
                OwnedCallbacks.withRecovery(
                    (WithClaimCallbackArgument1ClosureCallback)(incoming -> claim(ticket, 99)),
                    valid)));
            var sentinel = new IllegalStateException("java callback");
            check(reject(IllegalStateException.class, () -> withClaimCallback(valid,
                OwnedCallbacks.withRecovery(
                    (WithClaimCallbackArgument1ClosureCallback)(incoming -> { throw sentinel; }),
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
