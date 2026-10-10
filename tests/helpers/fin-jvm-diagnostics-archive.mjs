/**
 * Authenticate the complete original JVM diagnostic archive, including ignored logs.
 * This checks retained evidence bytes, not installed or hosted JVM acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";

export const finJvmDiagnosticsArchiveRoot = "docs/evidence/fin-jvm-exit-diagnostics-20261010";
export const finJvmDiagnosticsArchiveIndexSha256 = "b093c653bfcebc45b78d3a91a3806f5f96d23adb7a22a42522b29480a0082a2e";

/**
 * Read every indexed artifact from the portable archive, never its producer path.
 *
 * @param read - Archive-relative reader; injectable for missing/corrupt-file controls.
 */
export const assertFinJvmDiagnosticsArchive = async (read = path => readFile(join(finJvmDiagnosticsArchiveRoot, path))) => {
	const bytes = await read("index.json");
	assert.equal(sha256(bytes), finJvmDiagnosticsArchiveIndexSha256, "original JVM diagnostic index");
	const index = JSON.parse(bytes);
	assert.equal(index.files.length, 89);
	for(const file of index.files)
	{
		const artifact = await read(file.path);
		assert.equal(artifact.length, file.bytes, `JVM diagnostic artifact size: ${file.path}`);
		assert.equal(sha256(artifact), file.sha256, `JVM diagnostic artifact digest: ${file.path}`);
	}
	return index;
};
