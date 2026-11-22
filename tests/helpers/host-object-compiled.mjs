/**
 * Exercise actual Lean host imports, separately from backend package acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { generateLeanHostObjectAdapters } from "../../src/backends/lean/host-object.mjs";
import { executableHostFixture, hostMember, hostParameter, primitiveRef } from "./host-object-contract.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const execute = promisify(execFile);
const enabled = process.env.LEAN_BRIDGE_HOST_OBJECT_TEST === "1";
const prefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const lean = join(prefix, "bin/lean");
const fixture = resolve("tests/fixtures/host-object");
const scratch = async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-host-import-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	return root;
};

test("pinned Lean typechecks nineteen exact host scalars, nested results and forward resource references", { skip: !enabled }, async t => {
	const ir = executableHostFixture();
	const peer = structuredClone(ir.types.find(type => type.name === "Box"));
	peer.id = "lean:Alpha.Peer"; peer.name = "Peer"; peer.source.declaration = "Alpha.Peer"; peer.resource.kindId = "resource:Alpha.Peer";
	ir.types.push(peer);
	hostMember(ir, "peer", { result: { type: { kind: "named", id: peer.id }, ownership: "lease", lifetime: { scope: "explicit", anchor: null } } });
	const put = hostMember(ir, "fromPeer", { owner: peer.id });
	put.receiver.type.id = peer.id;
	const examples = ["example : Box → IO Peer := Box.peer", "example : Peer → IO UInt32 := Peer.fromPeer"];
	const scalars = [
		"Unit", "Bool", "Char", "String", "ByteArray", "Float32", "Float"
		, "Nat", "Int", "USize", "ISize", "UInt8", "UInt16", "UInt32", "UInt64"
		, "Int8", "Int16", "Int32", "Int64"
	];
	for(const name of scalars)
	{
		const type = primitiveRef(({ ByteArray: "bytes", Float: "float64" })[name] ?? name.toLowerCase());
		hostMember(ir, `echo${name}`, { parameters: [hostParameter("value", type)], result: { type, ownership: "copy", lifetime: null } });
		examples.push(`example : Box → ${name} → IO ${name} := Box.echo${name}`);
	}
	const app = (constructor, ...args) => ({ kind: "apply", constructor, arguments: args });
	const argument = app("list", app("array", app("option", primitiveRef("char"))));
	const result = app("result", app("tuple", primitiveRef("uint32"), app("option", primitiveRef("string"))), primitiveRef("int"));
	hostMember(ir, "nested", { parameters: [hostParameter("values", argument)], result: { type: result, ownership: "copy", lifetime: null } });
	examples.push("example : Box → List (Array (Option Char)) → IO (Except Int (UInt32 × Option String)) := Box.nested");
	const root = await scratch(t);
	await saveLakeFile(root, "Contract.lean", generateLeanHostObjectAdapters(ir)["LeanBridge/Host/Python.lean"]
		+ "\nopen LeanBridge.Host.Python\n" + examples.join("\n") + "\n");
	await execute(lean, ["-j1", "Contract.lean"], { cwd: root });
});

test("native Lean drives a real Python-owned object through constructor, members, alias, error and transfer", { skip: !enabled, timeout: 120_000 }, async t => {
	const root = await scratch(t), producer = join(root, "producer"), install = join(root, "install");
	const python = resolve(process.env.LEAN_BRIDGE_HOST_PYTHON ?? ".toolchains/python311/bin/python3");
	const config = JSON.parse((await execute(python, ["-I", "-c", "import json,sys,sysconfig as c; print(json.dumps([sys.base_prefix,c.get_path('include'),c.get_config_var('LIBDIR'),c.get_config_var('LDLIBRARY')]))"])).stdout);
	const [pythonHome, include, buildLibdir, library] = config;
	const installedLibdir = join(pythonHome, "lib");
	const libdir = existsSync(join(installedLibdir, library)) ? installedLibdir : buildLibdir;
	const environment = { ...process.env, LEAN_PATH: producer, LEAN_NUM_THREADS: "1" };
	const run = (command, args) => execute(command, args, { cwd: producer, env: environment });
	await saveLakeFile(producer, "LeanBridge/Host/Python.lean", generateLeanHostObjectAdapters(executableHostFixture())["LeanBridge/Host/Python.lean"]);
	for(const file of ["App.lean", "oracle.c"]) await copyFile(join(fixture, file), join(producer, file));
	await run(lean, ["-j1", "-o", "LeanBridge/Host/Python.olean", "-c", "host.c", "LeanBridge/Host/Python.lean"]);
	await run(lean, ["-j1", "-c", "app.c", "App.lean"]);
	await mkdir(install);
	const leanLib = join(prefix, "lib/lean");
	await run(process.env.CC ?? "cc", [
		"-std=gnu11", "-O1", "-I", join(prefix, "include"), "-I", include
		, "app.c", "host.c", "oracle.c", "-L", leanLib, `-Wl,-rpath,${leanLib}`
		, "-lleanshared", join(libdir, library), `-Wl,-rpath,${libdir}`
		, "-pthread", "-ldl", "-lm", "-o", join(install, "host-check")
	]);
	await copyFile(join(fixture, "host_app.py"), join(install, "host_app.py"));
	await rm(producer, { recursive: true });
	const relocated = join(root, "relocated"); await rename(install, relocated);
	const env = {
		PATH: "/unavailable", PYTHONHOME: pythonHome, PYTHONPATH: relocated
		, PYTHONNOUSERSITE: "1", PYTHONDONTWRITEBYTECODE: "1", LEAN_NUM_THREADS: "1"
	};
	const result = await execute(join(relocated, "host-check"), [], { cwd: relocated, env });
	assert.equal(result.stderr, "");
	assert.equal(result.stdout.trimEnd(), "host-owned Python members, identity, errors and cleanup passed");
});
