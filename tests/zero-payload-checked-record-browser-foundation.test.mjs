/**
 * Compile zero-payload checked records through the npm component profile before installed
 * Node and browser acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { reviewedContractDifference } from "../src/analyze/reviewed-source.mjs";
import { inspectLeanProject } from "../src/analyze/lean-project.mjs";
import { createComponentBuildPlan } from "../src/build/component-plan.mjs";
import { generateCompilerAdapters } from "../src/build/compiler-adapters.mjs";
import { prepareLakeEntryIntent } from "../src/build/lake-entry-intent.mjs";
import { resolveLakeBuildWorkspace } from "../src/build/lake-build-workspace.mjs";
import { elaborateLakeEntryModules } from "../src/build/lake-entry-elaboration.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";
import {
	zeroPayloadCheckedRecordContracts
	, zeroPayloadCheckedRecordFixture
	, zeroPayloadCheckedRecordModule
	, zeroPayloadCheckedRecordReview
} from "./helpers/zero-payload-checked-record-fixture.mjs";

const enabled = process.env.LEAN_BRIDGE_ZERO_PAYLOAD_CHECKED_RECORD_BROWSER_FOUNDATION_TEST === "1";
const leanPrefix = join(process.cwd()
	, ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");

test("npm adapters preserve nullary checked construction and empty result carriers", {
	skip: !enabled, timeout: 900_000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-zero-payload-npm-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const projectRoot = join(directory, "project");
	await cp(zeroPayloadCheckedRecordFixture, projectRoot, { recursive: true });
	const contracts = zeroPayloadCheckedRecordContracts();
	await writeFile(join(projectRoot, "lean-bridge.exports.json"), canonicalJson({
		schemaVersion: 1
		, modules: [zeroPayloadCheckedRecordModule]
		, exports: Object.keys(contracts)
		, contracts
		, targets: { npm: { name: "zeropayloadcheckedrecords", version: "1.0.0" } }
	}));
	const intent = await prepareLakeEntryIntent({ projectRoot });
	const workspace = await resolveLakeBuildWorkspace({
		snapshot: intent.lakeSnapshot
		, modules: intent.document.modules.map(entry => entry.module)
		, leanPrefix
	});
	let analysis;
	try
	{
		analysis = await elaborateLakeEntryModules({
			inventory: await inspectLeanProject(projectRoot)
			, entries: intent.document.modules
			, workspace
			, leanPrefix
			, engineRoot: process.cwd()
		});
	}
	finally
	{
		await workspace.dispose();
	}
	await assertJsonSchema("elaborated-export-metadata", analysis.elaboration.metadata);
	assert.equal(reviewedContractDifference(
		zeroPayloadCheckedRecordReview(), analysis.bindingIr.document
	), null);
	const graph = JSON.parse(await readFile(
		"poc/lean-link-spike/graph-lock.json", "utf8"
	));
	const componentPlan = createComponentBuildPlan({
		analysis
		, runtime: graph.runtime
		, targets: ["npm"]
		, lakeSnapshotSha256: intent.lakeSnapshot.sha256
	});
	const { plan, files } = generateCompilerAdapters({ analysis, componentPlan });
	await assertJsonSchema("compiler-adapter-plan", plan);
	assert.deepEqual(plan.privateAbi.types.map(item => [item.id, item.erased]), [
		[`lean:${zeroPayloadCheckedRecordModule}.Marker`, undefined]
		, [`lean:${zeroPayloadCheckedRecordModule}.Token`, ["fresh"]]
		, [`lean:${zeroPayloadCheckedRecordModule}.Witness`, ["positive"]]
	]);
	const source = files["LeanBridgeGenerated.lean"];
	assert.match(source, /structure LbErased\.ZeroPayloadCheckedRecords\.Witness where\n\ndef/u);
	assert.match(source, /_root_\.ZeroPayloadCheckedRecords\.mkWitness\b/u);
	assert.match(source, /_root_\.ZeroPayloadCheckedRecords\.mkAbsent\b/u);
	assert.match(source, /LbErased\.ZeroPayloadCheckedRecords\.Witness\.erase/u);
	assert.doesNotMatch(source
		, /_root_\.ZeroPayloadCheckedRecords\.Witness\.mk|⟨/u);
	const fixture = await readFile(join(
		zeroPayloadCheckedRecordFixture, `${zeroPayloadCheckedRecordModule}.lean`
	), "utf8");
	await writeFile(join(directory, "Generated.lean")
		, `${fixture}\n${source.replace(/^import ZeroPayloadCheckedRecords$/mu, "")}`);
	const run = await processBuildRunner.capture({
		command: join(leanPrefix, "bin/lean")
		, args: ["-c", join(directory, "Generated.c"), "Generated.lean"]
		, cwd: directory
		, timeoutMs: 600_000
	});
	assert.equal(run.stderr, "");
});
