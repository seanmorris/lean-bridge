/**
 * Close compiler-origin selection before executing a JavaScript author tool.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { identifyJavaScriptWasmCompiler, javascriptWasmArchiveMarker, javascriptWasmArchiveSource
	, javascriptWasmCompilerFiles, javascriptWasmOwnedPins as pins, javascriptWasmToolchainMarker
	, validJavaScriptWasmCompilerIdentity } from "../src/build/javascript-wasm-toolchain.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const version = `emcc (Emscripten gcc/clang-like replacement + linker emulating GNU ld) ${pins.emscriptenVersion} (${pins.emscriptenCommit})`;
const fixture = async (t, archive) => {
	const root = await mkdtemp(join(tmpdir(), "lean-javascript-sdk-unit-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const calls = [];
	for(const path of javascriptWasmCompilerFiles) await saveLakeFile(root, path, "unit compiler file: " + path);
	if(archive) await saveLakeFile(root, javascriptWasmToolchainMarker, javascriptWasmArchiveMarker);
	else await mkdir(join(root, ".git"));
	const run = async (command, args) => {
		calls.push({ command, args });
		if(command === "git") return { stdout: pins.emsdkCommit + "\n" };
		assert.equal(command, join(root, "upstream/emscripten/emcc")); assert.deepEqual(args, ["--version"]);
		return { stdout: version + "\nCopyright\n" };
	};
	return { root, calls, run, identify: () => identifyJavaScriptWasmCompiler({ sdkRoot: root, run }) };
};

for(const archive of [false, true]) test(`${archive ? "archive" : "checkout"} compiler origin preserves its actual source identity`, async t => {
	const { root, calls, identify } = await fixture(t, archive);
	const compiler = await identify(); assert.equal(validJavaScriptWasmCompilerIdentity(compiler), true);
	assert.equal(compiler.version, version);
	if(archive)
	{
		assert.deepEqual(compiler.releaseArchive, javascriptWasmArchiveSource);
		assert.equal(Object.hasOwn(compiler, "emsdkCommit"), false); assert.equal(calls.length, 1);
		assert.deepEqual(compiler.files[javascriptWasmToolchainMarker], { bytes: Buffer.byteLength(javascriptWasmArchiveMarker), sha256: sha256(javascriptWasmArchiveMarker) });
	}
	else
	{
		assert.equal(compiler.emsdkCommit, pins.emsdkCommit);
		assert.equal(Object.hasOwn(compiler, "releaseArchive"), false); assert.equal(calls.length, 2);
		assert.deepEqual(calls[0], { command: "git", args: ["-C", root, "rev-parse", "HEAD"] });
	}
	await saveLakeFile(root, "upstream/bin/clang", "changed compiler bytes");
	assert.notDeepEqual(await identify(), compiler, "Post-build capture must expose compiler replacement");
	for(const mutate of [
		value => { value.version += " changed"; }
		, value => { value.files["extra"] = value.files["upstream/bin/clang"]; }
		, value => { delete value.files["upstream/bin/wasm-ld"]; }
		, value => { value.files["upstream/bin/clang"].bytes = 0; }
		, value => { value.files["upstream/bin/clang"].sha256 += "\n"; }
		, value => { value.emsdkCommit = "0".repeat(40); }
		, value => { value.releaseArchive = { ...javascriptWasmArchiveSource, release: "0".repeat(40) }; }
	]) {
		const changed = structuredClone(compiler); mutate(changed);
		assert.equal(validJavaScriptWasmCompilerIdentity(changed), false);
	}
});

test("compiler origin rejects missing, unknown, ambiguous and symlink declarations before running tools", async t => {
	const { root, calls, identify } = await fixture(t, true);
	for(const marker of ["", javascriptWasmArchiveMarker.replace("6.0.6", "6.0.7"), javascriptWasmArchiveMarker + "\n", "x".repeat(32768)])
	{
		await saveLakeFile(root, javascriptWasmToolchainMarker, marker);
		await assert.rejects(identify, { code: "invalid-javascript-wasm-toolchain" });
	}
	await rm(join(root, javascriptWasmToolchainMarker));
	await assert.rejects(identify, { code: "invalid-javascript-wasm-toolchain" });
	await saveLakeFile(root, "other.json", javascriptWasmArchiveMarker);
	await symlink("other.json", join(root, javascriptWasmToolchainMarker));
	await assert.rejects(identify, { code: "invalid-javascript-wasm-toolchain" });
	await rm(join(root, javascriptWasmToolchainMarker));
	await saveLakeFile(root, javascriptWasmToolchainMarker, javascriptWasmArchiveMarker);
	await mkdir(join(root, ".git"));
	await assert.rejects(identify, { code: "invalid-javascript-wasm-toolchain" });
	assert.deepEqual(calls, []);
});

test("compiler identity rejects malformed records and substituted archive evidence", async t => {
	for(const value of [null, undefined, 1, "compiler", [], {}, { releaseArchive: {} }])
		assert.equal(validJavaScriptWasmCompilerIdentity(value), false);
	const { root, identify } = await fixture(t, true), compiler = await identify();
	compiler.files[javascriptWasmToolchainMarker].sha256 = "0".repeat(64);
	assert.equal(validJavaScriptWasmCompilerIdentity(compiler), false);
	await assert.rejects(() => identifyJavaScriptWasmCompiler({ sdkRoot: root, run: async () => ({ stdout: "emcc 3.1.68\n" }) }), { code: "invalid-javascript-wasm-toolchain" });
	await rm(join(root, javascriptWasmToolchainMarker)); await mkdir(join(root, ".git"));
	await assert.rejects(() => identifyJavaScriptWasmCompiler({ sdkRoot: root, run: async () => ({ stdout: "0".repeat(40) }) }), { code: "invalid-javascript-wasm-toolchain" });
});

test("the immutable Nix SDK records the same archive pin used by its fetcher", async () => {
	const source = await readFile("nix/wasm-toolchain.nix", "utf8");
	assert.ok(source.includes(`emscriptenVersion = "${javascriptWasmArchiveSource.version}";`));
	assert.ok(source.includes(`emscriptenRelease = "${javascriptWasmArchiveSource.release}";`));
	assert.ok(source.includes(`emscriptenArchiveHash = "${javascriptWasmArchiveSource.sha256}";`));
	assert.match(source, /emscriptenArchive = pkgs\.fetchurl \{[^}]*\$\{emscriptenRelease\}[^\n]*\n\s*hash = emscriptenArchiveHash;/u);
	assert.match(source, /kind = "emscripten-release-archive";\s*version = emscriptenVersion;\s*release = emscriptenRelease;\s*sha256 = emscriptenArchiveHash;/u);
	assert.ok(source.includes('> "$out/lean-bridge-toolchain.json"'));
});
