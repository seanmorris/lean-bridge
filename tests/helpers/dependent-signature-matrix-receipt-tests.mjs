/**
 * Fast conservation and substitution controls for the focused receipt.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import {
	buildDependentSignatureMatrixReceipt
	, dependentSignatureFocusedWorkflow
	, dependentSignatureMatrixArtifactName
	, dependentSignatureMatrixLanes
	, dependentSignatureMatrixResultPath
	, dependentSignatureMatrixRoutes
	, validateDependentSignatureMatrixReceipt
} from "./dependent-signature-matrix-receipt.mjs";

const producerCommit = "a".repeat(40);
const options = {
	repository: "owner/repository", workflow: dependentSignatureFocusedWorkflow
	, runId: 123, runAttempt: 2, producerCommit
};
const mode = route => route.startsWith("result-only-")
	? "result-only" : "full";
const reviewed = route => route.endsWith("reviewed-ir");
const result = (lane, route) => {
	const value = { route, producerCommit };
	for(const key of lane.required) value[key] = 1;
	if(lane.required.includes("sourceIdentities")) value.sourceIdentities = {
		producer: producerCommit, checker: producerCommit
	};
	if(lane.required.includes("consumerCommit"))
		value.consumerCommit = producerCommit;
	if(lane.required.includes("profiles")) value.profiles = [...lane.profiles];
	if(lane.required.includes("executions")) value.executions = 1;
	if(lane.required.includes("mode")) value.mode = mode(route);
	if(lane.required.includes("resultOnly"))
		value.resultOnly = mode(route) === "result-only";
	if(lane.required.includes("reviewed")) value.reviewed = reviewed(route);
	return value;
};
const records = () => {
	const values = new Map();
	for(const lane of dependentSignatureMatrixLanes)
		for(const route of dependentSignatureMatrixRoutes)
			values.set(
				dependentSignatureMatrixResultPath(lane, route, producerCommit)
				, Buffer.from(canonicalJson(result(lane, route)))
			);
	return values;
};
const build = values => buildDependentSignatureMatrixReceipt(path => {
	assert.ok(values.has(path), path); return values.get(path);
}, options);

test("focused dependent-signature receipt conserves 44 reports and 34 cells"
	, async () => {
	const receipt = await build(records());
	assert.deepEqual(receipt.matrix, {
		lanes: 11, profiles: 17, authorRoutes: 2, apiModes: 2
		, reports: 44, cells: 34
	});
	assert.equal(receipt.records.length, 44);
	assert.equal(new Set(receipt.records.map(item => item.artifact)).size, 11);
	assert.doesNotThrow(() => validateDependentSignatureMatrixReceipt(receipt));
	for(const lane of dependentSignatureMatrixLanes)
		assert.equal(dependentSignatureMatrixArtifactName(lane, producerCommit)
			, `dependent-checked-record-${lane.workflowStem}-${producerCommit}`);
	}
);

test("focused receipt refuses missing, substituted and noncanonical reports"
	, async t => {
	const complete = records();
	const firstPath = [...complete.keys()][0];
	for(const [name, change] of [
		["missing", values => values.delete(firstPath)]
		, ["noncanonical", values => {
			const parsed = JSON.parse(values.get(firstPath));
			values.set(firstPath, Buffer.from(JSON.stringify(parsed, null, 2)));
		}]
		, ["producer", values => {
			const parsed = JSON.parse(values.get(firstPath));
			parsed.producerCommit = "b".repeat(40);
			values.set(firstPath, Buffer.from(canonicalJson(parsed)));
		}]
		, ["route", values => {
			const parsed = JSON.parse(values.get(firstPath));
			parsed.route = "reviewed-ir";
			values.set(firstPath, Buffer.from(canonicalJson(parsed)));
		}]
	]) await t.test(name, async () => {
		const changed = new Map(complete); change(changed);
		await assert.rejects(build(changed));
	}
	);
	}
);

test("retained receipt refuses derived counts, identities and record hashes"
	, async () => {
	const receipt = await build(records());
	for(const changed of [
		{ ...receipt, matrix: { ...receipt.matrix, cells: 33 } }
		, { ...receipt, run: { ...receipt.run, workflow: "other.yml" } }
		, { ...receipt, records: receipt.records.slice(1) }
		, { ...receipt, records: receipt.records.map((record, index) =>
			index ? record : { ...record, sha256: "0".repeat(64) }) }
	]) assert.throws(() => validateDependentSignatureMatrixReceipt(changed));
	}
);

test("all eleven focused producers expose reusable closed verification output"
	, async () => {
	for(const lane of dependentSignatureMatrixLanes)
	{
		const workflow = await readFile(
			`.github/workflows/dependent-checked-record-${lane.workflowStem}.yml`
			, "utf8");
		const runner = await readFile(
			`scripts/run-dependent-checked-record-${lane.workflowStem}-ci.sh`
			, "utf8");
		assert.match(workflow, /on:\n {2}workflow_dispatch:[\s\S]*\n {2}workflow_call:/u);
		assert.ok(workflow.includes(
			`name: dependent-checked-record-${lane.workflowStem}-\${{ github.sha }}`
		));
		assert.ok(workflow.includes(
			`build/dependent-checked-record-${lane.workflowStem}-ci/`));
		assert.match(runner, /mkdir "\$output(?:_root)?\/verification"/u);
		assert.match(runner, /verification\/\$route\.json/u);
	}
	}
);
