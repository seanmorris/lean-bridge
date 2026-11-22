/**
 * Exercise two independently compiled, pip-installed host components with no producer checkout.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { appendFile, copyFile, link, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildNativeSharedRuntime } from "../../src/build/native-component.mjs";
import { buildPythonHostWheel, packagePythonHostRuntime, writePythonHostPackageSet } from "../../src/release/host-pypi.mjs";
import { packageSetReceiptName, readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { executableHostFixture, hostMember, hostParameter, primitiveRef as p } from "./host-object-contract.mjs";

const exec = promisify(execFile), enabled = process.env.LEAN_BRIDGE_HOST_OBJECT_TEST === "1";
const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const python = resolve(process.env.LEAN_BRIDGE_HOST_PYTHON ?? ".toolchains/python311/bin/python3");
const fixture = resolve("tests/fixtures/host-object");
const box = { kind: "named", id: "lean:Alpha.Box" }, u32 = p("uint32"), unit = p("unit");
const declaration = (name, lean, types, result) => ({
	name, declaration: `Workshop.${lean}`, result
	, parameters: types.map((type, i) => ({ type, name: i === 0 && type === box ? "box" : i === 1 && type === box ? "other" : "value" }))
});
const contract = source => {
	const ir = executableHostFixture();
	const entries = [
		declaration("make", "make", [u32], box)
		, declaration("alias", "alias", [box], box)
		, declaration("read", "read", [box], u32)
		, declaration("finish", "finish", [box], u32)
		, declaration("scale", "scale", [box, p("float32")], p("float32"))
		, declaration("same", "same", [box, box], p("bool"))
		, declaration("set_level", "setLevel", [box, u32], unit)
		, declaration("replace_error", "replaceError", [box], unit)
		, declaration("keep", "keep", [box], unit)
		, declaration("read_held", "readHeld", [], u32)
		, declaration("forget", "forget", [], unit)
		, declaration("live", "live", [], u32)
	];
	const extras = ["namespace Workshop", "open LeanBridge.Host.Python"];
	for(const lean of ["UInt8", "UInt16", "UInt32", "UInt64", "Int8", "Int16", "Int32", "Int64", "USize", "ISize", "Float32", "Float", "Nat", "Int", "Bool", "Unit", "Char", "String", "ByteArray"])
	{
		const tag = { Float: "float64", ByteArray: "bytes" }[lean] ?? lean.toLowerCase(), t = p(tag);
		const member = `echo${tag[0].toUpperCase()}${tag.slice(1)}`;
		hostMember(ir, member, { parameters: [hostParameter("v", t)], result: { type: t, ownership: "copy", lifetime: null } });
		extras.push(`def ${member} (box : Box) (v : ${lean}) : IO ${lean} := box.${member} v`);
		entries.push(declaration(`echo_${tag}`, member, [box, t], t));
	}
	return { ir, entries, module: "Workshop", sources: [{ module: "Workshop", source: `${source}\n${extras.join("\n")}\nend Workshop\n` }] };
};

test("offline wheels let ordinary Python classes implement compiled Lean host imports across components", { skip: !enabled, timeout: 480_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-host-wheel-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const workRoot = join(root, "producer"), output = join(root, "handoff"), runtimeRoot = join(workRoot, "runtime");
	await mkdir(workRoot); await mkdir(output);
	const options = {
		workRoot, output, runtimeRoot, leanPrefix, python, version: "1.0.0"
		, license: await readFile("LICENSE", "utf8")
		, ...contract(await readFile(join(fixture, "Workshop.lean"), "utf8")) };
	await buildNativeSharedRuntime({ outputRoot: runtimeRoot, leanPrefix });
	const a = await buildPythonHostWheel({ ...options, name: "lean-workshop" });
	const b = await buildPythonHostWheel({ ...options, name: "lean-workshop-peer" });
	const runtime = await packagePythonHostRuntime(options);
	assert.notEqual(a.componentIdentity, b.componentIdentity);
	const evidence = process.env.LEAN_BRIDGE_HOST_OBJECT_EVIDENCE_DIR, records = {};
	for(const artifact of [runtime, a, b])
	{
		assert.equal(artifact.runtimeIdentity, runtime.runtimeIdentity);
		assert.equal(sha256(await readFile(join(output, artifact.archive))), artifact.sha256);
	}
	for(const component of [a, b])
	{
		const handoff = join(output, component.name);
		await mkdir(handoff);
		for(const p of [runtime, component]) await link(join(output, p.archive), join(handoff, p.archive));
		await writePythonHostPackageSet({ root: handoff, runtime, component });
		const verified = await readVerifiedPackageSetReceipt({ receiptPath: join(handoff, packageSetReceiptName) });
		assert.equal(verified.receipt.packages.length, 2);
		records[component.name] = await readFile(join(handoff, packageSetReceiptName), "utf8");
	}
	if(evidence)
	{
		const wheels = resolve(evidence, "wheels"); await mkdir(wheels, { recursive: true });
		for(const p of [runtime, a, b])
		{
			const path = join(wheels, p.archive);
			try
			{ await copyFile(join(output, p.archive), path, constants.COPYFILE_EXCL); }
			catch(e)
			{ if(e.code !== "EEXIST") throw e; }
			assert.equal(sha256(await readFile(path)), p.sha256, "cannot replace different archive bytes");
		}
	}
	await rm(workRoot, { recursive: true });
	const target = join(root, "target"), relocated = join(root, "relocated");
	await exec(python, [
		"-I", "-m", "pip", "--isolated", "--disable-pip-version-check", "install"
		, "--no-cache-dir", "--no-index", "--only-binary", ":all:"
		, "--find-links", output, "--target", target, "lean-workshop==1.0.0"
		, "lean-workshop-peer==1.0.0"
	]);
	await rm(output, { recursive: true }); await rename(target, relocated);
	for(const file of ["installed.py", "host_app.py"]) await copyFile(join(fixture, file), join(root, file));
	const env = { PATH: "/unavailable", PYTHONPATH: relocated, PYTHONNOUSERSITE: "1", LEAN_NUM_THREADS: "1" };
	const { stdout, stderr } = await exec(python, ["-S", "-B", "installed.py"], { cwd: root, env });
	assert.equal(stderr, "");
	assert.match(stdout, /peers, 19 scalars, original exceptions, reentry, stale, fork, thread and zero live objects/u);
	const unverified = "import ctypes, pathlib, lean_bridge_host_runtime as r; ctypes.CDLL(str(pathlib.Path(r.__file__).parent / 'lib/libleanshared.so')); import lean_workshop";
	await assert.rejects(exec(python, ["-S", "-B", "-c", unverified], { cwd: root, env })
		, e => e.stderr.includes("ImportError: unverified native library already loaded"));
	const pkg = join(relocated, "lean_workshop"), metadata = JSON.parse(await readFile(join(pkg, "host-component.json")));
	await appendFile(join(pkg, metadata.binary), "not the compiled binary");
	await assert.rejects(exec(python, ["-S", "-B", "-c", "import lean_workshop"], { cwd: root, env: { PATH: "/unavailable", PYTHONPATH: relocated } })
		, e => e.stderr.includes("ImportError: compiled Lean component identity differs"));
	if(evidence)
	{
		const dir = resolve(evidence, a.tag); await mkdir(dir);
		for(const [name, record] of Object.entries(records))
			await writeFile(join(dir, `${name}-package-set.json`), record, { flag: "wx" });
		for(const file of ["installed.py", "host_app.py"])
			await copyFile(join(fixture, file), join(dir, file), constants.COPYFILE_EXCL);
		await writeFile(join(dir, "Workshop.lean"), options.sources[0].source, { flag: "wx" });
		await writeFile(join(dir, "host-imports.json"), canonicalJson(options.ir), { flag: "wx" });
		await writeFile(join(dir, "acceptance.json"), canonicalJson({ stdout, entries: options.entries, archives: [runtime, a, b] }), { flag: "wx" });
	}
	t.diagnostic(`pip installed ${a.tag} + one runtime; archive sha256 ${runtime.sha256} ${a.sha256} ${b.sha256}`);
});
