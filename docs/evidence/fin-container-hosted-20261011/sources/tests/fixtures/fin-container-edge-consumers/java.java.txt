        // All original checks precede this zero-bound and nested-position supplement.
        int edgeBefore = checks;
        check(Api.emptyArray(new BigInteger[0]).length == 0, "Fin 0 array round trip");
        check(Api.emptyList(new BigInteger[0]).length == 0, "Fin 0 list round trip");
        check(!Api.emptyOption(Option.none()).isSome(), "Fin 0 none round trip");
        for (BigInteger value : new BigInteger[]{n(0), n(1), huge}) {
            BigInteger[] input = {value};
            Option<BigInteger> option = Option.some(value);
            check(rejected(() -> Api.emptyArray(input), "arg0[0]", "0"), "Fin 0 nonempty array");
            check(rejected(() -> Api.emptyList(input), "arg0[0]", "0"), "Fin 0 nonempty list");
            check(rejected(() -> Api.emptyOption(option), "arg0?", "0"), "Fin 0 some");
            check(Arrays.equals(input, new BigInteger[]{value}) && option.isSome() && option.value().equals(value), "Fin 0 inputs unchanged");
        }
        check(!Api.optionalDigits(Option.none()).isSome(), "optional list absent");
        Option<BigInteger[]> edgeEmpty = Api.optionalDigits(Option.some(new BigInteger[0]));
        check(edgeEmpty.isSome() && edgeEmpty.value().length == 0, "optional list present empty");
        check(Arrays.equals(Api.optionalDigits(Option.some(new BigInteger[]{n(0), n(9)})).value(), new BigInteger[]{n(0), n(9)}), "optional list endpoints");
        for (int position = 0; position < 3; ++position) {
            BigInteger[] values = {n(1), n(2), n(3)};
            values[position] = n(10);
            BigInteger[] snapshot = values.clone();
            @SuppressWarnings("unchecked")
            Option<BigInteger>[] options = new Option[]{Option.some(values[0]), Option.some(values[1]), Option.some(values[2])};
            check(rejected(() -> Api.present(options), "arg0[" + position + "]?", "10"), "nested option invalid position");
            check(Arrays.stream(options).allMatch(Option::isSome) && Arrays.equals(Arrays.stream(options).map(Option::value).toArray(BigInteger[]::new), snapshot), "nested options unchanged");
            check(rejected(() -> Api.optionalDigits(Option.some(values)), "arg0?[" + position + "]", "10"), "optional list invalid position");
            check(Arrays.equals(values, snapshot), "optional list unchanged");
            for (int column = 0; column < 3; ++column) {
                BigInteger[][] table = {{n(1), n(2), n(3)}, {n(4), n(5), n(6)}, {n(7), n(8), n(9)}};
                table[position][column] = n(10);
                BigInteger[][] before = Arrays.stream(table).map(BigInteger[]::clone).toArray(BigInteger[][]::new);
                check(rejected(() -> Api.flatten(table), "arg0[" + position + "][" + column + "]", "10"), "nested row and member positions");
                check(Arrays.deepEquals(table, before), "nested rows unchanged");
            }
        }
        @SuppressWarnings("unchecked")
        Option<BigInteger>[] edgeAbsent = new Option[]{Option.none(), Option.none(), Option.none()};
        check(Api.present(edgeAbsent).length == 0, "absent options");
        Option<BigInteger[]> edgeRows = Api.flatten(new BigInteger[][]{{}, {}, {}});
        check(edgeRows.isSome() && edgeRows.value().length == 0, "present empty rows");
        check(throwsType(NullPointerException.class, () -> Api.emptyArray(null)), "null Array");
        check(throwsType(NullPointerException.class, () -> Api.emptyList(null)), "null List");
        check(throwsType(NullPointerException.class, () -> Api.optionalDigits(Option.some(null))), "present null List");
        java.util.function.Predicate<Runnable> edgeNegative = action -> {
            try { action.run(); }
            catch (IllegalArgumentException error) { return error.getClass() == IllegalArgumentException.class && "Nat cannot be negative".equals(error.getMessage()); }
            return false;
        };
        check(edgeNegative.test(() -> Api.emptyArray(new BigInteger[]{n(-1)})), "negative Fin 0 Array is Nat error");
        check(edgeNegative.test(() -> Api.emptyList(new BigInteger[]{n(-1)})), "negative Fin 0 List is Nat error");
        check(edgeNegative.test(() -> Api.emptyOption(Option.some(n(-1)))), "negative Fin 0 Option is Nat error");
        for (int position = 0; position < 3; ++position) {
            BigInteger[] values = {n(1), n(2), n(3)};
            values[position] = n(-1);
            BigInteger[] before = values.clone();
            check(edgeNegative.test(() -> Api.optionalDigits(Option.some(values))), "negative nested Nat");
            check(Arrays.equals(values, before), "negative input unchanged");
        }
        for (int cycle = 0; cycle < 1000; ++cycle) {
            check(rejected(() -> Api.emptyArray(new BigInteger[]{n(0)}), "arg0[0]", "0"), "cycle invalid Array");
            check(Api.emptyArray(new BigInteger[0]).length == 0, "cycle valid Array");
            check(rejected(() -> Api.emptyList(new BigInteger[]{n(0)}), "arg0[0]", "0"), "cycle invalid List");
            check(Api.emptyList(new BigInteger[0]).length == 0, "cycle valid List");
            check(rejected(() -> Api.emptyOption(Option.some(n(0))), "arg0?", "0"), "cycle invalid Option");
            check(!Api.emptyOption(Option.none()).isSome(), "cycle valid Option");
            @SuppressWarnings("unchecked")
            Option<BigInteger>[] badOptions = new Option[]{Option.some(n(1)), Option.some(n(10)), Option.none()};
            @SuppressWarnings("unchecked")
            Option<BigInteger>[] goodOptions = new Option[]{Option.some(n(1)), Option.none(), Option.some(n(9))};
            check(rejected(() -> Api.present(badOptions), "arg0[1]?", "10"), "cycle invalid nested option");
            check(Arrays.equals(Api.present(goodOptions), new BigInteger[]{n(1), n(9)}), "cycle valid nested option");
            check(rejected(() -> Api.flatten(new BigInteger[][]{{n(1)}, {n(10)}, {n(9)}}), "arg0[1][0]", "10"), "cycle invalid nested rows");
            check(Arrays.equals(Api.flatten(new BigInteger[][]{{n(1)}, {}, {n(9)}}).value(), new BigInteger[]{n(1), n(9)}), "cycle valid nested rows");
            check(rejected(() -> Api.optionalDigits(Option.some(new BigInteger[]{n(1), n(10), n(9)})), "arg0?[1]", "10"), "cycle invalid optional list");
            check(Arrays.equals(Api.optionalDigits(Option.some(new BigInteger[]{n(1), n(9)})).value(), new BigInteger[]{n(1), n(9)}), "cycle valid optional list");
        }
        check(checks - edgeBefore == 12062, "exact edge assertion coverage");
