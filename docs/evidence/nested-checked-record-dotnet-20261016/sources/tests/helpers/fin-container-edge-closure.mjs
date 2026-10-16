/**
 * Close package-owned trees before the Fin edge harness compiles or runs a consumer.
 * These profiles install the archive payload without package-manager-added files.
 * Interpreter environments and other ecosystems need their own closure policies.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, realpath } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";

/** Profiles whose installed package tree is exactly the original archive payload. */
export const finContainerEdgeClosedProfiles = Object.freeze(["c", "cpp", "wit-wasi", "rust"]);

/**
 * Require the receipt's exact bytes, listed files and no other regular or special files.
 *
 * @param options - Original receipt and installed package root.
 * @param options.installed - Real package directory, never a linked root.
 * @param options.receiptBytes - Exact bytes authenticated against the original archive.
 * @param options.receiptPath - Receipt path relative to the package root.
 */
export const verifyFinContainerEdgeFileClosure = async ({ installed, receiptBytes, receiptPath }) => {
	assert.equal(await realpath(installed), resolve(installed), "package root must not traverse a symlink");
	assert.match(receiptPath, /^(?:[A-Za-z0-9_.+-]+\/)*[A-Za-z0-9_.+-]+\.json$/u);
	assert.ok(receiptPath.split("/").every(part => part !== "." && part !== ".."));
	const bytes = Buffer.from(receiptBytes);
	assert.deepEqual(await readFile(join(installed, receiptPath)), bytes, "receipt must equal the original archive member");
	const receipt = JSON.parse(bytes);
	await verifyNativeFiles(installed, receipt.files);
	const files = await nativeArtifactPaths(installed);
	assert.deepEqual(files, [...Object.keys(receipt.files), receiptPath].sort(), "unrecorded or missing file in the package-owned tree");
	return { receiptSha256: sha256(bytes), packageFileSetSha256: sha256(canonicalJson(files)) };
};

/**
 * Authenticate the receipt from the verified archive, not from the mutable installed copy.
 * The installation harness calls this hook before compilation, before execution and after execution.
 *
 * @param options - Installed package and original tar archive.
 * @param options.profile - One of the explicitly closed profiles.
 * @param options.installed - Package-owned directory after archive extraction.
 * @param options.receiptPath - Receipt path within that directory.
 * @param options.archive - Absolute original archive path.
 * @param options.archiveSha256 - Original package-set artifact digest.
 */
export const verifyFinContainerEdgeArchiveClosure = async ({ profile, installed, receiptPath, archive, archiveSha256 }) => {
	assert.ok(finContainerEdgeClosedProfiles.includes(profile), `no exact package closure for ${profile}`);
	assert.match(archiveSha256, /^[a-f0-9]{64}$/u);
	assert.equal(sha256(await readFile(archive)), archiveSha256, "original package archive drift");
	const result = await processBuildRunner.capture({ command: "/usr/bin/tar"
		, args: ["--use-compress-program=/usr/bin/gzip", "-xOf", archive, `${basename(installed)}/${receiptPath}`]
		, cwd: installed, env: {}, timeoutMs: 180_000 });
	assert.equal(result.stderr, "");
	return verifyFinContainerEdgeFileClosure({ installed, receiptPath, receiptBytes: result.stdout });
};
