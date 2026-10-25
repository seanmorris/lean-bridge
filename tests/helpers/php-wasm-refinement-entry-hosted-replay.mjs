/**
 * Authenticate the complete source trees used by PHP-Wasm entry replay and
 * invoke the original producer's real verifier in its clean checkout.
 * No caller-supplied verifier or saved success object can replace execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { lstat, realpath, rm } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { gunzipSync } from "node:zlib";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { phpWasmEntryReplaySourceSupplement } from "./php-wasm-entry-source-supplement.mjs";
import { phpWasmEntryReplayBuildInputSupplement } from "./php-wasm-entry-build-input-supplement.mjs";
import {
	checkedRecordValueIndexHostedDigest, checkedRecordValueIndexHostedSafeZipPath
	, extractCheckedRecordValueIndexHostedArtifact
} from "./checked-record-value-index-hosted-archive.mjs";

// Retain code and non-module assets together. Do not infer assets from imports:
// callers, Lean fixtures, templates, lockfiles and workflows are read as data.
export const phpWasmEntryReplayBuildInputScopes = Object.freeze([
	"LICENSE"
	, "notices/runtime"
	, "notices/php-wasm.txt"
	, "patches/lean4-4.32.2-emscripten-runtime-signatures.patch"
	, "patches/lean4-4.32.2-emscripten-conditional-pthreads.patch"
	, "patches/lean4-4.32.2-offline-libuv-source.patch"
	, "poc/lean-link-spike/graph-lock.json"
	, "poc/lean-link-spike/bindings/alpha.binding-ir.json"
	, "poc/lean-link-spike/bindings/php-wasm.package.json"
	, "docs/evidence/owned-php-wasm-transfers-20260930.json"
	, "docs/evidence/callback-refinements-php-wasm-20261023/hosted/output/records/checked-record/reviewed/build-0/model.json"
]);
export const phpWasmEntryReplaySourceScopes = Object.freeze([
	"src", "tests", "scripts", "config", "schema", ".github"
	, "package.json", "package-lock.json", "lean-toolchain"
	, "flake.nix", "flake.lock", "docs/consumer-support.v1.json"
	, "site/paths.mjs", "site/serve.mjs"
	, ...phpWasmEntryReplayBuildInputScopes
]);
export const phpWasmEntryReplaySourceSupplementPath
	= "docs/evidence/php-wasm-entry-source-supplement-20261025.json";
export const phpWasmEntryReplaySourceSupplementSha256
	= "31aa1c26df04c3fa96d9e575624994288f9d1094863e5c0296e68c08c64b8b82";
export const phpWasmEntryReplayBuildInputSupplementPath
	= "docs/evidence/php-wasm-entry-build-input-supplement-20261025.json";
export const phpWasmEntryReplayBuildInputSupplementSha256
	= "19333471b6904ef61f99e6bf8ba2dc04a3eb4786114d5e209fc9a6e9d780d6e0";
const sourceLimit = 128 * 1024 * 1024;
const environment = () => Object.fromEntries(Object.entries(process.env)
	.filter(([key]) => !key.startsWith("GIT_") && !key.startsWith("LEAN_BRIDGE_")
		&& !["NODE_OPTIONS", "NODE_PATH"].includes(key)));
const git = (arguments_, cwd = process.cwd()) => execFileSync("git", arguments_
	, { cwd, env: environment(), encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
const completion = child => {
	let stderr = "";
	child.stderr?.on("data", chunk => { stderr = (stderr + chunk).slice(-65_536); });
	const result = new Promise((accept, reject) => {
		child.once("error", reject);
		child.once("close", (code, signal) => code === 0 ? accept()
			: reject(new Error(`Source process failed: ${code}/${signal}: ${stderr}`)));
	});
	void result.catch(() => {}); return result;
};

/**
 * Hash every selected original Git blob through one bounded batch reader.
 * Git SHA-1 object IDs select bytes; retained identities use SHA-256.
 *
 * @param revision - Full immutable producer or archiver revision.
 */
export const phpWasmEntryReplaySourceManifest = async revision => {
	assert.match(revision, /^[a-f0-9]{40}$/u);
	const source = git(["ls-tree", "-r", "-l", "-z", revision, "--", ...phpWasmEntryReplaySourceScopes]);
	const files = source.split("\0").filter(Boolean).map(line => {
		const match = line.match(/^(100644|100755) blob ([a-f0-9]{40})\s+([0-9]+)\t(.+)$/u);
		assert.ok(match, "Replay sources must be regular Git files");
		const [, mode, object, size, path] = match;
		assert.ok(checkedRecordValueIndexHostedSafeZipPath(path), path);
		const bytes = Number(size); assert.ok(Number.isSafeInteger(bytes) && bytes >= 0);
		return { path, mode, object, bytes };
	}).sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
	assert.ok(files.length > 0 && files.length <= 20_000);
	assert.ok(files.reduce((sum, file) => sum + file.bytes, 0) <= sourceLimit);
	for(const scope of phpWasmEntryReplaySourceScopes)
		assert.ok(files.some(file => file.path === scope || file.path.startsWith(scope + "/")), scope);
	const child = spawn("git", ["cat-file", "--batch"]
		, { env: environment(), stdio: ["pipe", "pipe", "pipe"] });
	const done = completion(child);
	child.stdin.on("error", () => {});
	child.stdin.end(files.map(file => file.object).join("\n") + "\n");
	let buffer = Buffer.alloc(0), stage = "header", position = 0, remaining = 0, hash;
	try
	{
		for await(const chunk of child.stdout)
		{
			buffer = Buffer.concat([buffer, chunk]);
			while(buffer.length)
			{
				const file = files[position]; assert.ok(file, "unexpected Git batch output");
				if(stage === "header")
				{
					const end = buffer.indexOf(10);
					if(end < 0)
					{
						assert.ok(buffer.length < 1024); break;
					}
					assert.deepEqual(buffer.subarray(0, end).toString().split(" ")
						, [file.object, "blob", String(file.bytes)], file.path);
					remaining = file.bytes; hash = createHash("sha256");
					buffer = buffer.subarray(end + 1); stage = "body";
				}
				if(stage === "body")
				{
					const size = Math.min(buffer.length, remaining);
					hash.update(buffer.subarray(0, size)); buffer = buffer.subarray(size); remaining -= size;
					if(remaining) break;
					file.sha256 = hash.digest("hex"); stage = "newline";
				}
				if(stage === "newline")
				{
					if(!buffer.length) break;
					assert.equal(buffer[0], 10); buffer = buffer.subarray(1); position++; stage = "header";
				}
			}
		}
		await done; assert.equal(stage, "header"); assert.equal(buffer.length, 0);
		assert.equal(position, files.length);
		return Object.freeze(files.map(file => Object.freeze(file)));
	}
	finally
	{
		if(child.exitCode === null) child.kill("SIGTERM");
		await done.catch(() => {});
	}
};

const checkSources = async (root, files) => {
	for(const file of files)
	{
		const path = join(root, file.path), information = await lstat(path);
		assert.ok(information.isFile(), file.path);
		assert.equal(await realpath(path), path, `source must not traverse symlinks: ${file.path}`);
		assert.equal(information.size, file.bytes, file.path);
		assert.equal(await checkedRecordValueIndexHostedDigest(path), file.sha256, file.path);
	}
};

/**
 * Decode one bounded source payload. This verifies its internal identity;
 * admission also requires the fixed supplement digest and original Git bytes.
 *
 * @param file - One compressed file from the pinned source supplement.
 */
export const readPhpWasmEntryReplayBuildInput = file => {
	assert.deepEqual(Object.keys(file).sort(), ["bytes", "gzipBase64", "gzipBytes"
		, "gzipSha256", "mode", "object", "path", "sha256"]);
	assert.ok(checkedRecordValueIndexHostedSafeZipPath(file.path));
	assert.equal(file.mode, "100644");
	assert.match(file.object, /^[a-f0-9]{40}$/u);
	for(const digest of [file.sha256, file.gzipSha256])
		assert.match(digest, /^[a-f0-9]{64}$/u);
	for(const size of [file.bytes, file.gzipBytes])
		assert.ok(Number.isSafeInteger(size) && size > 0 && size <= 8 * 1024 * 1024);
	assert.equal(typeof file.gzipBase64, "string");
	assert.equal(file.gzipBase64.length, Math.ceil(file.gzipBytes / 3) * 4);
	const compressed = Buffer.from(file.gzipBase64, "base64");
	assert.equal(compressed.toString("base64"), file.gzipBase64);
	assert.equal(compressed.length, file.gzipBytes);
	assert.equal(sha256(compressed), file.gzipSha256);
	const source = gunzipSync(compressed, { maxOutputLength: file.bytes });
	assert.equal(source.length, file.bytes);
	assert.equal(sha256(source), file.sha256);
	assert.equal(createHash("sha1").update(`blob ${source.length}\0`)
		.update(source).digest("hex"), file.object);
	return source;
};

/**
 * Retain omitted imports and data without changing original archive bytes.
 * Only the three complete, independently pinned snapshots use the supplement.
 * Every new snapshot must contain the entire current source manifest.
 *
 * @param snapshot - Exact original snapshot identity and members.
 * @param files - Independently hashed complete Git source manifest.
 */
export const phpWasmEntryReplaySnapshotFiles = (snapshot, files) => {
	assert.deepEqual(Object.keys(snapshot).sort(), ["files", "revision", "zip"]);
	const supplement = phpWasmEntryReplaySourceSupplement;
	assert.equal(sha256(canonicalJson(supplement)), phpWasmEntryReplaySourceSupplementSha256);
	const buildInputs = phpWasmEntryReplayBuildInputSupplement;
	assert.equal(sha256(canonicalJson(buildInputs)), phpWasmEntryReplayBuildInputSupplementSha256);
	const identity = sha256(canonicalJson(snapshot));
	const retained = supplement.snapshots.find(item => item.snapshotSha256 === identity);
	if(retained === undefined)
	{
		assert.deepEqual(snapshot.files, files, "source closure must equal original Git bytes");
		return files;
	}
	assert.equal(snapshot.revision, retained.revision);
	assert.deepEqual(buildInputs.snapshots, supplement.snapshots);
	assert.deepEqual(buildInputs.archives, supplement.archives);
	const omitted = new Set();
	for(const file of [...supplement.files, ...buildInputs.files])
	{
		const compressed = Object.hasOwn(file, "gzipBase64");
		const source = compressed ? readPhpWasmEntryReplayBuildInput(file) : Buffer.from(file.source);
		assert.equal(source.length, file.bytes);
		assert.equal(sha256(source), file.sha256);
		const original = files.find(item => item.path === file.path);
		assert.ok(original, file.path);
		assert.equal(original.bytes, file.bytes, file.path);
		assert.equal(original.sha256, file.sha256, file.path);
		if(compressed)
		{
			assert.equal(original.mode, file.mode, file.path);
			assert.equal(original.object, file.object, file.path);
		}
		assert.ok(!omitted.has(file.path), "duplicate omitted input");
		omitted.add(file.path);
	}
	const archived = files.filter(file => !omitted.has(file.path));
	assert.deepEqual(snapshot.files, archived, "exact supplemented archive source closure");
	return archived;
};
const canonicalRoot = async root => {
	assert.ok(typeof root === "string" && isAbsolute(root) && resolve(root) === root);
	assert.equal(await realpath(root), root, "canonical source checkout");
	assert.ok((await lstat(root)).isDirectory());
};

/**
 * Check real source bytes, not just clean-status flags that can hide edits.
 *
 * @param root - Exact original producer worktree, never a fabricated Git state.
 * @param revision - Expected common producer revision.
 */
export const assertPhpWasmEntryReplayCheckout = async (root, revision) => {
	await canonicalRoot(root); assert.match(revision, /^[a-f0-9]{40}$/u);
	assert.match(process.versions.node, /^22\./u, "original verifier requires Node 22");
	assert.equal(git(["rev-parse", "--show-toplevel"], root).trim(), root);
	assert.equal(git(["rev-parse", "HEAD"], root).trim(), revision, "exact original producer checkout");
	assert.equal(git(["diff", "--name-only", "HEAD", "--", ...phpWasmEntryReplaySourceScopes], root), "");
	// Include ignored files: replay must not acquire hidden code/dependency inputs.
	assert.equal(git(["ls-files", "--others", "--", ...phpWasmEntryReplaySourceScopes], root), "");
	const files = await phpWasmEntryReplaySourceManifest(revision);
	await checkSources(root, files); return files;
};

/**
 * Store one complete reproducible source snapshot; preserve exact Git bytes.
 *
 * @param revision - Source revision selected from original identities.
 * @param destination - Fresh absolute ZIP path owned by the archiver.
 */
export const writePhpWasmEntryReplaySourceSnapshot = async (revision, destination) => {
	assert.ok(isAbsolute(destination) && resolve(destination) === destination);
	await canonicalRoot(dirname(destination));
	const files = await phpWasmEntryReplaySourceManifest(revision);
	const child = spawn("git", ["archive", "--format=zip", "-1", revision, "--", ...phpWasmEntryReplaySourceScopes]
		, { env: environment(), stdio: ["ignore", "pipe", "pipe"] });
	const done = completion(child);
	try
	{
		await pipeline(child.stdout, createWriteStream(destination, { flags: "wx" })); await done;
	}
	finally
	{
		if(child.exitCode === null) child.kill("SIGTERM");
		await done.catch(() => {});
	}
	const information = await lstat(destination); assert.ok(information.isFile() && information.size <= sourceLimit);
	const snapshot = { revision, files
		, zip: { bytes: information.size
			, sha256: await checkedRecordValueIndexHostedDigest(destination) } };
	await checkPhpWasmEntryReplaySourceSnapshot(snapshot, destination);
	return snapshot;
};

/**
 * Reconstruct source identity independently of the snapshot's claimed hashes.
 *
 * @param snapshot - Closed retained source manifest and original ZIP identity.
 * @param zip - Reconstructed source ZIP.
 */
export const checkPhpWasmEntryReplaySourceSnapshot = async (snapshot, zip) => {
	assert.deepEqual(Object.keys(snapshot).sort(), ["files", "revision", "zip"]);
	assert.deepEqual(Object.keys(snapshot.zip).sort(), ["bytes", "sha256"]);
	assert.ok(isAbsolute(zip) && resolve(zip) === zip);
	assert.equal(await realpath(zip), zip);
	assert.ok((await lstat(zip)).isFile());
	const files = await phpWasmEntryReplaySourceManifest(snapshot.revision);
	const archived = phpWasmEntryReplaySnapshotFiles(snapshot, files);
	assert.equal((await lstat(zip)).size, snapshot.zip.bytes);
	assert.equal(await checkedRecordValueIndexHostedDigest(zip), snapshot.zip.sha256);
	const extracted = await extractCheckedRecordValueIndexHostedArtifact(zip);
	try
	{
		assert.deepEqual(await nativeArtifactPaths(extracted.root), archived.map(file => file.path).sort());
		await checkSources(extracted.root, archived);
	}
	finally
	{ await rm(extracted.root, { recursive: true, force: true }); }
	return true;
};

/**
 * Execute the original thirty-route verifier; never inject a substitute checker.
 * Both before and after execution, authenticate every selected source byte.
 *
 * @param root - Exact producer checkout.
 * @param revision - Exact producer revision.
 * @param directory - Closed extracted producer-artifact directory.
 */
export const replayPhpWasmEntryHostedArtifacts = async (root, revision, directory) => {
	await canonicalRoot(directory); await assertPhpWasmEntryReplayCheckout(root, revision);
	const bytes = execFileSync(process.execPath, ["--max-old-space-size=512"
		, join(root, "scripts/summarize-php-wasm-refinement-entry-hosted.mjs")
		, "--producer", revision, "--directory", directory]
	, { cwd: root, env: environment(), timeout: 180_000, maxBuffer: 16 * 1024 * 1024 });
	await assertPhpWasmEntryReplayCheckout(root, revision);
	const result = JSON.parse(bytes); assert.equal(bytes.toString(), canonicalJson(result));
	assert.equal(result.producerCommit, revision);
	assert.equal(result.matrix?.scope, "separate-instrumented-probe");
	assert.equal(result.matrix.cells, 30); assert.equal(result.matrix.artifacts, 27);
	return result;
};
