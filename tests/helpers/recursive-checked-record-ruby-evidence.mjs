/**
 * Authenticate the immutable recursive checked-record Ruby evidence archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkRecursiveCheckedRecordRubyControls } from "./recursive-checked-record-ruby-controls.mjs";
import { recursiveCheckedRecordRubyCounts } from "./recursive-checked-record-ruby-fixture.mjs";
import {
	assertRecursiveCheckedRecordRubyEvidenceTap, recursiveCheckedRecordRubyEvidence
	, recursiveCheckedRecordRubyEvidenceSources, recursiveCheckedRecordRubyInterpreter
	, recursiveCheckedRecordRubyLoadCeiling, recursiveCheckedRecordRubyOriginal
	, recursiveCheckedRecordRubyProducer, recursiveCheckedRecordRubyRuntime
	, recursiveCheckedRecordRubySelections, recursiveCheckedRecordRubyVerifier
} from "./recursive-checked-record-ruby-provenance.mjs";
import { checkRecursiveCheckedRecordRubyReport } from "./recursive-checked-record-ruby-report.mjs";

export { recursiveCheckedRecordRubyEvidence };

const treeFiles = async (root, prefix = "") => {
	const paths = [];
	for(const entry of await readdir(join(root, prefix), { withFileTypes: true }))
	{
		const path = prefix ? `${prefix}/${entry.name}` : entry.name;
		if(entry.isDirectory()) paths.push(...await treeFiles(root, path));
		else
		{
			assert.ok(entry.isFile() && !entry.isSymbolicLink(), path); paths.push(path);
		}
	}
	return paths.sort();
};

/**
 * Re-verify every archived byte, the original TAP, the frozen sources and each selection.
 *
 * @param reader - Byte reader for repository paths; tests inject single-byte changes.
 * @param options - Control scope.
 * @param options.controls - "none" re-checks records; "full" re-runs every tamper control.
 */
export const checkRecursiveCheckedRecordRubyEvidence = async (reader = readFile, { controls = "none" } = {}) => {
	assert.ok(["none", "full"].includes(controls), "Unknown control scope");
	const root = recursiveCheckedRecordRubyEvidence;
	const read = path => reader(`${root}/${path}`);
	const indexBytes = Buffer.from(await read("index.json")), index = JSON.parse(indexBytes);
	assert.equal(indexBytes.toString(), canonicalJson(index));
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "recursive-checked-record-ruby-installed-v1");
	assert.equal(index.producerCommit, recursiveCheckedRecordRubyProducer);
	assert.equal(index.checkerCommit, recursiveCheckedRecordRubyVerifier);
	assert.equal(index.loadCeiling, recursiveCheckedRecordRubyLoadCeiling);
	assert.deepEqual(index.runtime, recursiveCheckedRecordRubyRuntime);
	assert.deepEqual(index.interpreter, recursiveCheckedRecordRubyInterpreter);
	assert.deepEqual(index.selectedSources, recursiveCheckedRecordRubyEvidenceSources());
	assert.deepEqual(index.files.map(file => file.path)
		, (await treeFiles(root)).filter(path => path !== "index.json"));
	for(const file of index.files)
	{
		const bytes = Buffer.from(await read(file.path));
		assert.deepEqual({ bytes: bytes.length, sha256: sha256(bytes) }, { bytes: file.bytes, sha256: file.sha256 }, file.path);
	}
	const log = Buffer.from(await read("producer/run.tap"));
	assert.equal(index.logSha256, sha256(log));
	assert.ok(log.toString().endsWith("\nexit 0\n"));
	assertRecursiveCheckedRecordRubyEvidenceTap(log.toString().slice(0, -"exit 0\n".length));
	const queue = JSON.parse(await read("producer/runner.queue"));
	assert.equal(queue.revision, recursiveCheckedRecordRubyProducer);
	assert.ok((await read("producer/runner.sh")).toString().includes(`= ${recursiveCheckedRecordRubyProducer} ||`));
	for(const source of index.selectedSources)
		assert.equal(Buffer.compare(Buffer.from(await read(`sources/${source.role}/${source.path}`))
			, recursiveCheckedRecordRubyOriginal(source.revision, source.path)), 0, source.path);
	assert.deepEqual(index.runs.map(run => [run.route, run.fixture]), recursiveCheckedRecordRubySelections);
	const selections = [];
	for(const run of index.runs)
	{
		const options = {
			route: run.route, fixture: run.fixture
			, producerCommit: recursiveCheckedRecordRubyProducer
			, runtime: recursiveCheckedRecordRubyRuntime, floor: "2.36"
			, rubyVersion: recursiveCheckedRecordRubyInterpreter.version
		};
		const records = path => read(`${run.label}/records/${path}`);
		const result = controls === "full"
			? await checkRecursiveCheckedRecordRubyControls(records, options)
			: await checkRecursiveCheckedRecordRubyReport(records, options);
		assert.deepEqual(result.counts, recursiveCheckedRecordRubyCounts[run.fixture]);
		assert.deepEqual(run.counts, result.counts);
		for(const key of ["records", "executions", "loadCeiling", "archiveSha256", "reportSha256"])
			assert.equal(run[key], result[key], key);
		const recorded = JSON.parse(await read(`${run.label}/controls.json`));
		assert.deepEqual(recorded, run.controls);
		if(controls === "full") for(const key of Object.keys(recorded)) assert.equal(result[key], recorded[key], key);
		selections.push({
			...run.controls, route: run.route, fixture: run.fixture
			, counts: result.counts, executions: result.executions
			, records: result.records
		});
	}
	return {
		producerCommit: index.producerCommit, checkerCommit: index.checkerCommit
		, installedProfiles: ["ruby"], supportPromoted: false, hostedAcceptance: false
		, controls, selections
	};
};
