/** @file Prepare the pinned PIC Promise and signed-scalar dependencies for the threaded npm SDK. */
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname,join, resolve } from "node:path";
import {isDeepStrictEqual,promisify} from "node:util";
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
const pinnedSource=async (name,path)=>{
	const bytes = await readFile(join(source, path));
	const digest = createHash("sha1").update("blob " + bytes.length + "\0").update(bytes).digest("hex");
	if(!tree.has(path) || digest !== tree.get(path)) throw new Error("Modified or unpinned Init input: " + name);
	return bytes;
};
const visit = async name => {
	if(selected.has(name)) return;
	const path = "stage0/stdlib/" + name.replaceAll(".", "/") + ".c";
	const bytes=await pinnedSource(name,path);
	const [banner, module, imports] = bytes.toString("utf8", 0, Math.min(bytes.length, 16384)).split("\n", 3);
	if(banner !== "// Lean compiler output" || module !== "// Module: " + name || !imports.startsWith("// Imports:"))
		throw new Error("Unexpected pinned Init source header: " + name);
	selected.set(name, {path, digest: tree.get(path)});
	for(const dep of imports.matchAll(/\bimport\s+(?:all\s+)?([\w.]+)/gu))
	{
		if(!/^Init(?:[.]\w+)+$/u.test(dep[1])) throw new Error("Unexpected Init import: " + dep[1]);
		await visit(dep[1]);
	}
};
await visit("Init.System.Promise");
await visit("Init.Data.SInt.Basic");
await mkdir(out);
const prefix = join(sdk, "upstream/emscripten");
const env = {...process.env, EMSDK: sdk, EM_CONFIG: join(sdk, ".emscripten"), EMCC_CORES: "1", BINARYEN_CORES: "1"};
const names = [...selected.keys()].sort(), objects = names.map(name=>name+".o"), reused=new Set();
// Optional explicitly trusted prior SDK input. Work only from a private
// copy checked against the target stamp, headers, archive digest and every
// object's pinned source. Never extract extra names supplied by an archive.
if(process.env.LEAN_BRIDGE_JS_TASK_INIT_BASE)
{
	const base=resolve(process.env.LEAN_BRIDGE_JS_TASK_INIT_BASE), local=join(out,"seed.a");
	const receipt=JSON.parse(await readFile(join(dirname(base),"inputs.json"),"utf8"));
	await writeFile(local,await readFile(base),{flag: "wx"});
	try
	{
		if(receipt.commit!==commit || !isDeepStrictEqual(receipt.identity,await taskInitIdentity(runtime,local)))
			throw new Error("Threaded Init seed target or archive identity mismatch");
		const members=Object.keys(receipt.inputs).sort();
		if(!members.length || members.some(n=>!selected.has(n) || selected.get(n).digest!==receipt.inputs[n]))
			throw new Error("Threaded Init seed has unpinned or unrelated sources");
		const {stdout: list}=await run(join(prefix,"emar"),["t",local],{cwd: out,env});
		if(!isDeepStrictEqual(list.trimEnd().split("\n").sort(),members.map(n=>n+".o").sort()))
			throw new Error("Threaded Init seed archive inventory mismatch");
		await run(join(prefix,"emar"),["x",local],{cwd: out,env});
		for(const n of members) reused.add(n);
	} finally
	{await rm(local);}
}
const missing=names.filter(n=>!reused.has(n));
for(let i = 0; i < missing.length; i += 12)
{
	const group = missing.slice(i, i + 12), files = group.map(name => name + ".c");
	for(const name of group) await writeFile(join(out, name + ".c"),await pinnedSource(name,selected.get(name).path),{flag: "wx"});
	const flags = ["-O0", "-g0", "-DNDEBUG", "-pthread", "-fwasm-exceptions"
		, "-fPIC", "-DLEAN_EMSCRIPTEN", "-DLEAN_MULTI_THREAD"
		, "-ffunction-sections", "-fdata-sections"
		, "-I", join(runtime, "cmake/include"), "-c", ...files];
	await run(join(prefix, "emcc"), flags, {cwd: out, env, maxBuffer: 4 << 20});
	for(const file of files) await rm(join(out, file));
	console.log("prepared " + (reused.size+i+group.length) + "/" + names.length + " pinned Init modules ("+reused.size+" reused)");
}
await run(join(prefix, "emar"), ["rcsD", "libTaskInit.a", ...objects], {cwd: out, env});
for(const object of objects) await rm(join(out, object));
const identity = await taskInitIdentity(runtime, join(out, "libTaskInit.a"));
const inputs = Object.fromEntries(names.map(n => [n, selected.get(n).digest]));
await writeFile(join(out, "inputs.json"), JSON.stringify({commit, identity, inputs}) + "\n");
