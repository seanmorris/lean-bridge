package org.leanbridge.owned_aggregates

import java.lang.ref.WeakReference
import java.math.BigInteger
import java.util.function.Supplier
import org.leanbridge.owned_aggregates.kotlin.Api
import org.leanbridge.owned_aggregates.kotlin.Bundle
import org.leanbridge.owned_aggregates.kotlin.Choice
import org.leanbridge.owned_aggregates.kotlin.ChoiceMany
import org.leanbridge.owned_aggregates.kotlin.ChoiceOne
import org.leanbridge.owned_aggregates.kotlin.Option
import org.leanbridge.owned_aggregates.kotlin.Payload
import org.leanbridge.owned_aggregates.kotlin.Ticket
import org.leanbridge.owned_aggregates.kotlin.TicketValue
import org.leanbridge.owned_aggregates.kotlin.Tree
import org.leanbridge.owned_aggregates.kotlin.TreeBranch
import org.leanbridge.owned_aggregates.kotlin.TreeLeaf

internal object KotlinReceiverGcProbe {
    private fun verify(value: Boolean, message: String) = OwnedReceiverGcProbe.check(value, message)
    private fun bundle(ticket: Ticket) = Bundle(ticket, Option.none(), emptyArray(), emptyArray(), Payload(BigInteger.valueOf(42), byteArrayOf(0, -1)))
    private fun ticketScenario(original: TicketValue): OwnedReceiverGcProbe.Scenario {
        val raw = original.get()
        val view = original.retainTicket()
        val deeper = view.retainTicket()
        val retained = original.retain()
        return OwnedReceiverGcProbe.Scenario(WeakReference(original), raw, arrayOf(view, deeper), retained,
            { OwnedReceiverGcProbe.expired { view.serial }; OwnedReceiverGcProbe.expired { raw.serial } },
            { verify(retained.serial.intValueExact() == 42, "Kotlin independent nominal retain survives GC") })
    }
    private fun abandonedTicket() = ticketScenario(Api.newTicket(BigInteger.valueOf(42), "gc"))
    private fun pinnedTicket(): OwnedReceiverGcProbe.Pinned {
        val original = Api.newTicket(BigInteger.valueOf(42), "bound")
        return OwnedReceiverGcProbe.Pinned(Supplier { original.serial }, ticketScenario(original))
    }
    private fun abandonedParameter(): OwnedReceiverGcProbe.Scenario {
        Api.newTicket(BigInteger.ONE, "receiver").use { receiver ->
            val parameter = Api.newTicket(BigInteger.valueOf(42), "parameter")
            val selected = receiver.chooseTicket(parameter)
            val deeper = selected.retainTicket()
            val retained = selected.retain()
            val raw = selected.get()
            receiver.close()
            verify(selected.serial.intValueExact() == 42, "Kotlin remaining parameter is the original anchor")
            return OwnedReceiverGcProbe.Scenario(WeakReference(parameter), raw, arrayOf(selected, deeper), retained,
                { OwnedReceiverGcProbe.expired { selected.serial } },
                { verify(retained.serial.intValueExact() == 42, "Kotlin retained parameter result survives GC") })
        }
    }
    private fun abandonedBundle(): OwnedReceiverGcProbe.Scenario {
        Api.newTicket(BigInteger.valueOf(42), "bundle").use { seed ->
            val original = Api.copyEchoRecordResult(bundle(seed.get()))
            val view = original.echoRecord()
            val primary = original.primary
            val closure = original.makeRecord()
            val retained = original.retain()
            return OwnedReceiverGcProbe.Scenario(WeakReference(original), original.get(), arrayOf(view, primary, closure), retained,
                { OwnedReceiverGcProbe.expired { primary.serial } },
                { verify(retained.payload.count.intValueExact() == 42, "Kotlin retained aggregate member survives GC") })
        }
    }
    private fun abandonedChoice(empty: Boolean): OwnedReceiverGcProbe.Scenario {
        Api.newTicket(BigInteger.valueOf(42), "choice").use { seed ->
            val raw: Choice = if (empty) ChoiceMany(emptyArray()) else ChoiceOne(seed.get())
            val original = Api.copyEchoVariantResult(raw)
            val view = original.echoVariant()
            val retained = original.retain()
            return OwnedReceiverGcProbe.Scenario(WeakReference(original), original.get(), arrayOf(view), retained,
                { OwnedReceiverGcProbe.expired { view.echoVariant() } },
                { retained.echoVariant().use { verify(!it.isClosed, "Kotlin retained variant member survives GC") } })
        }
    }
    private fun abandonedTree(empty: Boolean): OwnedReceiverGcProbe.Scenario {
        Api.newTicket(BigInteger.valueOf(42), "tree").use { seed ->
            val raw: Tree = TreeBranch(if (empty) emptyArray() else arrayOf(TreeLeaf(seed.get())))
            val original = Api.copyEchoRecursiveResult(raw)
            val view = original.echoRecursive()
            val retained = original.retain()
            val escaped = original.get() as TreeBranch
            if (!empty) escaped.children[0] = escaped
            return OwnedReceiverGcProbe.Scenario(WeakReference(original), escaped, arrayOf(view), retained,
                { OwnedReceiverGcProbe.expired { view.echoRecursive() } },
                { retained.echoRecursive().use { verify(!it.isClosed, "Kotlin retained recursive member survives GC") } })
        }
    }
    fun run() {
        Api.newTicket(BigInteger.valueOf(42), "warm").use { ticket ->
            Api.copyEchoRecordResult(bundle(ticket.get())).use { record ->
                OwnedReceiverGcProbe.watch(ticket)
                repeat(5000) { index ->
                    OwnedReceiverGcProbe.forceAtCall(index % 200 == 0)
                    verify(ticket.serial.intValueExact() == 42, "warm Kotlin property")
                    verify(record.payload.count.intValueExact() == 42, "warm Kotlin aggregate property")
                }
            }
        }
        repeat(500) { index ->
            OwnedReceiverGcProbe.forceAtCall(index % 20 == 0)
            verify(ephemeral().intValueExact() == 42, "ephemeral Kotlin receiver property")
        }
        OwnedReceiverGcProbe.forceAtCall(false)
        OwnedReceiverGcProbe.run(abandonedTicket())
        OwnedReceiverGcProbe.run(abandonedParameter())
        OwnedReceiverGcProbe.run(abandonedBundle())
        OwnedReceiverGcProbe.run(abandonedChoice(true))
        OwnedReceiverGcProbe.run(abandonedChoice(false))
        OwnedReceiverGcProbe.run(abandonedTree(true))
        OwnedReceiverGcProbe.run(abandonedTree(false))
        OwnedReceiverGcProbe.runPinned(pinnedTicket())
    }
    private fun ephemeral(): BigInteger {
        val owner = Api.newTicket(BigInteger.valueOf(42), "ephemeral")
        OwnedReceiverGcProbe.watch(owner)
        return owner.serial
    }
}
