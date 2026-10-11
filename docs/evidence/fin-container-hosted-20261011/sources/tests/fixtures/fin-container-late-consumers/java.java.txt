        {
            int lateBefore = checks;
            String[] lateNames = {"alpha", "mid\0dle", "omega"};
            String[] savedNames = lateNames.clone();
            BigInteger[] lateOffsets = {n(1), n(2), n(3)};
            BigInteger[] savedOffsets = lateOffsets.clone();
            for (int i = 0; i < 3; i++) {
                lateNames[i] += "!"; check(!Arrays.equals(lateNames, savedNames), "name snapshot detects mutation"); lateNames[i] = savedNames[i];
                lateOffsets[i] = lateOffsets[i].add(BigInteger.ONE); check(!Arrays.equals(lateOffsets, savedOffsets), "offset snapshot detects mutation"); lateOffsets[i] = lateOffsets[i].subtract(BigInteger.ONE);
            }
            check(Arrays.equals(lateNames, savedNames), "name controls restored");
            check(Arrays.equals(lateOffsets, savedOffsets), "offset controls restored");
            // Nine position/value combinations, then 1,000 rejection/recovery pairs.
            for (int cycle = 0; cycle < 1009; cycle++) {
                int position = cycle % 3, representation = (cycle / 3) % 3;
                final BigInteger[] inputs = {n(1), n(2), n(3)};
                inputs[position] = representation == 2 ? BigInteger.ONE.shiftLeft(70) : n(4 + representation);
                BigInteger[] snapshot = inputs.clone();
                check(rejected(() -> Api.label(lateNames, inputs), "arg1[" + position + "]", "4"), "late bound diagnostic");
                check(Arrays.equals(lateNames, savedNames), "all names unchanged after rejection");
                check(Arrays.equals(inputs, snapshot), "all offsets unchanged after rejection");
                inputs[position] = n(position + 1); snapshot = inputs.clone();
                check(Api.label(lateNames, inputs).equals("alpha:1,mid\0dle:2,omega:3"), "late recovery output");
                check(Arrays.equals(lateNames, savedNames), "all names unchanged after recovery");
                check(Arrays.equals(inputs, snapshot), "all offsets unchanged after recovery");
            }
            check(checks - lateBefore == 6062, "complete late-input assertion count");
        }
