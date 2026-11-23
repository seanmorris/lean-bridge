/** @file Prepare the PIC Init.System.Promise dependency closure for the threaded npm author SDK. */
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { javascriptWasmOwnedPins } from "../src/build/javascript-wasm-toolchain.mjs";
import { taskInitIdentity } from "../src/build/javascript-wasm-task-init-identity.mjs";

const run = promisify(execFile);
const [source, runtime, sdk, out] = process.argv.slice(2).map(p => resolve(p));
if(!out || process.argv.length !== 6) throw new Error("usage: node scripts/prepare-javascript-task-init.mjs <pinned Lean checkout> <threaded runtime build> <emsdk> <new output>");
const commit = javascriptWasmOwnedPins.leanCommit;
// Use the official bootstrap C from this commit, compiled against the same
// current threaded headers as leanrt. Never relink a single-thread Init.a.
const {stdout} = await run("git", ["-C", source, "ls-tree", "-r", commit, "--", "stage0/stdlib/Init"], {maxBuffer: 4 << 20});
const tree = new Map(stdout.trimEnd().split("\n").map(row => { const [mode, path] = row.split("\t"); return [path, mode.split(" ")[2]]; }));
const selected = new Map();
const visit = async name => {
	if(selected.has(name)) return;
	const path = "stage0/stdlib/" + name.replaceAll(".", "/") + ".c";
	const bytes = await readFile(join(source, path));
	const digest = createHash("sha1").update("blob " + bytes.length + "\0").update(bytes).digest("hex");
	if(!tree.has(path) || digest !== tree.get(path)) throw new Error("Modified or unpinned Init input: " + name);
	const [banner, module, imports] = bytes.toString("utf8", 0, Math.min(bytes.length, 16384)).split("\n", 3);
	if(banner !== "// Lean compiler output" || module !== "// Module: " + name || !imports.startsWith("// Imports:"))
		throw new Error("Unexpected pinned Init source header: " + name);
	selected.set(name, {bytes, digest});
	for(const dep of imports.matchAll(/\bimport\s+(?:all\s+)?([\w.]+)/gu))
	{
		if(!/^Init(?:[.]\w+)+$/u.test(dep[1])) throw new Error("Unexpected Init import: " + dep[1]);
		await visit(dep[1]);
	}
};
await visit("Init.System.Promise");
await mkdir(out);
const prefix = join(sdk, "upstream/emscripten");
const env = {...process.env, EMSDK: sdk, EM_CONFIG: join(sdk, ".emscripten"), EMCC_CORES: "1", BINARYEN_CORES: "1"};
const names = [...selected.keys()].sort(), objects = [];
for(let i = 0; i < names.length; i += 12)
{
	const group = names.slice(i, i + 12), files = group.map(name => name + ".c");
	for(const name of group) await writeFile(join(out, name + ".c"), selected.get(name).bytes, {flag: "wx"});
	const flags = ["-O0", "-g0", "-DNDEBUG", "-pthread", "-fwasm-exceptions"
		, "-fPIC", "-DLEAN_EMSCRIPTEN", "-DLEAN_MULTI_THREAD"
		, "-ffunction-sections", "-fdata-sections"
		, "-I", join(runtime, "cmake/include"), "-c", ...files];
	await run(join(prefix, "emcc"), flags, {cwd: out, env, maxBuffer: 4 << 20});
	for(const file of files) await rm(join(out, file));
	objects.push(...group.map(name => name + ".o"));
	console.log("compiled " + objects.length + "/" + names.length + " pinned Init modules");
}
await run(join(prefix, "emar"), ["rcsD", "libTaskInit.a", ...objects], {cwd: out, env});
for(const object of objects) await rm(join(out, object));
const identity = await taskInitIdentity(runtime, join(out, "libTaskInit.a"));
const inputs = Object.fromEntries(names.map(n => [n, selected.get(n).digest]));
await writeFile(join(out, "inputs.json"), JSON.stringify({commit, identity, inputs}) + "\n");
