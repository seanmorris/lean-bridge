    // Array fields and results: Array Nat inside ArrayBox, BoxRow as Array NatBox, and RowBox's Array NatBox field.
    val arrayRaises = { kind: Class<*>, call: () -> Unit -> try { call(); false } catch (error: RuntimeException) { error.javaClass == kind } }
    val arrayWide = BigInteger.ONE.shiftLeft(70)
    val pushed = Api.pushCount(ArrayBox(arrayOf(n(1), arrayWide, n(3)), n(3)))
    checkCase(pushed == ArrayBox(arrayOf(n(1), arrayWide, n(3), n(3)), n(4)))
    checkCase(Api.pushCount(ArrayBox(arrayOf(), n(0))) == ArrayBox(arrayOf(n(0)), n(1)))
    val arrayInput = arrayOf(n(1), arrayWide, n(3))
    val arrayBox = ArrayBox(arrayInput, n(3))
    checkCase(Api.pushCount(arrayBox) == pushed && arrayInput.contentEquals(arrayOf(n(1), arrayWide, n(3))) && arrayBox.count() == n(3))
    val row = arrayOf(natBox(2, 3), NatBox(arrayWide, n(1)), natBox(0, 5))
    val rowExpected = arrayWide.add(n(6))
    checkCase(Api.rowTotal(row) == rowExpected && Api.rowTotal(arrayOf()) == n(0))
    checkCase(row.size == 3 && row[1] == NatBox(arrayWide, n(1)))
    val made = Api.rowOf(n(3))
    checkCase(made.contentEquals(arrayOf(natBox(0, 3), natBox(1, 3), natBox(2, 3))) && Api.rowOf(n(0)).isEmpty() && Api.rowTotal(made) == n(9))
    checkCase(Api.rowBoxSum(RowBox(row, n(4))) == rowExpected && Api.rowBoxSum(RowBox(arrayOf(), n(9))) == n(9) && Api.rowBoxSum(RowBox(made, n(0))) == n(3))
    // Negative members at the first, middle and last position are the generated API's exact exception; the caller's input is unchanged and
    // the next valid call succeeds. A wrong record class does not compile.
    for (position in 0 until 3) {
        val negative = arrayOf(n(1), arrayWide, n(3))
        negative[position] = n(-1)
        checkCase(arrayRaises(IllegalArgumentException::class.java) { Api.pushCount(ArrayBox(negative, n(3))) } && negative.size == 3 && negative[position] == n(-1))
        checkCase(Api.pushCount(ArrayBox(arrayOf(n(1), arrayWide, n(3)), n(3))) == pushed)
        for (member in listOf(natBox(-1, 0), natBox(0, -1))) {
            val broken = row.clone()
            broken[position] = member
            checkCase(arrayRaises(IllegalArgumentException::class.java) { Api.rowTotal(broken) } && broken.size == 3 && broken[position] === member)
            checkCase(arrayRaises(IllegalArgumentException::class.java) { Api.rowBoxSum(RowBox(broken, n(4))) } && broken[position] === member)
            checkCase(Api.rowTotal(row) == rowExpected && Api.rowBoxSum(RowBox(row, n(4))) == rowExpected)
        }
    }
    // Negative counts beside Array fields and a negative rowOf argument are refused too.
    for (call in listOf<() -> Unit>({ Api.pushCount(ArrayBox(arrayOf(n(1)), n(-1))) }, { Api.rowBoxSum(RowBox(row, n(-1))) }, { Api.rowOf(n(-1)) })) {
        checkCase(arrayRaises(IllegalArgumentException::class.java, call))
        checkCase(Api.rowBoxSum(RowBox(row, n(4))) == rowExpected)
    }
    // One thousand Array rounds: a rejected member, then valid Array input and result calls.
    for (roundIndex in 0 until 1000) {
        val round = roundIndex.toLong()
        val position = roundIndex % 3
        val size = round % 4
        val values = arrayOf(n(1), arrayWide, n(3))
        values[position] = n(-1)
        val rejectedMember = arrayRaises(IllegalArgumentException::class.java) { Api.pushCount(ArrayBox(values, n(round))) }
        values[position] = arrayOf(n(1), arrayWide, n(3))[position]
        val roundRow = Api.rowOf(n(size))
        val broken = row.clone()
        broken[position] = natBox(-1, 0)
        val triangle = size * maxOf(size - 1, 0L) / 2
        checkCase(rejectedMember && Api.pushCount(ArrayBox(values, n(round))) == ArrayBox(arrayOf(n(1), arrayWide, n(3), n(round)), n(round + 1))
            && roundRow.size.toLong() == size && Api.rowTotal(roundRow) == n(size * triangle)
            && Api.rowBoxSum(RowBox(roundRow, n(round))) == n(round + triangle)
            && arrayRaises(IllegalArgumentException::class.java) { Api.rowBoxSum(RowBox(broken, n(round))) })
    }
