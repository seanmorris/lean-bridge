using System;
using System.Numerics;
using LeanBridge.Finproducts;
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
    static void Main() {
        BigInteger wide = (N(10) << 64) + 10;
        // Fin 10 × Nat: only the first component is bounded.
        for (int d = 0; d < 10; ++d) Check(Api.First((N(d), N(1000))) == (N(9 - d), N(1001)), "first valid");
        Check(Rejected(() => Api.First((N(10), N(0))), "arg0.0", "10"), "first at bound");
        Check(Rejected(() => Api.First((BigInteger.One << 70, N(0))), "arg0.0", "10"), "first beyond 64 bits");
        Check(Api.First((N(3), BigInteger.One << 200)) == (N(6), (BigInteger.One << 200) + 1), "unbounded component");
        // Nat × Fin 1, and a bound wider than 64 bits beside Fin 10.
        Check(Api.Second((N(41), N(0))) == 41, "second valid");
        Check(Rejected(() => Api.Second((N(41), N(1))), "arg0.1", "1"), "second at bound");
        Check(Api.Wide((wide - 1, N(9))) == wide + 8, "wide valid");
        Check(Rejected(() => Api.Wide((wide, N(9))), "arg0.0", wide.ToString()), "wide at bound");
        Check(Rejected(() => Api.Wide((wide - 1, N(10))), "arg0.1", "10"), "wide second at bound");
        // Option (Fin 0 × Nat): only none is valid.
        Check(Api.AbsentOnly(Option<(BigInteger, BigInteger)>.None) == 7, "absent only none");
        Check(Rejected(() => Api.AbsentOnly(Option<(BigInteger, BigInteger)>.Some((N(0), N(0)))), "arg0?.0", "0"), "absent only some");
        // Except String (Fin 10): the ok branch is bounded; an inactive branch is never read.
        Check(Api.OkOnly(Result<BigInteger, string>.Ok(9)) == 9, "ok valid");
        Check(Rejected(() => Api.OkOnly(Result<BigInteger, string>.Ok(10)), "arg0.ok", "10"), "ok at bound");
        Check(Api.OkOnly(Result<BigInteger, string>.Err("four")) == 104, "inactive ok");
        // Except (Fin 5) Nat: the error branch is bounded; any ok Nat is valid.
        Check(Api.ErrorOnly(Result<BigInteger, BigInteger>.Ok(BigInteger.One << 100)) == BigInteger.One << 100, "unbounded ok");
        Check(Api.ErrorOnly(Result<BigInteger, BigInteger>.Err(4)) == 104, "error valid");
        Check(Rejected(() => Api.ErrorOnly(Result<BigInteger, BigInteger>.Err(5)), "arg0.error", "5"), "error at bound");
        // Except (Fin 3) (Fin 7): only the active branch is checked.
        Check(Api.Both(Result<BigInteger, BigInteger>.Ok(6)) == 6, "both ok valid");
        Check(Rejected(() => Api.Both(Result<BigInteger, BigInteger>.Ok(7)), "arg0.ok", "7"), "both ok at bound");
        Check(Api.Both(Result<BigInteger, BigInteger>.Err(2)) == 102, "both error valid");
        Check(Rejected(() => Api.Both(Result<BigInteger, BigInteger>.Err(3)), "arg0.error", "3"), "both error at bound");
        // List (Option (Fin 3 × Except (Fin 2) Nat)): every present element, both levels.
        Option<(BigInteger, Result<BigInteger, BigInteger>)>[] Rows(long a, long b) => [
            Option<(BigInteger, Result<BigInteger, BigInteger>)>.None
            , Option<(BigInteger, Result<BigInteger, BigInteger>)>.Some((N(a), Result<BigInteger, BigInteger>.Ok(50)))
            , Option<(BigInteger, Result<BigInteger, BigInteger>)>.Some((N(1), Result<BigInteger, BigInteger>.Err(b)))];
        Check(Api.Nested(Rows(2, 1)) == 54, "nested valid");
        Check(Rejected(() => Api.Nested(Rows(2, 2)), "arg0[2]?.1.error", "2"), "nested branch");
        Check(Rejected(() => Api.Nested(Rows(3, 1)), "arg0[1]?.0", "3"), "nested component");
        Check(Api.Nested(Rows(2, 1)) == 54, "nested recovery");
        // DigitPair := Digit × Digit through the alias.
        Check(Api.Aliased((N(1), N(9))) == (N(9), N(1)), "aliased valid");
        Check(Rejected(() => Api.Aliased((N(1), N(10))), "arg0.1", "10"), "aliased at bound");
        // Results carrying bounds are produced by Lean and arrive below them.
        var produced = Api.Produce(4);
        Check(!produced.IsOk && produced.Error == 4, "produce error");
        Check(Api.Produce(23).IsOk, "produce ok");
        Check(Api.PairUp(23) == (N(3), N(23)), "pair up");
        for (int i = 0; i < 1000; ++i) {
            if (Api.First((N(i % 10), N(i))).Item1 != 9 - i % 10) throw new Exception($"round {i} failed");
            if (!Rejected(() => Api.First((N(10 + i), N(i))), "arg0.0", "10")) throw new Exception($"rejection round {i} failed");
        }
        checks += 2000;
        Console.WriteLine($"fin-product-ok:{checks}");
    }
}
