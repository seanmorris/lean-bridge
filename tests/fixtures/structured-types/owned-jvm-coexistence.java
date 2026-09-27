import java.math.BigInteger;
import java.util.Arrays;

public final class Coexistence {
    private Coexistence() { }
    private static void check(boolean value) { if (!value) throw new AssertionError("Owned coexistence"); }
    private static void copied() {
        var value = new org.leanbridge.graph_one.Parcel(new org.leanbridge.graph_one.VDone(41));
        check(org.leanbridge.graph_one.Api.echo(value).equals(value));
        check(org.leanbridge.graph_peer.Api.value() == 42);
    }
    private static void exercise() {
        var huge = BigInteger.ONE.shiftLeft(201).add(BigInteger.valueOf(17));
        try (var first = org.leanbridge.owned_one.Api.ticket(huge)) {
            var input = new org.leanbridge.owned_one.Parcel(first, new byte[] {0, -1, 3});
            var result = org.leanbridge.owned_one.Api.through(input, borrowed -> {
                check(org.leanbridge.owned_one.Api.read(borrowed.ticket()).equals(huge));
                try (var second = org.leanbridge.owned_two.Api.ticket(huge.negate().negate())) {
                    var peer = new org.leanbridge.owned_two.Parcel(second, new byte[] {7, 8});
                    var output = org.leanbridge.owned_two.Api.through(peer, value -> {
                        copied();
                        check(org.leanbridge.owned_one.Api.read(borrowed.ticket()).equals(huge));
                        check(org.leanbridge.owned_two.Api.read(value.ticket()).equals(huge));
                        return value;
                    });
                    try (var returned = output.ticket()) {
                        check(org.leanbridge.owned_two.Api.read(returned).equals(huge));
                        check(Arrays.equals(output.bytes(), peer.bytes()));
                    }
                }
                return borrowed;
            });
            try (var returned = result.ticket()) {
                check(returned != first && !first.isClosed());
                check(org.leanbridge.owned_one.Api.read(returned).equals(huge));
                check(Arrays.equals(result.bytes(), input.bytes()) && result.bytes() != input.bytes());
            }
        }
    }
    private static void scenario(String mode) throws Exception {
        switch (mode) {
            case "owned-first" -> check(org.leanbridge.owned_one.Api.value() == 44);
            case "second-owned-first" -> check(org.leanbridge.owned_two.Api.value() == 45);
            case "graph-first" -> check(org.leanbridge.graph_one.Api.value() == 41);
            case "peer-first" -> check(org.leanbridge.graph_peer.Api.value() == 42);
            default -> throw new AssertionError("Unknown mode");
        }
        exercise();
        try (var pool = java.util.concurrent.Executors.newFixedThreadPool(4)) {
            var futures = new java.util.ArrayList<java.util.concurrent.Future<?>>();
            for (int i = 0; i < 64; i++) futures.add(pool.submit(Coexistence::exercise));
            for (var future : futures) future.get();
        }
    }
    public static void main(String[] args) throws Throwable {
        var failure = new Throwable[1];
        var creator = new Thread(() -> {
            try { scenario(args[0]); } catch (Throwable error) { failure[0] = error; }
        });
        creator.start(); creator.join(30000);
        check(!creator.isAlive());
        if (failure[0] != null) throw new AssertionError("Creator failed", failure[0]);
        // Each owned component pins one session per creating platform thread.
        // Closing wrappers does not end that session. Thread exit must do so.
        long deadline = System.nanoTime() + java.util.concurrent.TimeUnit.SECONDS.toNanos(5);
        for (;;) {
            try { Loading.snapshot("owned_one", 4); break; }
            catch (AssertionError error) {
                if (System.nanoTime() >= deadline) throw error;
                Thread.sleep(10);
            }
        }
        Loading.retire("graph_one");
        Loading.unavailable(() -> org.leanbridge.owned_one.Api.value());
        Loading.unavailable(() -> org.leanbridge.owned_two.Api.value());
        Loading.unavailable(() -> org.leanbridge.graph_one.Api.value());
        Loading.unavailable(() -> org.leanbridge.graph_peer.Api.value());
        Loading.finish("java-" + args[0]);
        java.lang.ref.Reference.reachabilityFence(creator);
    }
}
