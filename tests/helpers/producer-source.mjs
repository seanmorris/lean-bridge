/**
 * Read immutable UTF-8 source bytes from an exact Git producer revision.
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
 * Return one file exactly as committed by an evidence producer.
 *
 * @param revision - Full producer commit identity.
 * @param path - Safe repository-relative path.
 * @param expected - Optional recorded content SHA-256.
 */
export const sourceAtProducer = (revision, path, expected = undefined) => {
	assert.match(revision, revisionPattern);
	assert.equal(posix.normalize(path), path);
	assert.ok(!path.startsWith("/") && !path.split("/").includes(".."));
	if(expected !== undefined) assert.match(expected, digestPattern);
	const key = `${revision}:${path}`;
	let source = sources.get(key);
	if(source === undefined)
	{
		source = execFileSync("git", ["show", key], {
			encoding: "utf8", maxBuffer: maxSourceBytes
		});
		const bytes = Buffer.byteLength(source);
		if(bytes <= maxSourceBytes)
		{
			sources.set(key, source);
			retainedSourceBytes += bytes;
			while(retainedSourceBytes > maxSourceBytes)
			{
				const oldestKey = sources.keys().next().value;
				const oldest = sources.get(oldestKey);
				sources.delete(oldestKey);
				retainedSourceBytes -= Buffer.byteLength(oldest);
			}
		}
	}
	if(expected !== undefined) assert.equal(sha256(source), expected, path);
	return source;
};

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
