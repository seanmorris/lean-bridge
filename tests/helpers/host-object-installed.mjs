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
import { basename, join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { buildCliNpmPackage } from "../../src/release/cli-npm-package.mjs";
import { packageSetReceiptName, readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { executableHostFixture, hostMember, hostParameter, primitiveRef as p } from "./host-object-contract.mjs";

const exec = promisify(execFile), enabled = process.env.LEAN_BRIDGE_HOST_OBJECT_TEST === "1";
const kinds = process.env.LEAN_BRIDGE_PYTHON_HOST_KINDS === "1";
const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const python = resolve(process.env.LEAN_BRIDGE_HOST_PYTHON ?? ".toolchains/python311/bin/python3");
const fixture = resolve("tests/fixtures/host-object");
const contract = source => {
	const ir = executableHostFixture();
	const names = ["make", "alias", "read", "finish", "scale", "same", "setLevel", "replaceError", "keep", "readHeld", "forget", "live", "componentMark", "taskMark", "checkedSet", "reportSet", "setThenFail", "choose", "typedChoice"];
	const extras = ["namespace Workshop", "open LeanBridge.Host.Python"];
	for(const lean of ["UInt8", "UInt16", "UInt32", "UInt64", "Int8", "Int16", "Int32", "Int64", "USize", "ISize", "Float32", "Float", "Nat", "Int", "Bool", "Unit", "Char", "String", "ByteArray"])
	{
		const tag = { Float: "float64", ByteArray: "bytes" }[lean] ?? lean.toLowerCase(), t = p(tag);
		const member = `echo${tag[0].toUpperCase()}${tag.slice(1)}`;
		hostMember(ir, member, { parameters: [hostParameter("v", t)], result: { type: t, ownership: "copy", lifetime: null } });
		extras.push(`def ${member} (box : Box) (v : ${lean}) : IO ${lean} := box.${member} v`);
		const outcome = `outcome${member.slice(4)}`;
		extras.push(`def ${outcome} (mode : UInt8) (v : ${lean}) : EIO ${lean} (Except ${lean} ${lean}) := do\n  if mode == 2 then throw v\n  return if mode == 1 then .error v else .ok v`);
		names.push(member, outcome);
	}
	ir.types = ir.types.filter(t => t.host);
	ir.declarations = ir.declarations.filter(d => ir.types.some(t => t.id === d.owner));
	if(kinds)
	{
		const box = ir.types.find(t => t.name === "Box");
		box.host.identity = "strong-canonical";
		const id = "lean:Alpha.Token";
		ir.types.push({ ...box, id, name: "Token"
			, resource: { ...box.resource, kindId: "resource:Alpha.Token" }
			, host: { ...box.host, identity: "weak-canonical" }
			, source: { ...box.source, declaration: "Alpha.Token" } });
		const read = ir.declarations.find(d => d.name === "read" && d.owner === box.id);
		ir.declarations.push({ ...read, id: id + ".read", owner: id
			, overloadKey: "Token.read"
			, receiver: { ...read.receiver, type: { kind: "named", id } }
			, source: { ...read.source, declaration: "Alpha.Token.read" } });
		extras.push("def tokenRead (token : Token) : IO UInt32 := token.read"
			, "def hostPair (box : Box) (token : Token) (limit : UInt8) : IO UInt32 := do\n  let _ ← token.read\n  return (← box.read) + limit.toUInt32");
		names.push("tokenRead", "hostPair");
	}
	ir.assurance = [];
	for(const item of [...ir.types, ...ir.declarations]) item.assurance = [];
	return { ir, exports: names.map(name => `Workshop.${name}`), source: `${source}\n${extras.join("\n")}\nend Workshop\n` };
};

test(kinds ? "installed CPython wheels stage strong and weak nominal arguments across independent components"
	: "offline wheels let ordinary Python classes implement compiled Lean host imports across components", { skip: !enabled && !kinds, timeout: 480_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-host-wheel-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const workRoot = join(root, "producer"), output = join(root, "wheelhouse");
	await mkdir(workRoot); await mkdir(output);
	const corpus = contract(await readFile(join(fixture, "Workshop.lean"), "utf8"));
	const evidence = kinds ? undefined : process.env.LEAN_BRIDGE_HOST_OBJECT_EVIDENCE_DIR, reports = [], artifacts = new Map();
	let cli = resolve("scripts/lean-bridge.mjs");
	if(kinds)
	{
		const packed = await buildCliNpmPackage({outputRoot: join(workRoot, "cli-archive")});
		const tools = join(workRoot, "author-tools");
		await exec("npm", ["install", "--offline", "--ignore-scripts"
			, "--no-audit", "--no-fund"
			, "--prefix"
			, tools
			, "--cache"
			, join(workRoot,"npm-cache")
			, packed.archive], { cwd: root });
		await rm(packed.output, {recursive: true});
		cli = join(tools, "node_modules/.bin/lean-bridge");
	}
	let api, tag, runtimeId;
	for(const [name, mark] of [["workshop", 17], ["workshop-peer", 41]])
	{
		const reviewed = reports.length > 0, component = { id: `${name}@1.0.0`, name, version: "1.0.0" };
		const project = join(workRoot, name), handoff = join(workRoot, `${name}-handoff`);
		const files = ["lean-toolchain", "lakefile.toml", "lean-bridge.hosts.json", "lean-bridge.exports.json", "Workshop.lean", "LICENSE"];
		await mkdir(project);
		await copyFile("LICENSE", join(project, "LICENSE"));
		await writeFile(join(project, "lean-toolchain"), "leanprover/lean4:v4.32.2\n");
		await writeFile(join(project, "lakefile.toml"), `name = "${name}"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Workshop"\n`);
		await writeFile(join(project, "Workshop.lean"), corpus.source + `\ndef Workshop.componentMark : IO UInt32 := pure ${mark}\ndef Workshop.taskMark : Task UInt32 := Task.pure ${mark}\n`);
		await writeFile(join(project, "lean-bridge.hosts.json"), canonicalJson(corpus.ir));
		await writeFile(join(project, "lean-bridge.exports.json"), canonicalJson({
			schemaVersion: 1, hostImports: "lean-bridge.hosts.json"
			, modules: ["Workshop"], taskExports: ["Workshop.taskMark"]
			, ...(reviewed ? {} : { exports: corpus.exports })
			, targets: { pypi: { name: `lean-${name}`, version: "1.0.0" } }
		}));
		if(reviewed)
		{
			files.push("api.binding-ir.json");
			await writeFile(join(project, "api.binding-ir.json"), canonicalJson({ ...api, component }));
		}
		await exec(process.execPath, [cli, "build", "--project", project, "--target", "pypi", "--output", handoff, "--format", "json"]
			, { env: { ...process.env, LEAN_BRIDGE_LEAN_PREFIX: leanPrefix, LEAN_BRIDGE_PYTHON: python } })
			.catch(error => { throw new Error(`${error.message}\n${error.stdout}\n${error.stderr}`); });
		const { receipt } = await readVerifiedPackageSetReceipt({ receiptPath: join(handoff, packageSetReceiptName) });
		api = JSON.parse(await readFile(join(handoff, "binding-ir.json")));
		const evidenceRecord = JSON.parse(await readFile(join(handoff, "host-export-evidence.json")));
		assert.equal(evidenceRecord.reviewedSourceSha256 !== null, reviewed);
		assert.deepEqual(api.component, component);
		if(kinds)
		{
			assert.equal(api.types.find(type => type.id === "lean:Alpha.Box").host.identity, "strong-canonical");
			assert.equal(api.types.find(type => type.id === "lean:Alpha.Token").host.identity, "weak-canonical");
		}
		const decl = name => api.declarations.find(d => d.name === name);
		assert.deepEqual(decl("choose").effects, []);
		assert.deepEqual(decl("choose").failure.errors, []);
		assert.equal(decl("report_set").result.type.constructor, "result");
		assert.equal(decl("typed_choice").result.type.constructor, "result");
		assert.deepEqual(decl("typed_choice").failure.errors, ["error:EIO.Workshop.typedChoice"]);
		assert.deepEqual(api.errors.find(e => e.id === "error:EIO.Workshop.typedChoice").payload, p("nat"));
		assert.ok(api.declarations.filter(d => d.name !== "task_mark").every(d => d.resultMode === "value" && !d.effects.includes("async")));
		assert.equal(decl("task_mark").resultMode, "promise");
		assert.equal(hashBindingIr(api), receipt.profiles[0].bindingIrSha256);
		assert.deepEqual(evidenceRecord.metadata.entries.map(e => e.declaration).sort(), [...corpus.exports].sort());
		assert.equal(receipt.packages.length, 2);
		for(const pkg of receipt.packages)
		{
			const a = pkg.artifacts[0], file = basename(a.path);
			if(artifacts.has(file)) assert.deepEqual(artifacts.get(file), a, "peers must share byte-identical runtime");
			else
			{
				await link(join(handoff, a.path), join(output, file));
				artifacts.set(file, a);
			}
			if(pkg.role === "component") tag = file.split("-").slice(-3).join("-").replace(/\.whl$/u, "");
		}
		if(reviewed) assert.equal(receipt.profiles[0].runtimeIdentity, runtimeId);
		runtimeId = receipt.profiles[0].runtimeIdentity;
		reports.push({ name, project, handoff, files });
		if(!evidence) await rm(handoff, { recursive: true });
	}
	assert.equal(artifacts.size, 3);
	if(evidence)
	{
		const wheels = resolve(evidence, "wheels"); await mkdir(wheels, { recursive: true });
		for(const [file, artifact] of artifacts)
		{
			const path = join(wheels, file);
			try
			{ await copyFile(join(output, file), path, constants.COPYFILE_EXCL); }
			catch(e)
			{ if(e.code !== "EEXIST") throw e; }
			assert.equal(sha256(await readFile(path)), artifact.sha256, "cannot replace different archive bytes");
		}
		for(const { name, project, handoff, files } of reports)
		{
			const dest = resolve(evidence, tag, name);
			await mkdir(join(dest, "source"), { recursive: true });
			for(const path of files) await copyFile(join(project, path), join(dest, "source", path), constants.COPYFILE_EXCL);
			for(const path of [packageSetReceiptName, packageSetReceiptName + ".sha256", "native-release.json", "binding-ir.json", "host-export-evidence.json"])
				await copyFile(join(handoff, path), join(dest, path), constants.COPYFILE_EXCL);
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
	const client = kinds ? "strong.py" : "installed.py";
	for(const file of [client, "host_app.py"]) await copyFile(join(fixture, file), join(root, file));
	const env = { PATH: "/unavailable", PYTHONPATH: relocated, PYTHONNOUSERSITE: "1", LEAN_NUM_THREADS: "1" };
	const { stdout, stderr } = await exec(python, ["-S", "-B", client], { cwd: root, env });
	assert.equal(stderr, "");
	if(kinds) assert.match(stdout, /strong and weak nominal kinds: both binding orders, no retained objects/u);
	else
	{
		assert.match(stdout, /peers, 19 scalars, original exceptions, reentry, stale, fork, thread and zero live objects/u);
		assert.match(stdout, /19 typed error and returned result carriers on both source routes/u);
	}
	const unverified = "import ctypes, pathlib, lean_bridge_host_runtime as r; ctypes.CDLL(str(pathlib.Path(r.__file__).parent / 'lib/libleanshared.so')); import lean_workshop";
	await assert.rejects(exec(python, ["-S", "-B", "-c", unverified], { cwd: root, env })
		, e => e.stderr.includes("ImportError: unverified native library already loaded"));
	const pkg = join(relocated, "lean_workshop"), metadata = JSON.parse(await readFile(join(pkg, "host-component.json")));
	await appendFile(join(pkg, metadata.binary), "not the compiled binary");
	await assert.rejects(exec(python, ["-S", "-B", "-c", "import lean_workshop"], { cwd: root, env: { PATH: "/unavailable", PYTHONPATH: relocated } })
		, e => e.stderr.includes("ImportError: compiled Lean component identity differs"));
	if(evidence)
	{
		const dir = resolve(evidence, tag);
		for(const file of ["installed.py", "host_app.py"])
			await copyFile(join(fixture, file), join(dir, file), constants.COPYFILE_EXCL);
		await writeFile(join(dir, "acceptance.json"), canonicalJson({ stdout, sources: reports.map(r => r.name), archives: [...artifacts.values()] }), { flag: "wx" });
	}
	t.diagnostic(`pip installed ${tag}: ordinary + reviewed components, one verified runtime`);
	for(const [name, artifact] of artifacts) t.diagnostic(`${name} ${artifact.bytes} ${artifact.sha256}`);}
);
