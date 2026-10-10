        // Array fields and results: Array Nat inside ArrayBox, BoxRow as Array NatBox, and RowBox's Array NatBox field.
        java.util.function.BiPredicate<Class<?>, Runnable> arrayRaises = (kind, call) -> {
            try { call.run(); return false; } catch (RuntimeException error) { return error.getClass() == kind; }
        };
        BigInteger arrayWide = BigInteger.ONE.shiftLeft(70);
        ArrayBox pushed = Api.pushCount(new ArrayBox(new BigInteger[] {n(1), arrayWide, n(3)}, n(3)));
        check(pushed.equals(new ArrayBox(new BigInteger[] {n(1), arrayWide, n(3), n(3)}, n(4))));
        check(Api.pushCount(new ArrayBox(new BigInteger[0], n(0))).equals(new ArrayBox(new BigInteger[] {n(0)}, n(1))));
        BigInteger[] arrayInput = {n(1), arrayWide, n(3)};
        ArrayBox arrayBox = new ArrayBox(arrayInput, n(3));
        check(Api.pushCount(arrayBox).equals(pushed) && java.util.Arrays.equals(arrayInput, new BigInteger[] {n(1), arrayWide, n(3)}) && arrayBox.count().equals(n(3)));
        NatBox[] row = {natBox(2, 3), new NatBox(arrayWide, n(1)), natBox(0, 5)};
        BigInteger rowExpected = arrayWide.add(n(6));
        check(Api.rowTotal(row).equals(rowExpected) && Api.rowTotal(new NatBox[0]).equals(n(0)));
        check(row.length == 3 && row[1].equals(new NatBox(arrayWide, n(1))));
        NatBox[] made = Api.rowOf(n(3));
        check(java.util.Arrays.equals(made, new NatBox[] {natBox(0, 3), natBox(1, 3), natBox(2, 3)}) && Api.rowOf(n(0)).length == 0 && Api.rowTotal(made).equals(n(9)));
        check(Api.rowBoxSum(new RowBox(row, n(4))).equals(rowExpected) && Api.rowBoxSum(new RowBox(new NatBox[0], n(9))).equals(n(9)) && Api.rowBoxSum(new RowBox(made, n(0))).equals(n(3)));
        // Negative and null members at the first, middle and last position are the generated API's exact exceptions; the caller's input is
        // unchanged and the next valid call succeeds. A wrong record class does not compile.
        for (int position = 0; position < 3; ++position) {
            BigInteger[] negative = {n(1), arrayWide, n(3)}, missing = {n(1), arrayWide, n(3)};
            negative[position] = n(-1);
            missing[position] = null;
            check(arrayRaises.test(IllegalArgumentException.class, () -> Api.pushCount(new ArrayBox(negative, n(3)))) && negative.length == 3 && negative[position].equals(n(-1)));
            check(Api.pushCount(new ArrayBox(new BigInteger[] {n(1), arrayWide, n(3)}, n(3))).equals(pushed));
            check(arrayRaises.test(NullPointerException.class, () -> Api.pushCount(new ArrayBox(missing, n(3)))) && missing[position] == null);
            check(Api.pushCount(new ArrayBox(new BigInteger[] {n(1), arrayWide, n(3)}, n(3))).equals(pushed));
            NatBox[][] brokenRows = {row.clone(), row.clone(), row.clone(), row.clone()};
            brokenRows[0][position] = natBox(-1, 0);
            brokenRows[1][position] = natBox(0, -1);
            brokenRows[2][position] = new NatBox(null, n(0));
            brokenRows[3][position] = null;
            Class<?>[] kinds = {IllegalArgumentException.class, IllegalArgumentException.class, NullPointerException.class, NullPointerException.class};
            for (int member = 0; member < 4; ++member) {
                NatBox[] broken = brokenRows[member];
                NatBox before = broken[position];
                check(arrayRaises.test(kinds[member], () -> Api.rowTotal(broken)) && broken.length == 3 && broken[position] == before);
                check(arrayRaises.test(kinds[member], () -> Api.rowBoxSum(new RowBox(broken, n(4)))) && broken[position] == before);
                check(Api.rowTotal(row).equals(rowExpected) && Api.rowBoxSum(new RowBox(row, n(4))).equals(rowExpected));
            }
        }
        // Missing Arrays and records, and negative or missing counts beside Array fields, are refused too.
        Object[][] controls = {
            {NullPointerException.class, (Runnable)() -> Api.pushCount(new ArrayBox(null, n(1)))},
            {NullPointerException.class, (Runnable)() -> Api.rowTotal(null)},
            {NullPointerException.class, (Runnable)() -> Api.rowBoxSum(new RowBox(null, n(1)))},
            {IllegalArgumentException.class, (Runnable)() -> Api.pushCount(new ArrayBox(new BigInteger[] {n(1)}, n(-1)))},
            {IllegalArgumentException.class, (Runnable)() -> Api.rowBoxSum(new RowBox(row, n(-1)))},
            {IllegalArgumentException.class, (Runnable)() -> Api.rowOf(n(-1))},
            {NullPointerException.class, (Runnable)() -> Api.pushCount(null)},
            {NullPointerException.class, (Runnable)() -> Api.rowBoxSum(new RowBox(row, null))}};
        for (Object[] control : controls) {
            check(arrayRaises.test((Class<?>)control[0], (Runnable)control[1]));
            check(Api.rowBoxSum(new RowBox(row, n(4))).equals(rowExpected));
        }
        // One thousand Array rounds: a rejected member, then valid Array input and result calls.
        for (int roundIndex = 0; roundIndex < 1000; ++roundIndex) {
            final long round = roundIndex;
            int position = roundIndex % 3;
            long size = roundIndex % 4;
            BigInteger[] values = {n(1), arrayWide, n(3)};
            values[position] = n(-1);
            boolean rejectedMember = arrayRaises.test(IllegalArgumentException.class, () -> Api.pushCount(new ArrayBox(values, n(round))));
            values[position] = new BigInteger[] {n(1), arrayWide, n(3)}[position];
            NatBox[] roundRow = Api.rowOf(n(size));
            NatBox[] broken = row.clone();
            broken[position] = natBox(-1, 0);
            long triangle = size * Math.max(size - 1, 0) / 2;
            check(rejectedMember && Api.pushCount(new ArrayBox(values, n(round))).equals(new ArrayBox(new BigInteger[] {n(1), arrayWide, n(3), n(round)}, n(round + 1)))
                && roundRow.length == size && Api.rowTotal(roundRow).equals(n(size * triangle))
                && Api.rowBoxSum(new RowBox(roundRow, n(round))).equals(n(round + triangle))
                && arrayRaises.test(IllegalArgumentException.class, () -> Api.rowBoxSum(new RowBox(broken, n(round)))));
        }
