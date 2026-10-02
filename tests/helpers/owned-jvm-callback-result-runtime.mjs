/**
 * Independently authored direct Java and Kotlin callback-result consumers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { ownedJvmKotlinParameterType, ownedJvmKotlinReturnType } from "../../src/backends/jvm/owned-receivers.mjs";

const javaMethods = model => {
	const nodes = new Map(model.types.map(node => [node.id, node]));
	return model.exportCalls.map(fn => {
		const parameters = fn.parameters.map((_, index) => model.parameterType(fn, index, false));
		const unit = nodes.get(fn.result).name === "unit", result = unit ? "void" : model.returnType(fn, false);
		return `    private static ${result} ${fn.publicName}(${parameters.map((type, index) => `${type} arg${index}`).join(", ")}) {
        ${unit ? "" : "return "}bindings.${model.methodName(fn, "Java")}(${parameters.map((_, index) => `arg${index}`).join(", ")});
    }`;
	}).join("\n");
};

const javaLifetimeMethods = `    private static void drop(Value<?> value) { value.close(); }
    private static long sessionLive, sessionIdentities;
    private static void ownersReleased(String stage) {
        bindings.runtime.current().require();
        long liveOwners = count(live), identityOwners = count(identities);
        check(liveOwners == sessionLive && identityOwners == sessionIdentities,
            stage + " left native owners: " + liveOwners + "/" + identityOwners
                + ", expected " + sessionLive + "/" + sessionIdentities);
    }
    private static void expired(Runnable action) {
        expired(action, "expired callback owner was accepted");
    }
    private static void expired(Runnable action, String message) {
        try { action.run(); }
        catch (LeanBridgeException error) { check(error.status() == 4, "expired owner status"); return; }
        throw new AssertionError(message);
    }
    private static void originalOwners() {
        try (var capturedSeed = newTicket(BigInteger.valueOf(42), "captured");
             var suppliedSeed = newTicket(BigInteger.valueOf(7), "supplied");
             var captured = echoRecord(bundle(capturedSeed.get()));
             var supplied = echoRecord(bundle(suppliedSeed.get()));
             var closureOwner = makeRecord(captured.get());
             var closure = closureOwner.get().retain();
             var result = closure.invoke(true, supplied);
             var descendant = closure.invoke(false, result);
             var independent = result.retain(); var alias = supplied.share()) {
            var raw = descendant.get().primary();
            check(serial(raw).intValueExact() == 42, "callback result preserves captured data");
            drop(captured); drop(closureOwner);
            check(serial(result.get().primary()).intValueExact() == 42,
                "captured owner and closure are not the callback result anchor");
            drop(supplied);
            check(!result.isClosed() && !descendant.isClosed(), "shared original owner keeps descendants live");
            drop(alias);
            check(result.isClosed() && descendant.isClosed() && raw.isClosed(),
                "last original owner expires callback descendants transitively");
            expired(result::get); expired(descendant::get); expired(() -> serial(raw));
            expired(() -> closure.invoke(false, supplied));
            check(serial(independent.get().primary()).intValueExact() == 42,
                "retained callback result owns an independent copy");
            try (var later = echoRecord(bundle(suppliedSeed.get())); var valid = closure.invoke(false, later)) {
                check(serial(valid.get().primary()).intValueExact() == 7,
                    "retained closure remains usable with a fresh original owner");
            }
        }
    }
    private static void emptyOwners() {
        Tree empty = new TreeBranch(new Tree[0]);
        try (var original = echoRecursive(empty); var closureOwner = makeRecursive(empty);
             var result = closureOwner.get().invoke(false, original);
             var descendant = closureOwner.get().invoke(true, result); var independent = result.retain()) {
            check(result.get() instanceof TreeBranch branch && branch.children().length == 0,
                "empty callback result retains its shape");
            drop(original);
            check(result.isClosed() && descendant.isClosed(), "empty callback descendants keep their original owner");
            expired(result::get, "expired empty callback result was accepted");
            expired(descendant::get, "expired empty callback descendant was accepted");
            expired(() -> descendant.equals(descendant), "expired empty callback equality was accepted");
            check(independent.get() instanceof TreeBranch branch && branch.children().length == 0,
                "retained empty callback result is independent");
        }
    }
`;

const combinedJavaMethods = `    private static void combinedOwners() {
        try (var seed = newTicket(BigInteger.valueOf(63), "combined-owner")) {
            var input = bundle(seed.get());
            try (var closureOwner = makeRecordCallback(input)) {
                var nativeCallback = closureOwner.get();
                try (var replyOwner = echoRecord(input); var receiver = echoRecord(input);
                     var alias = receiver.share(); var borrowed = receiver.borrowRecord();
                     var moved = receiver.moveRecord((ApplyTwiceArgument1ClosureCallback)value -> CallbackResult.owner(replyOwner))) {
                    check(receiver.isClosed() && alias.isClosed() && borrowed.isClosed(),
                        "callback handoff consumes receiver aliases and anchored views");
                    drop(replyOwner);
                    check(serial(moved.get().primary()).intValueExact() == 63,
                        "whole callback reply is copied before its independent owner closes");
                }
                ApplyTwiceArgument1ClosureCallback raw = value -> CallbackResult.value(value);
                try (var receiver = echoRecord(input); var alias = receiver.share();
                     var borrowed = receiver.borrowRecord(); var invalid = echoRecord(input)) {
                    drop(invalid); var invoked = new boolean[1];
                    var recovery = OwnedCallbacks.withRecovery((ApplyTwiceArgument1ClosureCallback)value -> {
                        invoked[0] = true; return CallbackResult.value(value);
                    }, CallbackResult.owner(invalid));
                    expired(() -> receiver.moveRecord(recovery));
                    check(!invoked[0] && !receiver.isClosed() && !alias.isClosed() && !borrowed.isClosed(),
                        "expired recovery rejects before callback and original-owner handoff");
                    expired(() -> receiver.moveRecord((ApplyTwiceArgument1ClosureCallback)value -> {
                        invoked[0] = true; return CallbackResult.owner(invalid);
                    }));
                    check(invoked[0] && receiver.isClosed() && alias.isClosed() && borrowed.isClosed(),
                        "expired callback reply fails after handoff and leaves aliases consumed");
                }
                for (int mode = 0; mode < 4; ++mode) {
                    try (var receiver = echoRecord(input);
                         var moved = switch (mode) {
                             case 0 -> receiver.moveTwice(raw, raw);
                             case 1 -> receiver.moveTwice(nativeCallback, raw);
                             case 2 -> receiver.moveTwice(raw, nativeCallback);
                             default -> receiver.moveTwice(nativeCallback, nativeCallback);
                         }) {
                        check(receiver.isClosed() && serial(moved.get().primary()).intValueExact() == 63,
                            "mixed receiver overload consumes its original owner");
                    }
                }
                try (var receiver = echoRecord(input); var alias = receiver.share()) {
                    var expected = new IllegalStateException("same combined exception");
                    try {
                        receiver.moveTwice(raw, (ApplyTwiceArgument1ClosureCallback)value -> { throw expected; });
                        throw new AssertionError("missing combined callback exception");
                    } catch (IllegalStateException observed) {
                        check(observed == expected, "post-handoff callback exception identity");
                    }
                    check(receiver.isClosed() && alias.isClosed(), "post-handoff failure leaves receiver consumed");
                }
            }
        }
    }
`;

const javaProbe = (model, combined = false) => `package ${model.namespace};

import java.lang.foreign.*;
import java.lang.invoke.MethodHandle;
import java.math.BigInteger;
import static java.lang.foreign.ValueLayout.*;

public final class OwnedJvmCallbackResultProbe {
    static _OwnedBindings bindings;
    private static MethodHandle live, identities;
    private static int checks;
    static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message); checks++;
    }
    private static long count(MethodHandle function) {
        try { return (long)function.invokeExact(); }
        catch (Throwable error) { throw _OwnedRuntime.rethrow(error); }
    }
    static long liveCount() { return count(live); }
    static long identityCount() { return count(identities); }
${javaMethods(model)}
    private static Bundle bundle(Ticket ticket) {
        return new Bundle(ticket, Option.some(ticket), new Ticket[] { ticket }, new Ticket[0],
            new Payload(BigInteger.valueOf(-17), new byte[] { 0, -1, 3 }));
    }
${javaLifetimeMethods}
${combined ? combinedJavaMethods : ""}
    public static void main(String[] args) {
        try (var library = Arena.ofShared()) {
            var symbols = SymbolLookup.libraryLookup(args[0], library); var linker = Linker.nativeLinker();
            bindings = new _OwnedBindings(symbols, () -> { });
            live = linker.downcallHandle(symbols.find("probe_live").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            identities = linker.downcallHandle(symbols.find("probe_identities").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            bindings.runtime.current().require();
            sessionLive = count(live); sessionIdentities = count(identities);
            emptyOwners(); ownersReleased("empty owners"); originalOwners(); ownersReleased("original owners");
            try (var ticketOwner = newTicket(BigInteger.valueOf(42), "callback-owner")) {
                var input = bundle(ticketOwner.get());
                try (var original = echoRecord(input)) {
                    var escaped = new Ticket[1];
                    try (var rawReply = callbackRecord(input, (ApplyTwiceArgument1ClosureCallback)borrowed -> {
                        escaped[0] = borrowed.primary();
                        return CallbackResult.value(borrowed);
                    })) {
                        check(escaped[0].handle.lease.scope != null && escaped[0].handle.lease.slot == null,
                            "host callback argument uses a frame-scoped lease");
                        check(escaped[0].handle.lease.isClosed(), "escaped host callback frame expires");
                        expired(escaped[0].handle.lease::require, "escaped host callback frame was accepted");
                        check(escaped[0].isClosed(), "raw callback argument expires");
                        check(serial(rawReply.get().primary()).intValueExact() == 42, "raw callback reply is copied before expiration");
                    }
                    try (var ownerReply = callbackRecord(input, (ApplyTwiceArgument1ClosureCallback)ignored -> CallbackResult.owner(original))) {
                        check(serial(ownerReply.get().primary()).intValueExact() == 42, "whole callback reply preserves its original owner");
                    }
                    try (var rawRecovery = callbackRecord(input, OwnedCallbacks.withRecovery(
                             (ApplyTwiceArgument1ClosureCallback)value -> CallbackResult.value(value), CallbackResult.value(input)));
                         var wholeRecovery = callbackRecord(input, OwnedCallbacks.withRecovery(
                             (ApplyTwiceArgument1ClosureCallback)value -> CallbackResult.owner(original), CallbackResult.owner(original)))) {
                        check(serial(rawRecovery.get().primary()).intValueExact() == 42
                            && serial(wholeRecovery.get().primary()).intValueExact() == 42,
                            "explicit raw and whole recoveries preserve callback replies");
                    }
                    try (var invalid = echoRecord(input)) {
                        drop(invalid); var invoked = new boolean[1];
                        expired(() -> callbackRecord(input, OwnedCallbacks.withRecovery(
                            (ApplyTwiceArgument1ClosureCallback)value -> { invoked[0] = true; return CallbackResult.value(value); },
                            CallbackResult.owner(invalid))));
                        check(!invoked[0], "expired whole recovery rejects before callback execution");
                        expired(() -> callbackRecord(input,
                            (ApplyTwiceArgument1ClosureCallback)value -> CallbackResult.owner(invalid)));
                        check(!original.isClosed(), "expired whole reply does not consume independent input owners");
                    }
                    try (var closureOwner = makeRecordCallback(input)) {
                        var closure = closureOwner.get();
                        try (var direct = callbackRecord(input, closure);
                             var invoked = closure.invoke(original);
                             var twice = applyTwice(input, closure, closure);
                             var dispatchOwner = dispatch(input);
                             var dispatched = dispatchOwner.get().invoke(closure);
                             var hosted = dispatchOwner.get().invoke((ApplyTwiceArgument1ClosureCallback)value -> CallbackResult.value(value))) {
                            check(serial(direct.get().primary()).intValueExact() == 42, "native callback overload preserves closure identity");
                            check(serial(invoked.get().primary()).intValueExact() == 42, "anchored closure invocation accepts whole input");
                            check(serial(twice.get().primary()).intValueExact() == 42, "mixed overload matrix invokes native callbacks");
                            check(serial(dispatched.get().primary()).intValueExact() == 42, "higher-order native callback overload");
                            check(serial(hosted.get().primary()).intValueExact() == 42, "higher-order host callback result");
                        }
                    }
                    var expected = new IllegalStateException("same managed exception");
                    try {
                        callbackRecord(input, (ApplyTwiceArgument1ClosureCallback)ignored -> { throw expected; });
                        throw new AssertionError("missing callback exception");
                    } catch (IllegalStateException observed) {
                        check(observed == expected, "callback exception identity");
                    }
                }
            }
            ${combined ? "combinedOwners();" : ""}
            ownersReleased("Java callbacks before session shutdown");
            int javaChecks = checks;
            long beforeKotlinLive = count(live), beforeKotlinIdentities = count(identities);
            int kotlinChecks = OwnedKotlinCallbackResultProbe.INSTANCE.run();
            bindings.runtime.current().require();
            long kotlinLive = count(live), kotlinIdentities = count(identities);
            check(kotlinLive == beforeKotlinLive && kotlinIdentities == beforeKotlinIdentities,
                "Kotlin callback owners released: " + kotlinLive + "/" + kotlinIdentities
                    + ", expected " + beforeKotlinLive + "/" + beforeKotlinIdentities);
            bindings.runtime.current().close();
            check(count(live) == 0 && count(identities) == 0, "all callback owners released");
            System.out.println("{" + (char)34 + "checks" + (char)34 + ":" + javaChecks
                + "," + (char)34 + "kotlinChecks" + (char)34 + ":" + kotlinChecks
                + "," + (char)34 + "live" + (char)34 + ":" + count(live)
                + "," + (char)34 + "identities" + (char)34 + ":" + count(identities) + "}");
        }
    }
}
`;

const kotlinMethods = model => {
	const nodes = new Map(model.types.map(node => [node.id, node]));
	return model.exportCalls.map(fn => {
		const parameters = fn.parameters.map((_, index) => ownedJvmKotlinParameterType(model, fn, index));
		const unit = nodes.get(fn.result).name === "unit", result = ownedJvmKotlinReturnType(model, fn);
		return `    private fun ${fn.publicName}(${parameters.map((type, index) => `arg${index}: ${type}`).join(", ")}): ${result} {
        ${unit ? "" : "return "}bindings.${model.methodName(fn, "Kotlin")}(${parameters.map((_, index) => `arg${index}`).join(", ")})
    }`;
	}).join("\n");
};

const combinedKotlinMethods = `    private fun combinedOwners() {
        newTicket(BigInteger.valueOf(63), "kotlin-combined-owner").use { seed ->
            val input = bundle(seed.get())
            makeRecordCallback(input).use { closureOwner ->
                val nativeCallback = closureOwner.get()
                echoRecord(input).use { replyOwner ->
                    echoRecord(input).use { receiver ->
                        receiver.share().use { alias ->
                            receiver.borrowRecord().use { borrowed ->
                                receiver.moveRecord(ApplyTwiceArgument1ClosureCallback { CallbackResult.owner(replyOwner) }).use { moved ->
                                    verify(receiver.isClosed && alias.isClosed && borrowed.isClosed,
                                        "Kotlin callback handoff consumes receiver aliases and views")
                                    replyOwner.close()
                                    verify(serial(moved.get().primary).intValueExact() == 63,
                                        "Kotlin whole callback reply survives its owner")
                                }
                            }
                        }
                    }
                }
                val raw = ApplyTwiceArgument1ClosureCallback { CallbackResult.value(it) }
                echoRecord(input).use { receiver ->
                    receiver.share().use { alias ->
                        receiver.borrowRecord().use { borrowed ->
                            echoRecord(input).use { invalid ->
                                invalid.close()
                                var invoked = false
                                val recovery = KotlinOwnedCallbacks.withRecovery(
                                    ApplyTwiceArgument1ClosureCallback { invoked = true; CallbackResult.value(it) },
                                    CallbackResult.owner(invalid))
                                expired { receiver.moveRecord(recovery) }
                                verify(!invoked && !receiver.isClosed && !alias.isClosed && !borrowed.isClosed,
                                    "Kotlin invalid recovery rejects before original-owner transfer")
                                expired { receiver.moveRecord(ApplyTwiceArgument1ClosureCallback {
                                    invoked = true; CallbackResult.owner(invalid)
                                }) }
                                verify(invoked && receiver.isClosed && alias.isClosed && borrowed.isClosed,
                                    "Kotlin invalid reply fails after original-owner transfer")
                            }
                        }
                    }
                }
                for (mode in 0 until 4) {
                    echoRecord(input).use { receiver ->
                        val moved = when (mode) {
                            0 -> receiver.moveTwice(raw, raw)
                            1 -> receiver.moveTwice(nativeCallback, raw)
                            2 -> receiver.moveTwice(raw, nativeCallback)
                            else -> receiver.moveTwice(nativeCallback, nativeCallback)
                        }
                        moved.use {
                            verify(receiver.isClosed && serial(it.get().primary).intValueExact() == 63,
                                "Kotlin mixed receiver overload consumes its owner")
                        }
                    }
                }
                echoRecord(input).use { receiver ->
                    receiver.share().use { alias ->
                        val expected = IllegalStateException("same Kotlin combined exception")
                        try {
                            receiver.moveTwice(raw, ApplyTwiceArgument1ClosureCallback { throw expected })
                            throw AssertionError("missing Kotlin combined callback exception")
                        } catch (observed: IllegalStateException) {
                            verify(observed === expected, "Kotlin post-handoff callback exception identity")
                        }
                        verify(receiver.isClosed && alias.isClosed, "Kotlin post-handoff failure consumes receiver")
                    }
                }
            }
        }
    }
`;

const kotlinProbe = (model, combined = false) => `package ${model.namespace}

import java.math.BigInteger
import ${model.kotlin.namespace}.Bundle
import ${model.kotlin.namespace}.Ticket
import ${model.kotlin.namespace}.Option
import ${model.kotlin.namespace}.Payload
import ${model.kotlin.namespace}.TreeBranch
import ${model.kotlin.namespace}.ApplyTwiceArgument1ClosureCallback
import ${model.kotlin.namespace}.OwnedCallbacks as KotlinOwnedCallbacks

internal object OwnedKotlinCallbackResultProbe {
    private val bindings get() = OwnedJvmCallbackResultProbe.bindings
    private var checks = 0
    private fun verify(value: Boolean, message: String) {
        if (!value) throw AssertionError(message)
        checks++
    }
    private fun expired(action: () -> kotlin.Any?) {
        try { action() }
        catch (error: LeanBridgeException) { verify(error.status() == 4, "Kotlin expired owner status"); return }
        throw AssertionError("expired Kotlin callback owner was accepted")
    }
    private fun owners(live: Long, identities: Long, stage: String) {
        val actualLive = OwnedJvmCallbackResultProbe.liveCount()
        val actualIdentities = OwnedJvmCallbackResultProbe.identityCount()
        verify(actualLive == live && actualIdentities == identities,
            "Kotlin owner count at $stage: $actualLive/$actualIdentities, expected $live/$identities")
    }
${kotlinMethods(model)}
    private fun bundle(ticket: Ticket) = Bundle(ticket, Option.some(ticket), arrayOf(ticket), emptyArray(),
        Payload(BigInteger.valueOf(-17), byteArrayOf(0, -1, 3)))
    private fun originalOwners() {
        val owners = mutableListOf<AutoCloseable>()
        fun <T : AutoCloseable> own(value: T): T { owners.add(value); return value }
        try {
            val capturedSeed = own(newTicket(BigInteger.valueOf(42), "Kotlin captured"))
            val suppliedSeed = own(newTicket(BigInteger.valueOf(7), "Kotlin supplied"))
            val captured = own(echoRecord(bundle(capturedSeed.get())))
            val supplied = own(echoRecord(bundle(suppliedSeed.get())))
            val closureOwner = own(makeRecord(captured.get()))
            val closure = own(closureOwner.get().retain())
            val result = own(closure.invoke(true, supplied))
            val descendant = own(closure.invoke(false, result))
            val independent = own(result.retain())
            val alias = own(supplied.share())
            val raw = descendant.get().primary
            captured.close(); closureOwner.close()
            verify(serial(result.get().primary).intValueExact() == 42,
                "Kotlin captured owner and closure are not the callback anchor")
            supplied.close()
            verify(!result.isClosed && !descendant.isClosed, "Kotlin shared original owner preserves descendants")
            alias.close()
            verify(result.isClosed && descendant.isClosed && raw.isClosed,
                "Kotlin callback descendants expire with the original owner")
            expired { result.get() }; expired { descendant.get() }; expired { serial(raw) }
            expired { closure.invoke(false, supplied) }
            verify(serial(independent.get().primary).intValueExact() == 42, "Kotlin retained callback reply is independent")
            val empty = TreeBranch(emptyArray())
            val emptyOriginal = own(echoRecursive(empty))
            val emptyClosure = own(makeRecursive(empty))
            val emptyResult = own(emptyClosure.get().invoke(false, emptyOriginal))
            val emptyDescendant = own(emptyClosure.get().invoke(true, emptyResult))
            val emptyIndependent = own(emptyResult.retain())
            emptyOriginal.close()
            verify(emptyResult.isClosed && emptyDescendant.isClosed, "Kotlin empty descendants preserve the original owner")
            expired { emptyResult.get() }; expired { emptyDescendant.get() }
            verify((emptyIndependent.get() as TreeBranch).children.isEmpty(), "Kotlin retained empty reply is independent")
        } finally { owners.asReversed().forEach { it.close() } }
    }
${combined ? combinedKotlinMethods : ""}
    fun run(): Int {
        val baselineLive = OwnedJvmCallbackResultProbe.liveCount()
        val baselineIdentities = OwnedJvmCallbackResultProbe.identityCount()
        originalOwners()
        owners(baselineLive, baselineIdentities, "original and empty owners")
        newTicket(BigInteger.valueOf(52), "kotlin-callback-owner").use { ticketOwner ->
            val input = bundle(ticketOwner.get())
            echoRecord(input).use { original ->
                val ownerLive = OwnedJvmCallbackResultProbe.liveCount()
                val ownerIdentities = OwnedJvmCallbackResultProbe.identityCount()
                var escaped: Ticket? = null
                callbackRecord(input, ApplyTwiceArgument1ClosureCallback { borrowed ->
                    escaped = borrowed.primary
                    CallbackResult.value(borrowed)
                }).use { rawReply ->
                    verify(escaped!!.handle.lease.scope != null && escaped!!.handle.lease.slot == null,
                        "Kotlin host callback argument uses a frame-scoped lease")
                    verify(escaped!!.handle.lease.isClosed, "Kotlin escaped host callback frame expires")
                    expired { escaped!!.handle.lease.require() }
                    verify(escaped!!.isClosed, "Kotlin raw callback argument expires")
                    verify(serial(rawReply.get().primary).intValueExact() == 52, "Kotlin raw callback reply copied")
                }
                owners(ownerLive, ownerIdentities, "raw reply")
                callbackRecord(input, ApplyTwiceArgument1ClosureCallback { CallbackResult.owner(original) }).use { ownerReply ->
                    verify(serial(ownerReply.get().primary).intValueExact() == 52, "Kotlin whole callback reply")
                }
                owners(ownerLive, ownerIdentities, "whole reply")
                echoRecord(input).use { invalid ->
                    invalid.close()
                    var invoked = false
                    val recovery = KotlinOwnedCallbacks.withRecovery(
                        ApplyTwiceArgument1ClosureCallback { invoked = true; CallbackResult.value(it) }, CallbackResult.owner(invalid))
                    expired { callbackRecord(input, recovery) }
                    verify(!invoked, "Kotlin expired whole recovery rejects before callback execution")
                    expired { callbackRecord(input, ApplyTwiceArgument1ClosureCallback { CallbackResult.owner(invalid) }) }
                    verify(!original.isClosed, "Kotlin invalid callback reply preserves independent owner")
                }
                owners(ownerLive, ownerIdentities, "expired replies and recoveries")
                makeRecordCallback(input).use { closureOwner ->
                    val closure = closureOwner.get()
                    callbackRecord(input, closure).use { direct ->
                        verify(serial(direct.get().primary).intValueExact() == 52, "Kotlin native callback overload")
                    }
                    closure.invoke(original).use { invoked ->
                        verify(serial(invoked.get().primary).intValueExact() == 52, "Kotlin whole closure invocation")
                    }
                    applyTwice(input, closure, closure).use { twice ->
                        verify(serial(twice.get().primary).intValueExact() == 52, "Kotlin mixed callback overloads")
                    }
                    dispatch(input).use { dispatchOwner ->
                        dispatchOwner.get().invoke(closure).use { dispatched ->
                            verify(serial(dispatched.get().primary).intValueExact() == 52, "Kotlin higher-order native callback")
                        }
                        dispatchOwner.get().invoke(ApplyTwiceArgument1ClosureCallback { CallbackResult.value(it) }).use { hosted ->
                            verify(serial(hosted.get().primary).intValueExact() == 52, "Kotlin higher-order host callback")
                        }
                    }
                }
                owners(ownerLive, ownerIdentities, "native closures")
                val expected = IllegalStateException("same Kotlin exception")
                try {
                    callbackRecord(input, ApplyTwiceArgument1ClosureCallback { throw expected })
                    throw AssertionError("missing Kotlin callback exception")
                } catch (observed: IllegalStateException) {
                    verify(observed === expected, "Kotlin callback exception identity")
                }
                owners(ownerLive, ownerIdentities, "callback exception")
            }
        }
        ${combined ? "combinedOwners()" : ""}
        owners(baselineLive, baselineIdentities, "final scope")
        return checks
    }
}
`;

const nativeJavaProbe = model => `package ${model.namespace};

import java.lang.foreign.*;
import java.lang.invoke.MethodHandle;
import java.math.BigInteger;
import static java.lang.foreign.ValueLayout.*;

public final class OwnedJvmNativeCallbackResultProbe {
    static _OwnedBindings bindings;
    private static MethodHandle live, identities;
    private static int checks;
    private static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message); checks++;
    }
    private static long count(MethodHandle function) {
        try { return (long)function.invokeExact(); }
        catch (Throwable error) { throw _OwnedRuntime.rethrow(error); }
    }
    static long liveCount() { return count(live); }
    static long identityCount() { return count(identities); }
${javaMethods(model)}
    private static Bundle bundle(Ticket ticket) {
        return new Bundle(ticket, Option.some(ticket), new Ticket[] { ticket }, new Ticket[0],
            new Payload(BigInteger.valueOf(-21), new byte[] { 0, -1 }));
    }
${javaLifetimeMethods}
    public static void main(String[] args) {
        try (var library = Arena.ofShared()) {
            var symbols = SymbolLookup.libraryLookup(args[0], library); var linker = Linker.nativeLinker();
            bindings = new _OwnedBindings(symbols, () -> { });
            live = linker.downcallHandle(symbols.find("probe_live").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            identities = linker.downcallHandle(symbols.find("probe_identities").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            bindings.runtime.current().require();
            sessionLive = count(live); sessionIdentities = count(identities);
            emptyOwners(); ownersReleased("empty owners"); originalOwners(); ownersReleased("original owners");
            try (var ticketOwner = newTicket(BigInteger.valueOf(61), "native-callback")) {
                var ticket = ticketOwner.get(); var input = bundle(ticket);
                try (var original = echoRecord(input); var closureOwner = makeRecordCallback(input)) {
                    var closure = closureOwner.get();
                    try (var direct = callbackRecord(input, closure);
                         var invoked = closure.invoke(original);
                         var twice = applyTwice(input, closure, closure);
                         var dispatchOwner = dispatch(input);
                         var dispatched = dispatchOwner.get().invoke(closure)) {
                        check(serial(direct.get().primary()).intValueExact() == 61, "native callback export");
                        check(serial(invoked.get().primary()).intValueExact() == 61, "native callback whole argument");
                        check(serial(twice.get().primary()).intValueExact() == 61, "two native callback arguments");
                        check(serial(dispatched.get().primary()).intValueExact() == 61, "higher-order native callback");
                    }
                }
                Tree tree = new TreeBranch(new Tree[] { new TreeLeaf(ticket), new TreeBranch(new Tree[0]) });
                try (var originalTree = echoRecursive(tree); var closureOwner = makeTreeCallback(tree);
                     var directTree = callbackRecursive(tree, closureOwner.get());
                     var invokedTree = closureOwner.get().invoke(originalTree)) {
                    check(directTree.get() instanceof TreeBranch, "recursive native callback export");
                    check(invokedTree.get() instanceof TreeBranch, "recursive native callback whole argument");
                }
            }
            ownersReleased("native Java callbacks before session shutdown");
            int javaChecks = checks;
            int kotlinChecks = OwnedKotlinNativeCallbackResultProbe.INSTANCE.run();
            ownersReleased("native Kotlin callbacks before session shutdown");
            bindings.runtime.current().close();
            check(count(live) == 0 && count(identities) == 0, "all native callback owners released");
            System.out.println("{" + (char)34 + "checks" + (char)34 + ":" + javaChecks
                + "," + (char)34 + "kotlinChecks" + (char)34 + ":" + kotlinChecks
                + "," + (char)34 + "live" + (char)34 + ":" + count(live)
                + "," + (char)34 + "identities" + (char)34 + ":" + count(identities) + "}");
        }
    }
}
`;

const nativeKotlinProbe = model => {
	const original = kotlinProbe(model), marker = "    fun run(): Int {";
	assert.equal(original.split(marker).length, 2);
	let prefix = original.split(marker)[0];
	for(const line of [
		`import ${model.kotlin.namespace}.ApplyTwiceArgument1ClosureCallback\n`
		, `import ${model.kotlin.namespace}.OwnedCallbacks as KotlinOwnedCallbacks\n`
	]) {
		assert.equal(prefix.split(line).length, 2); prefix = prefix.replace(line, "");
	}
	prefix = prefix.replaceAll("OwnedJvmCallbackResultProbe", "OwnedJvmNativeCallbackResultProbe")
		.replace("OwnedKotlinCallbackResultProbe", "OwnedKotlinNativeCallbackResultProbe");
	return prefix + `    fun run(): Int {
        val baselineLive = OwnedJvmNativeCallbackResultProbe.liveCount()
        val baselineIdentities = OwnedJvmNativeCallbackResultProbe.identityCount()
        originalOwners()
        owners(baselineLive, baselineIdentities, "native original and empty owners")
        newTicket(BigInteger.valueOf(61), "native Kotlin callback").use { ticketOwner ->
            val input = bundle(ticketOwner.get())
            echoRecord(input).use { original ->
                makeRecordCallback(input).use { closureOwner ->
                    val closure = closureOwner.get()
                    callbackRecord(input, closure).use { direct ->
                        verify(serial(direct.get().primary).intValueExact() == 61, "native Kotlin callback export")
                    }
                    closure.invoke(original).use { invoked ->
                        verify(serial(invoked.get().primary).intValueExact() == 61, "native Kotlin whole argument")
                    }
                    applyTwice(input, closure, closure).use { twice ->
                        verify(serial(twice.get().primary).intValueExact() == 61, "native Kotlin mixed callback overloads")
                    }
                    dispatch(input).use { dispatcher ->
                        dispatcher.get().invoke(closure).use { higher ->
                            verify(serial(higher.get().primary).intValueExact() == 61, "native Kotlin higher-order callback")
                        }
                    }
                }
            }
            val tree = TreeBranch(arrayOf(${model.kotlin.namespace}.TreeLeaf(ticketOwner.get()), TreeBranch(emptyArray())))
            echoRecursive(tree).use { original ->
                makeTreeCallback(tree).use { closureOwner ->
                    callbackRecursive(tree, closureOwner.get()).use { direct ->
                        verify(direct.get() is TreeBranch, "native Kotlin recursive export")
                    }
                    closureOwner.get().invoke(original).use { result ->
                        verify(result.get() is TreeBranch, "native Kotlin recursive whole argument")
                    }
                }
            }
        }
        owners(baselineLive, baselineIdentities, "native final scope")
        return checks
    }
}
`;
};

/**
 * Render both language probes without importing or executing their test runner.
 *
 * @param model - Generated, compiler-authenticated JVM calls.
 * @param options - Selected independent direct-runtime composition.
 * @param options.hostCallbacks - Include raw and whole host replies.
 * @param options.combined - Include receiver, transfer and export-anchor calls.
 */
export const ownedJvmCallbackResultRuntimeProbes = (model, { hostCallbacks, combined }) => ({
	[`OwnedJvm${hostCallbacks ? "" : "Native"}CallbackResultProbe.java`]: hostCallbacks ? javaProbe(model, combined) : nativeJavaProbe(model)
	, [`OwnedKotlin${hostCallbacks ? "" : "Native"}CallbackResultProbe.kt`]: hostCallbacks ? kotlinProbe(model, combined) : nativeKotlinProbe(model)
});
