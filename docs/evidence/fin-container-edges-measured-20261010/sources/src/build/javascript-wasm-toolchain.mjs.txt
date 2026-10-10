/**
 * Identify pinned checkout and immutable archive-based JavaScript compilers.
 *
 * @file
 */
import { constants } from "node:fs";
import { lstat, open, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";

export const javascriptWasmOwnedPins = Object.freeze({
	leanCommit: "f3b06c705e6c85f5314019d5d3baab0fec5b580c"
	, patchSetSha256: "743765bf566f43ec2f7b4eb84a85686880b3797efe83bf244d6fc7281e4f85a3"
	, emscriptenVersion: "6.0.6"
	, emscriptenCommit: "ce75e06884093bcefb86a6b8fd56a5d62a4cc245"
	, emsdkCommit: "9981799f744be74ac67b1c1813ff172f63be0630"
});
export const javascriptWasmCompilerFiles = Object.freeze(["upstream/emscripten/emcc", "upstream/emscripten/em++.py", "upstream/emscripten/emcc.py", "upstream/emscripten/tools/link.py", "upstream/bin/clang", "upstream/bin/wasm-ld"]);
export const javascriptWasmTargetHeaders = Object.freeze(["lean.h", "lean_gmp.h", "lean_libuv.h", "config.h", "version.h"]);
export const javascriptWasmArchiveSource = Object.freeze({
	schemaVersion: 1, kind: "emscripten-release-archive"
	, version: javascriptWasmOwnedPins.emscriptenVersion
	, release: "833aa203ba2283fc2b6adb504a79a3a0d692df81"
	, sha256: "sha256-bLfPRa2FsLm0ZqRMxLtl7zgOR/BAznPm+Va954J4f0Y="
});
export const javascriptWasmToolchainMarker = "lean-bridge-toolchain.json";
// Nix's builtins.toJSON sorts attribute names and emits compact JSON.
export const javascriptWasmArchiveMarker = JSON.stringify(JSON.parse(canonicalJson(javascriptWasmArchiveSource))) + "\n";
const same = (a, b) => canonicalJson(a) === canonicalJson(b);
const closed = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && same(Object.keys(value).sort(), [...keys].sort());
const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
const file = value => closed(value, ["bytes", "sha256"]) && Number.isSafeInteger(value.bytes) && value.bytes > 0
	&& typeof value.sha256 === "string" && /^[a-f0-9]{64}$(?![\s\S])/.test(value.sha256);
const fail = message => { throw Object.assign(new Error(message), { code: "invalid-javascript-wasm-toolchain" }); };
const maybeStat = path => lstat(path).catch(error => { if(error.code === "ENOENT") return null; throw error; });

/**
 * Require the exact pinned compiler origin and complete retained file identities.
 * Origin metadata identifies trusted author tools; it is not publisher authentication.
 *
 * @param value - Compiler identity from a component receipt.
 */
export const validJavaScriptWasmCompilerIdentity = value => {
	const archive = value && Object.hasOwn(value, "releaseArchive");
	return Boolean(closed(value, ["version", archive ? "releaseArchive" : "emsdkCommit", "files"])
		&& typeof value.version === "string"
		&& value.version.endsWith(` ${javascriptWasmOwnedPins.emscriptenVersion} (${javascriptWasmOwnedPins.emscriptenCommit})`)
		&& (archive ? same(value.releaseArchive, javascriptWasmArchiveSource) : value.emsdkCommit === javascriptWasmOwnedPins.emsdkCommit)
		&& closed(value.files, [...javascriptWasmCompilerFiles, ...(archive ? [javascriptWasmToolchainMarker] : [])])
		&& Object.values(value.files).every(file)
		&& (!archive || same(value.files[javascriptWasmToolchainMarker], identity(javascriptWasmArchiveMarker))));
};

const readArchiveMarker = async path => {
	const descriptor = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
	try
	{
		const before = await descriptor.stat();
		if(!before.isFile() || before.size !== Buffer.byteLength(javascriptWasmArchiveMarker)) fail("Invalid immutable JavaScript SDK origin size or file type");
		const buffer = Buffer.alloc(before.size + 1);
		let length = 0;
		while(length < buffer.length)
		{
			const { bytesRead } = await descriptor.read(buffer, length, buffer.length - length, null);
			if(!bytesRead) break;
			length += bytesRead;
		}
		const after = await descriptor.stat(), current = await lstat(path);
		if(length !== before.size || current.ino !== before.ino || current.dev !== before.dev
			|| after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs
			|| buffer.subarray(0, length).toString() !== javascriptWasmArchiveMarker)
			fail("Immutable JavaScript SDK origin is not the pinned release archive");
		return buffer.subarray(0, length);
	} finally
	{ await descriptor.close(); }
};

/**
 * Capture real compiler bytes and provenance without manufacturing a Git checkout.
 * Call again after compilation to reject compiler or origin drift.
 *
 * @param options - Author SDK and process transport.
 * @param options.sdkRoot - Checkout or immutable archive-shaped SDK directory.
 * @param options.run - Compiler process runner with the selected SDK environment.
 */
export const identifyJavaScriptWasmCompiler = async ({ sdkRoot, run }) => {
	const root = resolve(sdkRoot), markerPath = join(root, javascriptWasmToolchainMarker);
	const marker = await maybeStat(markerPath), git = await maybeStat(join(root, ".git"));
	if(marker && git) fail("JavaScript SDK cannot declare both checkout and archive origins");
	if(!marker && !git) fail("JavaScript SDK requires its pinned checkout or release-archive origin");
	if(marker && !marker.isFile()) fail("JavaScript SDK origin must be a regular file, not a symlink");
	const archiveBytes = marker ? await readArchiveMarker(markerPath) : null;
	const origin = archiveBytes ? { releaseArchive: javascriptWasmArchiveSource }
		: { emsdkCommit: (await run("git", ["-C", root, "rev-parse", "HEAD"])).stdout.trim() };
	if(!archiveBytes && origin.emsdkCommit !== javascriptWasmOwnedPins.emsdkCommit) fail("JavaScript SDK checkout differs from the pinned emsdk commit");
	const version = (await run(join(root, "upstream/emscripten/emcc"), ["--version"])).stdout.split("\n")[0];
	const files = Object.fromEntries(await Promise.all(javascriptWasmCompilerFiles.map(async path => [path, identity(await readFile(join(root, path)))])));
	if(archiveBytes) files[javascriptWasmToolchainMarker] = identity(archiveBytes);
	const compiler = { version, ...origin, files };
	if(!validJavaScriptWasmCompilerIdentity(compiler)) fail("Owned JavaScript compilation requires the pinned npm Emscripten 6.0.6 toolchain");
	return compiler;
};
