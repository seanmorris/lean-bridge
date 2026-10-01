/**
 * Compile public JVM receiver members alongside original-owner regressions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedJvmCalls } from "../src/backends/jvm/owned-calls.mjs";
import { generateOwnedJvmPackage } from "../src/backends/jvm/owned-package.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { ownedRustBorrowReviewedIr } from "./helpers/owned-rust-borrow-fixture.mjs";
import { ownedRustReceiverConfiguration, ownedRustReceiverReviewedIr, ownedRustReceiverSource
	, ownedRustPlainReceiverReviewedIr } from "./helpers/owned-rust-receiver-fixture.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { compileOwnedJvmCallNative, compileOwnedJvmCallSources, ownedJvmCallProbeMethods } from "./helpers/owned-jvm-call-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { rejectOwnedJvmReceiverMisuse } from "./helpers/owned-jvm-receiver-rejections.mjs";

const options = { transferredInputs: true, anchoredResults: true, receiverExports: true };

test("JVM receiver core preserves original slots and older generated APIs", () => {
	const ir = ownedRustReceiverReviewedIr(), previous = structuredClone(ir);
	assert.throws(() => generateOwnedJvmCalls(ir, { ...options, receiverExports: false }), /only synchronous function/u);
	const generated = generateOwnedJvmCalls(ir, options);
	assert.deepEqual(ir, previous);
	assert.equal(generated.functions.length, 27);
	assert.equal(generated.functions.filter(fn => fn.receiver === 0).length, 16);
	assert.equal(generated.functions.filter(fn => fn.anchor !== undefined).length, 20);
	assert.equal(generated.functions.find(fn => fn.publicName === "chooseTicket").anchor, 1);
	for(const previous of [ownedAggregateReviewedIr(), ownedRustBorrowReviewedIr()])
		assert.deepEqual(generateOwnedJvmCalls(previous, options).files, generateOwnedJvmCalls(previous, { ...options, receiverExports: false }).files);
	for(const consuming of [false, true])
	{
		const plain = generateOwnedJvmCalls(ownedRustPlainReceiverReviewedIr(consuming), {
			receiverExports: true, transferredInputs: consuming, hostCallbacks: false
		});
		assert.equal(plain.c.anchoredResults, undefined);
		assert.doesNotMatch(Object.values(plain.files).join("\n"), /result_validate/u);
		assert.match(Object.values(plain.files).join("\n"), /final boolean borrowedResult, whole/u);
	}
});

for(const mode of ["ordinary", "reviewed"]) test(`JVM receiver core retains original lifetime regressions (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_JVM_RECEIVER_TEST !== "1", timeout: 900000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		...mode === "ordinary" ? { configuration: await ownedRustReceiverConfiguration() } : { reviewedIr: ownedRustReceiverReviewedIr() }
		, hostCallbacks: true, sourceSuffix: ownedRustReceiverSource
		, evidenceName: `jvm-receiver-core-${mode}-inputs.json`
	});
	const native = await compileOwnedJvmCallNative(compiled, options);
	const model = generateOwnedJvmPackage(compiled.model.bindingIr, null, options), files = { ...model.files };
	const loader = Object.keys(files).find(path => path.endsWith("/_OwnedLoader.java"));
	files[loader] = `package ${model.namespace};
final class _OwnedLoader {
    static _OwnedBindings bindings() { return OwnedBorrowProbe.bindings; }
}
`;
	const runtime = Object.keys(files).find(path => path.endsWith("/_OwnedRuntime.java"));
	assert.equal(files[runtime].split("static void checkpoint() { }").length, 2);
	files[runtime] = files[runtime].replace("static void checkpoint() { }", "static void checkpoint() { OwnedBorrowProbe.allocation(); }");
	assert.equal(files[runtime].split("if (closed.get()) check(4);").length, 2);
	files[runtime] = files[runtime].replace("if (closed.get()) check(4);", "if (closed.get()) check(4); OwnedBorrowProbe.afterWholeReadCheck();");
	for(const [file, kotlin] of [["owned-jvm-borrows.java", false], ["owned-kotlin-borrows.kt", true]])
	{
		let template = await readFile(`tests/fixtures/structured-types/${file}`, "utf8");
		const members = await readFile(`tests/fixtures/structured-types/${kotlin ? "owned-kotlin-receiver-members.kt" : "owned-jvm-receiver-members.java"}`, "utf8");
		assert.equal(template.split("/* METHODS */").length, 2);
		template = template.replace("/* METHODS */", "/* METHODS */\n" + members);
		const calls = kotlin ? "shapes(); callbacksAndTransfers()" : "shapes(); callbacks(); transfers();";
		assert.equal(template.split(calls).length, 2);
		template = template.replace(calls, "receiverMembers(); " + calls);
		assert.equal(template.split("/* METHODS */").length, 2);
		files[kotlin ? "KotlinBorrowProbe.kt" : "OwnedBorrowProbe.java"] = template.replace("/* METHODS */", () => ownedJvmCallProbeMethods(model, kotlin));
	}
	let observed;
	try
	{
		const toolchain = await compileOwnedJvmCallSources(compiled.directory, files);
		const run = await runCopied(toolchain.java, [
			"--enable-native-access=ALL-UNNAMED", "-cp", "classes:" + toolchain.stdlib
			, model.namespace + ".OwnedBorrowProbe"
			, join(compiled.directory, "libprobe.so")
		], compiled.directory);
		assert.equal(run.stderr, ""); observed = JSON.parse(run.stdout.trim());
	}
	catch(error)
	{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
	assert.ok(observed.javaChecks > 100); assert.ok(observed.kotlinChecks > 100);
	assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
	assert.equal(observed.threadExits, 2); assert.equal(observed.threadExitErrors, 0);
	for(const faults of [observed.faults, observed.kotlinFaults])
	{ assert.equal(faults.length, 4); assert.ok(faults.every(count => Number.isSafeInteger(count) && count > 0)); }
	const compileRejections = await rejectOwnedJvmReceiverMisuse(compiled.directory, model.namespace);
	assert.equal(compileRejections.length, 10);
	const owner = Object.keys(files).find(path => path.endsWith("/TicketValue.java"));
	const conversions = Object.keys(files).find(path => path.endsWith("/_OwnedConvert.java"));
	const selected = model.functions.findIndex(fn => fn.publicName === "chooseTicket");
	const mutations = [
		["receiver-used-as-parameter-anchor", [[owner, `bindings.callJava${selected}(get(), arg1)`, `bindings.callJava${selected}(get(), this)`]], /member selects other owner/u]
		, ["retained-member-shares-original", [[owner, "return (TicketValue)super.retain();", "return share();"]], /LeanBridgeException/u]
		, ["unchecked-whole-value", [[runtime, "T get() { T snapshot = value; lease.require(); if", "T get() { T snapshot = value; if"]], /Expected org\.leanbridge.*LeanBridgeException/u]
		, ["escaped-callback-frame-and-views"
			, [
			[runtime, "scope.active = false;", "scope.active = true;"]
			, [conversions, "try { handle.close(); }", "try { if (handle.lease.scope == null) handle.close(); }"]
			]
			, /callback member expires with its frame/u]
	];
	const rejectedMutations = [];
	for(const [name, changes, pattern] of mutations)
	{
		const changed = {};
		for(const [path, before, after] of changes)
		{
			assert.equal(files[path].split(before).length, 2, name);
			changed[path] = files[path].replace(before, after);
		}
		const toolchain = await compileOwnedJvmCallSources(compiled.directory, { ...files, ...changed });
		await assert.rejects(runCopied(toolchain.java, [
			"--enable-native-access=ALL-UNNAMED", "-cp", "classes:" + toolchain.stdlib
			, model.namespace + ".OwnedBorrowProbe"
			, join(compiled.directory, "libprobe.so")
		], compiled.directory), error => {
			assert.match(error.details.stderr, pattern, name); return true;
		}, name);
		rejectedMutations.push({ name, compiled: true
			, sources: Object.fromEntries(Object.entries(changed).map(([path, source]) => [path, sha256(source)])) });
		t.diagnostic(`${mode}: rejected compiled mutant ${name}`);
	}
	const restored = await compileOwnedJvmCallSources(compiled.directory, files);
	const replay = await runCopied(restored.java, ["--enable-native-access=ALL-UNNAMED"
		, "-cp", "classes:" + restored.stdlib, model.namespace + ".OwnedBorrowProbe"
		, join(compiled.directory, "libprobe.so")], compiled.directory);
	assert.equal(replay.stderr, ""); assert.deepEqual(JSON.parse(replay.stdout.trim()), observed);
	await saveLakeFile("build/owned-jvm-receiver-core", `${mode}.json`, canonicalJson({
		mode, actualLean: true, installedPackage: false, nominalMembers: true
		, observed, compileRejections, rejectedMutations, restored: true
		, input: native.input
		, generated: Object.fromEntries(Object.entries(model.files).map(([path, text]) => [path, sha256(text)]))
		, nativeProbeSha256: sha256(native.implementation)
		, javaProbeSha256: sha256(files["OwnedBorrowProbe.java"])
		, kotlinProbeSha256: sha256(files["KotlinBorrowProbe.kt"])
		, testLoaderSha256: sha256(files[loader])
	}));
	t.diagnostic(JSON.stringify({ mode, ...observed }));
});
