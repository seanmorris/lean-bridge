/**
 * Keep the scoped producer complete and prevent it from becoming a matrix gate.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import {
	assertOwnedCheckedRecordNpmProducer, ownedCheckedRecordNpmGuard
	, ownedCheckedRecordNpmTagPrefix, ownedCheckedRecordNpmWorkflow
	, selectOwnedCheckedRecordWorkflow
} from "./owned-checked-record-npm-producer.mjs";
import { ownedCheckedRecordHostedLanes } from "./owned-checked-record-hosted-contracts.mjs";
import { ownedCheckedRecordHostedWorkflowContract } from "./owned-checked-record-hosted-evidence.mjs";
import { ownedCheckedRecordEvidenceSources } from "./owned-checked-record-hosted-evidence-sources.mjs";
import { assertOwnedJavaScriptWasmCi } from "./owned-javascript-wasm-ci.mjs";

const read = async () => ({
	scoped: await readFile(ownedCheckedRecordNpmWorkflow, "utf8")
	, recurring: await readFile(".github/workflows/consumer-matrix.yml", "utf8")
});

test("scoped npm producer retains the complete recurring job", async () => {
	const { scoped, recurring } = await read();
	assertOwnedJavaScriptWasmCi(recurring);
	assert.deepEqual(assertOwnedCheckedRecordNpmProducer(scoped, recurring), {
		jobs: 1, workflow: ownedCheckedRecordNpmWorkflow
		, recurring: ".github/workflows/consumer-matrix.yml"
	});
	assert.doesNotMatch(scoped, /^ {2}(?:push|pull_request|support-summary):/mu);
	assert.match(recurring, /^ {2}support-summary:\n {4}name: Publish consumer support summary\n {4}if: always\(\)/mu);
});

test("scoped npm trigger admits only dispatch or its exact commit tag", () => {
	const sha = "a".repeat(40), ref = ownedCheckedRecordNpmTagPrefix + sha;
	for(const [eventName, type, name, expected] of [
		["workflow_dispatch", undefined, undefined, true]
		, ["create", "tag", ref, true]
		, ["create", "branch", ref, false]
		, ["create", "tag", ownedCheckedRecordNpmTagPrefix + "b".repeat(40), false]
		, ["create", "tag", "v1.0.0", false]
		, ["push", "tag", ref, false]
		, ["pull_request", "tag", ref, false]
		, ["create", "tag", ref + "/extra", false]
	]) {
		const accepted = runInNewContext(ownedCheckedRecordNpmGuard.slice(3, -2), {
			github: { event_name: eventName, sha, event: { ref_type: type, ref: name } }
			, format: (pattern, value) => pattern.replace("{0}", value)
		}, { timeout: 1000 });
		assert.equal(accepted, expected, eventName + "/" + type + "/" + name);
	}
});

test("scoped npm producer rejects narrowed execution and widened triggers", async () => {
	const { scoped, recurring } = await read();
	assertOwnedCheckedRecordNpmProducer(scoped, recurring);
	for(const [before, after] of [
		["  create:\n", "  push:\n"]
		, ["  contents: read", "  contents: write"]
		, ["  cancel-in-progress: false", "  cancel-in-progress: true"]
		, [ownedCheckedRecordNpmGuard, "true"]
		, ["    timeout-minutes: 90", "    timeout-minutes: 1"]
		, ['      LEAN_BRIDGE_OWNED_CHECKED_RECORD_BROWSER_TEST: "1"'
			, '      LEAN_BRIDGE_OWNED_CHECKED_RECORD_BROWSER_TEST: "0"']
		, ["chromium firefox webkit", "chromium"]
		, ["tests/owned-checked-record-javascript-packaging.test.mjs", "tests/unrelated.test.mjs"]
		, ["ordinary-full ordinary-result-only reviewed-full reviewed-result-only", "ordinary-full"]
		, ['tee "$checked_record_log" || checked_record_status=$?'
			, 'tee "$checked_record_log" || true']
		, ["            build/owned-checked-record-javascript-packaging/\n", ""]
	]) {
		const changed = scoped.replace(before, after);
		assert.notEqual(changed, scoped);
		assert.throws(() => assertOwnedCheckedRecordNpmProducer(changed, recurring));
	}
	assert.throws(() => assertOwnedCheckedRecordNpmProducer(scoped
		+ "\n  extra:\n    runs-on: ubuntu-24.04\n", recurring));
	assert.throws(() => assertOwnedCheckedRecordNpmProducer(scoped, recurring.replace(
		"  owned-javascript-wasm:\n", "  owned-javascript-wasm:\n    if: false\n"
	)));
});

test("owned hosted workflow selection remains closed for every lane", () => {
	for(const lane of Object.values(ownedCheckedRecordHostedLanes))
	{
		assert.equal(selectOwnedCheckedRecordWorkflow(lane), lane.workflow);
		assert.equal(selectOwnedCheckedRecordWorkflow(lane, lane.workflow), lane.workflow);
		if(lane.kind === "javascript")
			assert.equal(selectOwnedCheckedRecordWorkflow(lane, ownedCheckedRecordNpmWorkflow), ownedCheckedRecordNpmWorkflow);
		else assert.throws(() => selectOwnedCheckedRecordWorkflow(lane, ownedCheckedRecordNpmWorkflow));
		for(const workflow of [".github/workflows/unrelated.yml", "../consumer-matrix.yml", null, 1])
			assert.throws(() => selectOwnedCheckedRecordWorkflow(lane, workflow));
	}
});

test("scoped npm evidence requires a terminal successful run", () => {
	const lane = ownedCheckedRecordHostedLanes.javascript;
	const run = { path: ownedCheckedRecordNpmWorkflow, status: "completed", conclusion: "success" };
	const contract = ownedCheckedRecordHostedWorkflowContract(lane, run);
	assert.equal(contract.workflow, run.path);
	assert.equal(contract.jobName, lane.job);
	assert.deepEqual(contract.conclusions, { run: "success", job: "success" });
	for(const change of [{ path: undefined }
		, { path: ".github/workflows/other.yml" }
		, { status: "in_progress" }, { conclusion: "failure" }
		, { conclusion: "cancelled" }, { conclusion: "skipped" }])
		assert.throws(() => ownedCheckedRecordHostedWorkflowContract(lane, { ...run, ...change }));
	for(const conclusions of [{ run: "success", job: "failure" }
		, { run: "failure", job: "success" }
		, { run: "success", job: "success", forged: true }])
		assert.throws(() => ownedCheckedRecordHostedWorkflowContract(lane, run, conclusions));
	const old = ownedCheckedRecordHostedWorkflowContract(lane
		, { ...run, path: lane.workflow, conclusion: "failure" });
	assert.deepEqual(old.conclusions, { run: "failure", job: "success" }
		, "A successful recurring job may coexist with unrelated failed jobs");
});

test("scoped npm source selection refuses unknown workflow before Git reads", () => {
	const revisions = Object.fromEntries(["producer", "consumer", "checker", "archiver"]
		.map(role => [role, "0".repeat(40)]));
	assert.throws(() => ownedCheckedRecordEvidenceSources("javascript", revisions
		, ".github/workflows/unknown.yml"), /Unknown owned checked-record producer workflow/u);
});

test("committed scoped npm sources retain both exact workflows", () => {
	const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	const revisions = Object.fromEntries(["producer", "consumer", "checker", "archiver"]
		.map(role => [role, revision]));
	const recurring = ownedCheckedRecordEvidenceSources("javascript", revisions);
	const scoped = ownedCheckedRecordEvidenceSources("javascript", revisions, ownedCheckedRecordNpmWorkflow);
	const extra = { role: "producer", revision, path: ownedCheckedRecordNpmWorkflow };
	assert.ok(scoped.some(item => item.role === extra.role && item.path === extra.path));
	assert.deepEqual(scoped.filter(item => !(item.role === extra.role && item.path === extra.path)), recurring);
});
