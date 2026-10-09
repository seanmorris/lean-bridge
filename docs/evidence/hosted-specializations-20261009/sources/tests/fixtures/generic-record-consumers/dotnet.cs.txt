using System;
using System.Numerics;
using LeanBridge.Genericrecords;
class Consumer {
    static int checks;
    static void Check(bool value) { if (!value) throw new Exception("Generic record mismatch"); ++checks; }
    static bool Rejected(Action call) {
        try { call(); } catch (Exception error) when (error is ArgumentException or NullReferenceException) { return true; }
        return false;
    }
    static void Main() {
        // Each alias is its own sealed record with the structure's fields instantiated; Nat fields are BigInteger.
        var box = new NatBox(4, 1);
        var bumped = Api.Bump(box);
        Check(bumped == new NatBox(5, 2) && box.Value == 4 && !ReferenceEquals(bumped, box));
        Check(Api.Again(new NatBoxAgain(4, 1)) == new NatBoxAgain(8, 1));
        // Two aliases of one application are two distinct types with the same layout.
        Check(typeof(NatBox) != typeof(NatBoxAgain));
        Func<NatBox, NatBox> bump = Api.Bump;
        Func<NatBoxAgain, NatBoxAgain> again = Api.Again;
        string greeting = "héllo \U0001F642";
        Check(Api.Shout(new TextBox(greeting, 3)) == new TextBox(greeting + "!", 3));
        Check(Api.SwapNamed(new WordPair("a", 1)) == new WordPair("a!", 2));
        // A parameter instantiated with Option Nat and a List of a named instantiation.
        Check(Api.OrZero(new MaybeBox(Option<BigInteger>.Some(5), 2)) == 7);
        Check(Api.OrZero(new MaybeBox(Option<BigInteger>.None, 2)) == 2);
        BigInteger huge = BigInteger.Pow(2, 70);
        NatBox[] boxes = [new NatBox(1, 0), new NatBox(2, 0), new NatBox(huge, 0)];
        Check(Api.Total(boxes) == huge + 3 && Api.Total([]) == 0);
        Option<NatBox[]> first = Api.FirstBoxes(2);
        Check(first.IsSome && first.Value.Length == 2 && first.Value[1] == new NatBox(1, 2));
        Check(!Api.FirstBoxes(0).IsSome);
        // A pair of two named instantiations.
        Check(Api.Unpair(new BoxPair(new NatBox(3, 0), new TextBox("abcd", 0))) == 7);
        // A universe-polymorphic structure instantiated at Type.
        Check(Api.Retag(new TaggedNat("t", 1)) == new TaggedNat("t#", 2));
        // A phantom argument: the instantiation names Marker, which no field carries.
        Check(Api.Relabel(new MarkerTag("m")) == new MarkerTag("m?"));
        // Null records and negative Nat fields fail before Lean runs.
        Check(Rejected(() => bump(null!)));
        Check(Rejected(() => bump(new NatBox(-1, 1))));
        Check(Rejected(() => Api.Unpair(new BoxPair(null!, new TextBox("x", 0)))));
        Check(Rejected(() => Api.Shout(new TextBox(null!, 0))));
        Check(Rejected(() => Api.Total([new NatBox(1, 0), null!])));
        for (int i = 0; i < 1000; ++i) {
            var round = bump(new NatBox(i, i));
            if (round != new NatBox(i + 1, i + 1)) throw new Exception($"round {i} failed");
        }
        checks += 1000;
        _ = again;
        Console.WriteLine($"generic-records-ok:{checks}");
    }
}
