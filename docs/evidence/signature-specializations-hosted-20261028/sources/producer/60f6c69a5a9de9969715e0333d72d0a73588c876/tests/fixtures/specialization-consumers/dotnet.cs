using System;
using System.Linq;
using System.Numerics;
using LeanBridge.Specialized;
class Consumer {
    static int checks;
    static void Check(bool value) { if (!value) throw new Exception("Specialization mismatch"); ++checks; }
    static void Main() {
        // Each specialization is an ordinary concrete method; no generic method is exposed.
        Func<uint, uint> echoWord = Api.EchoWord;
        Func<string, string> echoText = Api.EchoText;
        Func<BigInteger, BigInteger> echoNat = Api.EchoNat;
        Func<bool, uint, uint> chooseWord = Api.ChooseWord;
        Func<string, uint, string> firstTextWord = Api.FirstTextWord;
        string greeting = "héllo \U0001F642";
        Check(echoWord(0) == 0 && echoWord(uint.MaxValue) == uint.MaxValue);
        Check(echoText(greeting) == greeting && echoText("") == "");
        BigInteger large = BigInteger.Pow(2, 200);
        Check(echoNat(large) == large);
        uint[] words = [0, 42, uint.MaxValue];
        Check(Api.EchoWords(words).SequenceEqual(words));
        foreach (var name in new[] { "Echo", "Choose", "First", "Duplicate" })
            Check(typeof(Api).GetMember(name).Length == 0);
        foreach (var method in typeof(Api).GetMethods())
            Check(!method.IsGenericMethod);
        // Lean resolved each instance dictionary at build time.
        Check(chooseWord(true, 5) == 5 && chooseWord(false, 5) == 37);
        Check(Api.ChooseText(true, greeting) == greeting && Api.ChooseText(false, greeting) == "");
        Check(Api.ChooseWords(true, words).SequenceEqual(words) && Api.ChooseWords(false, words).Length == 0);
        Check(Api.DoubleWord(2147483649) == 2);
        Check(Api.DoubleNat(BigInteger.Pow(2, 100)) == BigInteger.Pow(2, 101));
        Check(firstTextWord(greeting, 9) == greeting);
        Check(Api.Plain(1) == 4);
        for (uint i = 0; i < 1000; ++i) {
            Check(Api.ChooseWord(i % 2 == 0, i) == (i % 2 == 0 ? i : 37));
            Check(Api.DoubleWord(i) == 2 * i);
        }
        Console.WriteLine($"specialization-ok:{checks}");
    }
}
