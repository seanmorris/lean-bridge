/**
 * Explicit ownership admission at source capture and public build boundaries.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { canonicalizeJsonValue } from "../src/binding-ir/canonical.mjs";
import { sourceApiIdentity } from "../src/analyze/semantic-model.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { prepareLakeEntryIntent, readLakeEntryIntent, writeLakeEntryInputs } from "../src/build/lake-entry-intent.mjs";
import { assertCompiledProfileApiAgreement } from "../src/build/multi-profile-project.mjs";
import { createCompiledNativeModel } from "../src/build/native-graph-model.mjs";
import { createCompiledPhpWasmModel } from "../src/build/php-wasm-graph-model.mjs";
import { ownedDotnetCallbacksReviewedIr } from "./helpers/owned-dotnet-callback-fixture.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const fixture = async (t, reviewed) => {
	const directory = await mkdtemp(join(tmpdir(), "lean-owned-php-wasm-cli-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const project = join(directory, "project");
	await cp("tests/fixtures/onboarding/owned-dotnet-callables", project, { recursive: true });
	const config = reviewed ? { schemaVersion: 1, modules: ["Owned"] }
		: JSON.parse(await readFile(join(project, "lean-bridge.exports.json"), "utf8"));
	delete config.targets;
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(reviewed) await saveLakeFile(project, "reviewed.binding-ir.json", canonicalJson(ownedDotnetCallbacksReviewedIr()));
	return { directory, project };
};

test("ownership reviews round-trip only through explicitly capable analysis intent", async t => {
	const { directory, project } = await fixture(t, true), before = await lakeInputState(project);
	const intent = await prepareLakeEntryIntent({ projectRoot: project, purpose: "analysis", ownedGraphs: true });
	assert.equal(intent.document.schemaVersion, 3);
	assert.equal(JSON.parse(intent.document.reviewedBindingIr.source).schemaVersion, 4);
	const inputRoot = join(directory, "inputs");
	await writeLakeEntryInputs({ intent, outputRoot: inputRoot });
	const checked = await readLakeEntryIntent({ inputRoot, expectedSha256: intent.sha256, purpose: "analysis", ownedGraphs: true });
	assert.deepEqual(checked.document, intent.document);
	await assert.rejects(readLakeEntryIntent({ inputRoot, expectedSha256: intent.sha256, purpose: "analysis" }), { code: "consumer-upgrade-required" });
	await assert.rejects(readLakeEntryIntent({ inputRoot, expectedSha256: intent.sha256, ownedGraphs: true }), { code: "invalid-lake-entry-intent" });
	for(const options of [{}, { purpose: "analysis" }])
		await assert.rejects(prepareLakeEntryIntent({ projectRoot: project, ...options }), { code: "consumer-upgrade-required" });
	for(const options of [{ ownedGraphs: true }, { purpose: "analysis", ownedGraphs: "true" }])
		await assert.rejects(prepareLakeEntryIntent({ projectRoot: project, ...options }), { code: "invalid-lake-entry-intent" });
	assert.deepEqual(await lakeInputState(project), before);
});

for(const reviewed of [false, true]) test(`${reviewed ? "reviewed" : "ordinary"} ownership reaches the PHP-Wasm toolchain without opening npm or WIT`, async t => {
	const { directory, project } = await fixture(t, reviewed), before = await lakeInputState(project);
	const output = join(directory, "release"), environment = { LEAN_BRIDGE_PHP_EMSDK: join(directory, "missing-sdk") };
	await assert.rejects(buildCanonicalProject({ projectRoot: project, outputRoot: output, targets: ["php-wasm"], environment }), { code: "php-wasm-toolchain-unavailable" });
	for(const targets of [["npm"], ["php-wasm", "npm"], ["php-wasm", "wit-wasi"]])
		await assert.rejects(buildCanonicalProject({ projectRoot: project, outputRoot: output, targets, environment }),
			error => error.code === (reviewed ? "consumer-upgrade-required" : "unsupported-export-configuration"));
	assert.deepEqual(await readdir(directory), ["project"]);
	assert.deepEqual(await lakeInputState(project), before);
});

test("ownership-aware ABI comparison preserves policies while copied readers stay closed", async () => {
	const input = structuredClone(JSON.parse(await readFile("docs/evidence/owned-aggregate-execution-20260926.json", "utf8")).inputs.aggregates);
	const source = input.sourceIdentity, snapshot = source.lakeDependencies?.snapshotSha256 ?? "6".repeat(64);
	source.lakeDependencies = { ...source.lakeDependencies, snapshotSha256: snapshot };
	const native = createCompiledNativeModel(input, { ownedGraphs: true, ownedHostCallbacks: true });
	const wasm = createCompiledPhpWasmModel(input);
	const document = { component: input.component
		, reviewedBindingIr: source.reviewedBindingIr
		, source: { treeSha256: source.sourceTreeSha256
			, toolchain: `leanprover/lean4:v${source.leanVersion}`
			, lakeSnapshotSha256: snapshot } };
	const options = { ownedGraphs: true, models: [native, wasm]
		, configurationSha256: source.exportConfigurationSha256
		, intent: { document } };
	assert.match(assertCompiledProfileApiAgreement(options), /^[a-f0-9]{64}$/u);
	assert.throws(() => assertCompiledProfileApiAgreement({ ...options, ownedGraphs: false }), { code: "unsupported-schema" });
	assert.throws(() => sourceApiIdentity(wasm.bindingIr), { code: "unsupported-schema" });
	const identity = sourceApiIdentity(wasm.bindingIr, { ownedGraphs: true });
	assert.deepEqual(identity.document.aggregatePolicy, wasm.bindingIr.aggregatePolicy);
	for(const mutate of [
		value => { value.models[1].pointerBits = 64; }
		, value => { value.models[1].sourceIdentity.exportConfigurationSha256 = "0".repeat(64); }
		, value => { value.models[1].bindingIr.types.find(type => type.kind === "record").fields.reverse(); }
		, value => { value.models[1].bindingIr.aggregatePolicy.fallback = "none"; }
	]) {
		const changed = structuredClone(options); mutate(changed);
		changed.models[1].bindingIrSha256 = sha256(canonicalizeJsonValue(changed.models[1].bindingIr));
		assert.throws(() => assertCompiledProfileApiAgreement(changed));
	}
});
