/**
 * Retain the complete original PHP-Wasm entry aggregate and independently replay
 * its thirty routes. Saved summaries and caller-supplied checkers cannot replace
 * execution of the original producer's verifier.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { constants } from "node:fs";
import { copyFile, lstat, mkdir, mkdtemp, readFile, realpath, rm, statfs, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { reconstructCallbackSubtypeHostedArtifact } from "./callback-subtype-hosted-evidence.mjs";
import {
	checkedRecordValueIndexHostedDigest, splitCheckedRecordValueIndexHostedArtifact
} from "./checked-record-value-index-hosted-archive.mjs";
import {
	inspectPhpWasmRefinementEntryHostedIdentities, phpWasmRefinementEntryHostedContracts
} from "./php-wasm-refinement-entry-hosted-identities.mjs";
import {
	assertPhpWasmEntryReplayCheckout, checkPhpWasmEntryReplaySourceSnapshot
	, replayPhpWasmEntryHostedArtifacts, writePhpWasmEntryReplaySourceSnapshot
} from "./php-wasm-refinement-entry-hosted-replay.mjs";
import {
	checkPhpWasmEntryHostedArtifactBytes, checkPhpWasmEntryStoredIndex
	, inspectPhpWasmEntryStoredZip, retainPhpWasmEntryHostedArtifact
} from "./php-wasm-refinement-entry-hosted-storage.mjs";

const sourceRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const maxPartBytes = 64 * 1024 ** 2, maxSourceZipBytes = 128 * 1024 ** 2;
const exact = (value, keys, label) => {
	assert.ok(value && typeof value === "object" && !Array.isArray(value), label);
	assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), label);
};
const integer = (value, maximum, minimum = 0) =>
	assert.ok(Number.isSafeInteger(value) && value >= minimum && value <= maximum);
const identity = (value, maximum, minimum = 0) => {
	exact(value, ["bytes", "sha256"], "byte identity");
	integer(value.bytes, maximum, minimum); assert.match(value.sha256, /^[a-f0-9]{64}$/u);
};
const canonical = async path => {
	assert.ok(typeof path === "string" && isAbsolute(path) && resolve(path) === path);
	assert.equal(await realpath(path), path, "canonical archive path");
};
const receipt = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
const readJson = async (path, limit = 2 * 1024 ** 2, own = false) => {
	await canonical(path); const information = await lstat(path);
	assert.ok(information.isFile()); integer(information.size, limit, 1);
	const bytes = await readFile(path); assert.equal(bytes.length, information.size);
	const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
	if(own) assert.equal(bytes.toString(), canonicalJson(value));
	return { bytes, value, receipt: receipt(bytes) };
};
const ownRevision = async () => {
	assert.equal(process.cwd(), sourceRoot, "aggregate archive tools run in their own checkout");
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const revision = execFileSync("git", ["rev-parse", "HEAD"], { env, encoding: "utf8" }).trim();
	await assertPhpWasmEntryReplayCheckout(sourceRoot, revision); return revision;
};
const capacity = async (path, required) => {
	const space = await statfs(path);
	assert.ok(space.bavail * space.bsize >= required + 512 * 1024 ** 2
		, "complete archive must leave at least 512 MiB free");
};
const slot = position => String(position).padStart(4, "0");
const artifactDirectory = position => "artifacts/" + slot(position);
const apiPath = (kind, position) => `api/${kind}/${slot(position)}.json`;

/**
 * Close every path, source role and artifact slot in an archive index. Structural
 * agreement alone is not installed evidence; the full checker must execute.
 *
 * @param index - Untrusted parsed archive index.
 */
export const checkPhpWasmEntryHostedArchiveIndex = index => {
	exact(index, [
		"schemaVersion", "kind", "scope", "producerCommit", "archiverCommit"
		, "identity", "run", "artifacts", "sources", "replay"
	], "complete archive fields");
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, "php-wasm-refinement-entry-hosted-archive-v1");
	assert.equal(index.scope, "separate-instrumented-probe");
	for(const revision of [index.producerCommit, index.archiverCommit]) assert.match(revision, /^[a-f0-9]{40}$/u);
	identity(index.run, 2 * 1024 ** 2, 1); identity(index.replay, 16 * 1024 ** 2, 1);
	const contracts = phpWasmRefinementEntryHostedContracts(index.producerCommit);
	assert.ok(Array.isArray(index.artifacts)); assert.equal(index.artifacts.length, contracts.length);
	for(const [position, artifact] of index.artifacts.entries())
	{
		exact(artifact, ["name", "directory", "job", "artifact", "index", "storage"], "artifact slot");
		assert.equal(artifact.name, contracts[position].name);
		assert.equal(artifact.directory, artifactDirectory(position));
		identity(artifact.job, 2 * 1024 ** 2, 1); identity(artifact.artifact, 2 * 1024 ** 2, 1);
		identity(artifact.index, 8 * 1024 ** 2, 1);
		exact(artifact.storage, ["schemaVersion", "scope", "files", "zip", "outputBytes"], "stored byte result");
		assert.equal(artifact.storage.schemaVersion, 1);
		assert.equal(artifact.storage.scope, "original-zip-and-output-bytes-only");
		integer(artifact.storage.files, 20_000, 1);
		identity(artifact.storage.zip, 128 * 1024 ** 2, 1);
		integer(artifact.storage.outputBytes, 256 * 1024 ** 2);
	}
	assert.ok(Array.isArray(index.sources));
	assert.deepEqual(index.sources.map(item => item.role), ["producer", "archiver"]);
	for(const source of index.sources)
	{
		exact(source, ["role", "snapshot", "parts"], "source role");
		exact(source.snapshot, ["revision", "files", "zip"], "source snapshot");
		assert.equal(source.snapshot.revision, source.role === "producer" ? index.producerCommit : index.archiverCommit);
		assert.ok(Array.isArray(source.snapshot.files)); integer(source.snapshot.files.length, 20_000, 1);
		identity(source.snapshot.zip, maxSourceZipBytes, 1);
		assert.ok(Array.isArray(source.parts));
		assert.equal(source.parts.length, Math.ceil(source.snapshot.zip.bytes / maxPartBytes));
		let offset = 0;
		for(const [position, part] of source.parts.entries())
		{
			exact(part, ["path", "offset", "bytes", "sha256"], "source ZIP range");
			assert.equal(part.path, `sources/${source.role}/${slot(position)}.part`);
			assert.equal(part.offset, offset);
			assert.equal(part.bytes, Math.min(maxPartBytes, source.snapshot.zip.bytes - offset));
			assert.match(part.sha256, /^[a-f0-9]{64}$/u); offset += part.bytes;
		}
		assert.equal(offset, source.snapshot.zip.bytes);
	}
	return true;
};

const summaryShape = value => {
	exact(value, ["schemaVersion", "kind", "producerCommit", "verification", "artifacts", "matrix"], "replayed summary fields");
	assert.equal(value.schemaVersion, 1); assert.equal(value.kind, "php-wasm-refinement-entry-hosted-v1");
	assert.match(value.producerCommit, /^[a-f0-9]{40}$/u);
	exact(value.verification, [
		"verifierCommit", "sourcePathsClean", "sourcePaths"
		, "sourcePathClosure", "verifierNodeVersion", "verifierNodeMajor"
	], "original verifier boundary");
	assert.equal(value.verification.verifierCommit, value.producerCommit);
	assert.equal(value.verification.sourcePathsClean, true);
	assert.deepEqual(value.verification.sourcePaths, ["src", "tests", "scripts"]);
	assert.equal(value.verification.sourcePathClosure, "tracked-and-untracked-nonignored");
	assert.equal(value.verification.verifierNodeMajor, 22);
	assert.match(value.verification.verifierNodeVersion, /^22\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/u);
	assert.equal(value.matrix?.scope, "separate-instrumented-probe");
	assert.equal(value.matrix.producerCommit, value.producerCommit);
	assert.equal(value.matrix.cells, 30); assert.equal(value.matrix.artifacts, 27);
	assert.ok(Array.isArray(value.artifacts));
	assert.deepEqual(value.artifacts.map(item => item.name)
		, phpWasmRefinementEntryHostedContracts(value.producerCommit).slice(0, -1).map(item => item.name));
};

/**
 * Compare every summary field except the explicitly validated Node 22 version.
 * Keep both original versions and bytes; never erase the verification boundary.
 * This comparison does not execute a verifier or establish acceptance itself.
 *
 * @param recorded - Original hosted or archived summary, unchanged.
 * @param replayed - Result from the real original-producer CLI.
 */
export const comparePhpWasmEntryHostedReplay = (recorded, replayed) => {
	summaryShape(recorded); summaryShape(replayed);
	const normalize = value => ({ ...value
		, verification: { ...value.verification, verifierNodeVersion: "validated-node-22-version" } });
	const digest = sha256(canonicalJson(normalize(replayed)));
	assert.equal(sha256(canonicalJson(normalize(recorded))), digest
		, "all hosted summary semantics must match actual original-source replay");
	return { scope: "summary-comparison-only", semanticSha256: digest
		, recordedNodeVersion: recorded.verification.verifierNodeVersion
		, replayNodeVersion: replayed.verification.verifierNodeVersion };
};

const copyOutput = async (source, destination, output) => {
	await mkdir(destination);
	assert.deepEqual(await nativeArtifactPaths(source), output.map(file => file.path.slice(7)));
	for(const file of output)
	{
		const path = file.path.slice(7);
		const original = join(source, path); await canonical(original);
		const target = join(destination, path); await mkdir(dirname(target), { recursive: true });
		await copyFile(original, target, constants.COPYFILE_EXCL | constants.COPYFILE_FICLONE);
		assert.equal((await lstat(target)).size, file.bytes);
		assert.equal(await checkedRecordValueIndexHostedDigest(target), file.sha256);
	}
};
const replayRetained = async (directory, index, producerCheckout) => {
	const required = index.artifacts.reduce((sum, item) => sum + item.storage.outputBytes, 0);
	await capacity(tmpdir(), required);
	const temporary = await mkdtemp(join(tmpdir(), "lean-php-entry-matrix-replay-"));
	try
	{
		for(const item of index.artifacts.slice(0, -1))
		{
			const stored = await readJson(join(directory, item.directory, "index.json"), 8 * 1024 ** 2, true);
			assert.deepEqual(stored.receipt, item.index); checkPhpWasmEntryStoredIndex(stored.value);
			await copyOutput(join(directory, item.directory, "output"), join(temporary, item.name), stored.value.output);
		}
		const aggregate = join(directory, index.artifacts.at(-1).directory, "output");
		assert.deepEqual(await nativeArtifactPaths(aggregate), ["summary.json", "verification.log"]);
		const original = await readJson(join(aggregate, "summary.json"), 16 * 1024 ** 2, true);
		const aggregateIndex = await readJson(join(aggregate, "../index.json"), 8 * 1024 ** 2, true);
		assert.deepEqual(aggregateIndex.receipt, index.artifacts.at(-1).index);
		const summaryFile = aggregateIndex.value.output.find(file => file.path === "output/summary.json");
		assert.ok(summaryFile); assert.equal(original.receipt.bytes, summaryFile.bytes);
		assert.equal(original.receipt.sha256, summaryFile.sha256);
		const replayed = await replayPhpWasmEntryHostedArtifacts(producerCheckout, index.producerCommit, temporary);
		const comparison = comparePhpWasmEntryHostedReplay(original.value, replayed);
		return { replayed, comparison };
	}
	finally
	{ await rm(temporary, { recursive: true, force: true }); }
};

const retainSources = async (directory, producerCommit, archiverCommit) => {
	const sources = [], temporary = await mkdtemp(join(tmpdir(), "lean-php-entry-matrix-source-"));
	try
	{
		for(const [role, revision] of [["producer", producerCommit], ["archiver", archiverCommit]])
		{
			const zip = join(temporary, role + ".zip");
			const snapshot = await writePhpWasmEntryReplaySourceSnapshot(revision, zip);
			const target = join(directory, "sources", role); await mkdir(target);
			const parts = await splitCheckedRecordValueIndexHostedArtifact(zip, target);
			const ranges = parts.map(part => ({
				path: `sources/${role}/${part.name}`
				, offset: part.offset
				, bytes: part.bytes, sha256: part.sha256
			}));
			sources.push({ role, snapshot, parts: ranges });
		}
		return sources;
	}
	finally
	{ await rm(temporary, { recursive: true, force: true }); }
};

/**
 * Capture one complete terminal successful run. Original APIs, ZIPs, outputs and
 * source snapshots remain immutable; publish the index only after real replay.
 * Failed/partial runs belong to the separate diagnostic archiver.
 *
 * @param selection - Original complete identity-input paths in contract order.
 * @param destination - Fresh absolute archive directory.
 * @param producerCheckout - Clean worktree at the exact original producer SHA.
 */
export const archivePhpWasmEntryHostedMatrix = async (selection, destination, producerCheckout) => {
	const observed = await inspectPhpWasmRefinementEntryHostedIdentities(selection);
	const producerCommit = observed.identity.producerCommit, archiverCommit = await ownRevision();
	await assertPhpWasmEntryReplayCheckout(producerCheckout, producerCommit);
	assert.ok(isAbsolute(destination) && resolve(destination) === destination);
	await canonical(dirname(destination));
	let expanded = 0;
	for(const item of selection.artifacts) expanded += (await inspectPhpWasmEntryStoredZip(item.artifactZip)).expandedBytes;
	const required = expanded * 2 + observed.identity.zipBytes + maxSourceZipBytes * 2;
	await capacity(dirname(destination), required); await capacity(tmpdir(), required);
	await mkdir(destination);
	for(const path of ["api", "api/jobs", "api/artifacts", "artifacts", "sources"])
		await mkdir(join(destination, path));
	await writeFile(join(destination, "api/run.json"), observed.run.bytes, { flag: "wx" });
	const artifacts = [];
	for(const [position, item] of observed.artifacts.entries())
	{
		await writeFile(join(destination, apiPath("jobs", position)), item.job.bytes, { flag: "wx" });
		await writeFile(join(destination, apiPath("artifacts", position)), item.artifact.bytes, { flag: "wx" });
		const path = artifactDirectory(position);
		const retained = await retainPhpWasmEntryHostedArtifact(selection.artifacts[position].artifactZip, join(destination, path));
		assert.equal(retained.zip.bytes, item.zip.bytes); assert.equal(retained.zip.sha256, item.zip.sha256);
		artifacts.push({ name: item.name, directory: path
			, job: receipt(item.job.bytes), artifact: receipt(item.artifact.bytes)
			, index: (await readJson(join(destination, path, "index.json"), 8 * 1024 ** 2, true)).receipt
			, storage: await checkPhpWasmEntryHostedArtifactBytes(join(destination, path)) });
	}
	const sources = await retainSources(destination, producerCommit, archiverCommit);
	const index = {
		schemaVersion: 1, kind: "php-wasm-refinement-entry-hosted-archive-v1"
		, scope: "separate-instrumented-probe", producerCommit, archiverCommit
		, identity: observed.identity, run: receipt(observed.run.bytes)
		, artifacts, sources
	};
	const { replayed } = await replayRetained(destination, index, producerCheckout);
	const bytes = Buffer.from(canonicalJson(replayed));
	await writeFile(join(destination, "replay.json"), bytes, { flag: "wx" }); index.replay = receipt(bytes);
	checkPhpWasmEntryHostedArchiveIndex(index);
	await assertPhpWasmEntryReplayCheckout(sourceRoot, archiverCommit);
	await writeFile(join(destination, "index.json"), canonicalJson(index), { flag: "wx" });
	return checkPhpWasmEntryHostedArchive(destination, producerCheckout);
};

/**
 * Reconstruct every original input and execute the real thirty-route verifier.
 * Independently compare hosted and capture-time summaries to this fresh result.
 * There is no identity-only or saved-success bypass in this positive checker.
 *
 * @param directory - Canonical retained complete archive.
 * @param producerCheckout - Exact clean original producer worktree.
 */
export const checkPhpWasmEntryHostedArchive = async (directory, producerCheckout) => {
	await canonical(directory); assert.ok((await lstat(directory)).isDirectory());
	const recorded = await readJson(join(directory, "index.json"), 16 * 1024 ** 2, true), index = recorded.value;
	checkPhpWasmEntryHostedArchiveIndex(index);
	const run = await readJson(join(directory, "api/run.json")); assert.deepEqual(run.receipt, index.run);
	const checkerCommit = await ownRevision();
	await assertPhpWasmEntryReplayCheckout(producerCheckout, index.producerCommit);
	const required = index.artifacts.reduce((sum, item) => sum + item.storage.zip.bytes + item.storage.outputBytes, 0)
		+ maxSourceZipBytes * 2;
	await capacity(tmpdir(), required);
	const temporary = await mkdtemp(join(tmpdir(), "lean-php-entry-matrix-check-"));
	try
	{
		const paths = ["index.json", "replay.json", "api/run.json"];
		const selection = { runJson: join(directory, "api/run.json"), artifacts: [] };
		for(const [position, item] of index.artifacts.entries())
		{
			const root = join(directory, item.directory);
			const record = await readJson(join(root, "index.json"), 8 * 1024 ** 2, true);
			assert.deepEqual(record.receipt, item.index);
			const checked = await checkPhpWasmEntryHostedArtifactBytes(root); assert.deepEqual(checked, item.storage);
			const stored = record.value;
			paths.push(...checkPhpWasmEntryStoredIndex(stored).map(path => item.directory + "/" + path));
			for(const [kind, expected] of [["jobs", item.job], ["artifacts", item.artifact]])
			{
				const path = apiPath(kind, position); paths.push(path);
				assert.deepEqual((await readJson(join(directory, path))).receipt, expected);
			}
			const zip = join(temporary, slot(position) + ".zip");
			assert.equal(await reconstructCallbackSubtypeHostedArtifact(root, stored.zip.parts, zip), item.storage.zip.bytes);
			assert.equal(await checkedRecordValueIndexHostedDigest(zip), item.storage.zip.sha256);
			selection.artifacts.push({ name: item.name
				, jobJson: join(directory, apiPath("jobs", position))
				, artifactJson: join(directory, apiPath("artifacts", position))
				, artifactZip: zip });
		}
		const observed = await inspectPhpWasmRefinementEntryHostedIdentities(selection);
		assert.deepEqual(observed.identity, index.identity);
		assert.equal(observed.identity.producerCommit, index.producerCommit);
		for(const source of index.sources)
		{
			paths.push(...source.parts.map(part => part.path));
			for(const part of source.parts)
			{
				const path = join(directory, part.path); await canonical(path);
				const information = await lstat(path); assert.ok(information.isFile());
				assert.equal(information.size, part.bytes);
			}
			const zip = join(temporary, source.role + ".zip");
			assert.equal(await reconstructCallbackSubtypeHostedArtifact(directory, source.parts, zip), source.snapshot.zip.bytes);
			await checkPhpWasmEntryReplaySourceSnapshot(source.snapshot, zip);
		}
		assert.deepEqual(await nativeArtifactPaths(directory), paths.sort(), "complete archive file closure");
		const capture = await readJson(join(directory, "replay.json"), 16 * 1024 ** 2, true);
		assert.deepEqual(capture.receipt, index.replay);
		const { replayed, comparison } = await replayRetained(directory, index, producerCheckout);
		comparePhpWasmEntryHostedReplay(capture.value, replayed);
		await assertPhpWasmEntryReplayCheckout(sourceRoot, checkerCommit);
		return { schemaVersion: 1, kind: "php-wasm-entry-hosted-archive-acceptance-v1"
			, scope: "separate-instrumented-probe", producerCommit: index.producerCommit
			, archiverCommit: index.archiverCommit, checkerCommit
			, runId: observed.identity.runId, runAttempt: observed.identity.runAttempt
			, producerArtifacts: 27, aggregateArtifacts: 1, replayedRoutes: 30
			, files: paths.length, zipBytes: observed.identity.zipBytes
			, outputBytes: index.artifacts.reduce((sum, item) => sum + item.storage.outputBytes, 0)
			, summaryComparison: comparison, matrix: replayed.matrix };
	}
	finally
	{ await rm(temporary, { recursive: true, force: true }); }
};
