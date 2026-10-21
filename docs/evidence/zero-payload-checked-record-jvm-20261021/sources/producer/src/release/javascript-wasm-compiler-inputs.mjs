/**
 * Closed, relocatable wasm32 Lean headers for installed JavaScript authors.
 *
 * @file
 */
import { lstat, mkdir, mkdtemp, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { javascriptWasmOwnedPins as pins, javascriptWasmTargetHeaders } from "../build/javascript-wasm-owned-artifacts.mjs";
import { javascriptWasmOwnedProfile as profile } from "../build/javascript-wasm-owned-model.mjs";
import { readReceiptBytes } from "./package-set-receipt.mjs";
import { createDeterministicTarGzFromFiles } from "./deterministic-archive.mjs";

export const javascriptWasmCompilerInputsName = "javascript-wasm-compiler-inputs.json";
const paths = ["source/.lean-wasm-patched", "source/LICENSE", ...javascriptWasmTargetHeaders.map(name => `cmake/include/lean/${name}`)].sort();
const names = [...paths, javascriptWasmCompilerInputsName, `${javascriptWasmCompilerInputsName}.sha256`].sort();
const kind = "lean-bridge-javascript-wasm-compiler-inputs";
const same = (a, b) => canonicalJson(a) === canonicalJson(b);
const closed = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && same(Object.keys(value).sort(), [...keys].sort());
const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
const fail = message => { throw Object.assign(new Error(message), { code: "invalid-javascript-wasm-compiler-inputs" }); };
const read = async (root, path, signal, limit = 4 * 1024 ** 2) => {
	let current = resolve(root);
	if(!(await lstat(current)).isDirectory()) fail("JavaScript compiler inputs must be a regular directory");
	for(const part of path.split("/"))
	{
		current = join(current, part);
		if((await lstat(current)).isSymbolicLink()) fail(`JavaScript compiler inputs cannot contain symlinks: ${path}`);
	}
	return readReceiptBytes(current, signal, limit);
};
const checkHeaders = files => {
	if(files.get("source/.lean-wasm-patched")?.toString().trim() !== `${pins.leanCommit} ${pins.patchSetSha256} browser`)
		fail("JavaScript compiler inputs require the pinned browser target");
	const version = files.get("cmake/include/lean/version.h")?.toString() ?? "";
	if(!/^#define LEAN_PLATFORM_TARGET "wasm32-unknown-emscripten"\r?$/m.test(version)
		|| !/^#define LEAN_VERSION_STRING "4\.32\.2"\r?$/m.test(version)) fail("JavaScript compiler inputs require Lean 4.32.2 wasm32 headers");
	for(const path of paths.filter(path => !path.endsWith("/lean_libuv.h")))
		if(!files.get(path)?.length) fail(`Empty JavaScript compiler input: ${path}`);
};
const checkTree = async (root, prefix = "") => {
	const expected = [...new Set(names.filter(path => path.startsWith(prefix)).map(path => path.slice(prefix.length).split("/")[0]))].sort();
	const actual = await readdir(join(root, prefix), { withFileTypes: true });
	if(!same(actual.map(item => item.name).sort(), expected)) fail(`Missing or unrecorded JavaScript compiler input: ${prefix}`);
	for(const entry of actual)
	{
		const path = prefix + entry.name;
		if(names.includes(path))
		{ if(!entry.isFile()) fail(`Compiler input must be a regular file: ${path}`); }
		else
		{
			if(!entry.isDirectory()) fail(`Compiler input must be a regular directory: ${path}`);
			await checkTree(root, path + "/");
		}
	}
};

/**
 * Verify exact files and limits without following links or loading compiler code.
 * The sidecar detects drift; it does not authenticate the release publisher.
 *
 * @param root - Extracted, closed compiler-input directory.
 * @param options - Verification controls.
 * @param options.signal - Optional cancellation signal.
 */
export const readVerifiedJavaScriptWasmCompilerInputs = async (root, { signal } = {}) => {
	const bytes = await read(root, javascriptWasmCompilerInputsName, signal, 16384);
	const sidecar = await read(root, `${javascriptWasmCompilerInputsName}.sha256`, signal, 256);
	if(sidecar.toString() !== `${sha256(bytes)}  ${javascriptWasmCompilerInputsName}\n`) fail("JavaScript compiler input manifest hash mismatch");
	const manifest = JSON.parse(bytes.toString());
	if(!closed(manifest, ["schemaVersion", "kind", "profile", "pins", "files"])
		|| manifest.schemaVersion !== 1 || manifest.kind !== kind || manifest.profile !== profile
		|| !same(manifest.pins, pins) || !closed(manifest.files, paths)) fail("Invalid JavaScript compiler input manifest");
	await checkTree(resolve(root));
	const files = new Map();
	for(const path of paths)
	{
		const item = manifest.files[path];
		if(!closed(item, ["bytes", "sha256"]) || !Number.isSafeInteger(item.bytes) || item.bytes < 0 || item.bytes > 4 * 1024 ** 2
			|| typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$(?![\s\S])/.test(item.sha256)) fail(`Invalid JavaScript compiler input identity: ${path}`);
		const content = await read(root, path, signal, item.bytes);
		if(!same(identity(content), item)) fail(`JavaScript compiler input drift: ${path}`);
		files.set(path, content);
	}
	checkHeaders(files);
	files.set(javascriptWasmCompilerInputsName, bytes); files.set(`${javascriptWasmCompilerInputsName}.sha256`, sidecar);
	return { root: resolve(root), manifest, identity: sha256(bytes), files };
};

/**
 * Package only pinned target headers, their source stamp and the Lean license.
 * Consumers never need this author-only bundle or a compiler installation.
 *
 * @param options - Prepared target and new output directory.
 * @param options.leanRuntimeRoot - Pinned browser Lean target tree.
 * @param options.outputRoot - Absent directory for the bundle and archive.
 * @param options.signal - Optional cancellation signal.
 */
export const buildJavaScriptWasmCompilerInputs = async ({ leanRuntimeRoot, outputRoot, signal }) => {
	if(typeof outputRoot !== "string" || !outputRoot) fail("A new JavaScript compiler input output directory is required");
	const output = resolve(outputRoot);
	const absent = async () => {
		if(await lstat(output).catch(error => { if(error.code === "ENOENT") return null; throw error; })) fail("JavaScript compiler input output already exists");
	};
	await absent();
	const files = new Map();
	for(const path of paths) files.set(path, await read(leanRuntimeRoot, path, signal));
	checkHeaders(files);
	const manifest = { schemaVersion: 1, kind, profile, pins
		, files: Object.fromEntries([...files].map(([path, bytes]) => [path, identity(bytes)])) };
	const bytes = Buffer.from(canonicalJson(manifest));
	files.set(javascriptWasmCompilerInputsName, bytes);
	files.set(`${javascriptWasmCompilerInputsName}.sha256`, Buffer.from(`${sha256(bytes)}  ${javascriptWasmCompilerInputsName}\n`));
	await mkdir(dirname(output), { recursive: true });
	const staging = await mkdtemp(join(dirname(output), ".lean-javascript-inputs-"));
	try
	{
		for(const [path, bytes] of files)
		{
			const destination = join(staging, "javascript-wasm-compiler-inputs", path);
			await mkdir(dirname(destination), { recursive: true }); await writeFile(destination, bytes, { flag: "wx", mode: 0o644 });
		}
		const checked = await readVerifiedJavaScriptWasmCompilerInputs(join(staging, "javascript-wasm-compiler-inputs"), { signal });
		const archiveName = `lean-bridge-javascript-wasm-inputs-${checked.identity.slice(0, 20)}.tgz`;
		const archive = createDeterministicTarGzFromFiles({ sourceDateEpoch: 1
			, files: [...checked.files].map(([path, bytes]) => ({ path: `javascript-wasm-compiler-inputs/${path}`, bytes, mode: 0o644 })) });
		await writeFile(join(staging, archiveName), archive, { flag: "wx" });
		await writeFile(join(staging, `${archiveName}.sha256`), `${sha256(archive)}  ${archiveName}\n`, { flag: "wx" });
		signal?.throwIfAborted(); await absent(); await rename(staging, output);
		return { output, directory: join(output, "javascript-wasm-compiler-inputs")
			, archive: join(output, archiveName), identity: checked.identity
			, archiveSha256: sha256(archive) };
	}
	catch(error)
	{ await rm(staging, { recursive: true, force: true }); throw error; }
};
