using System;
using System.Linq;
using System.Numerics;
using LeanBridge.Finproductarrays;
class Consumer {
    static int checks;
    static void Check(bool value, string label) { if (!value) throw new Exception("failed: " + label); ++checks; }
    static bool Rejected(Action action, string parameter, string bound) {
        try { action(); }
        catch (ArgumentOutOfRangeException) { return false; }
        catch (ArgumentException error) { return error.Message == parameter + " is not below its Fin " + bound + " bound"; }
        return false;
    }
    static BigInteger N(long value) => new BigInteger(value);
    static readonly BigInteger Huge = BigInteger.One << 100;
    // (0, ok 2^100), (2, error 5), (3, ok 6): both endpoints, and ok values no bound applies to.
    static (BigInteger, Result<BigInteger, BigInteger>)[] Valid() => [
        (N(0), Result<BigInteger, BigInteger>.Ok(Huge)), (N(2), Result<BigInteger, BigInteger>.Err(5)), (N(3), Result<BigInteger, BigInteger>.Ok(6))];
    static void Main() {
        BigInteger expected = Huge + 1016;
        // An empty array is valid, in and out.
        Check(Api.Rows([]) == 0, "empty rows");
        Check(Api.Reversed([]).Length == 0, "empty reversed");
        var rows = Valid();
        Check(Api.Rows(rows) == expected, "valid rows");
        // A component at its bound is rejected in the first, middle and last element.
        for (int k = 0; k < 3; ++k) {
            rows[k].Item1 = 4;
            var before = rows.ToArray();
            Check(Rejected(() => Api.Rows(rows), "arg0", "4") && rows.SequenceEqual(before), $"component at {k}");
            rows[k].Item1 = Valid()[k].Item1;
        }
        // The active error branch is bounded: error 6 is rejected, while ok 6 in the last row passed above.
        rows[1].Item2 = Result<BigInteger, BigInteger>.Err(6);
        var snapshot = rows.ToArray();
        Check(Rejected(() => Api.Rows(rows), "arg0", "6") && rows.SequenceEqual(snapshot), "error branch at bound");
        rows[1].Item2 = Result<BigInteger, BigInteger>.Err(5);
        // A valid call recovers.
        Check(rows.SequenceEqual(Valid()), "caller rows unchanged");
        Check(Api.Rows(rows) == expected, "recovery");
        // Lean returns the rows reversed, each below its bounds.
        Check(Api.Reversed(rows).SequenceEqual(Valid().Reverse()), "reversed");
        for (int i = 0; i < 1000; ++i) {
            if (Api.Rows(rows) != expected) throw new Exception($"round {i} failed");
            rows[2].Item1 = 4 + i;
            if (!Rejected(() => Api.Rows(rows), "arg0", "4") || rows[2].Item1 != 4 + i) throw new Exception($"rejection round {i} failed");
            rows[2].Item1 = 3;
        }
        checks += 2000;
        Console.WriteLine($"fin-product-array-ok:{checks}");
    }
}
