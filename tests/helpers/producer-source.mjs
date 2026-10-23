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
