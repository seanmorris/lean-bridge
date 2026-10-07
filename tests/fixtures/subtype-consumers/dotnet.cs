using System;
using System.Numerics;
using System.Text;
using LeanBridge.Subtypes;
class Consumer {
    static int checks;
    static void Check(bool value, string label) { if (!value) throw new Exception("failed: " + label); ++checks; }
    static bool Rejected(Action action, string message) {
        try { action(); }
        catch (ArgumentOutOfRangeException) { return false; }
        catch (ArgumentException error) { return error.Message == message; }
        return false;
    }
    static bool Throws<T>(Action action) where T : Exception {
        try { action(); } catch (T) { return true; }
        return false;
    }
    static BigInteger N(long value) => new BigInteger(value);
    static void Main() {
        string hello = "héllo \U0001F642";
        // Nonempty String: Unicode and embedded NUL are ordinary payloads; the empty string is rejected.
        Check(Api.Shout(hello) == hello + "!" && Api.Shout("a\0b") == "a\0b!", "shout");
        Check(Rejected(() => Api.Shout(""), "arg0 was rejected by Subtypes.checkedWord"), "empty word");
        Check(Throws<ArgumentNullException>(() => Api.Shout(null!)), "null is rejected");
        // Even Nat beyond 64 bits.
        Check(Api.Half(N(42)) == N(21) && Api.Half(BigInteger.One << 100) == BigInteger.One << 99, "half");
        Check(Rejected(() => Api.Half(N(7)), "arg0 was rejected by Subtypes.checkedEven"), "odd");
        Check(Throws<ArgumentOutOfRangeException>(() => Api.Half(N(-2))), "negative is the Nat error");
        // Small Int after an unchecked argument.
        Check(Api.Scale(N(-3), N(-128)) == N(384) && Api.Scale(N(-3), N(127)) == N(-381), "scale");
        Check(Rejected(() => Api.Scale(N(-3), N(128)), "arg1 was rejected by Subtypes.checkedSmall") && Rejected(() => Api.Scale(N(-3), N(-129)), "arg1 was rejected by Subtypes.checkedSmall"), "late rejection");
        // Nonempty ByteArray.
        Check(Api.Head(new byte[] { 0, 255 }) == 0, "head");
        Check(Rejected(() => Api.Head(Array.Empty<byte>()), "arg0 was rejected by Subtypes.checkedPayload"), "empty payload");
        // A result-only subtype and two checked arguments.
        Check(Api.Pad(N(21)) == N(42) && Api.Join("ab", "cd") == "abcd", "pad and join");
        Check(Rejected(() => Api.Join("ab", ""), "arg1 was rejected by Subtypes.checkedWord") && Rejected(() => Api.Join("", "cd"), "arg0 was rejected by Subtypes.checkedWord"), "join rejections");
        // A normalizing constructor: the export sees the constructed value.
        Check(Api.Clamp(N(250)) == N(100) && Api.Clamp(N(7)) == N(7), "clamp");
        // A checked constructor beside a Fin bound: the Fin precheck runs first.
        Check(Api.Mix(N(4), N(3)) == N(7), "mix");
        Check(Rejected(() => Api.Mix(N(4), N(10)), "arg1 is not below its Fin 10 bound") && Rejected(() => Api.Mix(N(5), N(10)), "arg1 is not below its Fin 10 bound"), "Fin before the constructor");
        Check(Rejected(() => Api.Mix(N(5), N(3)), "arg0 was rejected by Subtypes.checkedEven"), "odd beside a valid digit");
        for (int i = 0; i < 1000; ++i) {
            int k = i;
            if (!Rejected(() => Api.Half(N(2 * k + 1)), "arg0 was rejected by Subtypes.checkedEven")) throw new Exception("invalid call accepted at " + i);
            if (Api.Half(N(2 * i)) != N(i)) throw new Exception("valid call failed at " + i);
        }
        checks += 2000;
        Console.WriteLine($"subtype-ok:{checks}");
    }
}
