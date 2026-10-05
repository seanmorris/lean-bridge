/**
 * Keep owned npm engine requests source-only and separate from copied builds.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { createEngineExecutionRequest, readVerifiedEngineExecutionRequest, validateEngineExecutionRequest, writeEngineExecutionRequest } from "../src/build/engine-execution-request.mjs";
import { prepareLakeEntryIntent, readLakeEntryIntent, writeLakeEntryInputs } from "../src/build/lake-entry-intent.mjs";
import { ownedAnalysisFixture } from "./helpers/owned-analysis.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";

for(const reviewed of [false, true]) test(`owned npm ${reviewed ? "reviewed" : "ordinary"} engine request binds source-only intent and a closed output set`, async t => {
	const { directory, root } = await ownedAnalysisFixture(t, reviewed);
	const intent = await prepareLakeEntryIntent({ projectRoot: root, purpose: "owned-javascript", ownedGraphs: true });
	await assertJsonSchema("lake-entry-intent", intent.document);
	const inputRoot = join(directory, "input"), output = join(directory, "request.json");
	await writeLakeEntryInputs({ intent, outputRoot: inputRoot });
	const options = { engineRoot: resolve("."), inputRoot, entryIntent: intent, purpose: "owned-javascript", targets: ["npm"] };
	const request = await writeEngineExecutionRequest({ ...options, output });
	await assertJsonSchema("engine-execution-request", request.document);
	assert.equal(request.document.schemaVersion, 4);
	assert.equal(request.document.output.kind, "compiler-owned-javascript-component");
	assert.equal(request.document.output.bundleDirectory, "component");
	assert.deepEqual(request.document.targets, ["npm"]);
	assert.equal(request.document.policies.compilerOwnedTypes, true);
	assert.equal(request.document.policies.compileOnce, true);
	assert.equal(request.document.policies.sharedRuntime, true);
	assert.equal(Object.hasOwn(request.document.policies, "noAdapterCompilation"), false);
	assert.ok(request.document.output.authorizedFiles.includes("lib/component.so.wasm"));
	assert.ok(request.document.output.authorizedFiles.includes("source-notices.json"));
	assert.equal(request.document.output.authorizedFiles.some(path => path.includes("runtime.wasm") || path.endsWith(".olean")), false);
	assert.equal((await readVerifiedEngineExecutionRequest({ requestPath: output, engineRoot: resolve("."), inputRoot })).sha256, request.sha256);
	await assert.rejects(readLakeEntryIntent({ inputRoot, expectedSha256: intent.sha256 }), /intent/);
	await assert.rejects(createEngineExecutionRequest({ ...options, purpose: "build" }), /intent/);
	await assert.rejects(createEngineExecutionRequest({ ...options, purpose: "analysis" }), /intent/);
	await assert.rejects(createEngineExecutionRequest({ ...options, targets: ["npm", "c"] }), /target/i);
	await assert.rejects(createEngineExecutionRequest({ ...options, targets: [] }), /target/i);
	const changes = [value => { value.output.bundleDirectory = "bundle"; }
		, value => { value.output.kind = "component-neutral-release-bundle"; }
		, value => { value.policies.noAdapterCompilation = true; }
		, value => { delete value.policies.compilerOwnedTypes; }
		, value => { value.targets = ["c"]; }
		, value => { value.component.componentPlanSha256 = "0".repeat(64); }];
	for(const change of changes)
	{
		const changed = structuredClone(request.document); change(changed);
		assert.throws(() => validateEngineExecutionRequest(changed), { code: "invalid-engine-execution-request" });
	}
	const relocated = join(directory, "relocated");
	await writeLakeEntryInputs({ intent, outputRoot: relocated });
	assert.deepEqual((await createEngineExecutionRequest({ ...options, inputRoot: relocated })).document, request.document);
	const source = await readFile(join(inputRoot, "lake/root/Owned.lean"), "utf8");
	await saveLakeFile(inputRoot, "lake/root/Owned.lean", source + "\n-- changed\n");
	await assert.rejects(readVerifiedEngineExecutionRequest({ requestPath: output, engineRoot: resolve("."), inputRoot }));
	assert.equal(await readFile(output, "utf8"), canonicalJson(request.document));
});

test("owned npm engine intent requires ownership admission instead of widening copied builds", async t => {
	const { root } = await ownedAnalysisFixture(t, false);
	await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Owned"] }));
	await assert.rejects(prepareLakeEntryIntent({ projectRoot: root, purpose: "owned-javascript", ownedGraphs: true }), /ownership/i);
	await assert.rejects(prepareLakeEntryIntent({ projectRoot: root, purpose: "owned-javascript" }), /ownership/i);
	await assert.rejects(prepareLakeEntryIntent({ projectRoot: root, ownedGraphs: true }), /ownership/i);
});
