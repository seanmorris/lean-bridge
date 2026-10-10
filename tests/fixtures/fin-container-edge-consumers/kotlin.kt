    // All original checks precede this zero-bound and nested-position supplement.
    val edgeBefore = checks
    check(Api.emptyArray(arrayOf()).isEmpty(), "Fin 0 array round trip")
    check(Api.emptyList(arrayOf()).isEmpty(), "Fin 0 list round trip")
    check(!Api.emptyOption(Option.none()).isSome(), "Fin 0 none round trip")
    for (value in arrayOf(n(0), n(1), huge)) {
        val input = arrayOf(value)
        val option = Option.some(value)
        check(rejected("arg0[0]", "0") { Api.emptyArray(input) }, "Fin 0 nonempty array")
        check(rejected("arg0[0]", "0") { Api.emptyList(input) }, "Fin 0 nonempty list")
        check(rejected("arg0?", "0") { Api.emptyOption(option) }, "Fin 0 some")
        check(input.contentEquals(arrayOf(value)) && option.isSome() && option.value() == value, "Fin 0 inputs unchanged")
    }
    check(!Api.optionalDigits(Option.none()).isSome(), "optional list absent")
    val edgeEmpty = Api.optionalDigits(Option.some(arrayOf<BigInteger>()))
    check(edgeEmpty.isSome() && edgeEmpty.value().isEmpty(), "optional list present empty")
    check(Api.optionalDigits(Option.some(arrayOf(n(0), n(9)))).value().contentEquals(arrayOf(n(0), n(9))), "optional list endpoints")
    for (position in 0 until 3) {
        val values = arrayOf(n(1), n(2), n(3))
        values[position] = n(10)
        val snapshot = values.copyOf()
        val options = values.map { Option.some(it) }.toTypedArray()
        check(rejected("arg0[$position]?", "10") { Api.present(options) }, "nested option invalid position")
        check(options.all { it.isSome() } && options.map { it.value() }.toTypedArray().contentEquals(snapshot), "nested options unchanged")
        check(rejected("arg0?[$position]", "10") { Api.optionalDigits(Option.some(values)) }, "optional list invalid position")
        check(values.contentEquals(snapshot), "optional list unchanged")
        for (column in 0 until 3) {
            val table = arrayOf(arrayOf(n(1), n(2), n(3)), arrayOf(n(4), n(5), n(6)), arrayOf(n(7), n(8), n(9)))
            table[position][column] = n(10)
            val before = table.map { it.copyOf() }.toTypedArray()
            check(rejected("arg0[$position][$column]", "10") { Api.flatten(table) }, "nested row and member positions")
            check(table.contentDeepEquals(before), "nested rows unchanged")
        }
    }
    check(Api.present(arrayOf(Option.none(), Option.none(), Option.none())).isEmpty(), "absent options")
    val edgeRows = Api.flatten(arrayOf(arrayOf(), arrayOf(), arrayOf()))
    check(edgeRows.isSome() && edgeRows.value().isEmpty(), "present empty rows")
    fun edgeNull(action: () -> Any?): Boolean = try { action(); false } catch (error: NullPointerException) { true }
    check(edgeNull { Api.emptyArray(null) }, "null Array")
    check(edgeNull { Api.emptyList(null) }, "null List")
    check(edgeNull { Api.optionalDigits(Option.some(null)) }, "present null List")
    fun edgeNegative(action: () -> Any?): Boolean = try { action(); false }
        catch (error: IllegalArgumentException) { error.javaClass == IllegalArgumentException::class.java && error.message == "Nat cannot be negative" }
    check(edgeNegative { Api.emptyArray(arrayOf(n(-1))) }, "negative Fin 0 Array is Nat error")
    check(edgeNegative { Api.emptyList(arrayOf(n(-1))) }, "negative Fin 0 List is Nat error")
    check(edgeNegative { Api.emptyOption(Option.some(n(-1))) }, "negative Fin 0 Option is Nat error")
    for (position in 0 until 3) {
        val values = arrayOf(n(1), n(2), n(3))
        values[position] = n(-1)
        val before = values.copyOf()
        check(edgeNegative { Api.optionalDigits(Option.some(values)) }, "negative nested Nat")
        check(values.contentEquals(before), "negative input unchanged")
    }
    for (cycle in 0 until 1000) {
        check(rejected("arg0[0]", "0") { Api.emptyArray(arrayOf(n(0))) }, "cycle invalid Array")
        check(Api.emptyArray(arrayOf()).isEmpty(), "cycle valid Array")
        check(rejected("arg0[0]", "0") { Api.emptyList(arrayOf(n(0))) }, "cycle invalid List")
        check(Api.emptyList(arrayOf()).isEmpty(), "cycle valid List")
        check(rejected("arg0?", "0") { Api.emptyOption(Option.some(n(0))) }, "cycle invalid Option")
        check(!Api.emptyOption(Option.none()).isSome(), "cycle valid Option")
        check(rejected("arg0[1]?", "10") { Api.present(arrayOf(Option.some(n(1)), Option.some(n(10)), Option.none())) }, "cycle invalid nested option")
        check(Api.present(arrayOf(Option.some(n(1)), Option.none(), Option.some(n(9)))).contentEquals(arrayOf(n(1), n(9))), "cycle valid nested option")
        check(rejected("arg0[1][0]", "10") { Api.flatten(arrayOf(arrayOf(n(1)), arrayOf(n(10)), arrayOf(n(9)))) }, "cycle invalid nested rows")
        check(Api.flatten(arrayOf(arrayOf(n(1)), arrayOf(), arrayOf(n(9)))).value().contentEquals(arrayOf(n(1), n(9))), "cycle valid nested rows")
        check(rejected("arg0?[1]", "10") { Api.optionalDigits(Option.some(arrayOf(n(1), n(10), n(9)))) }, "cycle invalid optional list")
        check(Api.optionalDigits(Option.some(arrayOf(n(1), n(9)))).value().contentEquals(arrayOf(n(1), n(9))), "cycle valid optional list")
    }
    check(checks - edgeBefore == 12062, "exact edge assertion coverage")
