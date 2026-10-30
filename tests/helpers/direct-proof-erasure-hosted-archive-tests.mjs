/**
 * Validate the closed direct proof-erasure hosted capture contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import {
	assertDirectProofErasureHostedReceiptSteps
	, assertDirectProofErasureHostedSteps
	, directProofErasureHostedLanes
	, directProofErasureHostedMatrixLane
	, directProofErasureHostedProducer
	, directProofErasureHostedReceipt
	, directProofErasureHostedRefusal
	, directProofErasureHostedRunId
	, directProofErasureHostedSources
	, parseDirectProofErasureHostedArchiveArgs
} from "./direct-proof-erasure-hosted-archive.mjs";
import {
	directProofErasureMatrixLanes
} from "./direct-proof-erasure-matrix.mjs";
import {
	directProofErasureFocusedWorkflow
} from "./direct-proof-erasure-matrix-receipt.mjs";

test("hosted proof-erasure capture closes ten lanes and seventeen profiles", () => {
	assert.match(directProofErasureHostedProducer, /^[a-f0-9]{40}$/u);
	assert.ok(Number.isSafeInteger(directProofErasureHostedRunId));
	assert.equal(directProofErasureHostedLanes.length, 10);
	assert.equal(new Set(directProofErasureHostedLanes.flatMap(
		lane => lane.profiles)).size, 17);
	assert.equal(new Set(directProofErasureHostedLanes.map(
		lane => lane.key)).size, 10);
	assert.equal(new Set(directProofErasureHostedLanes.map(
		lane => lane.job)).size, 10);
	for(const lane of directProofErasureHostedLanes)
	{
		const matrixLane = directProofErasureHostedMatrixLane(lane);
		assert.ok(directProofErasureMatrixLanes.includes(matrixLane));
		assert.notEqual(matrixLane, lane);
		assert.equal(matrixLane.key, lane.key);
		assert.equal(lane.runId, directProofErasureHostedRunId);
		assert.equal(lane.producerCommit, directProofErasureHostedProducer);
		assert.deepEqual(Object.keys(lane.steps).sort()
			, ["acceptance", "enforce", "upload"]);
		assert.equal(lane.workflow, directProofErasureFocusedWorkflow);
		assert.equal(lane.jobConclusion, "success");
		assert.deepEqual(lane.failedSteps, []);
		assert.match(lane.producerWorkflow
			, /^\.github\/workflows\/[a-z0-9-]+\.yml$/u);
	}
	assert.throws(() => directProofErasureHostedMatrixLane({
		...directProofErasureHostedLanes[0]
	}));
	assert.deepEqual(directProofErasureHostedReceipt, {
		id: "matrix", artifactPrefix: "direct-proof-erasure-matrix"
		, jobName: "Reconcile the exact same-run receipt"
	});
	assert.equal(directProofErasureHostedRefusal.diagnostic, "proof-only");
});

test("hosted proof-erasure steps require every focused lane to be green", () => {
	for(const lane of directProofErasureHostedLanes)
	{
		const steps = [
			{ name: lane.steps.acceptance, conclusion: "success" }
			, { name: lane.steps.upload, conclusion: "success" }
			, { name: lane.steps.enforce, conclusion: "skipped" }
			, ...lane.failedSteps.map(name => ({ name, conclusion: "failure" }))
		];
		assert.equal(assertDirectProofErasureHostedSteps(
			lane, Buffer.from(JSON.stringify({ steps }))), true);
		assert.throws(() => assertDirectProofErasureHostedSteps(lane
			, Buffer.from(JSON.stringify({
				steps: [...steps, { name: "unexpected", conclusion: "failure" }]
			}))
		));
	}
});

test("hosted proof-erasure receipt requires exact successful reconciliation", () => {
	const steps = [
		{ name: "Download every same-run direct proof-erasure artifact"
			, conclusion: "success", number: 1 }
		, { name: "Reconcile all seventeen profiles and both author routes"
			, conclusion: "success", number: 2 }
		, { name: "Preserve the complete direct proof-erasure receipt"
			, conclusion: "success", number: 3 }
		, { name: "Enforce every producer and exact receipt reconciliation"
			, conclusion: "skipped", number: 4 }
	];
	assert.equal(assertDirectProofErasureHostedReceiptSteps(
		Buffer.from(JSON.stringify({ steps }))), true);
	const failed = steps.map(step => step.number === 2
		? { ...step, conclusion: "failure" } : step);
	assert.throws(() => assertDirectProofErasureHostedReceiptSteps(
		Buffer.from(JSON.stringify({ steps: failed }))));
});

test("hosted proof-erasure archiver accepts only one canonical root", () => {
	assert.equal(parseDirectProofErasureHostedArchiveArgs([
		"--input-root", "/tmp/direct-proof-input"
	]), "/tmp/direct-proof-input");
	for(const args of [
		[], ["--input-root", "relative"], ["--other", "/tmp/input"]
		, ["--input-root", "/tmp/input", "extra"]
		, ["--input-root", "/tmp/input\nother"]
	]) assert.throws(() => parseDirectProofErasureHostedArchiveArgs(args));
});

test("hosted proof-erasure producer sources contain every exact workflow step", () => {
	for(const lane of directProofErasureHostedLanes)
	{
		const workflow = execFileSync("git", ["show"
			, `${directProofErasureHostedProducer}:${lane.producerWorkflow}`]
			, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
		for(const step of Object.values(lane.steps))
			assert.ok(workflow.includes(`- name: ${step}`)
				, `${lane.key}:${step}`);
	}
	const focused = execFileSync("git", ["show"
		, `${directProofErasureHostedProducer}:${directProofErasureFocusedWorkflow}`]
		, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
	for(const step of [
		"Download every same-run direct proof-erasure artifact"
		, "Reconcile all seventeen profiles and both author routes"
		, "Preserve the complete direct proof-erasure receipt"
		, "Enforce every producer and exact receipt reconciliation"
	]) assert.ok(focused.includes(`- name: ${step}`), step);
});

test("hosted proof-erasure source closure is closed at immutable revisions", () => {
	const revisions = {
		producer: directProofErasureHostedProducer
		, checker: execFileSync("git", ["rev-parse", "HEAD"])
			.toString().trim()
		, archiver: execFileSync("git", ["rev-parse", "HEAD"])
			.toString().trim()
	};
	const sources = directProofErasureHostedSources(revisions);
	assert.ok(sources.length > 100);
	assert.equal(new Set(sources.map(source =>
		`${source.revision}:${source.path}`)).size, sources.length);
	for(const source of sources) assert.doesNotThrow(() => execFileSync(
		"git", ["cat-file", "-e", `${source.revision}:${source.path}`]
	));
	const producerPaths = new Set(sources.filter(source =>
		source.revision === directProofErasureHostedProducer).map(source =>
		source.path));
	for(const path of [
		directProofErasureFocusedWorkflow
		, ".github/workflows/generic-subtype-npm-browser.yml"
		, ".github/workflows/generic-subtype-native-perl.yml"
		, ".github/workflows/generic-subtype-languages.yml"
		, ".github/workflows/generic-subtype-managed-wit.yml"
		, ".github/workflows/nominal-subtype-php-wasm.yml"
		, "scripts/reconcile-direct-proof-erasure-matrix.mjs"
	]) assert.ok(producerPaths.has(path), path);
	for(const obsolete of [
		".github/workflows/consumer-matrix.yml"
		, ".github/workflows/perl-consumer.yml"
	]) assert.equal(producerPaths.has(obsolete), false, obsolete);
});
