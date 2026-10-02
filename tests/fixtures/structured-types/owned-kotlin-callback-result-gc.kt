package org.leanbridge.owned_aggregates

import java.lang.ref.Reference
import java.lang.ref.WeakReference
import java.math.BigInteger
import org.leanbridge.owned_aggregates.kotlin.Api as KotlinApi
import org.leanbridge.owned_aggregates.kotlin.CallbackRecursiveArgument1ClosureCallback
import org.leanbridge.owned_aggregates.kotlin.MakeRecursiveResultClosure
import org.leanbridge.owned_aggregates.kotlin.Tree
import org.leanbridge.owned_aggregates.kotlin.TreeBranch
import org.leanbridge.owned_aggregates.kotlin.TreeLeaf

internal object KotlinCallbackResultGcProbe {
    private fun verify(value: Boolean, message: String) = OwnedCallbackResultGcProbe.check(value, message)
    private fun shape(value: Tree, populated: Boolean) {
        verify(value is TreeBranch, "Kotlin callback result keeps tree constructor")
        val children = (value as TreeBranch).children
        verify(children.size == if (populated) 1 else 0, "Kotlin callback result preserves populated or empty shape")
        if (populated) verify(KotlinApi.serial((children[0] as TreeLeaf).ticket).intValueExact() == 77,
            "Kotlin callback result keeps nested resource after source collection")
    }
    private fun abandoned(populated: Boolean): OwnedCallbackResultGcProbe.Scenario {
        KotlinApi.newTicket(BigInteger.valueOf(77), "Kotlin collected original").use { seed ->
            val raw: Tree = TreeBranch(if (populated) arrayOf(TreeLeaf(seed.get())) else emptyArray())
            val original = KotlinApi.echoRecursive(raw)
            KotlinApi.makeRecursive(raw).use { closure ->
                val result = closure.get().invoke(false, original)
                val descendant = closure.get().invoke(true, result)
                val retained = descendant.retain()
                val escaped = original.get()
                return OwnedCallbackResultGcProbe.Scenario(WeakReference(original), escaped, result, descendant, retained,
                    {
                        if (populated) {
                            val ticket = ((escaped as TreeBranch).children[0] as TreeLeaf).ticket
                            verify(ticket.isClosed, "Kotlin raw ticket expires with collected callback original")
                            OwnedCallbackResultGcProbe.expired { KotlinApi.serial(ticket) }
                        }
                    }, { shape(retained.get(), populated) })
            }
        }
    }
    private fun nativeCall(closure: MakeRecursiveResultClosure, original: Value<Tree>): Value<Tree> =
        closure.invoke(false, original)
    private fun temporaryReply(value: Tree): CallbackResult<Tree> {
        val owner = KotlinApi.echoRecursive(value)
        OwnedCallbackResultGcProbe.watch(owner)
        return CallbackResult.owner(owner)
    }
    private fun temporaryCall(value: Tree): Value<Tree> =
        KotlinApi.callbackRecursive(value, CallbackRecursiveArgument1ClosureCallback(::temporaryReply))
    private fun owners() {
        val empty: Tree = TreeBranch(emptyArray())
        KotlinApi.echoRecursive(empty).use { original ->
            KotlinApi.makeRecursive(empty).use { closure ->
                repeat(1500) { nativeCall(closure.get(), original).use { shape(it.get(), false) } }
            }
        }
        OwnedCallbackResultGcProbe.run(abandoned(false))
        OwnedCallbackResultGcProbe.run(abandoned(true))
    }
    private fun replies() {
        for (populated in arrayOf(false, true)) {
            KotlinApi.newTicket(BigInteger.valueOf(77), "Kotlin temporary reply").use { seed ->
                val value: Tree = TreeBranch(if (populated) arrayOf(TreeLeaf(seed.get())) else emptyArray())
                val allocations = OwnedCallbackResultGcProbe.liveCount()
                val identities = OwnedCallbackResultGcProbe.identityCount()
                repeat(1500) { temporaryCall(value).use { shape(it.get(), populated) } }
                OwnedCallbackResultGcProbe.baseline(allocations, identities, "Kotlin warm callback replies")
                OwnedCallbackResultGcProbe.forceAtReply(true)
                try {
                    repeat(2) {
                        temporaryCall(value).use {
                            OwnedCallbackResultGcProbe.afterReply()
                            shape(it.get(), populated)
                        }
                    }
                } finally { OwnedCallbackResultGcProbe.forceAtReply(false) }
                OwnedCallbackResultGcProbe.baseline(allocations, identities, "Kotlin collected callback replies")
                Reference.reachabilityFence(value)
            }
        }
    }
    fun run() { owners(); replies() }
}
