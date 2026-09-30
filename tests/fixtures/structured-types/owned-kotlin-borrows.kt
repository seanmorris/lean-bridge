package org.leanbridge.owned_aggregates

import java.math.BigInteger
import org.leanbridge.owned_aggregates.kotlin.*
import org.leanbridge.owned_aggregates.kotlin.Bundle
import org.leanbridge.owned_aggregates.kotlin.Ticket
import org.leanbridge.owned_aggregates.kotlin.Option
import org.leanbridge.owned_aggregates.kotlin.Result
import org.leanbridge.owned_aggregates.kotlin.Payload
import org.leanbridge.owned_aggregates.kotlin.Pair
import org.leanbridge.owned_aggregates.kotlin.Choice
import org.leanbridge.owned_aggregates.kotlin.ChoiceEmpty
import org.leanbridge.owned_aggregates.kotlin.ChoiceOne
import org.leanbridge.owned_aggregates.kotlin.ChoicePair
import org.leanbridge.owned_aggregates.kotlin.ChoiceMany
import org.leanbridge.owned_aggregates.kotlin.Tree
import org.leanbridge.owned_aggregates.kotlin.TreeLeaf
import org.leanbridge.owned_aggregates.kotlin.TreeBranch

internal object KotlinBorrowProbe {
    private val bindings get() = OwnedBorrowProbe.bindings
    private fun verify(value: Boolean, message: String) = OwnedBorrowProbe.check(value, message)
    /* METHODS */
    private fun bundle(ticket: Ticket) = Bundle(ticket, Option.some(ticket), arrayOf(ticket), emptyArray(), Payload(BigInteger.valueOf(-17), byteArrayOf(0, -1)))
    private fun <T : Any> shape(raw: T, copy: (T) -> Value<T>, borrow: (Value<T>) -> Value<T>) {
        copy(raw).use { original -> borrow(original).use { view -> borrow(view).use { deeper -> view.retain().use { independent ->
            verify(view == original && deeper == view, "Kotlin canonical equality")
            original.close(); verify(view.isClosed && deeper.isClosed, "Kotlin transitive owner expiration")
            OwnedBorrowProbe.status(4) { view.get() }; OwnedBorrowProbe.status(4) { deeper == deeper }
            verify(!independent.isClosed, "Kotlin retained owner"); independent.get()
        } } } }
    }
    private fun shapes() {
        newTicket(BigInteger.valueOf(42), "whole\u0000🙂").use { seed ->
            val ticket = seed.get(); val bundle = bundle(ticket)
            shape(bundle, ::copyEchoRecordResult, ::echoRecord); shape(bundle, ::copyEchoAliasResult, ::echoAlias)
            shape(emptyArray<Ticket>(), ::copyEchoArrayResult, ::echoArray); shape(arrayOf(ticket, ticket), ::copyEchoArrayResult, ::echoArray)
            shape(emptyArray<Ticket>(), ::copyEchoListResult, ::echoList); shape(arrayOf(ticket), ::copyEchoListResult, ::echoList)
            shape(Option.none<Ticket>(), ::copyEchoOptionResult, ::echoOption); shape(Option.some(ticket), ::copyEchoOptionResult, ::echoOption)
            shape(Result.ok<Bundle, Ticket>(bundle), ::copyEchoResultResult, ::echoResult); shape(Result.err<Bundle, Ticket>(ticket), ::copyEchoResultResult, ::echoResult)
            shape(Pair(ticket, Pair(Option.none<Ticket>(), bundle.payload)), ::copyEchoTupleResult, ::echoTuple)
            for (choice: Choice in arrayOf(ChoiceEmpty(), ChoiceOne(ticket), ChoicePair(ticket, ticket), ChoiceMany(emptyArray()), ChoiceMany(arrayOf(ticket))))
                shape(choice, ::copyEchoVariantResult, ::echoVariant)
            shape(arrayOf(Option.none(), Option.some(ticket)), ::copyEchoRowResult, ::echoRow); shape(emptyArray<Option<Ticket>>(), ::copyEchoRowResult, ::echoRow)
            var tree: Tree = TreeLeaf(ticket); repeat(12) { tree = TreeBranch(arrayOf(tree)) }
            shape(tree, ::copyEchoRecursiveResult, ::echoRecursive); shape<Tree>(TreeBranch(emptyArray()), ::copyEchoRecursiveResult, ::echoRecursive)
            shape(emptyArray<Array<Option<Result<Bundle, Ticket>>>>(), ::copyEchoNestedResult, ::echoNested)
            shape(arrayOf(emptyArray(), arrayOf(Option.some(Result.ok<Bundle, Ticket>(bundle)))), ::copyEchoNestedResult, ::echoNested)
            copyEchoRecordResult(bundle).use { original -> original.share().use { shared -> echoRecord(original).use { view ->
                val raw = original.get().primary
                raw.retain().use { kept ->
                    verify(raw.sameIdentity(kept) && raw == kept, "Kotlin native identity")
                    original.close(); verify(!view.isClosed, "Kotlin shared original owner")
                    shared.close(); verify(view.isClosed, "Kotlin final guard expires descendants")
                    OwnedBorrowProbe.status(4) { serial(raw) }; OwnedBorrowProbe.status(4) { raw == raw }
                    verify(serial(kept).intValueExact() == 42, "Kotlin independent retained resource")
                    OwnedBorrowProbe.reject(UnsupportedOperationException::class.java) { kept.hashCode() }
                }
            } } }
        }
    }
    private fun callbacksAndTransfers() {
        newTicket(BigInteger.valueOf(42), "callbacks").use { seed -> copyEchoRecordResult(bundle(seed.get())).use { original ->
            var escaped: Ticket? = null; var retained: Ticket? = null
            callbackRecord(original) { value -> escaped = value.primary; retained = value.primary.retain(); value }.use { reply ->
                verify(escaped!!.isClosed && serial(reply.get().primary).intValueExact() == 42, "Kotlin callback borrow expires")
                OwnedBorrowProbe.status(4) { serial(escaped!!) }
                verify(serial(retained!!).intValueExact() == 42, "Kotlin explicit callback retain"); escaped!!.close(); retained!!.close()
            }
            makeRecord(original).use { closure -> closure.retain().use { kept ->
                closure.get().invoke(true, bundle(seed.get())).use { returned -> verify(serial(returned.get().primary).intValueExact() == 42, "Kotlin whole closure reply") }
                val rawReply = closure.get().asCallback().invoke(true, bundle(seed.get()))
                verify(serial(rawReply.primary).intValueExact() == 42, "Kotlin host callback has raw result signature")
                rawReply.primary.close(); rawReply.spare.value().close()
                rawReply.peers.forEach { it.close() }; rawReply.history.forEach { it.close() }
                original.close(); OwnedBorrowProbe.status(4) { closure.get() }
                kept.get().invoke(true, bundle(seed.get())).use { returned -> verify(serial(returned.get().primary).intValueExact() == 42, "Kotlin retained closure") }
            } }
            copyEchoRecordResult(bundle(seed.get())).use { owner -> echoRecord(owner).use { view -> owner.share().use { alias ->
                OwnedBorrowProbe.status(1) { moveRecord(view) { it } }
                moveRecord(owner) { value -> verify(owner.isClosed && view.isClosed && alias.isClosed, "Kotlin reentrant consumption"); value }.use { returned ->
                    verify(serial(returned.get().primary).intValueExact() == 42, "Kotlin original token moved")
                }
            } } }
            copyEchoArrayResult(emptyArray()).use { empty -> echoArray(empty).use { view -> moveArray(empty).use { moved ->
                verify(empty.isClosed && view.isClosed && moved.get().isEmpty(), "Kotlin empty handoff")
            } } }
            newTicket(BigInteger.valueOf(43), "conflict").use { owner -> retainTicket(owner).use { view ->
                OwnedBorrowProbe.status(1) { mixedTicket(view, owner) }; verify(!owner.isClosed && !view.isClosed, "Kotlin ancestor conflict preserves input")
            } }
        } }
    }
    fun run(): IntArray {
        shapes(); callbacksAndTransfers()
        OwnedBorrowProbe.lifetimes({ newTicket(BigInteger.valueOf(44), "lifetime") }, { retainTicket(it) })
        OwnedBorrowProbe.closeDuringWholeRead(copyEchoArrayResult(emptyArray()))
        return newTicket(BigInteger.valueOf(42), "fault").use { seed ->
            OwnedBorrowProbe.faults({ copyEchoRecordResult(bundle(seed.get())) }, { echoRecord(it) }, { moveRecord(it) { value -> value } })
        }
    }
}
