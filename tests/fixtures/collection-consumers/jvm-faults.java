// A separate instrumented projection loads only the original JAR's native assets.
package org.leanbridge.collections;
import java.math.BigInteger;

public final class Faults {
    private Faults() { }
    private static int assertions;
    private static void check(boolean condition) { assertions++; if (!condition) throw new AssertionError("cleanup check " + assertions); }
    private static int faults(Runnable action) {
        CollectionProbe.reset(); action.run(); int count = CollectionProbe.count;
        check(count > 0); CollectionProbe.closed();
        for (int target = 1; target <= count; target++) {
            CollectionProbe.reset(); CollectionProbe.target = target; boolean failed = false;
            try { action.run(); } catch (OutOfMemoryError expected) { failed = true; }
            finally { CollectionProbe.target = 0; }
            check(failed); CollectionProbe.closed();
            check(CollectionProbe.calls <= 1); check(CollectionProbe.clears == CollectionProbe.calls);
            check(Api.recordMake().first() == 42); CollectionProbe.closed();
        }
        return count;
    }
    public static void main(String[] args) {
        var huge = BigInteger.ONE.shiftLeft(4096);
        var scalar = new Primitives(Unit.INSTANCE, true, 255, 65535, 4294967295L, BigInteger.ONE,
            (byte)-128, (short)-32768, Integer.MIN_VALUE, Long.MIN_VALUE, huge, huge.negate(),
            -0f, 1.5, "text\0雪", new byte[] {0, -1, 42}, 0x1f331, BigInteger.ONE, Long.MIN_VALUE);
        var packet = new Packet("packet", new Primitives[][] {{scalar, scalar}, {}, {scalar}}, new Empty(), new Single(BigInteger.ONE),
            new Count(huge), new Pair(42, "pair"), new Reversed("reversed", 17));
        int count = faults(() -> Api.recordShuffle(packet)) + faults(() -> Api.recordDuplicate(packet))
            + faults(() -> Api.recordReverse(new Primitives[] {scalar, scalar}))
            + faults(() -> Api.arrayReverseString(new String[][] {{"first", "雪\0"}, {"last"}}))
            + faults(() -> Api.arrayReverseInt(new BigInteger[][] {{huge, huge.negate()}, {BigInteger.ZERO}}))
            + faults(() -> Api.arrayDuplicate(new byte[][] {{0, -1}, {}, {42}}))
            + faults(() -> Api.generate(BigInteger.valueOf(8)));
        for (int i = 0; i < 64; i++) {
            CollectionProbe.reset(); boolean failed = false;
            try { Api.recordReverse(new Primitives[] {scalar, scalar, null}); }
            catch (NullPointerException expected) { failed = true; }
            check(failed); check(CollectionProbe.calls == 0); check(CollectionProbe.clears == 0); CollectionProbe.closed();
            check(Api.recordMake().first() == 42); CollectionProbe.closed();
        }
        System.out.println("{\"checks\":" + assertions + ",\"checkpoints\":" + count
            + ",\"partialInputs\":64,\"allArenasClosed\":true,\"outputsClearedExactlyOnce\":true}");
    }
}
