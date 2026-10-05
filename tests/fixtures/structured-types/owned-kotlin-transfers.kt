package org.leanbridge.owned_aggregates

import java.math.BigInteger
import org.leanbridge.owned_aggregates.kotlin.Bundle
import org.leanbridge.owned_aggregates.kotlin.Payload
import org.leanbridge.owned_aggregates.kotlin.Ticket
import org.leanbridge.owned_aggregates.kotlin.Option
import org.leanbridge.owned_aggregates.kotlin.Result
import org.leanbridge.owned_aggregates.kotlin.Pair
import org.leanbridge.owned_aggregates.kotlin.Choice
import org.leanbridge.owned_aggregates.kotlin.ChoiceEmpty
import org.leanbridge.owned_aggregates.kotlin.ChoiceOne
import org.leanbridge.owned_aggregates.kotlin.ChoicePair
import org.leanbridge.owned_aggregates.kotlin.ChoiceMany
import org.leanbridge.owned_aggregates.kotlin.Tree
import org.leanbridge.owned_aggregates.kotlin.TreeLeaf
import org.leanbridge.owned_aggregates.kotlin.TreeBranch
import org.leanbridge.owned_aggregates.kotlin.Chain
import org.leanbridge.owned_aggregates.kotlin.ChainStop
import org.leanbridge.owned_aggregates.kotlin.ChainLink
import org.leanbridge.owned_aggregates.kotlin.Mixed

internal object KotlinTransferProbe {
    private val bindings get() = OwnedTransferProbe.bindings
    private fun verify(value: Boolean, message: String) = OwnedTransferProbe.check(value, message)
    private fun drop(value: Any) = OwnedTransferProbe.drop(value)
    private fun allClosed(value: Any) = OwnedTransferProbe.allClosed(value)
    private fun allOpen(value: Any) = OwnedTransferProbe.allOpen(value)
    private fun semantic(value: Any) = OwnedTransferProbe.semantic(value)
    private fun <T : Any> roundTrip(make: () -> T, call: (T) -> T) = OwnedTransferProbe.roundTrip({ make() }, { call(it) })
    /* METHODS */
    fun identity(value: Any): String {
        val ticket = value as Ticket
        return "ticket:" + serial(ticket) + ":" + label(ticket)
    }
    private fun ticket(serial: Int = 17) = newTicket(BigInteger.valueOf(serial.toLong()), "native\u0000🙂")
    private fun record(): Bundle {
        val first = ticket(); val second = ticket(23)
        return Bundle(first, Option.some(second), arrayOf(first, second), arrayOf(second), Payload(BigInteger.ONE.shiftLeft(180).negate(), byteArrayOf(0, 127, -128, -1)))
    }
    private fun tree(depth: Int = 30): Tree {
        var result: Tree = TreeLeaf(ticket())
        repeat(depth) { result = TreeBranch(arrayOf(result)) }
        return result
    }
    private fun chain(depth: Int = 30): Chain {
        var result: Chain = ChainStop()
        repeat(depth) { result = ChainLink(ticket(it), Option.some(result)) }
        return result
    }
    private fun mixed(error: Boolean): Mixed {
        val ticket = ticket()
        return Mixed(ticket, arrayOf(Option.none(), Option.some(Option.none()), Option.some(Option.some(false)), Option.some(Option.some(true))),
            Option.some(Unit.INSTANCE), if (error) Result.err(ticket(31)) else Result.ok(record()), BigInteger.ONE.shiftLeft(180).negate(), BigInteger.ONE.shiftLeft(200), 0x1f642, -0.0, Float.POSITIVE_INFINITY,
            byteArrayOf(0, 127, -128, -1), arrayOf(BigInteger.ZERO, BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE)),
            Pair(ticket, Pair(Option.some(ticket(32)), Payload(BigInteger.valueOf(-2), byteArrayOf(4)))), chain(3))
    }
    private fun values() {
        ticket().use { ticket ->
            val alias = ticket
            ticket.retain().use { kept -> retainTicket(ticket).use { received ->
                verify(alias.isClosed && serial(received).intValueExact() == 17 && serial(kept).intValueExact() == 17, "Kotlin alias and independent retain")
                OwnedTransferProbe.status(4) { serial(alias) }
            } }
        }
        val original = record(); val bundle = echoRecord(original); drop(original)
        bundle.spare.value().retain().use { kept -> retainTicket(bundle.primary).use {
            verify(allClosed(bundle) && serial(kept).intValueExact() == 23, "Kotlin single leaf consumes shared result owner")
        } }; drop(bundle)
        roundTrip({ arrayOf(ticket(), ticket(2)) }, ::echoArray); roundTrip({ emptyArray<Ticket>() }, ::echoArray)
        roundTrip({ arrayOf(ticket(), ticket(2)) }, ::echoList); roundTrip({ emptyArray<Ticket>() }, ::echoList)
        roundTrip({ Option.some(ticket()) }, ::echoOption); roundTrip({ Option.none<Ticket>() }, ::echoOption)
        roundTrip({ Result.ok<Bundle, Ticket>(record()) }, ::echoResult); roundTrip({ Result.err<Bundle, Ticket>(ticket()) }, ::echoResult)
        roundTrip({ Pair(ticket(), Pair(Option.some(ticket(2)), Payload(BigInteger.valueOf(-1), byteArrayOf(5)))) }, ::echoTuple)
        roundTrip(::record, ::echoRecord); roundTrip(::record, ::echoAlias)
        for (make: () -> Choice in listOf({ ChoiceEmpty() }, { ChoiceOne(ticket()) }, { ChoicePair(ticket(), ticket(2)) }, { ChoiceMany(arrayOf(ticket(), ticket(2))) }, { ChoiceMany(emptyArray()) })) roundTrip(make, ::echoVariant)
        roundTrip({ arrayOf(Option.none(), Option.some(ticket()), Option.none()) }, ::echoRow)
        roundTrip({ tree() }, ::echoRecursive); roundTrip<Tree>({ TreeBranch(emptyArray()) }, ::echoRecursive)
        roundTrip({ arrayOf(emptyArray(), arrayOf(Option.none(), Option.some(Result.ok<Bundle, Ticket>(record())), Option.some(Result.err<Bundle, Ticket>(ticket())))) }, ::echoNested)
        roundTrip({ chain() }, ::echoChain); roundTrip<Chain>({ ChainStop() }, ::echoChain); roundTrip<Chain>({ ChainLink(ticket(), Option.none()) }, ::echoChain)
        roundTrip({ mixed(false) }, ::echoMixed); roundTrip({ mixed(true) }, ::echoMixed)
        ticket().use { ticket ->
            val repeated = echoArray(arrayOf(ticket, ticket)); verify(ticket.isClosed && serial(repeated[1]).intValueExact() == 17, "Kotlin repeated lease in one input"); drop(repeated)
        }
        ticket().use { first -> ticket(29).use { second -> ticket(31).use { borrowed ->
            val value = bundle(first, Option.some(borrowed), arrayOf(second), arrayOf(borrowed), Payload(BigInteger.valueOf(5), byteArrayOf()))
            verify(first.isClosed && second.isClosed && !borrowed.isClosed && serial(value.peers[0]).intValueExact() == 29, "Kotlin mixed borrowed and consumed inputs"); drop(value)
        } } }
    }
    private fun validation() {
        ticket().use { ticket ->
            val before = OwnedTransferProbe.handoffs()
            OwnedTransferProbe.status(1) { bundle(ticket, Option.none(), arrayOf(ticket), emptyArray(), Payload(BigInteger.ZERO, byteArrayOf())) }
            val deep = tree(130); OwnedTransferProbe.reject(_OwnedConvert.Limit::class.java) { echoRecursive(deep) }; verify(allOpen(deep), "Kotlin depth rejection preserves input"); drop(deep)
            val cyclic = arrayOf<Tree>(TreeBranch(emptyArray())); cyclic[0] = TreeBranch(cyclic)
            OwnedTransferProbe.reject(IllegalArgumentException::class.java) { echoRecursive(cyclic[0]) }
            verify(OwnedTransferProbe.handoffs() == before && serial(ticket).intValueExact() == 17, "Kotlin validation preserves owner")
        }
    }
    private fun callbacks() {
        val input = record(); var escaped: Ticket? = null; var retained: Ticket? = null
        val result = callbackRecord(input) { borrowed ->
            System.gc(); verify(allClosed(input), "Kotlin callback sees consumed aliases after GC"); OwnedTransferProbe.visibleOnOtherThread(input)
            escaped = borrowed.primary; OwnedTransferProbe.status(1) { retainTicket(borrowed.primary) }
            borrowed.primary.retain().use { independent -> retained = retainTicket(independent); verify(independent.isClosed, "Kotlin retained callback borrow transfers") }
            val nested = record(); val reply = echoRecord(nested); drop(nested); drop(reply); borrowed
        }
        verify(escaped!!.isClosed && serial(retained!!).intValueExact() == 17, "Kotlin callback borrow expires"); drop(input); drop(result); escaped!!.close(); retained!!.close()
        val failed = record(); val sentinel = IllegalStateException("same Kotlin exception")
        val observed = OwnedTransferProbe.reject(IllegalStateException::class.java) { callbackRecord(failed) { throw sentinel } }
        verify(observed === sentinel && allClosed(failed), "Kotlin post-handoff exception identity"); drop(failed)
        val recursive = tree(3); val echoed = callbackRecursive(recursive) { it }; verify(allClosed(recursive), "Kotlin recursive callback consumes"); drop(recursive); drop(echoed)
        val captured = record(); val expected = semantic(captured)
        makeRecord(captured).use { closure ->
            verify(allClosed(captured), "Kotlin closure capture consumes"); drop(captured)
            val supplied = record(); val returned = closure.invoke(true, supplied)
            verify(semantic(returned) == expected && allOpen(supplied), "Kotlin closure invoke borrows"); drop(supplied); drop(returned)
        }
        val capturedTree = tree(3)
        makeRecursive(capturedTree).use { closure -> drop(capturedTree); val supplied = tree(2); val returned = closure.invoke(true, supplied); drop(supplied); drop(returned) }
        newRecordCallback().use { identity -> identity.retain().use { kept -> transferCallback(identity).use { moved ->
            verify(identity.isClosed && !kept.isClosed, "Kotlin closure identity transfer")
            val supplied = record(); val returned = moved.invoke(supplied); verify(semantic(returned) == semantic(supplied), "Kotlin moved closure callable"); drop(supplied); drop(returned)
        } } }
    }
    fun run(): IntArray {
        values(); validation(); callbacks()
        val observations = OwnedTransferProbe.faults { multi ->
            val input = record(); val extra = ticket(29); val kept = input.primary.retain()
            OwnedTransferProbe.FaultCase(input, extra, kept,
                { if (multi) bundle(input.primary, Option.none(), arrayOf(extra), emptyArray(), input.payload) else callbackRecord(input) { it } },
                { input.primary.isClosed }, { extra.isClosed }, { verify(serial(kept).intValueExact() == 17, "Kotlin fault preserves retained identity") })
        }
        ticket().use { ticket -> OwnedTransferProbe.foreign({ retainTicket(ticket) }, { !ticket.isClosed }) }
        OwnedTransferProbe.interrupted { val input = record(); callbackRecord(input) { borrowed -> OwnedTransferProbe.pauseAfterMove(input); borrowed } }
        return observations
    }
}
