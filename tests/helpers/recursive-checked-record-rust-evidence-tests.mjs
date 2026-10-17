/**
 * Test the immutable four-cell recursive checked-record Rust evidence archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkRecursiveCheckedRecordRustEvidence
	, recursiveCheckedRecordRustEvidence
} from "./recursive-checked-record-rust-evidence.mjs";
import { recursiveCheckedRecordRustProducer } from "./recursive-checked-record-rust-provenance.mjs";

const assertArchiveLayouts = source => {
	assert.equal([...source.matchAll(/await copy\(join\(recordsRoot, path\), `\$\{label\}\/records\/\$\{path\}`\);/gu)].length, 1
		, "The evidence archive must flatten only the already verified record root");
	assert.equal([...source.matchAll(/producerFiles\.push\(`\$\{label\}\/records\/\$\{route\}\/\$\{fixture\}\/\$\{path\}`\);/gu)].length, 1
		, "The producer-tree assertion must retain the route and fixture directories");
};

test("recursive checked-record Rust evidence authenticates four installed crate selections", {
	timeout: 900_000
}, async () => {
	const checked = await checkRecursiveCheckedRecordRustEvidence();
	assert.equal(checked.producerCommit, recursiveCheckedRecordRustProducer);
	assert.equal(checked.checkerCommit, recursiveCheckedRecordRustProducer);
	assert.deepEqual(checked.installedProfiles, ["rust"]);
	assert.equal(checked.supportPromoted, false);
	assert.equal(checked.hostedAcceptance, false);
	assert.equal(checked.controls, "representative");
	assert.equal(checked.files.length, 874);
	assert.equal(checked.selectedSources.length, 570);
	assert.deepEqual(checked.selections.map(item => [item.route, item.fixture]), [
		["ordinary", "recursive"], ["ordinary", "mutual"]
		, ["reviewed", "recursive"], ["reviewed", "mutual"]
	]);
	for(const item of checked.selections)
	{
		const reviewed = item.route === "reviewed";
		assert.deepEqual(item.counts, item.fixture === "recursive" ? {
			checks: 908, limitRejections: 1, module: "recursive"
			, recoveries: 64, rejections: 144, rounds: 64
			, snapshotControls: 5, snapshots: 417
		} : {
			checks: 915, limitRejections: 1, module: "mutual"
			, recoveries: 64, rejections: 144, rounds: 64
			, snapshotControls: 6, snapshots: 420
		});
		assert.equal(item.executions, 3);
		assert.equal(item.records, reviewed ? 74 : 72);
		assert.equal(item.generatorModules, 28);
		assert.equal(item.dispatchObserved, false);
		assert.equal(item.loadCeiling, 8);
		assert.equal(item.recordControls, item.records * 2);
		assert.equal(item.resourceControls, 8);
		assert.equal(item.environmentControls, 60);
		assert.equal(item.packageControls, 7);
		assert.equal(item.modelControls, 8);
		assert.equal(item.executionControls, 30);
		assert.equal(item.artifacts.length, 1);
		assert.ok(item.artifacts[0].path.endsWith(".crate"));
		assert.match(item.dependencyArchiveSha256, /^[a-f0-9]{64}$/u);
	}
});

test("recursive checked-record Rust evidence rejects changed records, sources and receipts", async () => {
	const targets = [
		"index.json", "ordinary-mutual/records/report.json"
		, "reviewed-mutual/run.tap", "ordinary-recursive/verification.json"
		, "ordinary-recursive/controls.json"
		, "ordinary-recursive/records/dependency-handoff/rust-dependencies.tar.gz"
		, "sources/producer/tests/fixtures/recursive-checked-record-consumers/rust.rs"
	];
	for(const target of targets)
		await assert.rejects(checkRecursiveCheckedRecordRustEvidence(async path => {
			const bytes = await readFile(path);
			return path === `${recursiveCheckedRecordRustEvidence}/${target}`
				? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
		}, { controls: "none" }), undefined, target);
});

test("recursive checked-record Rust evidence admits only frozen control scopes", async () => {
	await assert.rejects(checkRecursiveCheckedRecordRustEvidence(
		readFile, { controls: "some" }
	));
});

test("recursive checked-record Rust archiving distinguishes producer and evidence layouts", async () => {
	const source = await readFile("scripts/archive-recursive-checked-record-rust-evidence.mjs", "utf8");
	assertArchiveLayouts(source);
	const flattenedProducer = source.replace(
		"producerFiles.push(`${label}/records/${route}/${fixture}/${path}`);"
		, "producerFiles.push(`${label}/records/${path}`);"
	);
	assert.notEqual(flattenedProducer, source);
	assert.throws(() => assertArchiveLayouts(flattenedProducer));
});
