/**
 * Read immutable source bytes from an exact Git producer revision.
 *
 * Evidence verifiers use this when their recorded milestone predates the
 * complete source-history graph. A producer commit is a stronger boundary
 * than replaying an incomplete suffix of today's source tree.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { posix } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";

const revisionPattern = /^[a-f0-9]{40}$/u;
const digestPattern = /^[a-f0-9]{64}$/u;
const sources = new Map();
const maxSourceBytes = 64 * 1024 * 1024;
let retainedSourceBytes = 0;

/**
 * Authenticate a complete source map with one Git tree read and one batched
 * object read. This is substantially cheaper than spawning Git once per file.
 *
 * @param revision - Full producer commit identity.
 * @param expectedSources - Repository paths mapped to recorded SHA-256 values.
 */
export const authenticateProducerSources = (revision, expectedSources) => {
	assert.match(revision, revisionPattern);
	assert.ok(expectedSources && typeof expectedSources === "object"
		&& !Array.isArray(expectedSources));
	const entries = Object.entries(expectedSources);
	assert.ok(entries.length > 0);
	const tree = execFileSync("git", ["ls-tree", "-rz", revision], {
		maxBuffer: 64 * 1024 * 1024
		, stdio: ["ignore", "pipe", "pipe"]
	});
	const blobs = new Map();
	for(const entry of tree.toString().split("\0").filter(Boolean))
	{
		const tab = entry.indexOf("\t");
		assert.ok(tab > 0);
		const [mode, type, object] = entry.slice(0, tab).split(" ");
		assert.match(mode, /^[0-7]{6}$/u);
		if(type === "blob") blobs.set(entry.slice(tab + 1), object);
	}
	const requests = entries.map(([path, expected]) => {
		assert.equal(posix.normalize(path), path);
		assert.ok(!path.startsWith("/") && !path.split("/").includes(".."));
		assert.match(expected, digestPattern);
		const object = blobs.get(path);
		assert.match(object, /^[a-f0-9]{40,64}$/u, path);
		return { path, expected, object };
	});
	const objects = [...new Set(requests.map(item => item.object))];
	const output = execFileSync("git", ["cat-file", "--batch"], {
		input: objects.join("\n") + "\n"
		, maxBuffer: 512 * 1024 * 1024
		, stdio: ["pipe", "pipe", "pipe"]
	});
	const digests = new Map();
	let offset = 0;
	for(const object of objects)
	{
		const newline = output.indexOf(10, offset);
		assert.ok(newline > offset);
		const [actual, type, sizeText] = output.subarray(offset, newline)
			.toString().split(" ");
		assert.equal(actual, object); assert.equal(type, "blob");
		assert.match(sizeText, /^(?:0|[1-9][0-9]*)$/u);
		const size = Number(sizeText), start = newline + 1, end = start + size;
		assert.ok(Number.isSafeInteger(size) && end < output.length);
		assert.equal(output[end], 10);
		digests.set(object, sha256(output.subarray(start, end)));
		offset = end + 1;
	}
	assert.equal(offset, output.length);
	for(const { path, expected, object } of requests)
		assert.equal(digests.get(object), expected, path);
	return true;
};

/**
 * Return one file's binary bytes exactly as committed by an evidence producer.
 *
 * @param revision - Full producer commit identity.
 * @param path - Safe repository-relative path.
 * @param expected - Optional recorded content SHA-256.
 */
export const bytesAtProducer = (revision, path, expected = undefined) => {
	assert.match(revision, revisionPattern);
	assert.equal(posix.normalize(path), path);
	assert.ok(!path.startsWith("/") && !path.split("/").includes(".."));
	if(expected !== undefined) assert.match(expected, digestPattern);
	const key = `${revision}:${path}`;
	let bytes = sources.get(key);
	if(bytes === undefined)
	{
		bytes = execFileSync("git", ["show", key], {
			maxBuffer: maxSourceBytes
			, stdio: ["ignore", "pipe", "pipe"]
		});
		if(bytes.length <= maxSourceBytes)
		{
			sources.set(key, bytes);
			retainedSourceBytes += bytes.length;
			while(retainedSourceBytes > maxSourceBytes)
			{
				const oldestKey = sources.keys().next().value;
				const oldest = sources.get(oldestKey);
				sources.delete(oldestKey);
				retainedSourceBytes -= oldest.length;
			}
		}
	}
	if(expected !== undefined) assert.equal(sha256(bytes), expected, path);
	return Buffer.from(bytes);
};

/**
 * Return one UTF-8 file exactly as committed by an evidence producer.
 *
 * @param revision - Full producer commit identity.
 * @param path - Safe repository-relative path.
 * @param expected - Optional recorded content SHA-256.
 */
export const sourceAtProducer = (revision, path, expected = undefined) =>
	bytesAtProducer(revision, path, expected).toString("utf8");

/**
 * Read the independent type-surface contracts at one producer revision.
 *
 * @param revision - Full producer commit identity.
 */
export const typeSurfaceContractsAtProducer = revision => ({
	irSchema: JSON.parse(sourceAtProducer(
		revision, "schema/binding-ir.schema.json"
	))
	, consumers: JSON.parse(sourceAtProducer(
		revision, "docs/consumer-support.v1.json"
	))
});
