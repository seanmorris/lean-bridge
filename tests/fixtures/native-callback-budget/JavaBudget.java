import java.lang.ref.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;
import org.leanbridge.budget.*;

public final class JavaBudget extends Observe {
    static <E extends Throwable> E failure(Class<E> type, CompletableFuture<?> task) {
        try { task.join(); throw new AssertionError("expected " + type); }
        catch (CompletionException e) {
            if (e.getCause().getClass() != type) throw new AssertionError("expected " + type, e);
            return type.cast(e.getCause());
        }
    }
    static CallbackAlreadyInvokedException denied(String name, CompletableFuture<?> task) {
        var e = failure(CallbackAlreadyInvokedException.class, task);
        check(e.declaration().equals(name) && e.getMessage().equals("callback-already-invoked")); return e;
    }
    record Capture(WeakReference<Object> weak, RetainedCallback<Function<Long,Long>> owner) {}
    static Capture track(AtomicInteger calls) {
        Object captured = new Object();
        var owner = RetainedCallback.<Long,Long>function(n -> {
            check(Thread.currentThread().isVirtual()); calls.incrementAndGet(); Reference.reachabilityFence(captured); return n+1;
        });
        return new Capture(new WeakReference<>(captured), owner);
    }
    public static void main(String[] args) {
        var calls = new AtomicInteger(); var many = new AtomicInteger();
        var capture = track(calls); var f = capture.owner.callback();
        denied("Budget.probe", Api.probe(1, f, n -> { many.incrementAndGet(); return n+1; }));
        check(calls.get() == 1 && many.get() == 2 && Api.pair(40, f, f).join() == 42);
        var a = Api.single(3, f); var b = Api.single(41, f);
        check(b.join() == 42 && a.join() == 4 && calls.get() == 5);
        var marker = new IllegalArgumentException("callback-already-invoked");
        var failed = new AtomicInteger(); Function<Long,Long> boom = n -> { failed.incrementAndGet(); throw marker; };
        denied("Budget.retry", Api.retry(1, boom)); check(failed.get() == 1);
        check(failure(IllegalArgumentException.class, Api.single(1, boom)) == marker);
        var prior = denied("Racing.duringStart", Api.duringStart(1, f));
        check(failure(CallbackAlreadyInvokedException.class, Api.single(1, n -> { throw prior; })) == prior);
        var initial = failure(LeanIOException.class, Api.start(0, f));
        var terminal = failure(TaskIOException.class, Api.replace(1, f));
        check(initial.declaration().equals("FactoryFault.start") && initial.getMessage().contains(marker.getMessage()));
        check(terminal.declaration().equals("Racing.replace") && terminal.getMessage().contains(marker.getMessage()));
        int before = calls.get(); var typed = failure(CheckedError.class, Api.checked(0, f));
        check(typed.payload() == 73L && typed.declaration().equals("TypedBudget.checked") && calls.get() == before);
        denied("TypedBudget.checked", Api.checked(1, f)); check(calls.get() == before + 1);
        for (int n=0; n<16; n++) {
            before=calls.get(); denied("Racing.race", Api.race(n, f)); check(calls.get() == before+1);
        }
        check(!capture.weak.refersTo(null)); capture.owner.close(); check(capture.owner.isClosed());
        until(() -> { System.gc(); return capture.weak.refersTo(null); });
        drained(); check(snapshot()[0] == 1 && snapshot()[3] == 0);
        System.out.println("Java: 16 worker races; original, factory, terminal and typed failures distinct; capture released; zero leases");
    }
}
