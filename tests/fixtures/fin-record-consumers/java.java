import java.math.BigInteger;
import java.util.Objects;
import java.util.function.Function;
import java.util.function.Supplier;
import org.leanbridge.finrecords.Api;
import org.leanbridge.finrecords.GateClosed;
import org.leanbridge.finrecords.GateNever;
import org.leanbridge.finrecords.Late;
import org.leanbridge.finrecords.Nest;
import org.leanbridge.finrecords.Option;
import org.leanbridge.finrecords.Shape;
import org.leanbridge.finrecords.ShapeCircle;
import org.leanbridge.finrecords.ShapeEmpty;
import org.leanbridge.finrecords.ShapeLabel;
import org.leanbridge.finrecords.Slot;
import org.leanbridge.finrecords.Tile;

final class Consumer {
    private Consumer() { }
    private static int checks;
    static void check(boolean value, String label) { if (!value) throw new AssertionError("failed: " + label); checks++; }
    // A rejected call names the parameter and the failed leaf's bound.
    static boolean rejected(Runnable action, String parameter, String bound) {
        try { action.run(); }
        catch (IllegalArgumentException error) { return (parameter + " is not below its Fin " + bound + " bound").equals(error.getMessage()); }
        return false;
    }
    // The input and an independently built snapshot exist before the call; they are compared
    // immediately after the rejection, before the caller changes anything back.
    static <T> boolean refused(Function<T, ?> call, Supplier<T> build, String bound) {
        T input = build.get();
        T before = build.get();
        return rejected(() -> call.apply(input), "arg0", bound) && Objects.deepEquals(input, before);
    }
    static BigInteger n(long value) { return BigInteger.valueOf(value); }
    static Tile tile(BigInteger digit, BigInteger count) { return new Tile(digit, count); }
    static Tile tile(long digit, long count) { return tile(n(digit), n(count)); }
    static Late late(long digit) { return new Late("ab", new BigInteger[] { n(1), n(2) }, n(digit)); }
    static Tile[] row() { return new Tile[] { tile(0, 1), tile(4, 2), tile(1, 0) }; }
    public static void main(String[] args) {
        BigInteger huge = BigInteger.ONE.shiftLeft(100);
        // Tile: the digit is Fin 5; any count is valid.
        for (int d = 0; d < 5; d++) check(Api.tileSum(tile(d, 10)).equals(n(d + 10)), "tile valid");
        check(Api.tileSum(tile(n(3), huge)).equals(huge.add(n(3))), "unbounded count");
        check(refused(Api::tileSum, () -> tile(n(5), huge), "5"), "tile at bound");
        check(refused(Api::tileSum, () -> tile(BigInteger.ONE.shiftLeft(70), huge), "5"), "tile beyond 64 bits");
        // Nest: the inner record's own bound and the outer bound are both checked.
        check(Api.nestSum(new Nest(tile(4, 6), n(2))).equals(n(210)), "nest valid");
        check(refused(Api::nestSum, () -> new Nest(tile(5, 6), n(2)), "5"), "nest inner at bound");
        check(refused(Api::nestSum, () -> new Nest(tile(4, 6), n(3)), "3"), "nest tag at bound");
        check(Api.nestSum(new Nest(tile(4, 6), n(2))).equals(n(210)), "nest recovery");
        // Late: heap fields precede the bound; a rejection leaves them as the caller built them.
        check(Api.lateSum(late(4)).equals(n(4005)), "late valid");
        check(refused(Api::lateSum, () -> late(5), "5"), "late at bound");
        check(Api.lateSum(late(4)).equals(n(4005)), "late recovery");
        // Slot: Option (Fin 0) is valid only when absent.
        check(Api.slotCount(new Slot(Option.none(), n(8))).equals(n(8)), "slot absent");
        check(refused(Api::slotCount, () -> new Slot(Option.some(n(0)), n(8)), "0"), "slot present");
        // Shape: only the active case is checked.
        check(Api.shapeSize(new ShapeCircle(n(9))).equals(n(9)), "circle valid");
        check(refused(Api::shapeSize, () -> (Shape) new ShapeCircle(n(10)), "10"), "circle at bound");
        check(Api.shapeSize(new ShapeLabel("abc")).equals(n(1003)), "label");
        check(Api.shapeSize(new ShapeEmpty()).equals(n(7)), "empty");
        // Gate: the never case holds Fin 0, so it is always rejected; the closed case is always valid.
        check(Api.gateOpen(new GateClosed()).equals(n(1)), "gate closed");
        check(refused(Api::gateOpen, () -> new GateNever(n(0)), "0"), "gate never");
        // Array Tile: every element; the empty array is valid.
        Tile[] tiles = row();
        check(Api.tiles(new Tile[0]).equals(n(0)), "tiles empty");
        check(Api.tiles(tiles).equals(n(8)), "tiles valid");
        for (int k = 0; k < 3; k++) {
            Tile kept = tiles[k];
            tiles[k] = tile(n(5), kept.count());
            Tile[] before = row();
            before[k] = tile(n(5), kept.count());
            check(rejected(() -> Api.tiles(tiles), "arg0", "5") && Objects.deepEquals(tiles, before), "tiles element " + k);
            tiles[k] = kept;
        }
        check(Api.tiles(tiles).equals(n(8)), "tiles recovery");
        // Option Shape: absent, a valid present circle, then an invalid one.
        check(Api.maybeShape(Option.none()).equals(n(99)), "maybe absent");
        check(Api.maybeShape(Option.some(new ShapeCircle(n(3)))).equals(n(3)), "maybe circle");
        check(refused(Api::maybeShape, () -> Option.<Shape>some(new ShapeCircle(n(10))), "10"), "maybe circle at bound");
        // Results carrying bounds are produced by Lean and arrive below them.
        check(Api.bump(tile(4, 9)).equals(tile(0, 10)), "bump");
        check(refused(Api::bump, () -> tile(5, 9), "5"), "bump at bound");
        check(Api.makeShape(n(4)).equals(new ShapeCircle(n(4))), "make circle");
        check(Api.makeShape(n(23)).equals(new ShapeLabel("23")), "make label");
        for (int i = 0; i < 1000; i++) {
            final int round = i;
            if (!Api.tileSum(tile(i % 5, i)).equals(n(i % 5 + i))) throw new AssertionError("round " + i + " failed");
            if (!refused(Api::tileSum, () -> tile(5 + round, round), "5")) throw new AssertionError("rejection round " + i + " failed");
        }
        checks += 2000;
        System.out.println("fin-record-ok:" + checks);
    }
}
