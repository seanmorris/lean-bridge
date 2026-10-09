        // Array fields and results: Array Nat inside ArrayBox, BoxRow as Array NatBox, and RowBox's Array NatBox field.
        Func<Type, Action, bool> arrayRaises = (kind, call) => {
            try { call(); return false; } catch (Exception error) { return error.GetType() == kind; }
        };
        var sameArrays = System.Collections.StructuralComparisons.StructuralEqualityComparer;
        BigInteger arrayWide = BigInteger.Pow(2, 70);
        ArrayBox pushed = Api.PushCount(new ArrayBox([1, arrayWide, 3], 3));
        Check(pushed == new ArrayBox([1, arrayWide, 3, 3], 4));
        Check(Api.PushCount(new ArrayBox([], 0)) == new ArrayBox([0], 1));
        BigInteger[] arrayInput = [1, arrayWide, 3];
        var arrayBox = new ArrayBox(arrayInput, 3);
        Check(Api.PushCount(arrayBox) == pushed && sameArrays.Equals(arrayInput, new BigInteger[] { 1, arrayWide, 3 }) && arrayBox.Count == 3);
        NatBox[] row = [new NatBox(2, 3), new NatBox(arrayWide, 1), new NatBox(0, 5)];
        BigInteger rowExpected = arrayWide + 6;
        Check(Api.RowTotal(row) == rowExpected && Api.RowTotal([]) == 0);
        Check(row.Length == 3 && row[1] == new NatBox(arrayWide, 1));
        NatBox[] made = Api.RowOf(3);
        Check(sameArrays.Equals(made, new NatBox[] { new NatBox(0, 3), new NatBox(1, 3), new NatBox(2, 3) }) && Api.RowOf(0).Length == 0 && Api.RowTotal(made) == 9);
        Check(Api.RowBoxSum(new RowBox(row, 4)) == rowExpected && Api.RowBoxSum(new RowBox([], 9)) == 9 && Api.RowBoxSum(new RowBox(made, 0)) == 3);
        // Negative and null members at the first, middle and last position are the generated API's exact exceptions; the caller's input is
        // unchanged and the next valid call succeeds. A wrong record class does not compile.
        for (var position = 0; position < 3; ++position) {
            BigInteger[] negative = [1, arrayWide, 3];
            negative[position] = -1;
            Check(arrayRaises(typeof(ArgumentOutOfRangeException), () => Api.PushCount(new ArrayBox(negative, 3))) && negative.Length == 3 && negative[position] == -1);
            Check(Api.PushCount(new ArrayBox([1, arrayWide, 3], 3)) == pushed);
            NatBox[][] brokenRows = [(NatBox[])row.Clone(), (NatBox[])row.Clone(), (NatBox[])row.Clone()];
            brokenRows[0][position] = new NatBox(-1, 0);
            brokenRows[1][position] = new NatBox(0, -1);
            brokenRows[2][position] = null!;
            Type[] kinds = [typeof(ArgumentOutOfRangeException), typeof(ArgumentOutOfRangeException), typeof(ArgumentNullException)];
            for (var member = 0; member < 3; ++member) {
                var broken = brokenRows[member];
                var before = broken[position];
                Check(arrayRaises(kinds[member], () => Api.RowTotal(broken)) && broken.Length == 3 && ReferenceEquals(broken[position], before));
                Check(arrayRaises(kinds[member], () => Api.RowBoxSum(new RowBox(broken, 4))) && ReferenceEquals(broken[position], before));
                Check(Api.RowTotal(row) == rowExpected && Api.RowBoxSum(new RowBox(row, 4)) == rowExpected);
            }
        }
        // Missing Arrays and records, and negative counts beside Array fields, are refused too.
        (Type Kind, Action Call)[] controls = [
            (typeof(ArgumentNullException), () => Api.PushCount(new ArrayBox(null!, 1))),
            (typeof(ArgumentNullException), () => Api.RowTotal(null!)),
            (typeof(ArgumentNullException), () => Api.RowBoxSum(new RowBox(null!, 1))),
            (typeof(ArgumentOutOfRangeException), () => Api.PushCount(new ArrayBox([1], -1))),
            (typeof(ArgumentOutOfRangeException), () => Api.RowBoxSum(new RowBox(row, -1))),
            (typeof(ArgumentOutOfRangeException), () => Api.RowOf(-1)),
            (typeof(ArgumentNullException), () => Api.PushCount(null!))];
        foreach (var control in controls) {
            Check(arrayRaises(control.Kind, control.Call));
            Check(Api.RowBoxSum(new RowBox(row, 4)) == rowExpected);
        }
        // One thousand Array rounds: a rejected member, then valid Array input and result calls.
        for (var roundIndex = 0; roundIndex < 1000; ++roundIndex) {
            var position = roundIndex % 3;
            var size = roundIndex % 4;
            BigInteger[] values = [1, arrayWide, 3];
            values[position] = -1;
            var round = roundIndex;
            var rejectedMember = arrayRaises(typeof(ArgumentOutOfRangeException), () => Api.PushCount(new ArrayBox(values, round)));
            values[position] = new BigInteger[] { 1, arrayWide, 3 }[position];
            var roundRow = Api.RowOf(size);
            var broken = (NatBox[])row.Clone();
            broken[position] = new NatBox(-1, 0);
            var triangle = size * Math.Max(size - 1, 0) / 2;
            Check(rejectedMember && Api.PushCount(new ArrayBox(values, round)) == new ArrayBox([1, arrayWide, 3, round], round + 1)
                && roundRow.Length == size && Api.RowTotal(roundRow) == size * triangle
                && Api.RowBoxSum(new RowBox(roundRow, round)) == round + triangle
                && arrayRaises(typeof(ArgumentOutOfRangeException), () => Api.RowBoxSum(new RowBox(broken, round))));
        }
