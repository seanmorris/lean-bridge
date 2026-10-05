import org.leanbridge.recursive.*;
import java.math.BigInteger;
import java.util.concurrent.atomic.AtomicInteger;

public final class Consumer {
    private static final AtomicInteger checks = new AtomicInteger();
    private static void verify(boolean value) { checks.incrementAndGet(); if (!value) throw new AssertionError("check " + checks.get()); }
    private static void reject(Runnable call) {
        try { call.run(); } catch (IllegalArgumentException expected) { checks.incrementAndGet(); return; }
        throw new AssertionError("Invalid copied graph accepted");
    }
    private static Scalars scalar() {
        return new Scalars(Unit.INSTANCE, true, 255, 65535, 4294967295L, BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE),
            Byte.MIN_VALUE, Short.MIN_VALUE, Integer.MIN_VALUE, Long.MIN_VALUE,
            BigInteger.ONE.shiftLeft(128).add(BigInteger.ONE), BigInteger.ONE.shiftLeft(128).add(BigInteger.ONE).negate(),
            1.5f, -2.25, "A\u0000\ud83c\udf31", new byte[] {0, -1, 1}, 0x1f331, BigInteger.valueOf(4294967295L), Integer.MIN_VALUE);
    }
    private static Tree tree() { return new TreeBranch(new Tree[] {new TreeLeaf(scalar()), new TreeBranch(new Tree[0])}); }
    public static void main(String[] arguments) throws Exception {
        // SIGNATURES
        reject(() -> Api.tree(null)); reject(() -> Api.joinTrees(tree(), null));
        reject(() -> Api.wordMax(BigInteger.ONE.negate())); reject(() -> Api.wordMax(BigInteger.ONE.shiftLeft(64)));
        verify(System.getProperties().keySet().stream().noneMatch(key -> key.toString().startsWith("lean.bridge.jvm.native-library-v1.")));
        verify(Api.inspect(scalar())); verify(Api.scalars(scalar()).equals(scalar()));
        verify(Api.wordMax(BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE))); verify(!Api.wordMax(BigInteger.ZERO));
        verify(Api.signedMin(Long.MIN_VALUE)); verify(!Api.signedMin(0));
        Tree original = tree(), copy = Api.tree(original);
        verify(copy.equals(original)); verify(copy != original); verify(copy.hashCode() == original.hashCode());
        verify(Api.empty().equals(new TreeBranch(new Tree[0])));
        verify(Api.joinTrees(original, original).equals(new TreeBranch(new Tree[] {original, original})));
        Tree[] forest = new Tree[128]; java.util.Arrays.fill(forest, original);
        Tree[] output = Api.forest(forest); verify(output != forest); verify(output.length == forest.length);
        for (Tree value : output) { verify(value.equals(original)); verify(value != original); }
        TreeBranch mutable = (TreeBranch)tree(), copied = (TreeBranch)Api.tree(mutable);
        ((TreeLeaf)mutable.children()[0]).payload().bytes()[0] = 9;
        verify(((TreeLeaf)copied.children()[0]).payload().bytes()[0] == 0);
        mutable.children()[0] = new TreeBranch(new Tree[0]); verify(copied.children()[0] instanceof TreeLeaf);
        for (Option<Option<Unit>> marker : java.util.List.<Option<Option<Unit>>>of(Option.none(), Option.some(Option.none()), Option.some(Option.some(Unit.INSTANCE))))
        for (Result<Pair<Tree, Tree>, String> result : java.util.List.<Result<Pair<Tree, Tree>, String>>of(Result.ok(new Pair<>(original, original)), Result.err("error\u0000\ud83c\udf31"))) {
            Envelope value = new Envelope(original, new Tree[][] {{}, {original}}, Option.none(), result, marker);
            Envelope next = Api.envelope(value); verify(next.equals(value)); verify(next != value); verify(next.alternatives() != value.alternatives());
        }
        LeftTree left = new LeftTreeNext(new RightTreeMany(new LeftTree[] {new LeftTreeLeaf(17)}));
        verify(Api.left(left).equals(left)); RightTree right = new RightTreeMany(new LeftTree[] {left}); verify(Api.right(right).equals(right));
        Spine spine = new SpineLeaf(41); for (int index = 0; index < 127; index++) spine = new SpineNext(spine);
        Spine current = spine, spineCopy = Api.spine(spine);
        for (int index = 0; index < 127; index++) { verify(current != spineCopy); current = ((SpineNext)current).value(); spineCopy = ((SpineNext)spineCopy).value(); }
        verify(((SpineLeaf)spineCopy).value() == 41); final Spine deepest = spine;
        reject(() -> Api.grow(deepest)); reject(() -> Api.spine(new SpineNext(deepest)));
        verify(Api.grow(new SpineLeaf(1)).equals(new SpineNext(new SpineLeaf(1))));
        WideNext.Builder builder = WideNext.builder();
        // WIDE_SETTERS
        Wide wide = new WideLeaf(17); for (int index = 0; index < 127; index++) wide = builder.child(wide).build();
        Wide wideCopy = Api.wide(wide); verify(wideCopy.equals(wide)); verify(wideCopy != wide);
        for (Marker marker : new Marker[] {new MarkerEmpty(), new MarkerUnit(Unit.INSTANCE), new MarkerNext(new MarkerEmpty())}) verify(Api.marker(marker).equals(marker));
        verify(Api.emptyRecord(new EmptyRecord()).equals(new EmptyRecord()));
        Unit[] units = new Unit[123]; java.util.Arrays.fill(units, Unit.INSTANCE);
        Unit[] unitsCopy = Api.units(units); verify(unitsCopy != units); verify(java.util.Arrays.equals(units, unitsCopy));
        reject(() -> Api.never(null));
        Tree[] cyclic = new Tree[1]; Tree cycle = new TreeBranch(cyclic); cyclic[0] = cycle;
        reject(() -> Api.tree(cycle)); reject(() -> cycle.equals(cycle)); reject(cycle::hashCode); reject(cycle::toString);
        verify(Api.tree(original).equals(original));
        try (var pool = java.util.concurrent.Executors.newFixedThreadPool(4)) {
            var futures = new java.util.ArrayList<java.util.concurrent.Future<?>>();
            for (int index = 0; index < 256; index++) futures.add(pool.submit(() -> { Tree result = Api.tree(original); verify(result.equals(original)); verify(result != original); }));
            for (var future : futures) future.get();
        }
        verify(Api.class.getDeclaredMethods().length == 18);
        // DOCUMENTATION
        Wire.result("recursive/checks", Wire.integer(checks.get()), true);
        Wire.result("recursive/concurrent-calls", Wire.integer(256), true);
        Wire.finish("java", "org.leanbridge.recursive", System.getProperty("java.version"), Api.class);
    }
}

final class Tamper {
    public static void main(String[] arguments) throws Exception {
        try { Api.empty(); throw new AssertionError("Corrupt native asset loaded"); }
        catch (LeanBridgeException error) {
            Throwable cause = error; while (cause.getCause() != null) cause = cause.getCause();
            if (!cause.getMessage().contains("differs from compiled evidence")) throw error;
        }
        for (String line : java.nio.file.Files.readAllLines(java.nio.file.Path.of("/proc/self/maps")))
            if (line.contains(System.getProperty("java.io.tmpdir") + "/lean-bridge-jvm-")) throw new AssertionError("Corrupt package mapped native code");
        System.out.println("rejected-before-native-loading");
    }
}
