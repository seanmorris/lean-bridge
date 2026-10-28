using System;
using System.Numerics;
using System.Text;
using LeanBridge.Defaults;

static class Consumer
{
    private static int checks;

    private static void Check(bool condition)
    {
        if (!condition) throw new InvalidOperationException("Optional-parameter mismatch");
        ++checks;
    }

    static int Main()
    {
        Check(Api.Word() == 7u);
        Check(Api.Word(7u) == 7u);
        Check(Api.Word(11u) == 11u);

        var large = BigInteger.Parse("184467440737095516160");
        Check(Api.Natural() == large);
        Check(Api.Natural(large) == large);
        Check(Api.Natural(new BigInteger(11)) == new BigInteger(11));

        Check(Api.Text() == "Lean\nBridge");
        Check(Api.Text("Lean\nBridge") == "Lean\nBridge");
        Check(Api.Text("other") == "other");

        Check(Api.Character() == new Rune('λ'));
        Check(Api.Character(new Rune('λ')) == new Rune('λ'));
        Check(Api.Character(new Rune('猫')) == new Rune('猫'));

        Check(Api.Maybe() == Option<uint>.None);
        Check(Api.Maybe(Option<uint>.None) == Option<uint>.None);
        Check(Api.Maybe(Option<uint>.Some(11u)) == Option<uint>.Some(11u));

        Check(Api.Present() == Option<uint>.Some(9u));
        Check(Api.Present(Option<uint>.Some(9u)) == Option<uint>.Some(9u));
        Check(Api.Present(Option<uint>.None) == Option<uint>.None);
        Check(Api.Present(Option<uint>.Some(11u)) == Option<uint>.Some(11u));

        Api.UnitValue();
        Check(true);
        Api.UnitValue(default(Unit));
        Check(true);

        Console.WriteLine($"optional-parameter-dotnet:{checks}");
        return 0;
    }
}
