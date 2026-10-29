/**
 * Refusal controls for hosted dependent-signature capture and replay.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	dependentSignatureHostedLanes
	, dependentSignatureHostedProducer
	, dependentSignatureHostedReceipt
	, dependentSignatureHostedRunConclusions
	, dependentSignatureHostedRunId
	, dependentSignatureHostedSources
	, parseDependentSignatureHostedArchiveArgs
} from "./dependent-signature-hosted-archive.mjs";
import {
	dependentSignatureFocusedWorkflow
	, dependentSignatureMatrixArtifactName
	, dependentSignatureMatrixRoutes
} from "./dependent-signature-matrix-receipt.mjs";

test("the hosted plan closes one same-run 17-profile matrix", () => {
	assert.deepEqual(dependentSignatureHostedRunConclusions, {
		[String(dependentSignatureHostedRunId)]: "success"
	});
	assert.equal(dependentSignatureHostedLanes.length, 11);
	const profiles = new Set();
	for(const lane of dependentSignatureHostedLanes)
	{
		assert.equal(new Set(lane.profiles).size, lane.profiles.length, lane.id);
		lane.profiles.forEach(profile => profiles.add(profile));
		assert.equal(lane.runId, dependentSignatureHostedRunId);
		assert.equal(lane.workflow, dependentSignatureFocusedWorkflow);
		assert.equal(
			dependentSignatureMatrixArtifactName(
				lane.matrixLane, dependentSignatureHostedProducer)
			, `${lane.artifactPrefix}-${dependentSignatureHostedProducer}`
		);
		for(const name of [
			"jobName", "acceptanceStep", "uploadStep", "enforceStep"
		]) assert.ok(lane[name].length > 0, `${lane.id}:${name}`);
	}
	assert.deepEqual([...profiles].sort(), [
		"browser-javascript", "browser-react", "browser-worker", "c", "cpp"
		, "dotnet", "java", "kotlin", "node-javascript", "node-typescript"
		, "perl", "php-native", "php-wasm", "python", "ruby", "rust"
		, "wit-wasi"
	]);
	assert.equal(profiles.size * 2, 34);
	assert.equal(dependentSignatureMatrixRoutes.length, 4);
	assert.deepEqual(dependentSignatureHostedReceipt, {
		id: "matrix", artifactPrefix: "dependent-signature-matrix"
		, jobName: "Reconcile the exact same-run receipt"
	});
});

test("the archive CLI accepts one canonical absolute input root only", async t => {
	const root = await mkdtemp(join(tmpdir(), "dependent-signature-args-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	assert.equal(parseDependentSignatureHostedArchiveArgs([
		"--input-root", root
	]), root);
	for(const args of [[], ["--input-root", "relative"], ["--else", root]
		, ["--input-root", root, "--input-root", root]])
		assert.throws(() => parseDependentSignatureHostedArchiveArgs(args));
});

const closureCommitted = [
	"scripts/archive-dependent-signature-hosted.mjs"
	, "scripts/download-dependent-signature-hosted-inputs.mjs"
].every(path => spawnSync("git", [
	"cat-file", "-e", `HEAD:${path}`
]).status === 0);
test("source selection freezes all focused producers, checker and archiver", {
	skip: !closureCommitted
}, () => {
	const current = execFileSync("git", ["rev-parse", "HEAD"], {
		encoding: "utf8"
	}).trim();
	const sources = dependentSignatureHostedSources({
		producer: dependentSignatureHostedProducer
		, checker: current, archiver: current
	});
	for(const path of [
		".github/workflows/dependent-signature-complete.yml"
		, ".github/workflows/dependent-checked-record-browser.yml"
		, ".github/workflows/dependent-checked-record-perl.yml"
		, ".github/workflows/dependent-checked-record-wit.yml"
		, "scripts/reconcile-dependent-signature-matrix.mjs"
		, "tests/fixtures/onboarding/dependent-checked-records/DependentRecords.lean"
		, "tests/fixtures/dependent-checked-record-consumers/perl.pl"
	])
		assert.ok(sources.some(source => source.role === "producer"
			&& source.path === path), path);
	assert.ok(sources.some(source => source.role === "archiver"
		&& source.path
			=== "scripts/download-dependent-signature-hosted-inputs.mjs"));
	assert.equal(new Set(sources.map(source =>
		`${source.role}:${source.path}`)).size, sources.length);
});
