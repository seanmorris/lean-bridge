fun exerciseValues() {
    val huge = BigInteger.ONE.shiftLeft(200) + BigInteger.valueOf(37)
    newTicket(huge, "Kotlin\u0000🌱").use { ticket ->
        verify(label(ticket) == "Kotlin\u0000🌱", "Kotlin resource label")
        val payload = Payload(-huge, byteArrayOf(0, -1, 1))
        val input = Bundle(ticket, Option.some(ticket), arrayOf(ticket, ticket), arrayOf(ticket), payload)
        val copied = echoRecord(input)
        verify(serial(copied.primary) == huge && serial(copied.spare.value()) == huge, "Kotlin owned record")
        verify(copied.peers.size == 2 && copied.history.size == 1 && copied.payload == payload, "Kotlin record children")
        verify(copied.primary !== copied.peers[0], "Kotlin aliases own independent wrappers")
        copied.primary.close()
        verify(serial(copied.peers[1]) == huge, "Kotlin another owner survives")
        drop(copied)
        val alias = echoAlias(input); verify(serial(alias.primary) == huge, "Kotlin nominal alias"); drop(alias)
        val array = echoArray(arrayOf(ticket, ticket))
        verify(array.size == 2 && array[0] !== array[1], "Kotlin owned array"); drop(array)
        val list = echoList(arrayOf(ticket)); verify(serial(list[0]) == huge, "Kotlin owned list"); drop(list)
        verify(!echoOption(Option.none()).isSome(), "Kotlin absent resource")
        val option = echoOption(Option.some(ticket)); verify(serial(option.value()) == huge, "Kotlin present resource"); drop(option)
        val row = echoRow(arrayOf(Option.none(), Option.some(ticket)))
        verify(!row[0].isSome() && serial(row[1].value()) == huge, "Kotlin alias row"); drop(row)
        val product = Pair(ticket, Pair(Option.some(ticket), payload))
        val tuple = echoTuple(product)
        verify(serial(tuple.first) == huge && tuple.second.second == payload, "Kotlin nested product"); drop(tuple)
        for (value in arrayOf<Result<Bundle, Ticket>>(Result.ok(input), Result.err(ticket))) {
            val output = echoResult(value)
            verify(output.isOk() == value.isOk(), "Kotlin result branch"); drop(output)
        }
        for (value in arrayOf<Choice>(ChoiceEmpty(), ChoiceOne(ticket), ChoicePair(ticket, ticket), ChoiceMany(arrayOf(ticket)))) {
            val output = echoVariant(value)
            verify(output.javaClass == value.javaClass, "Kotlin variant branch"); drop(output)
        }
        val tree = TreeBranch(arrayOf(TreeLeaf(ticket), TreeBranch(arrayOf(TreeLeaf(ticket)))))
        val copiedTree = echoRecursive(tree)
        verify(copiedTree is TreeBranch && copiedTree.children.size == 2, "Kotlin recursive ownership"); drop(copiedTree)
        var chain: Chain = ChainStop()
        repeat(40) { chain = ChainLink(ticket, Option.some(chain)) }
        val copiedChain = echoChain(chain)
        verify(copiedChain is ChainLink, "Kotlin nominal recursion"); drop(copiedChain)
        val nested: Array<Array<Option<Result<Bundle, Ticket>>>> = arrayOf(arrayOf(
            Option.none(), Option.some(Result.ok(input)), Option.some(Result.err(ticket))
        ))
        val copiedNested = echoNested(nested)
        verify(copiedNested[0].size == 3, "Kotlin nested array/list/option/result"); drop(copiedNested)
        val markers: Array<Option<Option<Boolean>>> = arrayOf(Option.none(), Option.some(Option.none()), Option.some(Option.some(false)))
        val mixed = Mixed(ticket, markers, Option.some(Unit.INSTANCE), Result.ok(input), -huge, huge,
            0x1f331, -0.0, 1.5f, byteArrayOf(0, -1),
            arrayOf(BigInteger.ZERO, BigInteger.ONE.shiftLeft(64) - BigInteger.ONE), product, chain)
        val copiedMixed = echoMixed(mixed)
        verify(!copiedMixed.markers[2].value().value() && copiedMixed.signed == -huge, "Kotlin mixed value"); drop(copiedMixed)
        makeRecord(input).use { closure ->
            closure.retain().use { kept ->
                closure.close()
                val output = kept.invoke(true, input)
                verify(serial(output.primary) == huge, "Kotlin retained closure"); drop(output)
                val supplied = kept.asCallback().invoke(false, input)
                verify(serial(supplied.primary) == huge, "Kotlin public callback conversion"); drop(supplied)
            }
        }
        makeRecursive(tree).use { closure ->
            val output = closure.invoke(true, tree)
            verify(output is TreeBranch, "Kotlin recursive closure"); drop(output)
        }
        val cycle = arrayOf<Tree>(TreeBranch(emptyArray())); cycle[0] = TreeBranch(cycle)
        OwnedInstalledSupport.reject(IllegalArgumentException::class.java) { echoRecursive(cycle[0]) }
        var deep: Chain = ChainStop()
        repeat(130) { deep = ChainLink(ticket, Option.some(deep)) }
        OwnedInstalledSupport.reject(IllegalArgumentException::class.java) { echoChain(deep) }
        OwnedInstalledSupport.repeat { echoMixed(mixed) }
        ticket.retain().use { kept ->
            ticket.close()
            verify(serial(kept) == huge, "Kotlin retained resource survives close")
            OwnedInstalledSupport.reject(LeanBridgeException::class.java) { echoRecord(input) }
        }
    }
}
