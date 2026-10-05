import java.math.BigInteger;
import java.util.HashMap;
import java.util.HashSet;
import org.leanbridge.collections.*;
import org.leanbridge.compounds.Option;
import org.leanbridge.compounds.Result;
import org.leanbridge.compounds.Pair;

public final class Equality {
    private Equality() { }
    private static int checks;
    private static void check(boolean condition) { checks++; if (!condition) throw new AssertionError("check " + checks); }
    private static void equal(Object a, Object b) {
        check(a != b); check(a.equals(a)); check(a.equals(b)); check(b.equals(a));
        check(a.hashCode() == b.hashCode()); check(!a.equals(null)); check(!a.equals("unrelated"));
        var set = new HashSet<Object>(); set.add(a); set.add(b); check(set.size() == 1); check(set.contains(b));
        var map = new HashMap<Object, String>(); map.put(a, "value"); check("value".equals(map.get(b)));
    }
    private static void different(Object a, Object b) { check(!a.equals(b)); check(!b.equals(a)); }
    private static void rejects(Class<? extends Throwable> type, Runnable action) {
        try { action.run(); } catch (Throwable error) { check(type.isInstance(error)); return; }
        throw new AssertionError("expected " + type);
    }
    private static Primitives primitives(int n, float f32, double f64) {
        return new Primitives(Unit.INSTANCE, true, n % 256, 65535, 0xffffffffL,
            BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE), (byte)-128, (short)-32768,
            Integer.MIN_VALUE, Long.MIN_VALUE, BigInteger.ONE.shiftLeft(256), BigInteger.valueOf(-n),
            f32, f64, "雪\u0000" + n, new byte[] {0, (byte)n, (byte)255}, 0x1f680,
            BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE), Long.MIN_VALUE);
    }
    private static Packet packet(int n) {
        return new Packet("packet", new Primitives[][] {{primitives(n, Float.NaN, Double.NaN)}, {}},
            new Empty(), new Single(BigInteger.TEN), new Count(BigInteger.TEN),
            new org.leanbridge.collections.Pair(n, "value"), new Reversed("value", n));
    }
    @SuppressWarnings({"unchecked", "rawtypes"})
    private static Object list(int n) {
        return new org.leanbridge.lists.Packet(new long[][] {{n, n, 0}, {}},
            new org.leanbridge.lists.Option[] {org.leanbridge.lists.Option.none(),
                org.leanbridge.lists.Option.some(org.leanbridge.lists.Result.err("error"))},
            new byte[][] {{(byte)n}, {}},
            new org.leanbridge.lists.Pair[][] {{new org.leanbridge.lists.Pair<>(true, n)}, {}});
    }
    private static Object alias(int n) {
        return new org.leanbridge.aliases.Packet(n, "alias", new long[][] {{n}, {}},
            org.leanbridge.aliases.Option.some(org.leanbridge.aliases.Option.none()),
            org.leanbridge.aliases.Result.ok(new org.leanbridge.aliases.Pair<>((long)n, new byte[] {(byte)n})));
    }
    private static Object variant(int n) {
        return new org.leanbridge.variants.Packet(new org.leanbridge.variants.SignalData(n, "named"),
            new org.leanbridge.variants.Signal[] {new org.leanbridge.variants.SignalIdle(), new org.leanbridge.variants.SignalMarker(org.leanbridge.variants.Unit.INSTANCE)},
            org.leanbridge.variants.Option.some(new org.leanbridge.variants.SignalStopped()),
            new org.leanbridge.variants.Mode[] {new org.leanbridge.variants.ModeFirst(), new org.leanbridge.variants.ModeThird()});
    }
    private static Object[] arrays(int n) {
        return new Object[] {new boolean[] {true, false}, new byte[] {(byte)n}, new short[] {(short)n},
            new int[] {n}, new long[] {n}, new float[] {n, Float.NaN}, new double[] {n, Double.NaN},
            new char[] {'雪'}, new String[][] {{"x" + n}, {}}, new BigInteger[] {BigInteger.valueOf(n)},
            new Unit[] {Unit.INSTANCE}, new Object[] {new int[] {n}, new byte[][] {{(byte)n}, {}}}};
    }
    public static void main(String[] args) {
        for (int n = 0; n < 256; n++) {
            equal(primitives(n, Float.NaN, Double.NaN), primitives(n, Float.intBitsToFloat(0x7f800001), Double.longBitsToDouble(0x7ff0000000000001L)));
            different(primitives(n, 0.0f, 0.0), primitives(n, -0.0f, 0.0));
            different(primitives(n, 0.0f, 0.0), primitives(n, 0.0f, -0.0));
            check(primitives(n, 0, 0).char_() == 0x1f680);
            Packet a = packet(n), b = packet(n), c = packet(n);
            equal(a, b); equal(b, c); check(a.equals(c));
            b.values()[0][0].bytes()[0] = 1; different(a, b); check(a.values()[0][0].bytes()[0] == 0);
            equal(list(n), list(n)); equal(alias(n), alias(n)); equal(variant(n), variant(n));
            equal(new org.leanbridge.variants.BuffersPair(new byte[] {(byte)n}, new byte[0]), new org.leanbridge.variants.BuffersPair(new byte[] {(byte)n}, new byte[0]));
            equal(Option.some(arrays(n)), Option.some(arrays(n)));
            equal(Result.ok(arrays(n)), Result.ok(arrays(n))); equal(Result.err(arrays(n)), Result.err(arrays(n)));
            equal(new Pair<>(arrays(n), Option.some(arrays(n))), new Pair<>(arrays(n), Option.some(arrays(n))));
            different(Result.ok(arrays(n)), Result.err(arrays(n)));
            different(Option.none(), Option.some(Option.none())); different(Option.some(Option.none()), Option.some(new int[0]));
        }
        equal(new Empty(), new Empty()); equal(new Single(BigInteger.ONE), new Single(BigInteger.ONE));
        different(new Single(BigInteger.ONE), new Count(BigInteger.ONE));
        different(new org.leanbridge.collections.Pair(1, "x"), new Reversed("x", 1));
        equal(new org.leanbridge.variants.SignalIdle(), new org.leanbridge.variants.SignalIdle());
        different(new org.leanbridge.variants.SignalIdle(), new org.leanbridge.variants.SignalStopped());
        different(new org.leanbridge.variants.SignalIdle(), new org.leanbridge.variants.SignalMarker(org.leanbridge.variants.Unit.INSTANCE));
        rejects(NullPointerException.class, () -> Option.some(null)); rejects(NullPointerException.class, () -> Result.ok(null));
        rejects(NullPointerException.class, () -> Result.err(null)); rejects(NullPointerException.class, () -> new Pair<>(null, 1));
        rejects(NullPointerException.class, () -> new Pair<>(1, null)); rejects(IllegalStateException.class, () -> Option.none().value());
        rejects(IllegalStateException.class, () -> Result.ok(1).error()); rejects(IllegalStateException.class, () -> Result.err(1).value());
        Object deepA = new long[] {1, 2}, deepB = new long[] {1, 2};
        for (int level = 1; level < 24; level++) {
            Object a = java.lang.reflect.Array.newInstance(deepA.getClass(), 1), b = java.lang.reflect.Array.newInstance(deepB.getClass(), 1);
            java.lang.reflect.Array.set(a, 0, deepA); java.lang.reflect.Array.set(b, 0, deepB); deepA = a; deepB = b;
        }
        equal(Option.some(deepA), Option.some(deepB));
        Object[] floatA = {new float[] {Float.NaN}, new double[] {Double.NaN}};
        Object[] floatB = {new float[] {Float.intBitsToFloat(0x7f800001)}, new double[] {Double.longBitsToDouble(0x7ff0000000000001L)}};
        equal(Option.some(floatA), Option.some(floatB));
        different(Option.some(new double[] {0.0}), Option.some(new double[] {-0.0}));
        check(!new byte[] {1}.equals(new byte[] {1}));
        System.out.println("{\"checks\":" + checks + ",\"generatedProfiles\":5,\"fixedArrayDepth\":24,\"nativeCalls\":0}");
    }
}
