using System;
using System.Collections;
using System.Numerics;
using LeanBridge.Finrecords;
class Consumer {
    static int checks;
    static void Check(bool value, string label) { if (!value) throw new Exception("failed: " + label); ++checks; }
    // A rejected call names the parameter and the failed leaf's bound.
    static bool Rejected(Action action, string parameter, string bound) {
        try { action(); }
        catch (ArgumentOutOfRangeException) { return false; }
        catch (ArgumentException error) { return error.Message == parameter + " is not below its Fin " + bound + " bound"; }
        return false;
    }
    static bool Same(object? value, object? expected) => StructuralComparisons.StructuralEqualityComparer.Equals(value, expected);
    // The input and an independently built snapshot exist before the call; they are compared
    // immediately after the rejection, before the caller changes anything back.
    static bool Refused<T>(Func<T, object> call, Func<T> build, string bound) {
        T input = build(), before = build();
        return Rejected(() => call(input), "arg0", bound) && Same(input, before);
    }
    static BigInteger N(long value) => new BigInteger(value);
    static Tile Piece(BigInteger digit, BigInteger count) => new(digit, count);
    static Late L(long digit) => new("ab", [N(1), N(2)], N(digit));
    static Tile[] Row() => [Piece(0, 1), Piece(4, 2), Piece(1, 0)];
    static void Main() {
        BigInteger huge = BigInteger.One << 100;
        // Tile: the digit is Fin 5; any count is valid.
        for (int d = 0; d < 5; ++d) Check(Api.TileSum(Piece(d, 10)) == d + 10, "tile valid");
        Check(Api.TileSum(Piece(3, huge)) == huge + 3, "unbounded count");
        Check(Refused(v => Api.TileSum(v), () => Piece(5, huge), "5"), "tile at bound");
        Check(Refused(v => Api.TileSum(v), () => Piece(BigInteger.One << 70, huge), "5"), "tile beyond 64 bits");
        // Nest: the inner record's own bound and the outer bound are both checked.
        Check(Api.NestSum(new Nest(Piece(4, 6), 2)) == 210, "nest valid");
        Check(Refused(v => Api.NestSum(v), () => new Nest(Piece(5, 6), 2), "5"), "nest inner at bound");
        Check(Refused(v => Api.NestSum(v), () => new Nest(Piece(4, 6), 3), "3"), "nest tag at bound");
        Check(Api.NestSum(new Nest(Piece(4, 6), 2)) == 210, "nest recovery");
        // Late: heap fields precede the bound; a rejection leaves them as the caller built them.
        Check(Api.LateSum(L(4)) == 4005, "late valid");
        Check(Refused(v => Api.LateSum(v), () => L(5), "5"), "late at bound");
        Check(Api.LateSum(L(4)) == 4005, "late recovery");
        // Slot: Option (Fin 0) is valid only when absent.
        Check(Api.SlotCount(new Slot(Option<BigInteger>.None, 8)) == 8, "slot absent");
        Check(Refused(v => Api.SlotCount(v), () => new Slot(Option<BigInteger>.Some(0), 8), "0"), "slot present");
        // Shape: only the active case is checked.
        Check(Api.ShapeSize(new ShapeCircle(9)) == 9, "circle valid");
        Check(Refused<Shape>(v => Api.ShapeSize(v), () => new ShapeCircle(10), "10"), "circle at bound");
        Check(Api.ShapeSize(new ShapeLabel("abc")) == 1003, "label");
        Check(Api.ShapeSize(new ShapeEmpty()) == 7, "empty");
        // Gate: the never case holds Fin 0, so it is always rejected; the closed case is always valid.
        Check(Api.GateOpen(new GateClosed()) == 1, "gate closed");
        Check(Refused<Gate>(v => Api.GateOpen(v), () => new GateNever(0), "0"), "gate never");
        // Array Tile: every element; the empty array is valid.
        Tile[] tiles = Row();
        Check(Api.Tiles([]) == 0, "tiles empty");
        Check(Api.Tiles(tiles) == 8, "tiles valid");
        for (int k = 0; k < 3; ++k) {
            Tile kept = tiles[k];
            tiles[k] = Piece(5, kept.Count);
            Tile[] before = Row();
            before[k] = Piece(5, kept.Count);
            Check(Rejected(() => Api.Tiles(tiles), "arg0", "5") && Same(tiles, before), $"tiles element {k}");
            tiles[k] = kept;
        }
        Check(Api.Tiles(tiles) == 8, "tiles recovery");
        // Option Shape: absent, a valid present circle, then an invalid one.
        Check(Api.MaybeShape(Option<Shape>.None) == 99, "maybe absent");
        Check(Api.MaybeShape(Option<Shape>.Some(new ShapeCircle(3))) == 3, "maybe circle");
        Check(Refused(v => Api.MaybeShape(v), () => Option<Shape>.Some(new ShapeCircle(10)), "10"), "maybe circle at bound");
        // Results carrying bounds are produced by Lean and arrive below them.
        Check(Api.Bump(Piece(4, 9)).Equals(Piece(0, 10)), "bump");
        Check(Refused(v => Api.Bump(v), () => Piece(5, 9), "5"), "bump at bound");
        Check(Api.MakeShape(4).Equals(new ShapeCircle(4)), "make circle");
        Check(Api.MakeShape(23).Equals(new ShapeLabel("23")), "make label");
        for (int i = 0; i < 1000; ++i) {
            if (Api.TileSum(Piece(i % 5, i)) != i % 5 + i) throw new Exception($"round {i} failed");
            int round = i;
            if (!Refused(v => Api.TileSum(v), () => Piece(5 + round, round), "5")) throw new Exception($"rejection round {i} failed");
        }
        checks += 2000;
        Console.WriteLine($"fin-record-ok:{checks}");
    }
}
