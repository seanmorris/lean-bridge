package org.leanbridge.recursive;

import java.math.BigInteger;
import java.lang.foreign.Arena;
import java.lang.foreign.FunctionDescriptor;
import java.lang.foreign.MemorySegment;
import java.lang.foreign.ValueLayout;

class GraphConversions {
    static final class Faults {
        static int attempts, fail;
        static boolean interrupt;
        static final java.util.ArrayList<MemorySegment> allocations = new java.util.ArrayList<>();
        static void hit() {
            if (++attempts == fail) {
                if (interrupt) throw new Aborted();
                throw new OutOfMemoryError("injected");
            }
        }
        static void allocated(MemorySegment value) { allocations.add(value); }
        static void reset(int failure, boolean interrupted) { attempts = 0; fail = failure; interrupt = interrupted; allocations.clear(); }
        static void closed() { for (var segment : allocations) check(!segment.scope().isAlive()); }
    }
    static final class Aborted extends RuntimeException { private static final long serialVersionUID = 1L; }
    private static int checks;
    private static void check(boolean valid) { checks++; if (!valid) throw new AssertionError("check " + checks); }
    private static Throwable rejects(Runnable action, Class<? extends Throwable> expected) {
        try { action.run(); }
        catch (Throwable error) { check(expected.isInstance(error)); return error; }
        throw new AssertionError("Expected " + expected.getName());
    }
    private static Scalars scalars() {
        BigInteger maximum = BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE);
        return new Scalars(Unit.INSTANCE, true, 255, 65535, 4294967295L, maximum,
            Byte.MIN_VALUE, Short.MIN_VALUE, Integer.MIN_VALUE, Long.MIN_VALUE,
            BigInteger.ONE.shiftLeft(200).add(BigInteger.valueOf(7)), BigInteger.ONE.shiftLeft(32).negate(),
            Float.intBitsToFloat(0x7fc00001), -0.0, "\u0000\u007f\u0080\u07ff\u0800\uffff\ud800\udc00\udbff\udfff", new byte[] {0, -1, -128}, 0x1f33f, maximum, Long.MIN_VALUE);
    }
    private static Object copied(Class<?> expected, Object value) {
        try (var scope = new _GraphRuntime.Scope(false)) {
            int type = GraphProbe.type(expected); var raw = _GraphRuntime.write(type, value, scope);
            return _GraphRuntime.read(type, raw, scope);
        }
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
    private static Spine spine(int depth) {
        Spine value = new SpineLeaf(7);
        for (int i = 0; i < depth; i++) value = new SpineNext(value);
        return value;
    }
    private static long nativeLayout(int index) {
        try { return (long)GraphProbe.symbol("graph_fixture_layout", FunctionDescriptor.of(ValueLayout.JAVA_LONG, ValueLayout.JAVA_LONG)).invokeExact((long)index); }
        catch (Throwable error) { throw new AssertionError(error); }
    }
    private static long nativeLayoutCount() {
        try { return (long)GraphProbe.symbol("graph_fixture_layout_count", FunctionDescriptor.of(ValueLayout.JAVA_LONG)).invokeExact(); }
        catch (Throwable error) { throw new AssertionError(error); }
    }
    public static void main(String[] arguments) {
        try (Arena library = Arena.ofConfined()) {
            GraphProbe.symbols = java.lang.foreign.SymbolLookup.libraryLookup(java.nio.file.Path.of(arguments[0]), library);
            GraphProbe.clear = GraphProbe.symbol("recursive_jvm_graph_clear", FunctionDescriptor.ofVoid(ValueLayout.ADDRESS));
            long[] actual = GraphProbe.layouts(), expected = GraphProbe.expectedLayouts();
            check(nativeLayoutCount() == actual.length); check(actual.length == expected.length);
            for (int i = 0; i < actual.length; i++) { check(actual[i] == nativeLayout(i)); check(actual[i] == expected[i]); }
            Scalars scalar = scalars(); check(scalar.equals(copied(Scalars.class, scalar))); Faults.closed();
            for (Scalars empty : new Scalars[] {replaced("natural", BigInteger.ZERO), replaced("integer", BigInteger.ZERO), replaced("text", ""), replaced("bytes", new byte[0])})
                check(empty.equals(copied(Scalars.class, empty)));
            for (int depth = 0; depth <= 100; depth++) { Spine value = spine(depth); check(value.equals(copied(Spine.class, value))); }
            Tree value = new TreeBranch(new Tree[] { new TreeLeaf(scalar), new TreeBranch(new Tree[0]) });
            Tree copy = (Tree)copied(Tree.class, value); check(value.equals(copy)); check(value != copy);
            check(((TreeBranch)value).children() != ((TreeBranch)copy).children());
            Tree covariant = new TreeBranch(new TreeLeaf[] {new TreeLeaf(scalar)}); check(covariant.equals(copied(Tree.class, covariant)));
            LeftTree mutual = new LeftTreeNext(new RightTreeMany(new LeftTree[] {new LeftTreeLeaf(9)}));
            check(mutual.equals(copied(LeftTree.class, mutual)));
            Link link = new Link(Option.some(new Link(Option.none()))); check(link.equals(copied(Link.class, link)));
            ResultLink resultLink = new ResultLink(Result.ok(new ResultLink(Result.err("error"))));
            check(resultLink.equals(copied(ResultLink.class, resultLink)));
            check(new MarkerEmpty().equals(copied(Marker.class, new MarkerEmpty())));
            check(new MarkerUnit(Unit.INSTANCE).equals(copied(Marker.class, new MarkerUnit(Unit.INSTANCE))));
            check(new EmptyRecord().equals(copied(EmptyRecord.class, new EmptyRecord())));
            Envelope envelope = new Envelope(value, new Tree[][] { {}, {value} }, Option.some(value), Result.ok(new Pair<>(value, copy)), Option.some(Option.none()));
            check(envelope.equals(copied(Envelope.class, envelope)));
            WideNext.Builder builder = WideNext.builder();
            // WIDE_SETTERS
            Wide wide = builder.child(new WideLeaf(7)).build(); check(wide.equals(copied(Wide.class, wide)));
            for (int depth = 1; depth < 127; depth++) wide = builder.child(wide).build();
            check(wide.equals(copied(Wide.class, wide)));

            GraphProbe.reset(0); Tree returned = GraphProbe.tree(value);
            check(returned.equals(value)); check(GraphProbe.count("calls") == 1); check(GraphProbe.count("clears") == 1); check(GraphProbe.count("live") == 0); Faults.closed();
            GraphProbe.reset(0); check(wide.equals(GraphProbe.wide(wide))); check(GraphProbe.count("live") == 0);
            GraphProbe.reset(0); Scalars fixed = GraphProbe.scalars(scalar);
            check(fixed.natural().equals(BigInteger.ONE.shiftLeft(1000).add(BigInteger.valueOf(7))));
            check(fixed.integer().equals(fixed.natural().negate())); check(fixed.text().equals("a\u0000\ud83c\udf3f"));
            check(fixed.f32() == Float.POSITIVE_INFINITY); check(Double.doubleToRawLongBits(fixed.f64()) == Long.MIN_VALUE);
            check(fixed.word().equals(BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE))); check(fixed.char_() == 0x1f33f);
            check(GraphProbe.count("live") == 0); check(GraphProbe.count("clears") == 1);
            for (int mode : new int[] {2, 3, 4, 5, 6, 7, 8}) {
                GraphProbe.reset(mode); Throwable error = rejects(() -> GraphProbe.scalars(scalar), LeanBridgeException.class);
                check(((LeanBridgeException)error).status() == 4); check(GraphProbe.count("retired") == 1);
                check(GraphProbe.count("clears") == 1); check(GraphProbe.count("live") == 0); Faults.closed();
            }
            GraphProbe.reset(9); rejects(() -> GraphProbe.scalars(scalar), _GraphRuntime.Limit.class);
            check(GraphProbe.count("clears") == 1); check(GraphProbe.count("live") == 0);
            int treeType = GraphProbe.type(Tree.class), treeFunction = GraphProbe.function(treeType);
            for (String name : new String[] {"bad_tree", "cycle_tree"}) {
                GraphProbe.reset(0); var target = GraphProbe.target(name, 2);
                rejects(() -> _GraphRuntime.call(treeFunction, target, new TreeBranch(new Tree[0])), LeanBridgeException.class);
                check(GraphProbe.count("retired") == 1); check(GraphProbe.count("clears") == 1); check(GraphProbe.count("live") == 0);
            }
            for (int mode : new int[] {101, 102, 103, 104, 105, 199}) {
                GraphProbe.reset(mode); Class<? extends Throwable> failure = mode == 101 ? IllegalArgumentException.class : mode == 102 ? _GraphRuntime.Limit.class : mode == 103 ? OutOfMemoryError.class : LeanBridgeException.class;
                rejects(() -> GraphProbe.scalars(scalar), failure); check(GraphProbe.count("clears") == 1); check(GraphProbe.count("live") == 0);
            }
            for (int mode : new int[] {12, 13}) {
                GraphProbe.reset(mode); rejects(() -> GraphProbe.envelope(envelope), LeanBridgeException.class);
                check(GraphProbe.count("clears") == 1); check(GraphProbe.count("live") == 0); check(GraphProbe.count("retired") == 1);
            }
            for (int mode = 20; mode <= 26; mode++) {
                GraphProbe.reset(mode); int function = GraphProbe.function(GraphProbe.type(Scalars.class));
                rejects(() -> _GraphRuntime.call(function, GraphProbe.target("scalar_more", 2), scalar), LeanBridgeException.class);
                check(GraphProbe.count("clears") == 1); check(GraphProbe.count("live") == 0); check(GraphProbe.count("retired") == 1);
            }
            Object[][] invalidFields = {{"u8", -1}, {"u8", 256}, {"u16", -1}, {"u16", 65536}, {"u32", -1L}, {"u32", 4294967296L},
                {"u64", BigInteger.ONE.negate()}, {"u64", BigInteger.ONE.shiftLeft(64)}, {"word", BigInteger.ONE.negate()}, {"word", BigInteger.ONE.shiftLeft(64)},
                {"natural", BigInteger.ONE.negate()}, {"text", "\ud800"}, {"text", "\udfff"}, {"char_", 0xd800}, {"char_", 0x110000}};
            for (Object[] field : invalidFields) {
                Scalars invalid = replaced((String)field[0], field[1]); GraphProbe.reset(0); Faults.reset(0, false);
                int function = GraphProbe.function(GraphProbe.type(Scalars.class));
                rejects(() -> _GraphRuntime.call(function, null, invalid), IllegalArgumentException.class);
                check(Faults.allocations.isEmpty()); check(GraphProbe.count("calls") == 0); check(GraphProbe.count("initialized") == 0);
            }
            int twoArguments = -1;
            for (int index = 0; index < _GraphTypes.PARAMETERS.length; index++) if (_GraphTypes.PARAMETERS[index].length == 2) twoArguments = index;
            final int join = twoArguments; check(join >= 0); GraphProbe.reset(0); Faults.reset(0, false);
            rejects(() -> _GraphRuntime.call(join, null, value, new TreeLeaf(replaced("natural", BigInteger.ONE.negate()))), IllegalArgumentException.class);
            check(Faults.allocations.isEmpty()); check(GraphProbe.count("initialized") == 0);
            Tree[] cyclicChildren = new Tree[1]; Tree cyclic = new TreeBranch(cyclicChildren); cyclicChildren[0] = cyclic;
            for (Object invalid : new Object[] {null, new Object(), cyclic}) {
                GraphProbe.reset(0); Faults.reset(0, false);
                rejects(() -> _GraphRuntime.call(treeFunction, null, invalid), IllegalArgumentException.class);
                check(GraphProbe.count("calls") == 0); check(GraphProbe.count("initialized") == 0); check(Faults.allocations.isEmpty());
            }
            GraphProbe.reset(0); int spineFunction = GraphProbe.function(GraphProbe.type(Spine.class));
            rejects(() -> _GraphRuntime.call(spineFunction, null, spine(10000)), _GraphRuntime.Limit.class);
            check(GraphProbe.count("initialized") == 0); check(Faults.allocations.isEmpty());
            GraphProbe.reset(0); Faults.reset(0, false); check(GraphProbe.tree(value).equals(value));
            int checkpoints = Faults.attempts; Faults.closed();
            int failures = 0, inputFailures = 0, outputFailures = 0;
            for (boolean interrupted : new boolean[] {false, true}) for (int failure = 1; failure <= checkpoints; failure++) {
                GraphProbe.reset(0); Faults.reset(failure, interrupted);
                rejects(() -> GraphProbe.tree(value), interrupted ? Aborted.class : OutOfMemoryError.class); failures++;
                if (GraphProbe.count("calls") == 0) inputFailures++; else outputFailures++;
                check(GraphProbe.count("live") == 0); check(GraphProbe.count("clears") == GraphProbe.count("calls")); Faults.closed();
            }
            Faults.reset(0, false); GraphProbe.reset(0); check(GraphProbe.tree(value).equals(value)); Faults.closed();
            check(inputFailures > 0); check(outputFailures > 0);
            System.out.println("{\"checks\":" + checks + ",\"layoutChecks\":" + actual.length + ",\"checkpoints\":" + checkpoints + ",\"failures\":" + failures + ",\"inputFailures\":" + inputFailures + ",\"outputFailures\":" + outputFailures + ",\"live\":0}");
        }
    }
}
