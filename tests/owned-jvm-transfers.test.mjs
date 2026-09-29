/**
 * Compiled Java/Kotlin consuming inputs, callback visibility and fault cleanup.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedJvmCalls } from "../src/backends/jvm/owned-calls.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";
import { ownedRustTransferConfiguration, ownedRustTransferReviewedIr, ownedRustTransferSource } from "./helpers/owned-rust-transfer-fixture.mjs";
import { compileOwnedJvmCallNative, compileOwnedJvmCallSources, ownedJvmCallProbeMethods } from "./helpers/owned-jvm-call-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("JVM consuming inputs require capability and preserve borrow-only APIs", () => {
	const ir = ownedRustTransferReviewedIr(), original = structuredClone(ir);
	assert.throws(() => generateOwnedJvmCalls(ir), /call-scoped input borrows/u);
	const generated = generateOwnedJvmCalls(ir, { transferredInputs: true });
	assert.deepEqual(ir, original);
	assert.equal(generated.functions.filter(fn => fn.transfers?.length).length, 20);
	const source = Object.values(generated.files).join("\n");
	assert.match(source, /finally \{ moves.finish\(\); \}/u);
	assert.match(source, /synchronized boolean consumed\(\)/u);
	assert.match(source, /shared \? Arena.ofShared\(\) : Arena.ofConfined\(\)/u);
	const reversed = structuredClone(ir); reversed.types.reverse();
	assert.deepEqual(generateOwnedJvmCalls(reversed, { transferredInputs: true }).files, generated.files);
	for(const fixture of [ownedCppCompositionReviewedIr, ownedPythonScalarsReviewedIr])
		assert.deepEqual(generateOwnedJvmCalls(fixture(), { transferredInputs: true }).files, generateOwnedJvmCalls(fixture()).files);
});

for(const mode of ["ordinary", "reviewed"]) test(`Java/Kotlin leases follow the compiled Lean handoff (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_JVM_TRANSFER_TEST !== "1", timeout: 900000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		...(mode === "ordinary" ? { configuration: await ownedRustTransferConfiguration() } : { reviewedIr: ownedRustTransferReviewedIr() })
		, hostCallbacks: true, sourceSuffix: ownedRustTransferSource
		, evidenceName: `jvm-transfers-${mode}-inputs.json`
	});
	const native = await compileOwnedJvmCallNative(compiled, { transferredInputs: true });
	const model = generateOwnedJvmCalls(compiled.model.bindingIr, { transferredInputs: true });
	const files = { ...model.files }, runtime = Object.keys(files).find(path => path.endsWith("/_OwnedRuntime.java"));
	assert.equal(files[runtime].split("static void checkpoint() { }").length, 2);
	files[runtime] = files[runtime].replace("static void checkpoint() { }", "static void checkpoint() { OwnedTransferProbe.allocation(); }");
	for(const [file, kotlin] of [["owned-jvm-transfers.java", false], ["owned-kotlin-transfers.kt", true]])
	{
		const template = await readFile(`tests/fixtures/structured-types/${file}`, "utf8");
		assert.equal(template.split("/* METHODS */").length, 2);
		files[kotlin ? "KotlinTransferProbe.kt" : "OwnedTransferProbe.java"] = template.replace("/* METHODS */", () => ownedJvmCallProbeMethods(model, kotlin));
	}
	let observed;
	try
	{
		const toolchain = await compileOwnedJvmCallSources(compiled.directory, files);
		const run = await runCopied(toolchain.java, [
			"--enable-native-access=ALL-UNNAMED", "-cp", "classes:" + toolchain.stdlib
			, model.namespace + ".OwnedTransferProbe"
			, join(compiled.directory, "libprobe.so")
		], compiled.directory);
		assert.equal(run.stderr, ""); observed = JSON.parse(run.stdout.trim());
	}
	catch(error)
	{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
	assert.ok(observed.javaChecks > 500); assert.ok(observed.kotlinChecks > 500);
	for(const language of ["javaFaults", "kotlinFaults"])
	{
		assert.equal(observed[language].length, 8);
		assert.ok(observed[language].every(count => Number.isSafeInteger(count) && count > 0));
	}
	assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
	assert.equal(observed.threadExits, 4); assert.equal(observed.threadExitErrors, 0);
	t.diagnostic(JSON.stringify(observed));
	await saveLakeFile(resolve("build/owned-jvm-transfers"), `${mode}.json`, canonicalJson({
		mode, actualLean: true, installedPackage: false, observed, input: native.input
		, generated: Object.fromEntries(Object.entries(model.files).map(([path, text]) => [path, sha256(text)]))
		, instrumentedRuntimeSha256: sha256(files[runtime])
		, javaProbeSha256: sha256(files["OwnedTransferProbe.java"])
		, kotlinProbeSha256: sha256(files["KotlinTransferProbe.kt"])
		, nativeProbeSha256: sha256(native.implementation)
		, guardSha256: sha256(native.cleanup.guardSource)
	}));
});
