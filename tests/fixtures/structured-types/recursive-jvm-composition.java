import org.leanbridge.graph_one.Parcel;
import org.leanbridge.graph_one.VDone;
import org.leanbridge.graph_one.VNext;

public final class Composition {
    private static void check(boolean value) { if (!value) throw new AssertionError("Composition failed"); }
    public static void main(String[] args) throws Throwable {
        var first = new Parcel(new VNext(new VDone(41)));
        var second = new org.leanbridge.graph_two.Parcel(new org.leanbridge.graph_two.VNext(new org.leanbridge.graph_two.VDone(43)));
        if (args[0].equals("peer-first")) check(org.leanbridge.graph_peer.Api.value() == 42);
        var retained = org.leanbridge.graph_one.Api.echo(first);
        check(retained.equals(first)); check(retained != first);
        check(org.leanbridge.graph_two.Api.echo(second).equals(second));
        check(org.leanbridge.graph_peer.Api.value() == 42);
        try (var pool = java.util.concurrent.Executors.newFixedThreadPool(4)) {
            var futures = new java.util.ArrayList<java.util.concurrent.Future<?>>();
            for (int index = 0; index < 64; index++) futures.add(pool.submit(() -> {
                check(org.leanbridge.graph_one.Api.echo(first).equals(first));
                check(org.leanbridge.graph_two.Api.echo(second).equals(second));
                check(org.leanbridge.graph_peer.Api.value() == 42);
            }));
            for (var future : futures) future.get();
        }
        Loading.snapshot("graph_one", 3);
        Loading.retire("graph_one");
        Loading.unavailable(() -> org.leanbridge.graph_one.Api.echo(first));
        Loading.unavailable(() -> org.leanbridge.graph_two.Api.echo(second));
        Loading.unavailable(() -> org.leanbridge.graph_peer.Api.value());
        check(retained.equals(first)); check(((VDone)((VNext)retained.node()).value()).value() == 41);
        Loading.finish("java-" + args[0]);
    }
}
