/**
 * Authenticate historical type-surface inventories without rereading every
 * unchanged evidence byte in each Core shard.
 *
 * The Core prerequisite authenticates the complete live corpus and binds that
 * pass to the exact commit. Historical inventories may retain older source
 * hashes, so changed paths are reconstructed from the same immutable Git tree
 * and passed through the source-history normalizer. Unchanged paths remain
 * covered directly by the authenticated live inventory.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { posix, resolve } from "node:path";
import { readTypeSurface } from "../../src/adoption/type-surface.mjs";
import { typeSurfaceEvidenceFiles } from "../../src/adoption/type-surface-evidence-receipt.mjs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";

const revisionPattern = /^[a-f0-9]{40}$/u;
const objectPattern = /^[a-f0-9]{40,64}$/u;
const digestPattern = /^[a-f0-9]{64}$/u;
const maxObjectBytes = 64 * 1024 * 1024;
const maxBatchBytes = 32 * 1024 * 1024;
const maxCacheBytes = 64 * 1024 * 1024;
const liveDocuments = new Map(), gitSources = new Map();
let retainedGitSourceBytes = 0;

const safePath = path => {
	assert.equal(typeof path, "string");
	assert.equal(posix.normalize(path), path);
	assert.ok(path && !path.startsWith("/") && !path.split("/").includes(".."));
	assert.doesNotMatch(path, /[:\0\r\n]/u);
	return path;
};

const revisionAt = repository => {
	const revision = execFileSync("git", [
		"-C", repository, "rev-parse", "HEAD"
	], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
	assert.match(revision, revisionPattern);
	return revision;
};

const liveDocument = async (repository, revision) => {
	const receipt = process.env.LEAN_BRIDGE_TYPE_SURFACE_EVIDENCE_RECEIPT ?? "";
	const key = `${repository}\0${revision}\0${receipt}`;
	let pending = liveDocuments.get(key);
	if(pending === undefined)
	{
		pending = readTypeSurface({ repository }).then(result => result.document);
		liveDocuments.set(key, pending);
		pending.catch(() => liveDocuments.delete(key));
	}
	return pending;
};

/**
 * Return exact live path/digest pairs after the normal byte or receipt pass.
 *
 * @param options - Repository selection.
 * @param options.repository - Repository root.
 */
export const authenticatedTypeSurfaceEvidence = async (options = {}) => {
	let { repository = resolve(".") } = options;
	repository = resolve(repository);
	const document = await liveDocument(repository, revisionAt(repository));
	return new Map(typeSurfaceEvidenceFiles(document)
		.map(file => [file.path, file.sha256]));
};

/**
 * Read a bounded set of exact Git blobs with one object query and bounded
 * batches. Callers already hold authenticated expected hashes for HEAD.
 *
 * @param paths - Safe repository-relative paths.
 * @param revision - Exact Git commit.
 * @param root - Repository root.
 */
export const historicalTypeSurfaceGitSources = (
	paths, revision, root = resolve(".")
) => {
	assert.match(revision, revisionPattern);
	assert.ok(Array.isArray(paths));
	root = resolve(root);
	const selected = [...new Set(paths.map(safePath))].toSorted();
	if(selected.length === 0) return new Map();
	const sources = new Map(), missing = [];
	for(const path of selected)
	{
		const key = `${root}\0${revision}\0${path}`, cached = gitSources.get(key);
		if(cached === undefined) missing.push(path);
		else
		{
			gitSources.delete(key); gitSources.set(key, cached);
			sources.set(path, Buffer.from(cached));
		}
	}
	if(missing.length === 0) return sources;
	const expressions = missing.map(path => `${revision}:${path}`);
	const checked = execFileSync("git", [
		"-C", root, "cat-file"
		, "--batch-check=%(objectname) %(objecttype) %(objectsize)"
	], {
		input: `${expressions.join("\n")}\n`, encoding: "utf8"
		, maxBuffer: 16 * 1024 * 1024
		, stdio: ["pipe", "pipe", "pipe"]
	}).trimEnd().split("\n");
	assert.equal(checked.length, missing.length);
	const requests = checked.map((line, index) => {
		const [object, type, sizeText, ...extra] = line.split(" ");
		assert.deepEqual(extra, []); assert.match(object, objectPattern);
		assert.equal(type, "blob", missing[index]);
		assert.match(sizeText, /^(?:0|[1-9][0-9]*)$/u);
		const size = Number(sizeText);
		assert.ok(Number.isSafeInteger(size) && size <= maxObjectBytes
			, `${missing[index]} exceeds the historical source bound`);
		return { expression: expressions[index], object, path: missing[index], size };
	});
	const batches = []; let batch = []; let bytes = 0;
	for(const request of requests)
	{
		if(batch.length && bytes + request.size > maxBatchBytes)
		{ batches.push(batch); batch = []; bytes = 0; }
		batch.push(request); bytes += request.size;
	}
	if(batch.length) batches.push(batch);
	for(const group of batches)
	{
		const expectedBytes = group.reduce((total, item) => total + item.size, 0);
		const output = execFileSync("git", ["-C", root, "cat-file", "--batch"], {
			input: `${group.map(item => item.expression).join("\n")}\n`
			, maxBuffer: expectedBytes + group.length * 256 + 1024
			, stdio: ["pipe", "pipe", "pipe"]
		});
		let offset = 0;
		for(const request of group)
		{
			const newline = output.indexOf(10, offset);
			assert.ok(newline > offset);
			const [object, type, sizeText, ...extra] = output.subarray(
				offset, newline).toString().split(" ");
			assert.deepEqual(extra, []); assert.equal(object, request.object);
			assert.equal(type, "blob"); assert.equal(Number(sizeText), request.size);
			const start = newline + 1, end = start + request.size;
			assert.ok(end < output.length); assert.equal(output[end], 10);
			const source = Buffer.from(output.subarray(start, end));
			sources.set(request.path, Buffer.from(source));
			const key = `${root}\0${revision}\0${request.path}`;
			gitSources.set(key, source); retainedGitSourceBytes += source.length;
			while(retainedGitSourceBytes > maxCacheBytes)
			{
				const oldest = gitSources.keys().next().value;
				const removed = gitSources.get(oldest);
				gitSources.delete(oldest); retainedGitSourceBytes -= removed.length;
			}
			offset = end + 1;
		}
		assert.equal(offset, output.length);
	}
	return sources;
};

/**
 * Require every historical evidence pin to be either the already-authenticated
 * live pin or a valid source-history projection of the exact live Git blob.
 *
 * @param historical - Historical type-surface document.
 * @param input - Legacy normalizer or injectable controls.
 */
export const assertHistoricalTypeSurfaceEvidence = async (
	historical, input = {}
) => {
	assert.ok(historical && typeof historical === "object");
	const options = typeof input === "function" ? { normalize: input } : input;
	let { live, normalize = beforeFinRefinementSource
		, readSources = historicalTypeSurfaceGitSources
		, repository = resolve(".") } = options;
	repository = resolve(repository);
	const revision = revisionAt(repository);
	if(live === undefined) live = await liveDocument(repository, revision);
	const liveFiles = new Map(typeSurfaceEvidenceFiles(live)
		.map(file => [file.path, file.sha256]));
	const historicalFiles = typeSurfaceEvidenceFiles(historical);
	const changed = historicalFiles.filter(file =>
		liveFiles.get(file.path) !== file.sha256);
	const sources = readSources(changed.map(file => file.path), revision, repository);
	assert.ok(sources instanceof Map);
	assert.equal(sources.size, changed.length);
	for(const file of changed)
	{
		assert.match(file.sha256, digestPattern);
		const source = sources.get(file.path);
		assert.ok(Buffer.isBuffer(source), file.path);
		const liveDigest = liveFiles.get(file.path);
		if(liveDigest !== undefined)
			assert.equal(sha256(source), liveDigest, file.path);
		assert.equal(sha256(normalize(
			file.path, source, file.sha256
		)), file.sha256, file.path);
	}
	return Object.freeze({
		count: historicalFiles.length
		, inherited: historicalFiles.length - changed.length
		, reconstructed: changed.length
	});
};
