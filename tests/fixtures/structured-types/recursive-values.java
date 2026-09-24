import org.leanbridge.recursive.*;
import java.math.BigInteger;

class RecursiveValues {
    private static int checks;
    private static int cycles;
    private static void check(boolean valid) {
        checks++;
        if (!valid) throw new AssertionError("check " + checks);
    }
    private static void rejects(Runnable action, String message) {
        checks++;
        try { action.run(); }
        catch (IllegalArgumentException expected) {
            if (!expected.getMessage().contains(message)) throw new AssertionError(expected);
            return;
        }
        throw new AssertionError("expected rejection: " + message);
    }
    private static void cyclic(Runnable action) { rejects(action, "Cyclic"); cycles++; }
    private static Spine spine(int depth) {
        Spine value = new SpineLeaf(42);
        for (int index = 0; index < depth; index++) value = new SpineNext(value);
        return value;
    }
    private static int match(Marker value) {
        return switch (value) {
            case MarkerEmpty ignored -> 0;
            case MarkerUnit item -> item.value() == Unit.INSTANCE ? 1 : -1;
            case MarkerNext item -> 2 + match(item.value());
        };
    }
    private static Scalars scalars() {
        BigInteger word = BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE);
        return new Scalars(Unit.INSTANCE, true, 255, 65535, 4294967295L, word,
            Byte.MIN_VALUE, Short.MIN_VALUE, Integer.MIN_VALUE, Long.MIN_VALUE,
            BigInteger.ONE.shiftLeft(200), BigInteger.ONE.shiftLeft(200).negate(),
            Float.NaN, -0.0, "hello\u0000\ud83d\ude00", new byte[] {0, -1, 1}, 0x1f600, word, Long.MIN_VALUE);
    }
    public static void main(String[] args) {
        for (int depth = 0; depth < 120; depth++) {
            Spine left = spine(depth), right = spine(depth);
            check(left.equals(right)); check(right.equals(left));
            check(left.hashCode() == right.hashCode()); check(left.equals(left));
            check(!left.equals(new Object())); check(!left.equals(null));
            check(new java.util.HashSet<>(java.util.List.of(left)).contains(right));
        }
        check(new EmptyRecord().equals(new EmptyRecord()));
        Scalars scalar = scalars(), scalarCopy = scalars();
        check(scalar.equals(scalarCopy)); check(scalar.hashCode() == scalarCopy.hashCode());
        check(scalar.bytes() != scalarCopy.bytes());
        scalarCopy.bytes()[0] = 5; check(!scalar.equals(scalarCopy));
        check(scalar.u64().equals(scalar.word())); check(scalar.char_() == 0x1f600);
        check(match(new MarkerEmpty()) == 0);
        check(match(new MarkerUnit(Unit.INSTANCE)) == 1);
        check(match(new MarkerNext(new MarkerEmpty())) == 2);
        check(!new MarkerEmpty().equals(new MarkerUnit(Unit.INSTANCE)));
        check(!Option.none().equals(Option.some(Option.none())));
        check(!Option.none().equals(Option.some(Unit.INSTANCE)));
        check(!Result.ok(Unit.INSTANCE).equals(Result.err(Unit.INSTANCE)));
        check(Option.some(new int[] {1, 2}).equals(Option.some(new int[] {1, 2})));
        check(Option.some(new int[] {1, 2}).hashCode() == Option.some(new int[] {1, 2}).hashCode());
        check(!Option.some(new int[] {1, 2}).equals(Option.some(new int[] {2, 1})));
        check(!Option.some(new int[] {1, 2}).equals(Option.some(new Integer[] {1, 2})));
        check(new Pair<>(new byte[] {1, 2}, Result.ok(new long[] {3})).equals(new Pair<>(new byte[] {1, 2}, Result.ok(new long[] {3}))));
        check(!Option.some(0.0).equals(Option.some(-0.0)));
        check(Option.some(Double.NaN).equals(Option.some(Double.longBitsToDouble(0x7ff0000000000001L))));
        check(Option.some(Float.NaN).hashCode() == Option.some(Float.intBitsToFloat(0x7f800001)).hashCode());
        check(Option.some(BigInteger.ONE.shiftLeft(20000)).toString().contains("bits"));
        check(Option.some("x".repeat(8000)).toString().length() <= 4099);
        check(Option.some("x".repeat(8000)).toString().endsWith("..."));
        Tree shared = new TreeBranch(new Tree[0]);
        TreeBranch repeated = new TreeBranch(new Tree[] { shared, shared });
        TreeBranch copied = new TreeBranch(new Tree[] { new TreeBranch(new Tree[0]), new TreeBranch(new Tree[0]) });
        check(repeated.equals(copied)); check(repeated.hashCode() == copied.hashCode());
        TreeBranch covariant = new TreeBranch(new TreeBranch[] { new TreeBranch(new Tree[0]) });
        TreeBranch widened = new TreeBranch(new Tree[] { new TreeBranch(new Tree[0]) });
        check(covariant.equals(widened)); check(covariant.hashCode() == widened.hashCode());
        Envelope envelope = new Envelope(shared, new Tree[][] { { shared }, {} }, Option.some(shared),
            Result.ok(new Pair<>(shared, copied)), Option.some(Option.some(Unit.INSTANCE)));
        Envelope envelopeCopy = new Envelope(new TreeBranch(new Tree[0]), new Tree[][] { { new TreeBranch(new Tree[0]) }, {} },
            Option.some(new TreeBranch(new Tree[0])), Result.ok(new Pair<>(new TreeBranch(new Tree[0]), repeated)), Option.some(Option.some(Unit.INSTANCE)));
        check(envelope.equals(envelopeCopy)); check(envelope.hashCode() == envelopeCopy.hashCode());
        LeftTree mutual = new LeftTreeNext(new RightTreeMany(new LeftTree[] { new LeftTreeLeaf(42) }));
        LeftTree mutualCopy = new LeftTreeNext(new RightTreeMany(new LeftTree[] { new LeftTreeLeaf(42) }));
        check(mutual.equals(mutualCopy)); check(mutual.hashCode() == mutualCopy.hashCode());
        Tree[] children = new Tree[1]; TreeBranch cycle = new TreeBranch(children); children[0] = cycle;
        cyclic(() -> cycle.equals(cycle)); cyclic(() -> cycle.equals(new TreeBranch(new Tree[0])));
        cyclic(cycle::hashCode); cyclic(cycle::toString);
        Object[] values = new Object[1]; values[0] = values;
        Option<Object[]> arrayCycle = Option.some(values);
        cyclic(() -> arrayCycle.equals(arrayCycle)); cyclic(arrayCycle::hashCode); cyclic(arrayCycle::toString);
        Pair<Integer, Tree> later = new Pair<>(1, cycle);
        cyclic(() -> later.equals(new Pair<>(2, shared)));
        Pair<String, Tree> hiddenByTextLimit = new Pair<>("x".repeat(5000), cycle);
        cyclic(hiddenByTextLimit::toString);
        Spine deep = spine(10000);
        rejects(() -> deep.equals(deep), "128 levels"); rejects(deep::hashCode, "128 levels"); rejects(deep::toString, "128 levels");
        Option<int[]> wideArray = Option.some(new int[262144]);
        rejects(() -> wideArray.equals(wideArray), "node visits"); rejects(wideArray::hashCode, "node visits");
        Tree dag = new TreeBranch(new Tree[0]);
        for (int index = 0; index < 19; index++) dag = new TreeBranch(new Tree[] { dag, dag });
        Tree expensive = dag;
        rejects(expensive::hashCode, "node visits"); rejects(() -> expensive.equals(expensive), "node visits");
        Option<byte[]> hugeBytes = Option.some(new byte[16 * 1024 * 1024 + 1]);
        rejects(hugeBytes::hashCode, "16 MiB");
        WideNext.Builder builder = WideNext.builder();
        try { builder.build(); throw new AssertionError("incomplete builder"); }
        catch (IllegalStateException expected) { check(expected.getMessage().contains("Every copied field")); }
        // WIDE_SETTERS
        builder.child(new WideLeaf(7)); WideNext wide = builder.build();
        check(wide.field0() == 0); check(wide.field254() == 254); check(wide.child().equals(new WideLeaf(7)));
        WideNext same = builder.build(); check(wide.equals(same)); check(wide.hashCode() == same.hashCode());
        builder.field0(99); check(wide.field0() == 0); check(!wide.equals(builder.build()));
        org.leanbridge.linked.Link link = new org.leanbridge.linked.Link(org.leanbridge.linked.Option.none(), 7);
        for (int index = 0; index < 40; index++) link = new org.leanbridge.linked.Link(org.leanbridge.linked.Option.some(link), index);
        check(link.equals(link)); check(link.hashCode() == link.hashCode());
        long[][][][][][][][][][][][][][][][][][][][][][][][][][][][][][][][] depth32 = new long[1][][][][][][][][][][][][][][][][][][][][][][][][][][][][][][][];
        org.leanbridge.deep.Link box = new org.leanbridge.deep.Link(depth32); check(box.value() == depth32); check(box.equals(box));
        org.leanbridge.names.Frame frame = new org.leanbridge.names.Frame(org.leanbridge.names.Option.none(), 7);
        check(frame.equals(new org.leanbridge.names.Frame(org.leanbridge.names.Option.none(), 7)));
        check(new org.leanbridge.names.Entry().equals(new org.leanbridge.names.Entry()));
        check(new org.leanbridge.names.Cursor().equals(new org.leanbridge.names.Cursor()));
        check(!new org.leanbridge.names.Entry().equals(new org.leanbridge.names.Cursor()));
        check(!java.lang.reflect.Modifier.isPublic(java.util.Arrays.stream(SpineLeaf.class.getDeclaredMethods()).filter(method -> method.getName().equals("bridgeField")).findFirst().orElseThrow().getModifiers()));
        System.out.println("{\"checks\":" + checks + ",\"wideFields\":256,\"nativeCalls\":0,\"cycleRejections\":" + cycles + "}");
    }
}
