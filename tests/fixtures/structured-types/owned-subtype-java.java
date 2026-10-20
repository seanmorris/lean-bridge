// Independent installed-Maven Java consumer for checked owned aggregates.
import java.math.BigInteger;
import java.util.Arrays;
import org.leanbridge.owned_subtypes.*;

public final class Consumer {
    private static int checks;

    private static void check(boolean value, String message) {
        checks++;
        if (!value) throw new AssertionError("owned Subtype Java check " + checks + ": " + message);
    }

    private static void rejected(Runnable operation) {
        try { operation.run(); }
        catch (LeanBridgeException error) {
            check(error.status() == 1, "expected invalid argument, got status " + error.status());
            return;
        }
        throw new AssertionError("expected checked-constructor rejection");
    }

    private static Bundle bundle(Ticket ticket, long count) {
        return new Bundle(ticket, Option.none(), new Ticket[] { ticket }, new Ticket[] { ticket },
            new Payload(BigInteger.valueOf(count), new byte[] { 0, (byte)255 }));
    }

    private static void release(Bundle value) {
        value.primary().close();
        if (value.spare().isSome()) value.spare().value().close();
        for (var ticket : value.peers()) ticket.close();
        for (var ticket : value.history()) ticket.close();
    }

    private static void serialIs(Ticket ticket, long expected, String message) {
        check(Api.serial(ticket).equals(BigInteger.valueOf(expected)), message);
    }

    private record Abandoned(java.lang.ref.WeakReference<Ticket> weak, Ticket retained) { }

    private static Abandoned abandon() {
        var abandoned = Api.newTicket(BigInteger.valueOf(61), "finalized");
        return new Abandoned(new java.lang.ref.WeakReference<>(abandoned), abandoned.retain());
    }

    private static void join(Thread thread) {
        try { thread.join(10000); }
        catch (InterruptedException error) { throw new AssertionError(error); }
        check(!thread.isAlive(), "worker completed");
    }

    private static void collect(java.lang.ref.WeakReference<?> weak) {
        for (var index = 0; index < 100 && weak.get() != null; index++) {
            System.gc();
            try { Thread.sleep(5); }
            catch (InterruptedException error) { throw new AssertionError(error); }
        }
        check(weak.get() == null, "garbage collection reaches the abandoned owner");
    }

    public static void main(String[] arguments) {
        var ticket = Api.newTicket(BigInteger.valueOf(41), "java\0checked");
        var retained = ticket.retain();
        serialIs(ticket, 41, "fresh resource is usable");
        serialIs(retained, 41, "explicit retain is independent");

        var valid = bundle(ticket, 7);
        for (var index = 0; index < 25; index++) {
            var echoed = Api.echoRecord(valid);
            check(echoed.payload().count().equals(BigInteger.valueOf(7)), "selected constructor accepts a valid value");
            serialIs(echoed.primary(), 41, "selected constructor preserves the resource");
            var alternate = Api.echoRecordAlternate(valid);
            check(Arrays.equals(alternate.payload().bytes(), new byte[] { 0, (byte)255 }), "alternate constructor preserves bytes");
            serialIs(alternate.primary(), 41, "alternate constructor preserves the resource");
            release(echoed);
            release(alternate);
        }
        check(!ticket.isClosed(), "borrowed calls do not consume the input owner");

        var invalid = bundle(ticket, -1);
        rejected(() -> Api.echoRecord(invalid));
        rejected(() -> Api.echoRecordAlternate(invalid));
        check(!ticket.isClosed(), "borrowed rejection preserves the input owner");
        serialIs(ticket, 41, "borrowed rejection leaves the resource usable");

        var moving = Api.newTicket(BigInteger.valueOf(51), "moving");
        var kept = moving.retain();
        rejected(() -> Api.transferRecord(bundle(moving, -1)));
        check(!moving.isClosed(), "transfer rejection happens before ownership movement");
        serialIs(moving, 51, "rejected transfer leaves the original usable");
        serialIs(kept, 51, "rejected transfer leaves the retain usable");

        var moved = Api.transferRecord(bundle(moving, 9));
        check(moving.isClosed(), "successful transfer consumes the selected owner");
        serialIs(kept, 51, "successful transfer preserves an independent retain");
        check(moved.payload().count().equals(BigInteger.valueOf(9)), "successful transfer preserves the checked field");
        serialIs(moved.primary(), 51, "successful transfer returns a usable resource");

        var foreignFailure = new java.util.concurrent.atomic.AtomicReference<Throwable>();
        var foreign = new Thread(() -> {
            try { Api.serial(ticket); }
            catch (Throwable error) { foreignFailure.set(error); }
        });
        foreign.start(); join(foreign);
        check(foreignFailure.get() instanceof LeanBridgeException error && error.status() == 5,
            "foreign-thread use rejects without closing the owner");
        serialIs(ticket, 41, "owner remains usable after foreign-thread rejection");

        var abandoned = abandon();
        collect(abandoned.weak());
        serialIs(abandoned.retained(), 61,
            "Cleaner cleanup preserves an independent retain");
        abandoned.retained().close();
        serialIs(ticket, 41, "runtime remains usable after Cleaner cleanup");

        release(moved);
        ticket.close(); retained.close(); moving.close(); kept.close();
        check(ticket.isClosed() && retained.isClosed() && moving.isClosed() && kept.isClosed(),
            "cleanup is explicit and idempotent");
        System.out.println("owned-subtype-java:" + checks);
    }
}
