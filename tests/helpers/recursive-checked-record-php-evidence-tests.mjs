/**
 * Test the immutable four-selection hosted native PHP evidence archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import {
	checkRecursiveCheckedRecordPhpEvidence, recursiveCheckedRecordPhpEvidence
} from "./recursive-checked-record-php-evidence.mjs";
import {
	recursiveCheckedRecordPhpEvidenceProducer
	, recursiveCheckedRecordPhpEvidenceVerifier
	, recursiveCheckedRecordPhpHostedArtifact
} from "./recursive-checked-record-php-provenance.mjs";

test("recursive checked-record PHP evidence authenticates four hosted Composer selections", async () => {
	const checked = await checkRecursiveCheckedRecordPhpEvidence();
	assert.equal(checked.producerCommit, recursiveCheckedRecordPhpEvidenceProducer);
	assert.equal(checked.checkerCommit, recursiveCheckedRecordPhpEvidenceVerifier);
	assert.deepEqual(checked.installedProfiles, ["php-native"]);
	assert.equal(checked.supportPromoted, false); assert.equal(checked.hostedAcceptance, true);
	assert.deepEqual(checked.hostedArtifact, recursiveCheckedRecordPhpHostedArtifact);
	assert.deepEqual(checked.selections.map(item => [item.route, item.fixture]), [
		["ordinary", "recursive"], ["reviewed", "recursive"]
		, ["ordinary", "mutual"], ["reviewed", "mutual"]
	]);
	for(const item of checked.selections)
	{
		const mutual = item.fixture === "mutual";
		assert.equal(item.executions, 4); assert.equal(item.dispatchObserved, false);
		assert.equal(item.counts.checks * item.executions, mutual ? 4_456 : 4_388);
		assert.equal(item.counts.rejections * item.executions, 576);
		assert.equal(item.counts.hostRejections * item.executions, mutual ? 336 : 328);
		assert.equal(item.counts.recoveries * item.executions, 256);
		assert.equal(item.records.length, item.route === "reviewed" ? 75 : 73);
		assert.equal(item.recordControls, item.records.length * 2);
		assert.equal(item.executionControls, 48); assert.equal(item.toolControls, 12);
		assert.equal(item.resourceControls, 7); assert.equal(item.environmentControls, 10);
		assert.equal(item.packageControls, 6); assert.equal(item.modelControls, 7);
	}
});

test("recursive checked-record PHP evidence rejects changed records, sources, checks and toolchain", async () => {
	const targets = ["ordinary-mutual/records/report.json"
		, "reviewed-mutual/run.tap", "ordinary-recursive/verification.json"
		, "reviewed-recursive/controls.json", "producer/toolchain.log"
		, "sources/producer/tests/fixtures/recursive-checked-record-consumers/php-native.php"];
	for(const target of targets)
		await assert.rejects(checkRecursiveCheckedRecordPhpEvidence(async path => {
			const bytes = await readFile(path);
			return path === `${recursiveCheckedRecordPhpEvidence}/${target}`
				? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
		}, { controls: "none" }), undefined, target);
	// Re-signing the index cannot substitute a different hosted artifact identity.
	const index = JSON.parse(await readFile(`${recursiveCheckedRecordPhpEvidence}/index.json`));
	index.hostedArtifact.artifactId++;
	await assert.rejects(checkRecursiveCheckedRecordPhpEvidence(async path =>
		path === `${recursiveCheckedRecordPhpEvidence}/index.json`
			? Buffer.from(canonicalJson(index)) : readFile(path), { controls: "none" }));
});

test("recursive checked-record PHP evidence admits only frozen control scopes", async () => {
	await assert.rejects(checkRecursiveCheckedRecordPhpEvidence(readFile, { controls: "some" }));
});
