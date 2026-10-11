        {
            int lateBefore = checks;
            string[] lateNames = ["alpha", "mid\0dle", "omega"];
            string[] savedNames = (string[])lateNames.Clone();
            BigInteger[] lateOffsets = [N(1), N(2), N(3)];
            BigInteger[] savedOffsets = (BigInteger[])lateOffsets.Clone();
            for (int i = 0; i < 3; i++) {
                lateNames[i] += "!"; Check(!lateNames.SequenceEqual(savedNames), "name snapshot detects mutation"); lateNames[i] = savedNames[i];
                lateOffsets[i]++; Check(!lateOffsets.SequenceEqual(savedOffsets), "offset snapshot detects mutation"); lateOffsets[i]--;
            }
            Check(lateNames.SequenceEqual(savedNames), "name controls restored");
            Check(lateOffsets.SequenceEqual(savedOffsets), "offset controls restored");
            // Nine position/value combinations, then 1,000 rejection/recovery pairs.
            for (int cycle = 0; cycle < 1009; cycle++) {
                int position = cycle % 3, representation = (cycle / 3) % 3;
                lateOffsets = [N(1), N(2), N(3)];
                lateOffsets[position] = representation == 2 ? BigInteger.One << 70 : N(4 + representation);
                savedOffsets = (BigInteger[])lateOffsets.Clone();
                Check(Rejected(() => Api.Label(lateNames, lateOffsets), $"arg1[{position}]", "4"), "late bound diagnostic");
                Check(lateNames.SequenceEqual(savedNames), "all names unchanged after rejection");
                Check(lateOffsets.SequenceEqual(savedOffsets), "all offsets unchanged after rejection");
                lateOffsets = [N(1), N(2), N(3)]; savedOffsets = (BigInteger[])lateOffsets.Clone();
                Check(Api.Label(lateNames, lateOffsets) == "alpha:1,mid\0dle:2,omega:3", "late recovery output");
                Check(lateNames.SequenceEqual(savedNames), "all names unchanged after recovery");
                Check(lateOffsets.SequenceEqual(savedOffsets), "all offsets unchanged after recovery");
            }
            Check(checks - lateBefore == 6062, "complete late-input assertion count");
        }
