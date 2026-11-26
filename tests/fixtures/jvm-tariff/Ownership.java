// Test-only observations, shared by two independent application processes.
// Observe reads the broker the package loaded; it does not create a binding.
import java.util.concurrent.atomic.AtomicReference;

final class Ownership {
    static int baseline;
    static void check(boolean ok) { if (!ok) throw new AssertionError(); }
    static int live() { return Observe.snapshot()[3]; }
    static void begin() { baseline = live(); System.out.println("baseline " + baseline); }
    static void held() {
        int n = live(); check(n > baseline); System.out.println("held " + n);
    }
    static void settled(String label) {
        int n = live();
        if (n != baseline) throw new AssertionError(label + ": expected " + baseline + ", found " + n);
        System.out.println(label + " " + n);
    }
    static void run(Runnable scenarios) throws InterruptedException {
        var failure = new AtomicReference<Throwable>();
        Thread owner = Thread.ofPlatform().unstarted(scenarios);
        owner.setUncaughtExceptionHandler((t, e) -> failure.set(e)); owner.start(); owner.join();
        if (failure.get() != null) throw new AssertionError("owner failed", failure.get());
        Observe.until(() -> live() == 0);
        System.out.println("afterThreadExit " + live());
    }
}
