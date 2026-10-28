/**
 * Independently replay the immutable hosted native-language callback-Fin
 * archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, open, readFile, realpath, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkedRecordValueIndexHostedDigest
	, extractCheckedRecordValueIndexHostedArtifact
} from "./checked-record-value-index-hosted-archive.mjs";
import {
	callbackFinNativeHostedEvidenceDirectory
	, callbackFinNativeHostedLanes
	, callbackFinNativeHostedOriginal
	, callbackFinNativeHostedSources
	, inspectCallbackFinNativeHostedArtifact
} from "./callback-fin-native-hosted-archive.mjs";
import { callbackFinLanguageVerification } from "./callback-fin-language-ci.mjs";
import { callbackFinPerlVerification } from "./callback-fin-perl-ci.mjs";
import { verifyCallbackFinRetainedPackages } from "./callback-fin-retained-packages.mjs";

export const callbackFinNativeHostedIndexPath
	= `${callbackFinNativeHostedEvidenceDirectory}/index.json`;

const reconstruct = async (root, parts, target) => {
	const output = await open(target, "wx");
	try
	{
		let offset = 0;
		for(const part of parts)
		{
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

const replay = async (lane, outputRoot, revision) => {
	const tap = await readFile(join(outputRoot, "acceptance.tap"), "utf8");
	const report = JSON.parse(await readFile(
		join(outputRoot, "report.json"), "utf8"));
	const base = lane.id === "languages"
		? callbackFinLanguageVerification(revision, tap, report)
		: callbackFinPerlVerification(revision, tap, report);
	return {
		...base
		, retainedPackages: await verifyCallbackFinRetainedPackages(
			outputRoot, report)
	};
};

/**
 * Validate every retained byte, reconstruct both ZIPs and replay each lane.
 *
 * @param evidenceRoot - Immutable archive root.
 */
export const checkCallbackFinNativeHostedEvidence = async (
	evidenceRoot = callbackFinNativeHostedEvidenceDirectory
) => {
	const root = await realpath(evidenceRoot);
	const indexBytes = await readFile(join(root, "index.json"));
	const index = JSON.parse(indexBytes);
	assert.equal(indexBytes.toString(), canonicalJson(index));
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, "callback-fin-native-hosts-installed-v1");
	for(const key of ["producerCommit", "checkerCommit", "archiveCommit"])
		assert.match(index[key], /^[a-f0-9]{40}$/u, key);
	assert.equal(index.producerCommit, index.checkerCommit);
	assert.deepEqual(index.lanes.map(lane => lane.id)
		, callbackFinNativeHostedLanes.map(lane => lane.id));
	assert.deepEqual(index.files, [...index.files].sort((left, right) =>
		left.path.localeCompare(right.path)));
	assert.equal(new Set(index.files.map(file => file.path)).size
		, index.files.length);
	assert.deepEqual(await nativeArtifactPaths(root), [
		"index.json", ...index.files.map(file => file.path)
	].sort());
	for(const file of index.files)
	{
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
		, callbackFinNativeHostedSources(revisions));
	for(const source of index.selectedSources)
		assert.deepEqual(
			await readFile(join(root, `sources/${source.role}/${source.path}`))
			, callbackFinNativeHostedOriginal(source.revision, source.path)
			, `${source.role}/${source.path}`);

	const temporary = await mkdtemp(join(
		tmpdir(), "lean-bridge-callback-fin-native-evidence-"));
	try
	{
		for(const retainedLane of index.lanes)
		{
			const lane = callbackFinNativeHostedLanes.find(
				item => item.id === retainedLane.id);
			assert.ok(lane); assert.deepEqual(retainedLane.profiles, lane.profiles);
			const zip = join(temporary, `${lane.id}.zip`);
			const bytes = await reconstruct(
				root, retainedLane.hostedRun.artifact.parts, zip);
			assert.equal(bytes, retainedLane.hostedRun.artifact.bytes);
			assert.equal(await checkedRecordValueIndexHostedDigest(zip)
				, retainedLane.hostedRun.artifact.sha256);
			const apiRoot = join(root, `hosted/api/${lane.id}`);
			const hosted = await inspectCallbackFinNativeHostedArtifact({
				"artifact-zip": zip, "run-json": join(apiRoot, "run.json")
				, "job-json": join(apiRoot, "job.json")
				, "artifact-json": join(apiRoot, "artifact.json")
			}, lane);
			assert.equal(hosted.revision, index.producerCommit);
			const extracted = await extractCheckedRecordValueIndexHostedArtifact(zip);
			try
			{
				assert.deepEqual(extracted.entries
					, retainedLane.hostedRun.artifact.members);
				for(const path of await nativeArtifactPaths(extracted.root))
					assert.deepEqual(await readFile(join(extracted.root, path))
						, await readFile(join(
							root, `hosted/output/${lane.id}/${path}`)), path);
			}
			finally
			{ await rm(extracted.root, { recursive: true }); }
			const retainedOutput = lane.outputRoot
				? join(root, `hosted/output/${lane.id}`, lane.outputRoot)
				: join(root, `hosted/output/${lane.id}`);
			const accepted = await replay(
				lane, retainedOutput, index.producerCommit);
			assert.deepEqual(accepted, retainedLane.accepted);
			assert.equal(await readFile(join(
				retainedOutput, "verification.json"), "utf8")
			, canonicalJson(accepted));
		}
	}
	finally
	{ await rm(temporary, { recursive: true }); }
	return index;
};
