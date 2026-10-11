    run {
        val lateBefore = checks
        val lateNames = arrayOf("alpha", "mid\u0000dle", "omega")
        val savedNames = lateNames.copyOf()
        var lateOffsets = arrayOf(n(1), n(2), n(3))
        var savedOffsets = lateOffsets.copyOf()
        for (i in 0..2) {
            lateNames[i] += "!"; check(!lateNames.contentEquals(savedNames), "name snapshot detects mutation"); lateNames[i] = savedNames[i]
            lateOffsets[i] += BigInteger.ONE; check(!lateOffsets.contentEquals(savedOffsets), "offset snapshot detects mutation"); lateOffsets[i] -= BigInteger.ONE
        }
        check(lateNames.contentEquals(savedNames), "name controls restored")
        check(lateOffsets.contentEquals(savedOffsets), "offset controls restored")
        // Nine position/value combinations, then 1,000 rejection/recovery pairs.
        for (cycle in 0 until 1009) {
            val position = cycle % 3
            val representation = (cycle / 3) % 3
            lateOffsets = arrayOf(n(1), n(2), n(3))
            lateOffsets[position] = if (representation == 2) BigInteger.ONE.shiftLeft(70) else n(4L + representation)
            savedOffsets = lateOffsets.copyOf()
            check(rejected("arg1[$position]", "4") { Api.label(lateNames, lateOffsets) }, "late bound diagnostic")
            check(lateNames.contentEquals(savedNames), "all names unchanged after rejection")
            check(lateOffsets.contentEquals(savedOffsets), "all offsets unchanged after rejection")
            lateOffsets = arrayOf(n(1), n(2), n(3)); savedOffsets = lateOffsets.copyOf()
            check(Api.label(lateNames, lateOffsets) == "alpha:1,mid\u0000dle:2,omega:3", "late recovery output")
            check(lateNames.contentEquals(savedNames), "all names unchanged after recovery")
            check(lateOffsets.contentEquals(savedOffsets), "all offsets unchanged after recovery")
        }
        check(checks - lateBefore == 6062, "complete late-input assertion count")
    }
