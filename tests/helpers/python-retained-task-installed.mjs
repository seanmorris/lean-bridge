/**
 * Exercise real installed callback-capable Lean tasks, and replay the original wheel pairs without a producer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { inspectLeanProject } from "../../src/analyze/lean-project.mjs";
import { reconcileHostExports } from "../../src/analyze/host-export-model.mjs";
import { compileHostSources } from "../../src/build/host-elaboration.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { assertJsonSchema } from "./json-schema.mjs";
import config from "../fixtures/python-retained-tasks/lean-bridge.exports.json" with { type: "json" };

const exec = promisify(execFile), base = resolve("tests/fixtures/python-retained-tasks"), cli = resolve("scripts/lean-bridge.mjs");
const python = resolve(process.env.LEAN_BRIDGE_HOST_PYTHON ?? ".toolchains/python311/bin/python3");
const env = { ...process.env, LEAN_BRIDGE_PYTHON: python, LEAN_NUM_THREADS: "1", PIP_ROOT_USER_ACTION: "ignore" };
const enabled = process.env.LEAN_BRIDGE_HOST_OBJECT_TEST === "1", replay = process.env.LEAN_BRIDGE_PY_CALLBACK_REPLAY;
const inputs = ["Retained.lean", "lakefile.toml", "lean-toolchain", "lean-bridge.exports.json"];
const json = async file => JSON.parse(await readFile(file, "utf8"));
const hash = async file => sha256(await readFile(file));
const run = async (cwd, ...args) => {
	const { stdout } = await exec(process.execPath, [cli, ...args, "--format", "json"], { cwd, env }).catch(e => {
		throw new Error(`${e.message}\n${e.stdout}\n${e.stderr}`);
	});
	return JSON.parse(stdout).result;
};
const checkContract = (api, evidence) => {
	const task = api.declarations.find(d => d.name === "repeat_call"), callback = api.types.find(t => t.id === task.parameters[1].type.id);
	assert.deepEqual([callback.kind, callback.callable.invocation, callback.callable.reentry, callback.callable.selfDisposal]
		, ["callback", "many", "same-agent", "defer"]);
	assert.equal(task.parameters[1].ownership, "lease"); assert.equal(task.parameters[1].lifetime.scope, "explicit");
	assert.deepEqual(task.failure.errors, ["error:TaskIO.Error", "error:PythonHostException"]);
	assert.equal(task.source.extensions["lean-bridge.dev/task-failure"], "IO.Error");
	const recovered = api.declarations.find(d => d.name === "recover");
	assert.equal(recovered.result.type.constructor, "result"); assert.equal(recovered.failure.mode, "none");
	const mutations = [
		(ir, d) => { d.parameters[1].ownership = "borrow"; d.parameters[1].lifetime.scope = "call"; }
		, (ir, d) => { delete d.source.extensions["lean-bridge.dev/task-failure"]; }
		, ir => { ir.types.find(t => t.id === callback.id).callable.selfDisposal = "reject"; }
	];
	for(const mutate of mutations)
	{
		const changed = structuredClone(api); mutate(changed, changed.declarations.find(d => d.name === "repeat_call"));
		assert.throws(() => reconcileHostExports({ ...evidence, ir: null, component: api.component, review: { source: canonicalJson(changed) } })
			, /Reviewed API differs/u);
	}
};

test("terminal task IO errors must be selected explicitly from taskExports", async () => {
	await assertJsonSchema("lean-export-configuration", config);
	assert.doesNotThrow(() => validateExportConfiguration(config));
	const section = (await readFile("docs/publish/pypi.md", "utf8")).split("### Let a Lean task call Python\n")[1];
	const sample = JSON.parse(section.match(/\x60{3}json\n([\s\S]*?)\x60{3}/u)[1]);
	await assertJsonSchema("lean-export-configuration", sample);
	validateExportConfiguration(sample);
	assert.deepEqual(sample.taskIOErrors, ["Retained.repeatCall"]);
	assert.deepEqual(sample.taskExports, sample.taskIOErrors);
	for(const taskIOErrors of [[], ["Retained.plain"], ["Retained.terminal", "Retained.terminal"]])
		assert.throws(() => validateExportConfiguration({ ...config, taskIOErrors }), { code: "invalid-export-configuration" });
});

const compilerChecked = process.env.LEAN_BRIDGE_CALLBACK_COMPILER_CHECKED === "1";
test("fresh signatures reject undeclared callback schedulers, unsupported callback shapes and false IO failure declarations", { skip: !enabled || Boolean(replay) || compilerChecked }, async t => {
	const root = await mkdtemp(join(tmpdir(), "py-retained-signatures-")); t.after(() => rm(root, { recursive: true, force: true }));
	const source = `namespace Bad
def pureCallback (_ : Nat → Nat) : Task Nat := Task.pure 0
def twoArgs (_ : Nat → String → IO Nat) : Task Nat := Task.pure 0
def owned (_ : (List Nat) → IO Nat) : Task Nat := Task.pure 0
def retained (_ : Nat → IO Nat) : Task Nat := Task.pure 0
def different : Task (Except String Nat) := Task.pure (.ok 0)
end Bad`;
	const cases = [["pureCallback", true, false, /unary IO function/u]
		, ["twoArgs", true, false, /unary IO function/u]
		, ["owned", true, false, /must be copied scalars/u]
		, ["retained", false, false, /unsupported .*carrier/u]
		, ["different", true, true, /taskIOErrors requires Task/u]];
	for(const [name, py, terminal, pattern] of cases)
	{
		const declaration = "Bad." + name;
		const compile = compileHostSources({ app: await mkdtemp(join(root, "bad-"))
			, ir: null, environment: env, python: py && python
			, leanPrefix: resolve(env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
			, sources: [{ module: "Bad", source }]
			, projectContract: { modules: ["Bad"], exports: [declaration]
				, taskExports: [declaration]
				, ...terminal ? { taskIOErrors: [declaration] } : {} }
			, run: (command, args, cwd, environment) => processBuildRunner.capture({ command, args, cwd, env: environment }) });
		await assert.rejects(compile, e => {
			assert.match([e.message, e.details?.stdout, e.details?.stderr].join("\n"), pattern); return true;
		});
	}
	// A pre-callback non-Python request omits both optional capabilities. It
	// must still compile a Task carrying an ordinary Except as a returned value.
	const name = "Bad.different";
	const simple = await compileHostSources({ app: await mkdtemp(join(root, "previous-"))
		, ir: null, environment: env
		, leanPrefix: resolve(env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
		, sources: [{ module: "Bad", source }]
		, projectContract: { modules: ["Bad"], exports: [name], taskExports: [name]
			, component: { id: "old@1.0.0", name: "old", version: "1.0.0" } }
		, run: (command, args, cwd, environment) => processBuildRunner.capture({ command, args, cwd, env: environment }) });
	assert.equal(simple.api.declarations[0].result.type.constructor, "result");
	assert.equal(simple.api.declarations[0].failure.mode, "none");
	assert.equal("pythonTaskCallbacks" in simple.evidence.selection, false);
});

test("offline ordinary and reviewed wheels retain Python callbacks on the owning event loop", { skip: !enabled && !replay, timeout: 900_000 }, async t => {
	const temp = await mkdtemp(join(tmpdir(), "py-retained-"));
	t.after(() => rm(temp, { recursive: true, force: true }));
	const tag = (await exec(python, ["-I", "-c", "import sys; print(sys.implementation.cache_tag)"])).stdout.trim();
	const publish = process.env.LEAN_BRIDGE_HOST_OBJECT_EVIDENCE_DIR && resolve(process.env.LEAN_BRIDGE_HOST_OBJECT_EVIDENCE_DIR, "retained-callbacks", tag);
	const original = replay ? resolve(replay) : publish ?? join(temp, "original");
	if(!replay)
	{
		await mkdir(dirname(original), { recursive: true });
		await mkdir(original);
	}
	const prior = replay ? await json(join(original, "acceptance.json")) : null;
	if(prior) assert.equal(prior.interpreter, tag);
	const client = join(original, "installed.py"), observer = join(original, "audit.py");
	if(!replay)
	{
		await copyFile(join(base, "installed.py"), client);
		await copyFile(join(base, "audit.py"), observer);
	}
	const consumerSha256 = await hash(client), auditSha256 = await hash(observer);
	if(prior)
	{ assert.equal(consumerSha256, prior.consumerSha256); assert.equal(auditSha256, prior.auditSha256); }
	let previous, runtime;
	const routes = [];
	for(const route of ["ordinary", "reviewed"])
	{
		const dir = join(original, route), source = join(dir, "source"), wheelhouse = join(dir, "handoff");
		if(!replay)
		{
			await mkdir(source, { recursive: true });
			for(const f of inputs) await copyFile(join(base, f), join(source, f));
			if(previous)
			{
				const c = { ...config }; delete c.exports;
				await writeFile(join(source, "lean-bridge.exports.json"), canonicalJson(c));
				await writeFile(join(source, "api.binding-ir.json"), canonicalJson(previous));
			}
			// Keep the actual source snapshot; run the CLI from an independent copy.
			const producer = join(temp, "producer-" + route); await cp(source, producer, { recursive: true });
			await run(temp, "build", "--project", producer, "--target", "pypi", "--output", wheelhouse);
			await rm(producer, { recursive: true });
		}
		const verified = await run(temp, "verify", "--receipt", join(wheelhouse, "package-set-receipt.json"));
		assert.equal(verified.verified, true); assert.equal(verified.archives, 2);
		const api = await json(join(wheelhouse, "binding-ir.json")), evidence = await json(join(wheelhouse, "host-export-evidence.json"));
		if(!replay) assert.equal(evidence.extractorSha256, await hash(resolve("src/analyze/HostExports.lean")));
		checkContract(api, evidence);
		if(previous) assert.deepEqual(api, previous);
		previous = api;
		const receipt = await json(join(wheelhouse, "package-set-receipt.json"));
		assert.equal(receipt.profiles[0].bindingIrSha256, hashBindingIr(api));
		assert.equal(receipt.profiles[0].id, "native-python-task-v1");
		const rr = receipt.packages.find(p => p.role === "runtime").artifacts[0], cc = receipt.packages.find(p => p.role === "component").artifacts[0];
		if(runtime) assert.deepEqual(runtime, rr); runtime = rr;
		assert.equal(await hash(join(source, "Retained.lean")), evidence.interfaces.find(f => f.module === "Retained").sourceSha256);
		const snapshot = await inspectLeanProject(source);
		assert.equal(snapshot.sourceTreeSha256, evidence.sourceTreeSha256);
		assert.equal(snapshot.configurationRecord.sourceSha256, await hash(join(source, "lean-bridge.exports.json")));
		assert.equal(snapshot.configurationRecord.sha256, evidence.configurationSha256);
		assert.equal(evidence.reviewedSourceSha256, route === "ordinary" ? null : await hash(join(source, "api.binding-ir.json")));
		const sourceFiles = Object.fromEntries(await Promise.all([...inputs, ...route === "reviewed" ? ["api.binding-ir.json"] : []].map(async f => [f, await hash(join(source, f))])));
		routes.push({ route, receiptSha256: verified.receiptSha256
			, sourceTreeSha256: evidence.sourceTreeSha256
			, extractorSha256: evidence.extractorSha256
			, sourceFiles, bindingIrSha256: hashBindingIr(api)
			, componentArchive: cc, runtimeArchive: rr });
		const archives = join(temp, "install-wheels-" + route);
		await mkdir(archives);
		for(const a of [rr, cc]) await copyFile(join(wheelhouse, a.path), join(archives, basename(a.path)));
		const install = ["-I", "-m", "pip", "--isolated"
			, "--disable-pip-version-check"
			, "install", "--no-index", "--no-cache-dir", "--only-binary", ":all:"
			, "--find-links", archives, "--target", join(temp, "installed-" + route)
			, "lean-retained==1.0.0"];
		await exec(python, install, { cwd: temp, env });
		await rm(archives, { recursive: true });
	}
	const report = { schemaVersion: 1, interpreter: tag, consumerSha256, auditSha256, routes };
	if(prior) assert.deepEqual(report, prior);
	const relocated = join(temp, "client"); await mkdir(relocated); await copyFile(client, join(relocated, "client.py"));
	await copyFile(observer, join(relocated, "audit.py"));
	const guide = (await readFile("docs/consume/python.md", "utf8")).split("### Pass a callback to a Lean task\n")[1];
	await writeFile(join(relocated, "example.py"), guide.match(/\x60{3}python\n([\s\S]*?)\x60{3}/u)[1]);
	for(const { route } of routes)
	{
		const installed = join(relocated, route); await rename(join(temp, "installed-" + route), installed);
		const isolated = { PATH: "/unavailable", PYTHONPATH: installed
			, LEAN_NUM_THREADS: "1", PYTHONNOUSERSITE: "1", PYTHONFAULTHANDLER: "1" };
		const r = await exec(python, ["-S", "-B", "-W", "error", "client.py"], { cwd: relocated, timeout: 90000, env: isolated });
		assert.equal(r.stderr, ""); assert.match(r.stdout, /self-close, expiry, cancellation and descriptor baseline passed/u);
		const guideRun = await exec(python, ["-S", "-B", "example.py"], { cwd: relocated, timeout: 30000, env: isolated });
		assert.equal(guideRun.stderr, ""); assert.equal(guideRun.stdout, "start!!\n");
		for(const mode of ["shutdown", "retire"])
		{
			const audit = await exec(python, ["-S", "-B", "-W", "error", "audit.py", mode], { cwd: relocated, timeout: 30000, env: isolated });
			assert.equal(audit.stderr, ""); assert.match(audit.stdout, /broker leases returned to zero/u);
		}
	}
	if(!replay)
	{
		await writeFile(join(original, "acceptance.json"), canonicalJson(report), { flag: "wx" });
	}
	t.diagnostic(`${tag}: both wheel pairs and the relocated consumer passed; shared runtime ${runtime.sha256}`);
});
