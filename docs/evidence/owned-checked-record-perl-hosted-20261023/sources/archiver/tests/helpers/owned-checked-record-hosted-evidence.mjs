/**
 * Write and independently replay immutable owned checked-record hosted
 * evidence.
 *
 * An archive retains the original artifact ZIP in authenticated parts, the
 * GitHub run/job/artifact API bytes, the complete extracted output including
 * every retained package archive, and the exact source closures. The checker
 * reconstructs the ZIP, re-authenticates it against the API records, proves
 * the retained output equals its members and replays the output without
 * trusting the index's accepted summary.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	copyFile, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat
	, writeFile
} from "node:fs/promises";
import { constants, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	callbackSubtypeHostedDigest, extractCallbackSubtypeHostedArtifact
	, inspectCallbackSubtypeHostedArtifact, splitCallbackSubtypeHostedArtifact
} from "./callback-subtype-hosted-archive.mjs";
import {
	assertCallbackSubtypeHostedApiBinding, assertCallbackSubtypeHostedOutputSet
	, callbackSubtypeHostedApiRecords, reconstructCallbackSubtypeHostedArtifact
} from "./callback-subtype-hosted-evidence.mjs";
import {
	ownedCheckedRecordHostedLaneNames, ownedCheckedRecordHostedLanes
} from "./owned-checked-record-hosted-contracts.mjs";
import {
	ownedCheckedRecordEvidenceSources, ownedCheckedRecordHostedOriginal
} from "./owned-checked-record-hosted-evidence-sources.mjs";
import { replayOwnedCheckedRecordHostedOutput } from "./owned-checked-record-hosted-output.mjs";

const limitations = Object.freeze([
	"The fixture covers the tested owned Ticket, Booking and Claim records with checked Window and Claim payloads, transferred inputs, host callbacks and returned Lean closures on four ordinary/reviewed full/result-only routes."
	, "Every route retains the exact receipt-named package archives that the installed consumers executed; the receipt, sidecar, closed file set and every archive byte are independently verified."
	, "The original artifact ZIP, GitHub API records, complete hosted output and exact producer, consumer, checker and archiver source closures are retained byte-for-byte and independently replayed."
	, "PHP-Wasm, recursive owned graphs, retained or asynchronous callbacks, arbitrary predicates, dispatch cost and peak memory remain separate work."
	, "External runtimes, compilers, package managers and operating-system distributions remain trusted inputs represented by recorded identities rather than copied toolchains."
]);

/**
 * Require the hosted job to have reached acceptance and skipped enforcement.
 *
 * @param lane - Hosted lane contract.
 * @param jobBytes - Original GitHub job API record bytes.
 */
export const assertOwnedCheckedRecordHostedSteps = (lane, jobBytes) => {
	const job = JSON.parse(jobBytes);
	assert.ok(Array.isArray(job.steps) && job.steps.length > 0
		, "Hosted job record must list its steps");
	const named = name => {
		const steps = job.steps.filter(step => step.name === name);
		assert.equal(steps.length, 1, name);
		return steps[0];
	};
	const acceptance = named(lane.acceptanceStep);
	assert.equal(acceptance.status, "completed", lane.acceptanceStep);
	assert.equal(acceptance.conclusion, "success", lane.acceptanceStep);
	if(lane.enforceStep)
	{
		const enforce = named(lane.enforceStep);
		assert.equal(enforce.conclusion, "skipped", lane.enforceStep);
		assert.ok(enforce.number > acceptance.number
			, "Enforcement must follow acceptance");
	}
	else
	{
		const archive = named(lane.archiveStep);
		assert.equal(archive.conclusion, "success", lane.archiveStep);
		assert.ok(archive.number > acceptance.number
			, "Artifact upload must follow acceptance");
	}
	for(const step of job.steps)
		assert.ok(["success", "skipped"].includes(step.conclusion)
			, `Hosted step did not succeed: ${step.name}`);
};

const regularFiles = async (root, prefix = "") => {
	const files = [];
	for(const entry of await readdir(join(root, prefix), { withFileTypes: true }))
	{
		const path = prefix ? `${prefix}/${entry.name}` : entry.name;
		const information = await lstat(join(root, path));
		if(information.isDirectory()) files.push(...await regularFiles(root, path));
		else
		{
			assert.ok(information.isFile(), `Evidence must be regular: ${path}`);
			files.push(path);
		}
	}
	return files.toSorted();
};

const retainedOutputPaths = (lane, paths) => lane.retainedRoots
	? paths.filter(path => lane.retainedRoots.some(root => path.startsWith(root)))
	: paths;

const hostedContract = (lane, selected, retainedConclusions) => {
	const expected = { workflow: lane.workflow, jobName: lane.job
		, artifactPrefix: lane.prefix };
	if(!lane.runConclusions) return expected;
	const conclusions = retainedConclusions ?? (() => {
		const run = JSON.parse(readFileSync(selected["run-json"], "utf8"));
		return { run: run.conclusion, job: "success" };
	})();
	assert.deepEqual(Object.keys(conclusions).sort(), ["job", "run"]);
	assert.ok(lane.runConclusions.includes(conclusions.run)
		, `Ineligible hosted run conclusion: ${conclusions.run}`);
	assert.equal(conclusions.job, "success");
	return { ...expected, conclusions };
};

/**
 * Authenticate, replay and write one immutable hosted evidence directory.
 *
 * @param options - Archive inputs.
 * @param options.lane - Lane whose workflow job produced the artifact.
 * @param options.selected - Absolute ZIP and API record paths.
 * @param options.destination - New evidence directory.
 * @param options.archiveCommit - Clean archiver and checker revision.
 */
export const writeOwnedCheckedRecordHostedEvidence = async ({
	lane: laneName, selected, destination, archiveCommit
}) => {
	assert.ok(ownedCheckedRecordHostedLaneNames.includes(laneName), laneName);
	assert.match(archiveCommit, /^[a-f0-9]{40}$/u);
	await assert.rejects(lstat(destination), { code: "ENOENT" }
		, "Hosted evidence destination must be new");
	const lane = ownedCheckedRecordHostedLanes[laneName];
	const hosted = await inspectCallbackSubtypeHostedArtifact(
		selected, hostedContract(lane, selected));
	assertOwnedCheckedRecordHostedSteps(lane, hosted.api.job.bytes);
	const revision = hosted.revision, revisions = {
		producer: revision, consumer: revision
		, checker: archiveCommit, archiver: archiveCommit
	};
	const descriptors = new Map();
	const put = (path, descriptor) => {
		assert.ok(!descriptors.has(path), path);
		descriptors.set(path, descriptor);
	};
	const putBytes = (path, value) => {
		const bytes = Buffer.from(value);
		put(path, { bytes: bytes.length, sha256: sha256(bytes), value: bytes });
	};
	const putFile = async (path, source) => {
		const information = await lstat(source);
		assert.ok(information.isFile(), source);
		put(path, { bytes: information.size
			, sha256: await callbackSubtypeHostedDigest(source), source });
	};
	const extracted = await extractCallbackSubtypeHostedArtifact(
		selected["artifact-zip"]);
	const partsRoot = await mkdtemp(join(
		tmpdir(), "lean-bridge-owned-checked-record-zip-"));
	try
	{
		const accepted = await replayOwnedCheckedRecordHostedOutput(
			laneName, extracted.root, revision);
		const outputPaths = retainedOutputPaths(
			lane, await regularFiles(extracted.root));
		assert.ok(outputPaths.length > 0, "Hosted artifact retained no lane output");
		for(const path of outputPaths)
			await putFile(`hosted/output/${path}`, join(extracted.root, path));
		for(const [name, item] of Object.entries(hosted.api))
			putBytes(`hosted/api/${name}.json`, item.bytes);
		const parts = await splitCallbackSubtypeHostedArtifact(
			selected["artifact-zip"], partsRoot);
		for(const part of parts)
			await putFile(`hosted/artifact.zip.parts/${part.name}`, part.path);
		const selectedSources = ownedCheckedRecordEvidenceSources(
			laneName, revisions);
		for(const source of selectedSources)
			putBytes(`sources/${source.role}/${source.path}`
				, ownedCheckedRecordHostedOriginal(source.revision, source.path));
		const ordered = [...descriptors].sort(([left], [right]) =>
			left.localeCompare(right));
		const files = ordered.map(([path, descriptor]) => ({
			path, bytes: descriptor.bytes, sha256: descriptor.sha256
		}));
		const index = {
			schemaVersion: 1
			, kind: `owned-checked-record-${laneName}-hosted-v1`
			, lane: laneName, targets: lane.targets
			, producerCommit: revision, consumerCommit: revision
			, checkerCommit: archiveCommit, archiveCommit, accepted
			, hostedRun: {
				...hosted.hostedRun
				, apiRecords: callbackSubtypeHostedApiRecords(hosted.api)
				, artifact: {
					...hosted.hostedRun.artifact, members: extracted.entries
					, parts: parts.map(({ name, offset, bytes, sha256: digest }) => ({
						path: `hosted/artifact.zip.parts/${name}`
						, offset, bytes, sha256: digest
					}))
				}
			}
			, selectedSources, files, limitations
		};
		await mkdir(destination, { recursive: true });
		for(const [path, descriptor] of descriptors)
		{
			const target = join(destination, path);
			await mkdir(dirname(target), { recursive: true });
			if(descriptor.source)
				await copyFile(descriptor.source, target, constants.COPYFILE_EXCL);
			else await writeFile(target, descriptor.value, { flag: "wx" });
			assert.equal((await stat(target)).size, descriptor.bytes, path);
			assert.equal(await callbackSubtypeHostedDigest(target)
				, descriptor.sha256, path);
		}
		await writeFile(join(destination, "index.json"), canonicalJson(index)
			, { flag: "wx" });
		return index;
	}
	finally
	{
		await rm(extracted.root, { recursive: true });
		await rm(partsRoot, { recursive: true });
	}
};

/**
 * Independently replay one retained owned checked-record hosted archive.
 *
 * @param laneName - Lane whose contract the archive must satisfy.
 * @param evidenceRoot - Evidence directory containing index.json.
 */
export const checkOwnedCheckedRecordHostedEvidence = async (
	laneName, evidenceRoot
) => {
	assert.ok(ownedCheckedRecordHostedLaneNames.includes(laneName), laneName);
	const lane = ownedCheckedRecordHostedLanes[laneName];
	const root = await realpath(evidenceRoot);
	const indexBytes = await readFile(join(root, "index.json"));
	const index = JSON.parse(indexBytes);
	assert.equal(indexBytes.toString(), canonicalJson(index));
	assert.deepEqual(Object.keys(index).toSorted(), ["accepted", "archiveCommit"
		, "checkerCommit", "consumerCommit", "files", "hostedRun", "kind", "lane"
		, "limitations", "producerCommit", "schemaVersion", "selectedSources"
		, "targets"]);
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, `owned-checked-record-${laneName}-hosted-v1`);
	assert.equal(index.lane, laneName);
	assert.deepEqual(index.targets, lane.targets);
	assert.deepEqual(index.limitations, limitations);
	for(const key of [
		"producerCommit", "consumerCommit", "checkerCommit", "archiveCommit"
	]) assert.match(index[key], /^[a-f0-9]{40}$/u, key);
	assert.equal(index.producerCommit, index.consumerCommit);
	assert.equal(index.checkerCommit, index.archiveCommit);
	assert.deepEqual(index.files, [...index.files].sort((left, right) =>
		left.path.localeCompare(right.path)));
	assert.equal(new Set(index.files.map(file => file.path)).size
		, index.files.length);
	assert.deepEqual(await regularFiles(root)
		, ["index.json", ...index.files.map(file => file.path)].toSorted());
	for(const file of index.files)
	{
		const path = join(root, file.path);
		assert.equal((await stat(path)).size, file.bytes, file.path);
		assert.equal(await callbackSubtypeHostedDigest(path), file.sha256
			, file.path);
	}
	const revisions = {
		producer: index.producerCommit, consumer: index.consumerCommit
		, checker: index.checkerCommit, archiver: index.archiveCommit
	};
	assert.deepEqual(index.selectedSources
		, ownedCheckedRecordEvidenceSources(laneName, revisions));
	for(const source of index.selectedSources)
		assert.deepEqual(await readFile(join(
			root, `sources/${source.role}/${source.path}`))
		, ownedCheckedRecordHostedOriginal(source.revision, source.path)
		, `${source.role}/${source.path}`);
	assert.deepEqual(index.files.filter(file => file.path.startsWith("sources/"))
		.map(file => file.path).toSorted()
	, index.selectedSources.map(source =>
		`sources/${source.role}/${source.path}`).toSorted()
	, "Retained sources must be exactly the selected closure");

	const temporary = await mkdtemp(join(
		tmpdir(), "lean-bridge-owned-checked-record-evidence-"));
	let extracted;
	try
	{
		const zip = join(temporary, "artifact.zip");
		const bytes = await reconstructCallbackSubtypeHostedArtifact(
			root, index.hostedRun.artifact.parts, zip);
		assert.equal(bytes, index.hostedRun.artifact.bytes);
		assert.equal(await callbackSubtypeHostedDigest(zip)
			, index.hostedRun.artifact.sha256);
		const api = name => join(root, `hosted/api/${name}.json`);
		const selection = {
			"artifact-zip": zip, "run-json": api("run")
			, "job-json": api("job"), "artifact-json": api("artifact")
		};
		const hosted = await inspectCallbackSubtypeHostedArtifact(selection
			, hostedContract(lane, selection
				, lane.runConclusions ? index.hostedRun.conclusions : undefined));
		assert.equal(hosted.revision, index.producerCommit);
		assertCallbackSubtypeHostedApiBinding(index, hosted);
		assertOwnedCheckedRecordHostedSteps(lane, hosted.api.job.bytes);
		extracted = await extractCallbackSubtypeHostedArtifact(zip);
		assert.deepEqual(extracted.entries, index.hostedRun.artifact.members);
		const extractedPaths = retainedOutputPaths(
			lane, await regularFiles(extracted.root));
		assertCallbackSubtypeHostedOutputSet(index, extractedPaths);
		for(const path of extractedPaths)
			assert.deepEqual(await readFile(join(extracted.root, path))
				, await readFile(join(root, "hosted/output", path)), path);
		const accepted = await replayOwnedCheckedRecordHostedOutput(
			laneName, join(root, "hosted/output"), index.producerCommit
			, path => ownedCheckedRecordHostedOriginal(index.producerCommit, path));
		assert.deepEqual(accepted, index.accepted);
	}
	finally
	{
		if(extracted) await rm(extracted.root, { recursive: true });
		await rm(temporary, { recursive: true });
	}
	return index;
};
