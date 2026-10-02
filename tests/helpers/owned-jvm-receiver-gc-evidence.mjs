/**
 * Authenticate optimized nominal-owner GC and independent lifetime-fence mutants.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { createCompiledNativeModel } from "../../src/build/native-graph-model.mjs";
import { generateOwnedJvmPackage } from "../../src/backends/jvm/owned-package.mjs";
import { ownedJvmCallNative } from "./owned-jvm-call-fixture.mjs";
import { ownedRustReceiverSource } from "./owned-rust-receiver-fixture.mjs";
import { assertOwnedJvmReceiverGcCi } from "./owned-jvm-receiver-gc-ci.mjs";

export const ownedJvmReceiverGcCommand = "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-jvm-receiver-gc";
export const ownedJvmReceiverGcScope = Object.freeze({
	profiles: ["java", "kotlin"], sourcePaths: ["ordinary-source", "reviewed-ir"]
	, compiledLean: true, optimizedNominalReceiverGc: true
	, originalReceiverOwners: true, remainingParameterOwners: true
	, transitiveExpiration: true, independentRetains: true
	, boundMethodReachability: true
	, emptyValues: true, recursiveValues: true, compiledNegativeVariants: 2
	, callbackResultAnchors: false, installedPackages: false
	, docker: false, installedSupportPromotions: 0
});
export const ownedJvmReceiverGcMethods = [
	"TicketValue getSerial", "BundleValue getPayload"
	, "_OwnedKotlinTicketValue getSerial", "_OwnedKotlinBundleValue getPayload"
	, "OwnedReceiverGcProbe ephemeralJava", "KotlinReceiverGcProbe ephemeral"];
const expected = { javaChecks: 10627, kotlinChecks: 10627
	, javaCollected: 8, kotlinCollected: 8, duringCalls: 100
	, live: 0, identities: 0 };
const observed = value => {
	const { rounds, ...stable } = value;
	assert.deepEqual(stable, expected);
	assert.ok(Number.isSafeInteger(rounds) && rounds >= 126 && rounds < 9711);
};
const optimized = (value, methods, namespace) => {
	assert.deepEqual(value.optimized.map(item => item.method), methods);
	assert.match(value.compilationSha256, /^[a-f0-9]{64}$/u);
	assert.notEqual(value.compilationSha256, "0".repeat(64));
	for(const { method, lines } of value.optimized)
	{
		assert.ok(Array.isArray(lines) && lines.length > 0);
		for(const line of lines)
		{
			assert.ok(line.startsWith("<nmethod ") && line.includes("compiler='c2'"));
			assert.ok(line.includes("method='" + namespace + "." + method + " "));
		}
	}
};

/**
 * Rebuild every tested generator output and check actual optimizing compilations.
 *
 * @param item - One completed ordinary or reviewed runtime observation.
 */
export const assertOwnedJvmReceiverGcExecution = async item => {
	assert.equal(item.schemaVersion, 1); assert.ok(["ordinary", "reviewed"].includes(item.mode));
	assert.equal(item.actualLean, true); assert.equal(item.actualGc, true);
	assert.equal(item.installedPackage, false); assert.equal(item.compiler, "c2");
	assert.equal(item.missingFencesRejected, true);
	observed(item.observed); observed(item.restored);
	assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
	const source = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	assert.equal(item.input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(source + ownedRustReceiverSource));
	for(const field of ["hostCallbacks", "transferredInputs", "anchoredResults", "receiverExports"])
		assert.equal(item.input[field], true, field);
	const native = createCompiledNativeModel(item.input, { ownedGraphs: true
		, ownedHostCallbacks: true, ownedInputTransfers: true
		, ownedAnchoredResults: true, ownedReceiverExports: true });
	const model = generateOwnedJvmPackage(native.bindingIr, null, {
		transferredInputs: true, anchoredResults: true, receiverExports: true
	});
	assert.equal(model.functions.filter(fn => fn.receiver === 0).length, 16);
	assert.deepEqual(item.generated, Object.fromEntries(Object.entries(model.files).map(([path, text]) => [path, sha256(text)])));
	assert.equal(item.nativeProbeSha256, sha256(ownedJvmCallNative(item.input).implementation));
	assert.equal(item.javaProbeSha256, sha256(await readFile("tests/fixtures/structured-types/owned-jvm-receiver-gc.java")));
	assert.equal(item.kotlinProbeSha256, sha256(await readFile("tests/fixtures/structured-types/owned-kotlin-receiver-gc.kt")));
	const bindingsPath = Object.keys(model.files).find(path => path.endsWith("/_OwnedBindings.java"));
	let bindings = model.files[bindingsPath];
	const serial = model.functions.findIndex(fn => fn.publicName === "serial");
	for(const family of ["Java", "Kotlin"])
	{
		const head = new RegExp(`(call${family}${serial}\\([^\\n]*\\) \\{\\n)`, "gu");
		assert.equal([...bindings.matchAll(head)].length, 1);
		bindings = bindings.replace(head, "$1        OwnedReceiverGcProbe.beforeScalarCall();\n");
	}
	assert.equal(item.instrumentedBindingsSha256, sha256(bindings));
	assert.deepEqual(item.optimizedMethods, ownedJvmReceiverGcMethods);
	optimized(item, ownedJvmReceiverGcMethods, model.namespace);
	const fence = "finally { java.lang.ref.Reference.reachabilityFence(this); }";
	assert.deepEqual(item.mutations.map(value => value.owner), ["TicketValue", "_OwnedKotlinTicketValue"]);
	for(const mutation of item.mutations)
	{
		const { owner, compilationSha256, optimized: compilations, ...identity } = mutation;
		const path = Object.keys(model.files).find(path => path.endsWith("/" + owner + ".java"));
		assert.ok(model.files[path].includes(fence));
		assert.deepEqual(identity, { path
			, sourceSha256: sha256(model.files[path].replaceAll(fence, "finally { }"))
			, compiled: true, semanticRejection: true });
		optimized({ compilationSha256, optimized: compilations }, [owner + " getSerial"
			, owner === "TicketValue" ? "OwnedReceiverGcProbe ephemeralJava" : "KotlinReceiverGcProbe ephemeral"], model.namespace);
	}
};

/**
 * Require a complete no-skip run and authenticate both language observations.
 *
 * @param record - Complete source-bound optimized receiver GC receipt.
 */
export const assertOwnedJvmReceiverGcAcceptance = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-jvm-receiver-gc");
	assert.equal(record.planNode, 1219); assert.equal(record.acceptance, "passed");
	assert.deepEqual(record.scope, ownedJvmReceiverGcScope);
	assert.equal(record.run.command, ownedJvmReceiverGcCommand);
	assert.equal(record.run.exitCode, 0); assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [key, count] of Object.entries({ tests: 2, pass: 2, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	assert.deepEqual(record.runtime.map(value => value.mode), ["ordinary", "reviewed"]);
	for(const item of record.runtime) await assertOwnedJvmReceiverGcExecution(item);
	// Canonical report files sort object keys; TAP diagnostics preserve insertion order.
	const diagnostics = record.run.text.split("\n").filter(line => line.startsWith("# {")).map(line => JSON.parse(line.slice(2)));
	assert.deepEqual(diagnostics, record.runtime.map(item => ({ mode: item.mode, ...item.observed, optimizedMethods: item.optimizedMethods })));
	assertOwnedJvmReceiverGcCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"), JSON.parse(await readFile("package.json", "utf8")));
};
