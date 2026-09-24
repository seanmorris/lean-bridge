package org.leanbridge.recursive;

import java.math.BigInteger;
import java.lang.foreign.Arena;
import java.lang.foreign.FunctionDescriptor;
import java.lang.foreign.MemorySegment;
import java.lang.foreign.ValueLayout;

class GraphLean {
    static final class Aborted extends RuntimeException { private static final long serialVersionUID = 1L; }
    static final class Faults {
        static int attempts, fail;
        static boolean interrupt;
        static Runnable during;
        static final java.util.ArrayList<MemorySegment> allocations = new java.util.ArrayList<>();
        static void hit() {
            if (during != null) during.run();
            if (++attempts == fail) {
                if (interrupt) throw new Aborted();
                throw new OutOfMemoryError("injected");
            }
        }
        static void allocated(MemorySegment value) { allocations.add(value); }
        static void reset(int failure, boolean interrupted) {
            attempts = 0; fail = failure; interrupt = interrupted; during = null; allocations.clear();
        }
        static void closed() { for (var segment : allocations) check(!segment.scope().isAlive()); }
    }
    private static int checks;
    private static void check(boolean valid) { checks++; if (!valid) throw new AssertionError("check " + checks); }
    private static Throwable rejects(Runnable action, Class<? extends Throwable> expected) {
        try { action.run(); }
        catch (Throwable error) {
            if (!expected.isInstance(error)) throw new AssertionError("Expected " + expected.getName(), error);
            checks++; return error;
        }
        throw new AssertionError("Expected " + expected.getName());
    }
    private static Scalars scalars() {
        return new Scalars(Unit.INSTANCE, true, 255, 65535, 4294967295L, BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE),
            Byte.MIN_VALUE, Short.MIN_VALUE, Integer.MIN_VALUE, Long.MIN_VALUE,
            BigInteger.ONE.shiftLeft(128).add(BigInteger.ONE), BigInteger.ONE.shiftLeft(128).add(BigInteger.ONE).negate(),
            1.5f, -2.25, "A\u0000\ud83c\udf31", new byte[] {0, -1, 1}, 0x1f331, BigInteger.valueOf(4294967295L), Integer.MIN_VALUE);
    }
    private static Scalars replaced(String name, Object value) {
        try {
            var components = Scalars.class.getRecordComponents(); Object[] fields = new Object[components.length];
            Class<?>[] types = new Class<?>[components.length]; Scalars source = scalars();
            for (int index = 0; index < fields.length; index++) {
                types[index] = components[index].getType();
                fields[index] = components[index].getName().equals(name) ? value : components[index].getAccessor().invoke(source);
            }
            return Scalars.class.getConstructor(types).newInstance(fields);
        } catch (ReflectiveOperationException error) { throw new AssertionError(error); }
    }
    private static Tree tree() { return new TreeBranch(new Tree[] {new TreeLeaf(scalars()), new TreeBranch(new Tree[0])}); }
    private static Envelope envelope() {
        return new Envelope(tree(), new Tree[][] {{}, {tree()}}, Option.some(tree()), Result.ok(new Pair<>(tree(), tree())), Option.some(Option.some(Unit.INSTANCE)));
    }
    private static void clean() { Faults.closed(); check(GraphProbe.count("live") == 0); }
    private static void reset(long nativeFailure, int javaFailure, boolean interrupted) {
        clean(); GraphProbe.reset(nativeFailure, 0, 0); Faults.reset(javaFailure, interrupted);
    }
    private static long layout(int index) {
        try { return (long)GraphProbe.symbol("graph_fixture_layout", FunctionDescriptor.of(ValueLayout.JAVA_LONG, ValueLayout.JAVA_LONG)).invokeExact((long)index); }
        catch (Throwable error) { throw new AssertionError(error); }
    }
    private static long layoutCount() {
        try { return (long)GraphProbe.symbol("graph_fixture_layout_count", FunctionDescriptor.of(ValueLayout.JAVA_LONG)).invokeExact(); }
        catch (Throwable error) { throw new AssertionError(error); }
    }
    public static void main(String[] arguments) {
        try (Arena library = Arena.ofConfined()) {
            GraphProbe.symbols = java.lang.foreign.SymbolLookup.libraryLookup(java.nio.file.Path.of(arguments[0]), library);
            GraphProbe.clear = GraphProbe.symbol("recursive_jvm_graph_clear", FunctionDescriptor.ofVoid(ValueLayout.ADDRESS));
            long[] actual = GraphProbe.layouts(), expected = GraphProbe.expectedLayouts();
            check(layoutCount() == actual.length); check(actual.length == expected.length);
            for (int index = 0; index < actual.length; index++) { check(actual[index] == layout(index)); check(actual[index] == expected[index]); }
            reset(0, 0, false); check(GraphProbe.count("ready") == 0);
            Spine excessive = new SpineLeaf(0);
            for (int index = 0; index < 128; index++) excessive = new SpineNext(excessive);
            final Spine invalid = excessive;
            rejects(() -> GraphProbe.spine(invalid), IllegalArgumentException.class);
            rejects(() -> GraphProbe.joinTrees(tree(), new TreeLeaf(replaced("natural", BigInteger.ONE.negate()))), IllegalArgumentException.class);
            check(GraphProbe.count("ready") == 0); check(GraphProbe.count("decodes") == 0); check(Faults.attempts == 0); clean();

            Scalars scalar = scalars(); check(GraphProbe.inspect(scalar)); // Lean independently checks all nineteen fields.
            check(GraphProbe.scalars(scalar).equals(scalar));
            check(GraphProbe.wordMax(BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE))); check(!GraphProbe.wordMax(BigInteger.ZERO));
            check(GraphProbe.signedMin(Long.MIN_VALUE)); check(!GraphProbe.signedMin(0));
            for (Scalars value : new Scalars[] {
                replaced("natural", BigInteger.ONE.shiftLeft(1000).add(BigInteger.valueOf(7))),
                replaced("integer", BigInteger.ONE.shiftLeft(1000).add(BigInteger.valueOf(7)).negate()),
                replaced("natural", BigInteger.ZERO), replaced("integer", BigInteger.ZERO),
                replaced("text", ""), replaced("bytes", new byte[0]), replaced("f32", Float.NEGATIVE_INFINITY),
                replaced("f64", Double.POSITIVE_INFINITY)}) check(GraphProbe.scalars(value).equals(value));
            check(Float.isNaN(GraphProbe.scalars(replaced("f32", Float.NaN)).f32()));
            check(Double.doubleToRawLongBits(GraphProbe.scalars(replaced("f64", -0.0)).f64()) == Long.MIN_VALUE); clean();

            Tree tree = tree(); check(GraphProbe.tree(tree).equals(tree));
            check(GraphProbe.empty().equals(new TreeBranch(new Tree[0])));
            check(GraphProbe.joinTrees(tree, tree).equals(new TreeBranch(new Tree[] {tree, tree})));
            Tree[] forest = new Tree[512]; java.util.Arrays.fill(forest, tree);
            Tree[] forestCopy = GraphProbe.forest(forest); check(forestCopy.length == forest.length);
            for (int index = 0; index < forest.length; index++) check(forestCopy[index].equals(tree) && forestCopy[index] != tree);
            TreeBranch input = new TreeBranch(new Tree[] {new TreeLeaf(scalars())});
            TreeBranch copied = (TreeBranch)GraphProbe.tree(input);
            ((TreeLeaf)input.children()[0]).payload().bytes()[0] = 17;
            check(((TreeLeaf)copied.children()[0]).payload().bytes()[0] == 0);
            input.children()[0] = new TreeBranch(new Tree[0]); check(copied.children()[0] instanceof TreeLeaf);
            Envelope envelope = envelope();
            for (Option<Option<Unit>> marker : java.util.List.<Option<Option<Unit>>>of(Option.none(), Option.some(Option.none()), Option.some(Option.some(Unit.INSTANCE))))
            for (Result<Pair<Tree, Tree>, String> outcome : java.util.List.<Result<Pair<Tree, Tree>, String>>of(Result.ok(new Pair<>(tree, tree)), Result.err("error\u0000\ud83c\udf31"))) {
                Envelope value = new Envelope(tree, envelope.alternatives(), Option.none(), outcome, marker);
                check(GraphProbe.envelope(value).equals(value));
            }
            LeftTree left = new LeftTreeNext(new RightTreeMany(new LeftTree[] {new LeftTreeLeaf(9)}));
            check(GraphProbe.left(left).equals(left));
            RightTree right = new RightTreeMany(new LeftTree[] {left}); check(GraphProbe.right(right).equals(right));
            Spine spine = new SpineLeaf(41);
            for (int index = 0; index < 127; index++) spine = new SpineNext(spine);
            Spine original = spine, copy = GraphProbe.spine(spine);
            for (int index = 0; index < 127; index++) { check(original != copy); original = ((SpineNext)original).value(); copy = ((SpineNext)copy).value(); }
            check(((SpineLeaf)original).value() == 41 && ((SpineLeaf)copy).value() == 41);
            final Spine deep = spine; rejects(() -> GraphProbe.grow(deep), IllegalArgumentException.class);
            check(GraphProbe.grow(new SpineLeaf(7)).equals(new SpineNext(new SpineLeaf(7))));
            WideNext.Builder builder = WideNext.builder();
            // WIDE_SETTERS
            Wide wide = new WideLeaf(17);
            for (int index = 0; index < 127; index++) wide = builder.child(wide).build();
            Wide wideCopy = GraphProbe.wide(wide); check(wideCopy.equals(wide)); check(wideCopy != wide);
            for (Marker value : new Marker[] {new MarkerEmpty(), new MarkerUnit(Unit.INSTANCE), new MarkerNext(new MarkerEmpty())}) check(GraphProbe.marker(value).equals(value));
            check(GraphProbe.emptyRecord(new EmptyRecord()).equals(new EmptyRecord()));
            Unit[] units = new Unit[123]; java.util.Arrays.fill(units, Unit.INSTANCE);
            check(GraphProbe.units(units).length == 123);
            rejects(() -> GraphProbe.never(null), IllegalArgumentException.class); clean();

            reset(0, 0, false); check(GraphProbe.envelope(envelope).equals(envelope));
            int nativeCheckpoints = GraphProbe.count("attempts"), managedCheckpoints = Faults.attempts;
            int allocationCheckpoints = Faults.allocations.size(); clean();
            for (int fail = 1; fail <= nativeCheckpoints; fail++) {
                reset(fail, 0, false); rejects(() -> GraphProbe.envelope(envelope), OutOfMemoryError.class); clean();
                check(GraphProbe.count("ready") == 1);
            }
            int inputFailures = 0, outputFailures = 0;
            for (int fail = 1; fail <= managedCheckpoints; fail++) for (boolean interrupted : new boolean[] {false, true}) {
                reset(0, fail, interrupted); rejects(() -> GraphProbe.envelope(envelope), interrupted ? Aborted.class : OutOfMemoryError.class);
                if (!interrupted) { if (GraphProbe.count("decodes") == 0) inputFailures++; else outputFailures++; }
                clean(); check(GraphProbe.count("ready") == 1);
            }
            check(inputFailures > 0 && outputFailures > 0);
            reset(0, 0, false); check(GraphProbe.envelope(envelope).equals(envelope)); clean();

            check(GraphProbe.count("hold") == 0); int retained = GraphProbe.count("live"); check(retained > 0);
            String mode = arguments[1];
            switch (mode) {
                case "carrier" -> GraphProbe.reset(0, 1, 0);
                case "raw" -> GraphProbe.reset(0, 0, 1);
                case "cycle" -> GraphProbe.reset(0, 0, 2);
                case "during" -> {
                    GraphProbe.reset(0, 0, 0);
                    Faults.during = () -> { if (GraphProbe.count("decodes") > 0) GraphProbe.invokeVoid("retire"); };
                }
                default -> throw new AssertionError("Unknown retirement scenario");
            }
            var error = (LeanBridgeException)rejects(() -> GraphProbe.tree(tree), LeanBridgeException.class);
            check(error.status() == (mode.equals("during") ? 5 : 4));
            check(GraphProbe.count("ready") == 0); check(GraphProbe.count("live") == retained); Faults.closed();
            GraphProbe.reset(0, 0, 0); Faults.reset(0, false);
            check(((LeanBridgeException)rejects(() -> GraphProbe.envelope(envelope), LeanBridgeException.class)).status() == 5);
            check(GraphProbe.count("decodes") == 0); check(GraphProbe.count("live") == retained); Faults.closed();
            GraphProbe.invokeVoid("release"); GraphProbe.invokeVoid("release"); GraphProbe.invokeVoid("detach"); clean();
            System.out.println("{\"checks\":" + checks + ",\"nativeCheckpoints\":" + nativeCheckpoints + ",\"managedCheckpoints\":" + managedCheckpoints
                + ",\"allocationCheckpoints\":" + allocationCheckpoints + ",\"inputFailures\":" + inputFailures + ",\"outputFailures\":" + outputFailures
                + ",\"layoutChecks\":" + actual.length + ",\"compiledLean\":true,\"live\":0}");
        }
    }
}
