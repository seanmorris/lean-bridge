/**
 * JVM callback replies preserve compiler-authenticated argument owners.
 *
 * @file
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { generateOwnedJvmCalls } from "../src/backends/jvm/owned-calls.mjs";
import { generateOwnedJvmPackage } from "../src/backends/jvm/owned-package.mjs";
import { ownedJvmKotlinParameterType, ownedJvmKotlinReturnType } from "../src/backends/jvm/owned-receivers.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedDotnetCallbackResultReviewedIr, ownedDotnetCallbackResultSource
	, ownedDotnetCallbackResultCombinedReviewedIr, ownedDotnetCallbackResultCombinedSource } from "./helpers/owned-dotnet-callback-result-fixture.mjs";
import { compileOwnedJvmCallNative, compileOwnedJvmCallSources } from "./helpers/owned-jvm-call-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

const capability = { callbackResultAnchors: true };

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

const combinedJavaMethods = `    private static void drop(Value<?> value) { value.close(); }
    private static void combinedOwners() {
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
${combined ? combinedJavaMethods : ""}
    public static void main(String[] args) {
        try (var library = Arena.ofShared()) {
            var symbols = SymbolLookup.libraryLookup(args[0], library); var linker = Linker.nativeLinker();
            bindings = new _OwnedBindings(symbols, () -> { });
            live = linker.downcallHandle(symbols.find("probe_live").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            identities = linker.downcallHandle(symbols.find("probe_identities").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            bindings.runtime.current().require();
            try (var ticketOwner = newTicket(BigInteger.valueOf(42), "callback-owner")) {
                var input = bundle(ticketOwner.get());
                try (var original = echoRecord(input)) {
                    var escaped = new Ticket[1];
                    try (var rawReply = callbackRecord(input, (ApplyTwiceArgument1ClosureCallback)borrowed -> {
                        escaped[0] = borrowed.primary();
                        return CallbackResult.value(borrowed);
                    })) {
                        check(escaped[0].isClosed(), "raw callback argument expires");
                        check(serial(rawReply.get().primary()).intValueExact() == 42, "raw callback reply is copied before expiration");
                    }
                    try (var ownerReply = callbackRecord(input, (ApplyTwiceArgument1ClosureCallback)ignored -> CallbackResult.owner(original))) {
                        check(serial(ownerReply.get().primary()).intValueExact() == 42, "whole callback reply preserves its original owner");
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
import ${model.kotlin.namespace}.ApplyTwiceArgument1ClosureCallback

internal object OwnedKotlinCallbackResultProbe {
    private val bindings get() = OwnedJvmCallbackResultProbe.bindings
    private var checks = 0
    private fun verify(value: Boolean, message: String) {
        if (!value) throw AssertionError(message)
        checks++
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
${combined ? combinedKotlinMethods : ""}
    fun run(): Int {
        val baselineLive = OwnedJvmCallbackResultProbe.liveCount()
        val baselineIdentities = OwnedJvmCallbackResultProbe.identityCount()
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
                    verify(escaped!!.isClosed, "Kotlin raw callback argument expires")
                    verify(serial(rawReply.get().primary).intValueExact() == 52, "Kotlin raw callback reply copied")
                }
                owners(ownerLive, ownerIdentities, "raw reply")
                callbackRecord(input, ApplyTwiceArgument1ClosureCallback { CallbackResult.owner(original) }).use { ownerReply ->
                    verify(serial(ownerReply.get().primary).intValueExact() == 52, "Kotlin whole callback reply")
                }
                owners(ownerLive, ownerIdentities, "whole reply")
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
    private static _OwnedBindings bindings;
    private static MethodHandle live, identities;
    private static int checks;
    private static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message); checks++;
    }
    private static long count(MethodHandle function) {
        try { return (long)function.invokeExact(); }
        catch (Throwable error) { throw _OwnedRuntime.rethrow(error); }
    }
${javaMethods(model)}
    private static Bundle bundle(Ticket ticket) {
        return new Bundle(ticket, Option.some(ticket), new Ticket[] { ticket }, new Ticket[0],
            new Payload(BigInteger.valueOf(-21), new byte[] { 0, -1 }));
    }
    public static void main(String[] args) {
        try (var library = Arena.ofShared()) {
            var symbols = SymbolLookup.libraryLookup(args[0], library); var linker = Linker.nativeLinker();
            bindings = new _OwnedBindings(symbols, () -> { });
            live = linker.downcallHandle(symbols.find("probe_live").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            identities = linker.downcallHandle(symbols.find("probe_identities").orElseThrow(), FunctionDescriptor.of(JAVA_LONG));
            bindings.runtime.current().require();
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
            bindings.runtime.current().close();
            check(count(live) == 0 && count(identities) == 0, "all native callback owners released");
            System.out.println("{" + (char)34 + "checks" + (char)34 + ":" + checks
                + "," + (char)34 + "live" + (char)34 + ":" + count(live)
                + "," + (char)34 + "identities" + (char)34 + ":" + count(identities) + "}");
        }
    }
}
`;

test("JVM callback-result owners require capability and retain native closure identity", () => {
	const ir = ownedDotnetCallbackResultReviewedIr(), original = structuredClone(ir);
	assert.throws(() => generateOwnedJvmPackage(ir), /explicit output leases/u);
	const native = generateOwnedJvmPackage(ir, null, { ...capability, hostCallbacks: false });
	assert.deepEqual(ir, original);
	assert.equal(native.callbacks.filter(callback => callback.anchor !== undefined).length, 4);
	assert.equal(native.wholeOwners, true);
	assert.equal(native.contract.schemaVersion, 5);
	assert.equal(native.contract.backend, "owned-jvm-v5");
	assert.equal(native.contract.callbackResultAnchors.nativeClosures, "identity-preserved");
	assert.equal(native.contract.callbackResultAnchors.signatures.length, 4);
	const nativeSource = Object.values(native.files).join("\n");
	assert.doesNotMatch(nativeSource, /class CallbackResult/u);
	assert.doesNotMatch(nativeSource, /reply\.read\(replies\)/u);
	assert.match(nativeSource, /public [^{]+ invoke\(Value</u);

	const host = generateOwnedJvmPackage(ir, null, { ...capability, hostCallbacks: true });
	const source = Object.values(host.files).join("\n");
	assert.equal(host.functions.length, 32);
	assert.match(source, /public final class CallbackResult<T>/u);
	assert.match(source, /static <T> CallbackResult<T> owner\(Value<T> owner\)/u);
	assert.match(source, /reply\.read\(replies\)/u);
	assert.match(source, /recovery\.read\(scope\)/u);
	assert.match(source, /callJava\d+Native\d+/u);
	assert.match(source, /callKotlin\d+Native\d+/u);
	assert.match(source, /CallbackResult<[^>]+> invoke/u);
	assert.match(source, /public [^{]+ invoke\(Value</u);
	assert.equal(JSON.parse(host.files["binding-manifest.json"]).supportedFeatures.includes("callback-result-anchors"), true);

	const reordered = structuredClone(ir); reordered.types.reverse();
	assert.deepEqual(generateOwnedJvmCalls(reordered, { ...capability, hostCallbacks: true }).files
		, generateOwnedJvmCalls(ir, { ...capability, hostCallbacks: true }).files);
	assert.deepEqual(generateOwnedJvmPackage(ownedAggregateReviewedIr(), null, capability).files
		, generateOwnedJvmPackage(ownedAggregateReviewedIr()).files);
});

test("Java callback replies copy raw and whole values before their frame expires", {
	skip: process.env.LEAN_BRIDGE_OWNED_JVM_CALLBACK_RESULT_TEST !== "1"
	, timeout: 900000
}, async t => {
	const options = { ...capability, hostCallbacks: true };
	const compiled = await compileOwnedAggregateFixture(t, {
		reviewedIr: ownedDotnetCallbackResultReviewedIr(), hostCallbacks: true
		, sourceSuffix: ownedDotnetCallbackResultSource
		, evidenceName: "jvm-callback-results-reviewed-inputs.json"
	});
	await compileOwnedJvmCallNative(compiled, options);
	const model = generateOwnedJvmCalls(compiled.model.bindingIr, options);
	const files = { ...model.files
		, "OwnedJvmCallbackResultProbe.java": javaProbe(model)
		, "OwnedKotlinCallbackResultProbe.kt": kotlinProbe(model) };
	let observed;
	try
	{
		const toolchain = await compileOwnedJvmCallSources(compiled.directory, files);
		const args = ["--enable-native-access=ALL-UNNAMED"
			, "-cp", "classes:" + toolchain.stdlib
			, model.namespace + ".OwnedJvmCallbackResultProbe"
			, join(compiled.directory, "libprobe.so")];
		const run = await runCopied(toolchain.java, args, compiled.directory);
		assert.equal(run.stderr, ""); observed = JSON.parse(run.stdout.trim());
	}
	catch(error)
	{
		throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error });
	}
	assert.ok(observed.checks >= 9); assert.ok(observed.kotlinChecks >= 9);
	assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
});

test("JVM native closures preserve callback-result owners without host upcalls", {
	skip: process.env.LEAN_BRIDGE_OWNED_JVM_CALLBACK_RESULT_TEST !== "1"
	, timeout: 900000
}, async t => {
	const options = { ...capability, hostCallbacks: false };
	const compiled = await compileOwnedAggregateFixture(t, {
		reviewedIr: ownedDotnetCallbackResultReviewedIr(), hostCallbacks: false
		, sourceSuffix: ownedDotnetCallbackResultSource
		, evidenceName: "jvm-callback-results-reviewed-native-inputs.json"
	});
	await compileOwnedJvmCallNative(compiled, options);
	const model = generateOwnedJvmCalls(compiled.model.bindingIr, options);
	const files = { ...model.files
		, "OwnedJvmNativeCallbackResultProbe.java": nativeJavaProbe(model) };
	let observed;
	try
	{
		const toolchain = await compileOwnedJvmCallSources(compiled.directory, files);
		const args = ["--enable-native-access=ALL-UNNAMED"
			, "-cp", "classes:" + toolchain.stdlib
			, model.namespace + ".OwnedJvmNativeCallbackResultProbe"
			, join(compiled.directory, "libprobe.so")];
		const run = await runCopied(toolchain.java, args, compiled.directory);
		assert.equal(run.stderr, ""); observed = JSON.parse(run.stdout.trim());
	}
	catch(error)
	{
		throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error });
	}
	assert.ok(observed.checks >= 7); assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
});

test("JVM callback-result owners compose with transfers, anchors, and receivers", {
	skip: process.env.LEAN_BRIDGE_OWNED_JVM_CALLBACK_RESULT_TEST !== "1"
	, timeout: 900000
}, async t => {
	const options = { ...capability, hostCallbacks: true, transferredInputs: true
		, anchoredResults: true, receiverExports: true };
	const compiled = await compileOwnedAggregateFixture(t, {
		reviewedIr: ownedDotnetCallbackResultCombinedReviewedIr(), hostCallbacks: true
		, sourceSuffix: ownedDotnetCallbackResultCombinedSource
		, evidenceName: "jvm-callback-results-reviewed-combined-inputs.json"
	});
	await compileOwnedJvmCallNative(compiled, options);
	const model = generateOwnedJvmCalls(compiled.model.bindingIr, options);
	const files = { ...model.files
		, "OwnedJvmCallbackResultProbe.java": javaProbe(model, true)
		, "OwnedKotlinCallbackResultProbe.kt": kotlinProbe(model, true) };
	let observed;
	try
	{
		const toolchain = await compileOwnedJvmCallSources(compiled.directory, files);
		const args = ["--enable-native-access=ALL-UNNAMED"
			, "-cp", "classes:" + toolchain.stdlib
			, model.namespace + ".OwnedJvmCallbackResultProbe"
			, join(compiled.directory, "libprobe.so")];
		const run = await runCopied(toolchain.java, args, compiled.directory);
		assert.equal(run.stderr, ""); observed = JSON.parse(run.stdout.trim());
	}
	catch(error)
	{
		throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error });
	}
	assert.ok(observed.checks >= 16); assert.ok(observed.kotlinChecks >= 16);
	assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
});
