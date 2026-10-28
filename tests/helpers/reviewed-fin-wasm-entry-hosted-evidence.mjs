/**
 * Independently replay the immutable hosted reviewed Fin Wasm-entry archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { open, readFile, realpath, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkedRecordValueIndexHostedDigest
	, extractCheckedRecordValueIndexHostedArtifact
} from "./checked-record-value-index-hosted-archive.mjs";
import {
	inspectReviewedFinWasmEntryHostedArtifact
	, reviewedFinWasmEntryHostedEvidenceDirectory
	, reviewedFinWasmEntryHostedModes
	, reviewedFinWasmEntryHostedOriginal
	, reviewedFinWasmEntryHostedSources
} from "./reviewed-fin-wasm-entry-hosted-archive.mjs";
import {
	checkWasmEntryCiRun, wasmEntryCiReports
} from "./reviewed-fin-wasm-entry-ci.mjs";
import {
	recountReviewedFinWasmEntryReport
} from "./reviewed-fin-wasm-entry-producer.mjs";
import { expectReviewedFinWasmEntry } from "./reviewed-fin-wasm-entry.mjs";

export const reviewedFinWasmEntryHostedIndexPath
	= `${reviewedFinWasmEntryHostedEvidenceDirectory}/index.json`;

const reconstruct = async (root, parts, target) => {
	const output = await open(target, "wx");
	try
	{
		let offset = 0;
		for(const part of parts)
		{
			assert.deepEqual(Object.keys(part).sort(), [
				"bytes", "offset", "path", "sha256"
			]);
			assert.equal(part.offset, offset);
			const bytes = await readFile(join(root, part.path));
			assert.equal(bytes.length, part.bytes);
			assert.equal(sha256(bytes), part.sha256);
			await output.write(bytes, 0, bytes.length, offset);
			offset += bytes.length;
		}
		return offset;
	}
	finally
	{ await output.close(); }
};

const replay = async (mode, root) => {
	const files = [
		"run.tap", ...wasmEntryCiReports(mode).map(name => `${name}.json`)
	].sort();
	const tap = await readFile(join(root, "run.tap"), "utf8");
	const reports = Object.fromEntries(await Promise.all(
		wasmEntryCiReports(mode).map(async name => [
			name, JSON.parse(await readFile(join(root, `${name}.json`), "utf8"))
		])
	));
	return checkWasmEntryCiRun({
		mode, tap, files, reports
		, recount: async (report, reportMode, selection, engines) =>
			recountReviewedFinWasmEntryReport(report
				, await expectReviewedFinWasmEntry(selection, reportMode)
				, { engines: [...engines] })
	});
};

/**
 * Validate every retained byte, reconstruct both ZIPs and replay all reports.
 *
 * @param evidenceRoot - Immutable archive root.
 */
export const checkReviewedFinWasmEntryHostedEvidence = async (
	evidenceRoot = reviewedFinWasmEntryHostedEvidenceDirectory
) => {
	const root = await realpath(evidenceRoot);
	const indexBytes = await readFile(join(root, "index.json"));
	const index = JSON.parse(indexBytes);
	assert.equal(indexBytes.toString(), canonicalJson(index));
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, "reviewed-fin-wasm-entry-hosted-v1");
	for(const key of ["producerCommit", "checkerCommit", "archiveCommit"])
		assert.match(index[key], /^[a-f0-9]{40}$/u, key);
	assert.equal(index.producerCommit, index.checkerCommit);
	assert.deepEqual(index.profiles, [
		"node-javascript", "node-typescript", "browser-javascript"
		, "browser-react", "browser-worker"
	]);
	assert.deepEqual(index.engines, ["chromium", "firefox", "webkit"]);
	assert.deepEqual(index.legs.map(leg => leg.mode)
		, reviewedFinWasmEntryHostedModes);
	assert.deepEqual(index.files, [...index.files].sort((left, right) =>
		left.path.localeCompare(right.path)));
	assert.equal(new Set(index.files.map(file => file.path)).size
		, index.files.length);
	assert.deepEqual(await nativeArtifactPaths(root), [
		"index.json", ...index.files.map(file => file.path)
	].sort());
	for(const file of index.files)
	{
		assert.deepEqual(Object.keys(file).sort(), ["bytes", "path", "sha256"]);
		const path = join(root, file.path), information = await stat(path);
		assert.equal(information.size, file.bytes, file.path);
		assert.equal(await checkedRecordValueIndexHostedDigest(path)
			, file.sha256, file.path);
	}
	const revisions = {
		producer: index.producerCommit, checker: index.checkerCommit
		, archiver: index.archiveCommit
	};
	assert.deepEqual(index.selectedSources
		, reviewedFinWasmEntryHostedSources(revisions));
	for(const source of index.selectedSources)
		assert.deepEqual(
			await readFile(join(root, `sources/${source.role}/${source.path}`))
			, reviewedFinWasmEntryHostedOriginal(source.revision, source.path)
			, `${source.role}/${source.path}`);

	const temporary = await mkdtemp(join(
		tmpdir(), "lean-bridge-reviewed-fin-wasm-evidence-"));
	try
	{
		for(const leg of index.legs)
		{
			assert.ok(reviewedFinWasmEntryHostedModes.includes(leg.mode));
			const zip = join(temporary, `${leg.mode}.zip`);
			const bytes = await reconstruct(
				root, leg.hostedRun.artifact.parts, zip);
			assert.equal(bytes, leg.hostedRun.artifact.bytes);
			assert.equal(await checkedRecordValueIndexHostedDigest(zip)
				, leg.hostedRun.artifact.sha256);
			const hosted = await inspectReviewedFinWasmEntryHostedArtifact({
				"artifact-zip": zip
				, "run-json": join(root, "hosted/api/run.json")
				, "job-json": join(root, `hosted/api/${leg.mode}/job.json`)
				, "artifact-json": join(
					root, `hosted/api/${leg.mode}/artifact.json`)
				, "job-log": join(root, `hosted/${leg.mode}/job.log`)
			}, leg.mode);
			assert.equal(hosted.revision, index.producerCommit);
			const extracted = await extractCheckedRecordValueIndexHostedArtifact(zip);
			try
			{
				assert.deepEqual(extracted.entries
					, leg.hostedRun.artifact.members);
				const expected = [
					"run.tap"
					, ...wasmEntryCiReports(leg.mode).map(
						name => `${name}.json`)
				].sort();
				assert.deepEqual(await nativeArtifactPaths(extracted.root), expected);
				for(const path of expected)
					assert.deepEqual(await readFile(join(extracted.root, path))
						, await readFile(join(
							root, `observations/${leg.mode}/${path}`)), path);
			}
			finally
			{ await rm(extracted.root, { recursive: true }); }
			const accepted = await replay(
				leg.mode, join(root, `observations/${leg.mode}`));
			assert.deepEqual(accepted, leg.accepted);
			assert.equal(await readFile(join(root
				, `observations/${leg.mode}/independent-verification.json`), "utf8")
			, canonicalJson(accepted));
		}
	}
	finally
	{ await rm(temporary, { recursive: true }); }
	return index;
};
