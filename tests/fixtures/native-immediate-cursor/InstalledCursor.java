import java.lang.ref.WeakReference;
import java.util.NoSuchElementException;
import java.util.concurrent.FutureTask;
import org.leanbridge.dials.*;

public final class InstalledCursor {
    private static LeanCursor<Long> atExit;
    private static void check(boolean ok) { if (!ok) throw new AssertionError(); }
    private static WeakReference<?> abandon() {
        var it = Api.sequence(3);
        check(it.hasNext());
        return new WeakReference<>(it);
    }
    private static void tickets() {
        check(Observe.snapshot()[3] == 0);
        try (var original = Api.issue(23); var seq = Api.tickets(original)) {
            check(seq.hasNext() && seq.hasNext());
            original.close(); // The only Java ticket left is buffered in the iterator.
        }
        check(Api.closedTickets() == 1 && Observe.snapshot()[3] == 0);
        try (var original = Api.issue(42); var seq = Api.tickets(original); var item = seq.next()) {
            check(item.sameResource(original)); original.close();
            try { seq.next(); throw new AssertionError(); }
            catch (TicketsStepError failure) {
                check(failure.declaration().equals("TicketPulls.nextTicket") && !seq.hasNext());
                try (var payload = failure.payload()) {
                    check(payload.sameResource(item)); item.close(); seq.close();
                    check(Api.readTicket(payload) == 42);
                }
            }
        }
        check(Api.closedTickets() == 2 && Observe.snapshot()[3] == 0);
    }
    public static void main(String[] args) throws Exception {
        check(Api.counts() == 0);
        if (args[0].equals("shutdown")) {
            atExit = Api.sequence(3);
            check(atExit.next() == 0 && Api.counts() == 10100);
            return;
        }
        tickets();
        try (LeanCursor<Long> seq = Api.sequence(3)) {
            check(seq.iterator() == seq && Api.counts() == 10000);
            check(seq.hasNext() && seq.hasNext() && Api.counts() == 10100);
            for (long n : seq) { check(n == 0 && Api.counts() == 10100); break; }
        }
        check(Api.counts() == 10101);
        try (var seq = Api.sequence(2)) {
            var task = new FutureTask<Long>(seq::next);
            Thread.startVirtualThread(task);
            check(task.get() == 0 && seq.next() == 1 && !seq.hasNext());
            try { seq.next(); throw new AssertionError(); } catch (NoSuchElementException expected) {}
        }
        check(Api.counts() == 20402);
        try { Api.checked(0); throw new AssertionError(); } catch (CheckedError e) {
            check(e.declaration().equals("Dials.checked") && e.payload().equals("factory"));
        }
        try (var seq = Api.checked(1)) {
            check(seq.next() == 0);
            try { seq.hasNext(); throw new AssertionError(); } catch (CheckedStepError e) {
                check(e.declaration().equals("Dials.checkedNext") && e.payload().equals("step"));
            }
            check(!seq.hasNext());
        }
        check(Api.counts() == 30603);
        try (var seq = Api.units(1)) {
            check(seq.next() == Unit.INSTANCE);
            try { seq.next(); throw new AssertionError(); } catch (LeanIOException e) {
                check(e.declaration().equals("Dials.nextUnit") && e.getCause().getMessage().equals("unit step"));
            }
        }
        int units = 0;
        try (var seq = Api.units(4)) { for (var v : seq) { check(v == Unit.INSTANCE); units++; } }
        check(units == 2 && Api.counts() == 51105);
        var caller = new RuntimeException("leave");
        try { Api.sequence(3).forEach(n -> { throw caller; }); throw new AssertionError(); }
        catch (RuntimeException e) { check(e == caller); }
        check(Api.counts() == 61206);
        var weak = abandon();
        long until = System.nanoTime() + 15_000_000_000L;
        while ((weak.refersTo(null) == false || Api.counts() != 71307) && System.nanoTime() < until) {
            System.gc(); Thread.sleep(25);
        }
        check(weak.refersTo(null) && Api.counts() == 71307);
    }
}
