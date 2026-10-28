using System;
using System.Numerics;
using LeanBridge.Dependentfin;
class Consumer {
    static int checks;
    static void Check(bool value, string label) { if (!value) throw new Exception("failed: " + label); ++checks; }
    static bool Rejected(Action action, string parameter, string bound) {
        try { action(); }
        catch (ArgumentOutOfRangeException) { return false; }
        catch (ArgumentException error) { return error.Message == parameter + " is not below its dependent Fin bound " + bound; }
        return false;
    }
    static bool Throws<T>(Action action) where T : Exception {
        try { action(); } catch (T) { return true; }
        return false;
    }
    static BigInteger N(long value) => new BigInteger(value);
    static void Main() {
        BigInteger huge = BigInteger.One << 70, word = BigInteger.One << 32;
        // Fin 0: the live bound zero has no values.
        Check(Rejected(() => Api.Mirror(N(0), N(0)), "arg1", "arg0"), "Fin 0 rejects zero");
        Check(Rejected(() => Api.Mirror(N(0), N(1)), "arg1", "arg0"), "Fin 0 rejects one");
        // Fin 1: only zero.
        Check(Api.Mirror(N(1), N(0)) == N(0), "Fin 1 accepts zero");
        Check(Rejected(() => Api.Mirror(N(1), N(1)), "arg1", "arg0"), "Fin 1 rejects its bound");
        // The exact endpoints of a small live bound.
        Check(Api.Mirror(N(10), N(0)) == N(9) && Api.Mirror(N(10), N(9)) == N(0), "Fin 10 endpoints");
        foreach (var value in new[] { N(10), N(11), word, huge })
            Check(Rejected(() => Api.Mirror(N(10), value), "arg1", "arg0"), "Fin 10 rejects " + value);
        // Live bounds wider than a machine word are compared limb by limb.
        Check(Api.Mirror(word, word - 1) == N(0) && Api.Mirror(word + 1, word) == N(0), "word bounds");
        Check(Rejected(() => Api.Mirror(word, word), "arg1", "arg0"), "word bound rejects itself");
        Check(Api.Mirror(huge, huge - 1) == N(0) && Api.Mirror(huge, N(0)) == huge - 1, "huge endpoints");
        Check(Api.Mirror(huge + 1, huge) == N(0), "one past a huge bound");
        foreach (var value in new[] { huge, huge + 1, BigInteger.One << 128 })
            Check(Rejected(() => Api.Mirror(huge, value), "arg1", "arg0"), "huge bound rejects " + value);
        // The bound is the argument of this call, never a frozen constant.
        for (int bound = 0; bound < 12; ++bound) {
            int live = bound;
            if (live > 5) Check(Api.Mirror(N(live), N(5)) == N(live - 6), "value 5 below live bound " + live);
            else Check(Rejected(() => Api.Mirror(N(live), N(5)), "arg1", "arg0"), "value 5 at or above live bound " + live);
        }
        // Only the named earlier parameter bounds the value, not an unrelated earlier Nat.
        Check(Api.Label(N(100), N(3), N(2), "slot") == "slot:102", "later dependency");
        Check(Rejected(() => Api.Label(N(100), N(3), N(3), "slot"), "arg2", "arg1"), "bound is arg1, not the larger arg0");
        Check(Rejected(() => Api.Label(N(100), N(0), N(0), "slot"), "arg2", "arg1"), "Fin 0 at a later site");
        Check(Api.Label(N(0), huge, huge - 1, "x") == "x:" + (huge - 1), "huge later bound");
        // A negative Nat is the Nat ArgumentOutOfRangeException, not a dependent Fin rejection.
        Check(Throws<ArgumentOutOfRangeException>(() => Api.Mirror(N(-1), N(0))), "negative bound");
        Check(Throws<ArgumentOutOfRangeException>(() => Api.Mirror(N(5), N(-1))), "negative value");
        // Rejection leaves caller data unchanged.
        BigInteger start = 7, limit = 4, digit = 4; string name = "slot";
        Check(Rejected(() => Api.Label(start, limit, digit, name), "arg2", "arg1"), "rejected label");
        Check(start == 7 && limit == 4 && digit == 4 && name == "slot" && Api.Label(start, limit, N(3), name) == "slot:10", "caller data unchanged");
        // Repeated invalid and valid calls recover; the bound changes every call.
        for (int i = 0; i < 1000; ++i) {
            int k = i;
            if (!Rejected(() => Api.Mirror(N(10), N(10 + k % 5)), "arg1", "arg0")) throw new Exception("invalid call accepted at " + i);
            if (Api.Mirror(N(i % 7 + 1), N(i % 7)) != N(0) || Api.Mirror(N(10), N(i % 10)) != N(9 - i % 10)) throw new Exception("valid call failed at " + i);
        }
        checks += 2000;
        Console.WriteLine($"dependent-fin-ok:{checks}");
    }
}
