/**
 * Write and independently replay immutable generic-Subtype hosted evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { constants } from "node:fs";
import {
	copyFile, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat
	, writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	callbackSubtypeHostedDigest, extractCallbackSubtypeHostedArtifact
	, inspectCallbackSubtypeHostedArtifact, splitCallbackSubtypeHostedArtifact
} from "./callback-subtype-hosted-archive.mjs";
import {
	assertCallbackSubtypeHostedApiBinding, callbackSubtypeHostedApiRecords
	, reconstructCallbackSubtypeHostedArtifact
} from "./callback-subtype-hosted-evidence.mjs";
import {
	genericSubtypeHostedContract, genericSubtypeHostedLaneNames
} from "./generic-subtype-hosted-contracts.mjs";
import {
	genericSubtypeEvidenceSources, genericSubtypeHostedOriginal
} from "./generic-subtype-hosted-evidence-sources.mjs";
import {
	replayGenericSubtypeHostedOutput
} from "./generic-subtype-hosted-output.mjs";

const limitations = Object.freeze([
	"The installed lanes cover the exact closed GenericNat specializations with retained Nat payload and marker fields, independent plusOne and plusTwo Subtype constructors, erased proofs and constructor-free copied results on ordinary and reviewed routes."
	, "The foundation lane separately checks retained Nat, Bool and String indices, synthesized instance dictionaries, constructor authority and exact refusal of unsupported open or malformed dependent shapes."
	, "Every hosted artifact, API record, output byte and selected producer, consumer, checker and archiver source is retained and independently replayed."
	, "PHP-Wasm, open generic types, arbitrary predicates, recursive generic graphs, owned or callback positions, dispatch cost and peak memory remain separate work."
	, "External runtimes, compilers, package managers and operating-system distributions remain trusted recorded inputs rather than copied toolchains."
]);

/**
 * Require successful acceptance followed by skipped failure enforcement.
 *
 * @param contract - Closed hosted lane contract.
 * @param jobBytes - Original GitHub job API record.
 */
export const assertGenericSubtypeHostedSteps = (contract, jobBytes) => {
	const job = JSON.parse(jobBytes);
	assert.ok(Array.isArray(job.steps) && job.steps.length > 0);
	const named = name => {
		const matches = job.steps.filter(step => step.name === name);
		assert.equal(matches.length, 1, name);
		return matches[0];
	};
	const acceptance = named(contract.acceptanceStep);
	const enforce = named(contract.enforceStep);
	assert.equal(acceptance.status, "completed", contract.acceptanceStep);
	assert.equal(acceptance.conclusion, "success", contract.acceptanceStep);
	assert.equal(enforce.conclusion, "skipped", contract.enforceStep);
	assert.ok(enforce.number > acceptance.number);
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

/**
 * Authenticate and archive one hosted lane.
 *
 * @param options - Archive inputs.
 * @param options.lane - Closed hosted lane name.
 * @param options.selected - Original ZIP and API record paths.
 * @param options.destination - Fresh evidence directory.
 * @param options.archiveCommit - Clean checker and archiver revision.
 */
export const writeGenericSubtypeHostedEvidence = async ({
	lane, selected, destination, archiveCommit
}) => {
	assert.ok(genericSubtypeHostedLaneNames.includes(lane), lane);
	assert.match(archiveCommit, /^[a-f0-9]{40}$/u);
	await assert.rejects(lstat(destination), { code: "ENOENT" }
		, "Hosted evidence destination must be new");
	const contract = genericSubtypeHostedContract(lane);
	const hosted = await inspectCallbackSubtypeHostedArtifact(selected, {
		workflow: contract.workflow, jobName: contract.job
		, artifactPrefix: contract.artifactPrefix
	});
	assertGenericSubtypeHostedSteps(contract, hosted.api.job.bytes);
	const revision = hosted.revision;
	const revisions = { producer: revision, consumer: revision
		, checker: archiveCommit, archiver: archiveCommit };
	const descriptors = new Map();
	const put = (path, descriptor) => {
		assert.ok(!descriptors.has(path), path); descriptors.set(path, descriptor);
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
		tmpdir(), "lean-bridge-generic-subtype-zip-"));
	try
	{
		const accepted = await replayGenericSubtypeHostedOutput(
			lane, extracted.root, revision);
		for(const path of await regularFiles(extracted.root))
			await putFile(`hosted/output/${path}`, join(extracted.root, path));
		for(const [name, item] of Object.entries(hosted.api))
			putBytes(`hosted/api/${name}.json`, item.bytes);
		const parts = await splitCallbackSubtypeHostedArtifact(
			selected["artifact-zip"], partsRoot);
		for(const part of parts)
			await putFile(`hosted/artifact.zip.parts/${part.name}`, part.path);
		const selectedSources = genericSubtypeEvidenceSources(lane, revisions);
		for(const source of selectedSources)
			putBytes(`sources/${source.role}/${source.path}`
				, genericSubtypeHostedOriginal(source.revision, source.path));
		const ordered = [...descriptors].sort(([left], [right]) =>
			left.localeCompare(right));
		const files = ordered.map(([path, descriptor]) => ({
			path, bytes: descriptor.bytes, sha256: descriptor.sha256
		}));
		const index = {
			schemaVersion: 1, kind: `generic-subtype-${lane}-hosted-v1`
			, lane, profiles: contract.profiles, routes: contract.routes
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
 * Independently replay one retained generic-Subtype archive.
 *
 * @param lane - Closed hosted lane name.
 * @param evidenceRoot - Evidence directory containing index.json.
 */
export const checkGenericSubtypeHostedEvidence = async (lane, evidenceRoot) => {
	const contract = genericSubtypeHostedContract(lane);
	const root = await realpath(evidenceRoot);
	const indexBytes = await readFile(join(root, "index.json"));
	const index = JSON.parse(indexBytes);
	assert.equal(indexBytes.toString(), canonicalJson(index));
	assert.deepEqual(Object.keys(index).toSorted(), ["accepted", "archiveCommit"
		, "checkerCommit", "consumerCommit", "files", "hostedRun", "kind"
		, "lane", "limitations", "producerCommit", "profiles", "routes"
		, "schemaVersion", "selectedSources"]);
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, `generic-subtype-${lane}-hosted-v1`);
	assert.equal(index.lane, lane);
	assert.deepEqual(index.profiles, contract.profiles);
	assert.deepEqual(index.routes, contract.routes);
	assert.deepEqual(index.limitations, limitations);
	for(const key of ["producerCommit", "consumerCommit", "checkerCommit"
		, "archiveCommit"]) assert.match(index[key], /^[a-f0-9]{40}$/u, key);
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
		assert.equal(await callbackSubtypeHostedDigest(path)
			, file.sha256, file.path);
	}
	const revisions = { producer: index.producerCommit
		, consumer: index.consumerCommit, checker: index.checkerCommit
		, archiver: index.archiveCommit };
	assert.deepEqual(index.selectedSources
		, genericSubtypeEvidenceSources(lane, revisions));
	for(const source of index.selectedSources)
		assert.deepEqual(await readFile(join(root
			, `sources/${source.role}/${source.path}`))
		, genericSubtypeHostedOriginal(source.revision, source.path)
		, `${source.role}/${source.path}`);
	assert.deepEqual(index.files.filter(file =>
		file.path.startsWith("sources/")).map(file => file.path).toSorted()
	, index.selectedSources.map(source =>
		`sources/${source.role}/${source.path}`).toSorted());
	const temporary = await mkdtemp(join(
		tmpdir(), "lean-bridge-generic-subtype-evidence-"));
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
		const hosted = await inspectCallbackSubtypeHostedArtifact({
			"artifact-zip": zip, "run-json": api("run")
			, "job-json": api("job"), "artifact-json": api("artifact")
		}, { workflow: contract.workflow, jobName: contract.job
			, artifactPrefix: contract.artifactPrefix });
		assert.equal(hosted.revision, index.producerCommit);
		assertCallbackSubtypeHostedApiBinding(index, hosted);
		assertGenericSubtypeHostedSteps(contract, hosted.api.job.bytes);
		extracted = await extractCallbackSubtypeHostedArtifact(zip);
		assert.deepEqual(extracted.entries, index.hostedRun.artifact.members);
		const paths = await regularFiles(extracted.root);
		assert.deepEqual(paths, index.accepted.files);
		for(const path of paths)
			assert.deepEqual(await readFile(join(extracted.root, path))
				, await readFile(join(root, "hosted/output", path)), path);
		assert.deepEqual(await replayGenericSubtypeHostedOutput(
			lane, join(root, "hosted/output"), index.producerCommit)
		, index.accepted);
	}
	finally
	{
		if(extracted) await rm(extracted.root, { recursive: true });
		await rm(temporary, { recursive: true });
	}
	return index;
};
