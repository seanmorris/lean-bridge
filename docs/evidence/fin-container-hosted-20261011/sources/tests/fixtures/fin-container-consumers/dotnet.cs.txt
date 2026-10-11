using System;
using System.Linq;
using System.Numerics;
using LeanBridge.Fincontainers;
class Consumer {
    static int checks;
    static void Check(bool value, string label) { if (!value) throw new Exception("failed: " + label); ++checks; }
    static bool Rejected(Action action, string parameter, string bound) {
        try { action(); }
        catch (ArgumentOutOfRangeException) { return false; }
        catch (ArgumentException error) { return error.Message == parameter + " is not below its Fin " + bound + " bound"; }
        return false;
    }
    static bool Throws<T>(Action action) where T : Exception {
        try { action(); } catch (T) { return true; }
        return false;
    }
    static BigInteger N(long value) => new BigInteger(value);
    static void Main() {
        BigInteger huge = BigInteger.One << 70, word = BigInteger.One << 32;
        BigInteger[] digits = Enumerable.Range(0, 10).Select(i => N(i)).ToArray();
        // Array (Fin 10): every element is checked; results stay below the bound.
        Check(Api.MirrorAll(digits).SequenceEqual(digits.Reverse()), "mirror endpoints");
        Check(Api.MirrorAll([]).Length == 0, "empty array");
        for (int position = 0; position < 3; ++position) {
            BigInteger[] bad = [N(1), N(2), N(3)];
            bad[position] = N(10);
            Check(Rejected(() => Api.MirrorAll(bad), $"arg0[{position}]", "10"), "invalid element at " + position);
            Check(bad[position] == N(10), "input unchanged");
        }
        Check(Rejected(() => Api.MirrorAll([word, N(1), N(2)]), "arg0[0]", "10"), "word element");
        Check(Throws<ArgumentOutOfRangeException>(() => Api.MirrorAll([N(-1), N(1)])), "negative is the Nat error");
        Check(Throws<ArgumentNullException>(() => Api.MirrorAll(null!)), "null array is rejected");
        // Array (Fin 0): only the empty array has values.
        Check(Api.CountNone([]) == N(0), "Fin 0 empty");
        Check(Rejected(() => Api.CountNone([N(0)]), "arg0[0]", "0"), "Fin 0 present");
        // List Huge: a 2^70 bound compared limb by limb.
        Check(Api.SumHuge([word, huge - 1]) == word + huge - 1 && Api.SumHuge([]) == N(0), "huge sums");
        Check(Rejected(() => Api.SumHuge([word, huge]), "arg0[1]", huge.ToString()), "huge bound");
        // Option (Fin 1): none is valid; a present value is checked.
        Check(Api.OrDefault(Option<BigInteger>.None) == N(7) && Api.OrDefault(Option<BigInteger>.Some(N(0))) == N(0), "option values");
        Check(Rejected(() => Api.OrDefault(Option<BigInteger>.Some(N(1))), "arg0?", "1"), "present Fin 1");
        // Array (Option Digit): only present elements are checked.
        Option<BigInteger>[] mixed = [Option<BigInteger>.Some(N(1)), Option<BigInteger>.None, Option<BigInteger>.Some(N(9))];
        Check(Api.Present(mixed).SequenceEqual([N(1), N(9)]), "present digits");
        mixed[2] = Option<BigInteger>.Some(N(10));
        Check(Rejected(() => Api.Present(mixed), "arg0[2]?", "10"), "present invalid");
        mixed[2] = Option<BigInteger>.None;
        Check(Api.Present(mixed).Length == 1, "absent is never read");
        // List (Array Digit) -> Option (List Digit): nested rows.
        BigInteger[][] rows = [[N(1), N(2)], [N(3)]];
        var flat = Api.Flatten(rows);
        Check(flat.IsSome && flat.Value.SequenceEqual([N(1), N(2), N(3)]), "flatten rows");
        Check(!Api.Flatten([]).IsSome, "no rows");
        rows[1][0] = N(10);
        Check(Rejected(() => Api.Flatten(rows), "arg0[1][0]", "10"), "nested invalid last");
        // A late refined argument after an unrefined one.
        string[] names = ["a", "b"];
        Check(Api.Label(names, [N(1), N(3)]) == "a:1,b:3", "label");
        Check(Rejected(() => Api.Label(names, [N(1), N(4)]), "arg1[1]", "4") && names[1] == "b", "late argument, caller data unchanged");
        // A result-only container refinement projects each element after Lean returns.
        Check(Api.WrapAll([N(100), huge]).SequenceEqual([N(2), N(2)]) && Api.WrapAll([]).Length == 0, "wrapped results");
        for (int i = 0; i < 1000; ++i) {
            int k = i;
            if (!Rejected(() => Api.MirrorAll([N(10 + k % 5)]), "arg0[0]", "10")) throw new Exception("invalid call accepted at " + i);
            if (Api.MirrorAll([N(i % 10)])[0] != N(9 - i % 10)) throw new Exception("valid call failed at " + i);
        }
        checks += 2000;
        Console.WriteLine($"fin-container-ok:{checks}");
    }
}
