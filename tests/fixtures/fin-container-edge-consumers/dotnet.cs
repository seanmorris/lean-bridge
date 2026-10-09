        // All original checks precede this zero-bound and nested-position supplement.
        int edgeBefore = checks;
        Check(Api.EmptyArray([]).Length == 0, "Fin 0 array round trip");
        Check(Api.EmptyList([]).Length == 0, "Fin 0 list round trip");
        Check(!Api.EmptyOption(Option<BigInteger>.None).IsSome, "Fin 0 none round trip");
        foreach (BigInteger value in new[] { N(0), N(1), huge }) {
            BigInteger[] input = [value];
            var option = Option<BigInteger>.Some(value);
            Check(Rejected(() => Api.EmptyArray(input), "arg0", "0"), "Fin 0 nonempty array");
            Check(Rejected(() => Api.EmptyList(input), "arg0", "0"), "Fin 0 nonempty list");
            Check(Rejected(() => Api.EmptyOption(option), "arg0", "0"), "Fin 0 some");
            Check(input.SequenceEqual([value]) && option.IsSome && option.Value == value, "Fin 0 inputs unchanged");
        }
        Check(!Api.OptionalDigits(Option<BigInteger[]>.None).IsSome, "optional list absent");
        var edgeEmpty = Api.OptionalDigits(Option<BigInteger[]>.Some([]));
        Check(edgeEmpty.IsSome && edgeEmpty.Value.Length == 0, "optional list present empty");
        Check(Api.OptionalDigits(Option<BigInteger[]>.Some([N(0), N(9)])).Value.SequenceEqual([N(0), N(9)]), "optional list endpoints");
        for (int position = 0; position < 3; ++position) {
            BigInteger[] values = [N(1), N(2), N(3)];
            values[position] = N(10);
            var snapshot = values.ToArray();
            var options = values.Select(Option<BigInteger>.Some).ToArray();
            Check(Rejected(() => Api.Present(options), "arg0", "10"), "nested option invalid position");
            Check(options.All(value => value.IsSome) && options.Select(value => value.Value).SequenceEqual(snapshot), "nested options unchanged");
            Check(Rejected(() => Api.OptionalDigits(Option<BigInteger[]>.Some(values)), "arg0", "10"), "optional list invalid position");
            Check(values.SequenceEqual(snapshot), "optional list unchanged");
            for (int column = 0; column < 3; ++column) {
                BigInteger[][] table = [[N(1), N(2), N(3)], [N(4), N(5), N(6)], [N(7), N(8), N(9)]];
                table[position][column] = N(10);
                var before = table.Select(row => row.ToArray()).ToArray();
                Check(Rejected(() => Api.Flatten(table), "arg0", "10"), "nested row and member positions");
                Check(table.Zip(before).All(pair => pair.First.SequenceEqual(pair.Second)), "nested rows unchanged");
            }
        }
        Check(Api.Present([Option<BigInteger>.None, Option<BigInteger>.None, Option<BigInteger>.None]).Length == 0, "absent options");
        var edgeRows = Api.Flatten([[], [], []]);
        Check(edgeRows.IsSome && edgeRows.Value.Length == 0, "present empty rows");
        Check(Throws<ArgumentNullException>(() => Api.EmptyArray(null!)), "null Array");
        Check(Throws<ArgumentNullException>(() => Api.EmptyList(null!)), "null List");
        Check(Throws<ArgumentNullException>(() => Api.OptionalDigits(Option<BigInteger[]>.Some(null!))), "present null List");
        bool EdgeNegative(Action action) {
            try { action(); }
            catch (ArgumentOutOfRangeException error) {
                return error.GetType() == typeof(ArgumentOutOfRangeException) && error.ParamName == "value"
                    && error.Message == new ArgumentOutOfRangeException("value", "Lean Nat cannot be negative").Message;
            }
            return false;
        }
        Check(EdgeNegative(() => Api.EmptyArray([N(-1)])), "negative Fin 0 Array is Nat error");
        Check(EdgeNegative(() => Api.EmptyList([N(-1)])), "negative Fin 0 List is Nat error");
        Check(EdgeNegative(() => Api.EmptyOption(Option<BigInteger>.Some(N(-1)))), "negative Fin 0 Option is Nat error");
        for (int position = 0; position < 3; ++position) {
            BigInteger[] values = [N(1), N(2), N(3)];
            values[position] = N(-1);
            var before = values.ToArray();
            Check(EdgeNegative(() => Api.OptionalDigits(Option<BigInteger[]>.Some(values))), "negative nested Nat");
            Check(values.SequenceEqual(before), "negative input unchanged");
        }
        for (int cycle = 0; cycle < 1000; ++cycle) {
            Check(Rejected(() => Api.EmptyArray([N(0)]), "arg0", "0"), "cycle invalid Array");
            Check(Api.EmptyArray([]).Length == 0, "cycle valid Array");
            Check(Rejected(() => Api.EmptyList([N(0)]), "arg0", "0"), "cycle invalid List");
            Check(Api.EmptyList([]).Length == 0, "cycle valid List");
            Check(Rejected(() => Api.EmptyOption(Option<BigInteger>.Some(N(0))), "arg0", "0"), "cycle invalid Option");
            Check(!Api.EmptyOption(Option<BigInteger>.None).IsSome, "cycle valid Option");
            Check(Rejected(() => Api.Present([Option<BigInteger>.Some(N(1)), Option<BigInteger>.Some(N(10)), Option<BigInteger>.None]), "arg0", "10"), "cycle invalid nested option");
            Check(Api.Present([Option<BigInteger>.Some(N(1)), Option<BigInteger>.None, Option<BigInteger>.Some(N(9))]).SequenceEqual([N(1), N(9)]), "cycle valid nested option");
            Check(Rejected(() => Api.Flatten([[N(1)], [N(10)], [N(9)]]), "arg0", "10"), "cycle invalid nested rows");
            Check(Api.Flatten([[N(1)], [], [N(9)]]).Value.SequenceEqual([N(1), N(9)]), "cycle valid nested rows");
            Check(Rejected(() => Api.OptionalDigits(Option<BigInteger[]>.Some([N(1), N(10), N(9)])), "arg0", "10"), "cycle invalid optional list");
            Check(Api.OptionalDigits(Option<BigInteger[]>.Some([N(1), N(9)])).Value.SequenceEqual([N(1), N(9)]), "cycle valid optional list");
        }
        Check(checks - edgeBefore == 12062, "exact edge assertion coverage");
