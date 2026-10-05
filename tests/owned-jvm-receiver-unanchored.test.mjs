/**
 * Receiver owners and callable replies work without a result-anchor capability.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedJvmPackage } from "../src/backends/jvm/owned-package.mjs";
import { ownedRustReceiverConfiguration, ownedRustReceiverReviewedIr, ownedRustReceiverSource } from "./helpers/owned-rust-receiver-fixture.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { compileOwnedJvmCallNative, compileOwnedJvmCallSources } from "./helpers/owned-jvm-call-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

for(const mode of ["ordinary", "reviewed"]) test(`JVM receiver callables need no result anchors (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_JVM_RECEIVER_TEST !== "1", timeout: 600000
}, async t => {
	const configuration = await ownedRustReceiverConfiguration();
	for(const [name, contract] of Object.entries(configuration.contracts))
	{
		delete contract.result;
		if(Object.keys(contract).length === 0) delete configuration.contracts[name];
	}
	const ir = ownedRustReceiverReviewedIr();
	for(const fn of ir.declarations) if(fn.result.ownership === "borrow")
		Object.assign(fn.result, { ownership: "lease", lifetime: { scope: "explicit", anchor: null } });
	const compiled = await compileOwnedAggregateFixture(t, {
		...mode === "ordinary" ? { configuration } : { reviewedIr: ir }
		, hostCallbacks: true, sourceSuffix: ownedRustReceiverSource
		, evidenceName: `jvm-receiver-${mode}-unanchored-inputs.json`
	});
	const options = { transferredInputs: true, hostCallbacks: true, receiverExports: true };
	const native = await compileOwnedJvmCallNative(compiled, options);
	const model = generateOwnedJvmPackage(compiled.model.bindingIr, null, options);
	assert.equal(model.c.anchoredResults, undefined);
	assert.equal(model.contract.resultAnchors, undefined);
	assert.ok(!model.functions.some(fn => fn.anchor !== undefined));
	assert.doesNotMatch(Object.values(model.files).join("\n"), /result_validate/u);
	const files = { ...model.files
		, "UnanchoredReceiverProbe.java": await readFile("tests/fixtures/structured-types/owned-jvm-receiver-unanchored.java", "utf8")
		, "KotlinUnanchoredReceiverProbe.kt": await readFile("tests/fixtures/structured-types/owned-kotlin-receiver-unanchored.kt", "utf8") };
	const loader = Object.keys(files).find(path => path.endsWith("/_OwnedLoader.java"));
	files[loader] = `package ${model.namespace};
final class _OwnedLoader {
    static _OwnedBindings bindings() { return UnanchoredReceiverProbe.bindings; }
}
`;
	let observed;
	try
	{
		const toolchain = await compileOwnedJvmCallSources(compiled.directory, files);
		const run = await runCopied(toolchain.java, ["--enable-native-access=ALL-UNNAMED"
			, "-cp", "classes:" + toolchain.stdlib
			, model.namespace + ".UnanchoredReceiverProbe"
			, join(compiled.directory, "libprobe.so")], compiled.directory);
		assert.equal(run.stderr, ""); observed = JSON.parse(run.stdout.trim());
	}
	catch(error)
	{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
	assert.deepEqual(observed, { javaChecks: 8, kotlinChecks: 8, live: 0, identities: 0 });
	await saveLakeFile("build/owned-jvm-receiver-core", `${mode}-unanchored.json`, canonicalJson({
		mode, actualLean: true, installedPackage: false, resultAnchors: false
		, observed, input: native.input
		, generated: Object.fromEntries(Object.entries(model.files).map(([path, text]) => [path, sha256(text)]))
		, nativeProbeSha256: sha256(native.implementation)
		, javaProbeSha256: sha256(files["UnanchoredReceiverProbe.java"])
		, kotlinProbeSha256: sha256(files["KotlinUnanchoredReceiverProbe.kt"])
		, testLoaderSha256: sha256(files[loader])
	}));
	t.diagnostic(JSON.stringify({ mode, ...observed }));
});
