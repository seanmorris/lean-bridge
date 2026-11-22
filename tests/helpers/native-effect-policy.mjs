/**
 * Exercise the native effect policy at the author, compiler, package and consumer boundaries.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { nativeEffectPolicy, nativeEffects, resolveNativeHostEffects } from "../../src/analyze/native-host-effects.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { reconcileHostExports } from "../../src/analyze/host-export-model.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { compileHostSources } from "../../src/build/host-elaboration.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { assertJsonSchema, jsonSchemaErrors } from "./json-schema.mjs";
import { buildEffectHandoffs, fixture } from "./native-effect-packages.mjs";
import { runEffectConsumers } from "./native-effect-consumers.mjs";

const policy = { modules: ["Demo"], exports: ["Demo.f"], members: [], asyncIterators: [], nativeEffectPolicy, nativeEffects: [...nativeEffects] };
const resolveLeaf = (leaf, change = {}, hostSymbols) => resolveNativeHostEffects({ ...policy, ...change },
	{ policy: nativeEffectPolicy, initializers: [], roots: [{ declaration: "Demo.f", leaves: [leaf] }] }, hostSymbols);
const cfg = "lean-bridge.exports.json";
test("native effect author grants, compiled leaves and packaged policy are closed sets", async () => {
	const config = JSON.parse(await readFile(join(fixture, cfg)));
	await assertJsonSchema("lean-export-configuration", config);
	const guide = (await readFile("docs/lean/export-decisions.md", "utf8")).split("## Declare native OS access\n")[1];
	const example = JSON.parse(guide.match(/\x60{3}json\n([\s\S]*?)\x60{3}/u)[1]);
	validateExportConfiguration(example); await assertJsonSchema("lean-export-configuration", example);
	assert.deepEqual(example.nativeEffects, config.nativeEffects); assert.deepEqual(example.taskExports, config.taskExports);
	for(const file of ["lean/existing-package", ...["c", "cpp", "cargo", "pypi"].map(s => "publish/" + s)])
		assert.match(await readFile("docs/" + file + ".md", "utf8"), /export-decisions\.md#declare-native-os-access\)/u);
	for(const bad of [{ ...config, nativeEffects: ["network"] }, { ...config, nativeEffects: ["clock", "clock"] }, { schemaVersion: 1, nativeEffects: [] }])
	{
		assert.throws(() => validateExportConfiguration(bad), { code: "invalid-export-configuration" });
		assert.ok(await jsonSchemaErrors("lean-export-configuration", bad));
	}
	for(const file of ["package.json", "config/cli-package.v1.json", "nix/perl-engine-source-boundary.json"])
	{
		const m = JSON.parse(await readFile(file)); assert.ok((m.files ?? m.includedFiles).includes("src/analyze/native-host-effects.mjs"));
	}
	const samples = [["filesystem", "lean_io_metadata"]
		, ["environment", "lean_io_getenv"]
		, ["stdio", "lean_get_stderr"]
		, ["random", "lean_io_get_random_bytes"]
		, ["process-info", "lean_io_process_get_pid"]
		, ["clock", "lean_get_current_time"]];
	for(const [cap, symbol] of samples)
	{
		const leaf = { name: "probe", module: "Init.System.IO", symbol }, resolved = resolveLeaf(leaf);
		assert.deepEqual(resolved.capabilities.map(c => c.id), ["capability:native." + cap]);
		assert.throws(() => resolveLeaf(leaf, { nativeEffects: [] }), /requires nativeEffects/u);
	}
	for(const symbol of ["lean_io_exit", "lean_io_process_set_current_dir", "lean_io_process_spawn", "unclassified"])
		assert.throws(() => resolveLeaf({ name: "opaque", module: "Init.System.IO", symbol }), /cannot be granted/u);
	for(const module of ["Demo", "Unreviewed", "Init.Fake"])
		assert.throws(() => resolveLeaf({ name: "foreign", module, symbol: "lean_nat_add" }, { modules: ["Demo", "Init.Fake"] }), /cannot be granted/u);
	const name = "LeanBridge.Host.Python.Box.read", host = { name, module: "LeanBridge.Host.Python", symbol: "reviewed" };
	assert.deepEqual(resolveLeaf(host, { members: [name] }, new Map([[name, "reviewed"]])).capabilities, []);
	assert.throws(() => resolveLeaf(host, { members: [name], taskExports: policy.exports }, new Map([[name, "reviewed"]])), /outside its owner/u);
	assert.throws(() => resolveLeaf({ ...host, symbol: "different" }, { members: [name] }, new Map([[name, "reviewed"]])), /cannot be granted/u);
	assert.throws(() => resolveNativeHostEffects(policy), /missing or invalid/u);
	assert.throws(() => resolveNativeHostEffects(policy, { policy: nativeEffectPolicy, initializers: [], roots: [] }), /roots do not match/u);
});
const enabled = process.env.LEAN_BRIDGE_NATIVE_EFFECT_TEST === "1", replay = process.env.LEAN_BRIDGE_NATIVE_EFFECT_REPLAY;
const scratch = async t => {
	const root = await mkdtemp(join(tmpdir(), "native-effect-check-")); t.after(() => rm(root, { recursive: true, force: true })); return root;
};
const env = { ...process.env, LEAN_NUM_THREADS: "1", CMAKE_BUILD_PARALLEL_LEVEL: "1", CARGO_BUILD_JOBS: "1" };
test("the compiler separates ambient OS families from an IO signature and authenticates generated host-only imports", { skip: !enabled }, async t => {
	const work = await scratch(t), component = { id: "probe@1.0.0", name: "probe", version: "1.0.0" };
	const probe = (app, ir, sources, projectContract) => compileHostSources({ app
		, ir
		, python: true
		, sources
		, projectContract: { ...projectContract, component }
		, environment: env
		, leanPrefix: resolve(env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
		, run: (command, args, cwd, env) => processBuildRunner.capture({ command, args, cwd, env }) });
	const names = ["clock", "entropy", "pid", "say", "plain"];
	const source = `namespace Probe
def clock : IO Nat := liftM IO.monoNanosNow
def entropy (n : USize) : IO ByteArray := IO.getRandomBytes n
def pid : IO UInt32 := liftM IO.Process.getPID
def say (msg : String) : IO Unit := IO.println msg
def plain : IO UInt32 := pure 5
end Probe`;
	const { api } = await probe(join(work, "probe"), null, [{ module: "Probe", source }], {
		modules: ["Probe"]
		, exports: names.map(n => "Probe." + n)
		, nativeEffects: [...nativeEffects] });
	for(const [i, kind] of ["clock", "random", "process-info", "stdio", null].entries())
		assert.deepEqual(api.declarations.find(d => d.name === names[i]).capabilities, kind ? ["capability:native." + kind] : []);
	assert.ok(!api.capabilities.some(c => c.id.endsWith("filesystem")));
	const host = resolve("tests/fixtures/python-host-meter"), ir = JSON.parse(await readFile(join(host, "lean-bridge.hosts.json")));
	const imports = await probe(join(work, "host"), ir, await Promise.all(["Workshop", "Workshop.Internal"].map(async module =>
		({ module, source: await readFile(join(host, module.replaceAll(".", "/") + ".lean"), "utf8") }))), { modules: ["Workshop"], exports: ["Workshop.readLevel"] });
	assert.ok(imports.evidence.metadata.nativeEffectAudit.roots.find(r => r.declaration === "Workshop.readLevel").leaves
		.some(l => l.module === "LeanBridge.Host.Python" && l.symbol === "lean_bridge_host_python_box_read"));
	assert.deepEqual(imports.api.capabilities, []);
	const hostCap = { id: "capability:host.meter", category: "host", requirement: "required", documentation: { summary: "Read the host meter.", details: "" } };
	ir.capabilities.push(hostCap); ir.declarations[0].capabilities = [hostCap.id];
	const reconcile = () => reconcileHostExports({ ...imports.evidence, component, ir }).api;
	assert.deepEqual(reconcile().capabilities, [hostCap]);
	assert.deepEqual(reconcile().declarations[0].capabilities, [hostCap.id]);
	hostCap.id = "capability:native.filesystem"; ir.declarations[0].capabilities = [hostCap.id];
	assert.throws(reconcile, /compiler-owned/u);
});
test("existing retained callbacks, leased resources and scheduler-only packages keep their actual native requirements", { skip: !enabled }, async t => {
	const work = await scratch(t);
	for(const [dir, target, modules, expected] of [
		["python-retained-tasks", "pypi", ["Retained"], []]
		, ["resource-tasks", "c", ["Shared", "Depot"], ["capability:native.filesystem"]]
		, ["c-lean-tasks", "cpp", ["Pulse"], []]
	]){
		const base = resolve("tests/fixtures", dir), config = JSON.parse(await readFile(join(base, cfg)));
		const result = await compileHostSources({ app: join(work, dir)
			, ir: null
			, target
			, python: target === "pypi"
			, environment: env
			, leanPrefix: resolve(env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
			, sources: await Promise.all(modules.map(async module => ({ module, source: await readFile(join(base, module + ".lean"), "utf8") })))
			, projectContract: { ...config, component: { id: "fixture@1.0.0", name: "fixture", version: "1.0.0" }, leanResources: config.resources?.toSorted() ?? [] }
			, run: (command, args, cwd, env) => processBuildRunner.capture({ command, args, cwd, env }) });
		assert.deepEqual(result.api.capabilities.map(c => c.id), expected);
	}
});
test("compiled ambient effects stop packaging at startup, in workers, in iterator cleanup and behind a library wrapper", { skip: !enabled, timeout: 1_200_000 }, async t => {
	const root = await scratch(t);
	const only = (c, name) => { c.exports = ["Effects." + name]; delete c.taskExports; delete c.asyncIterators; };
	const cases = [
		["startup"
		, (c, s, marker) => {
			only(c, "worker"); c.taskExports = c.exports; c.nativeEffects = ["filesystem"];
			return s.replace("end Effects", `initialize do\n  IO.FS.writeFile ${JSON.stringify(marker)} "ran"\nend Effects`);
		}
		, /requires nativeEffects "environment" via IO.getEnv/u]
		, ["scheduler-closure", (c, s) => { only(c, "worker"); c.taskExports = c.exports; c.nativeEffects = ["environment"]; return s; }, /Effects.worker requires nativeEffects "filesystem"/u]
		, ["close-only"
		, (c, s) => {
			c.exports = ["Effects.walk"]; delete c.taskExports; c.nativeEffects = ["environment"];
			return s.replace(/def pull [\s\S]*?(?=def close)/u, "def pull (_ : Cursor) : BaseIO (Task (Option UInt32)) := pure (Task.pure none)\n");
		}
		, /Effects.close requires nativeEffects "filesystem"/u]
		, ["forbidden-library-operation", (c, s) => { c.exports.push("Effects.changeDirectory"); c.nativeEffects = [...nativeEffects]; return s; }, /Effects.changeDirectory reaches unclassified native operation .*lean_io_process_set_current_dir/u]
		, ["eager-constant", (c, s) => { c.nativeEffects = ["environment", "filesystem"]; return s.replace("end Effects", 'def eager : UInt32 := dbgTrace "effect sentinel" fun _ => 5\nend Effects'); }, /requires nativeEffects "stdio" via dbgTrace/u]
	];
	for(const [label, edit, failure] of cases)
	{
		const project = join(root, label), out = join(root, label + "-handoff"); await cp(fixture, project, { recursive: true, errorOnExist: true });
		const config = JSON.parse(await readFile(join(project, cfg))), source = join(project, "Effects.lean");
		const marker = join(root, "unexpected-startup-side-effect");
		await writeFile(source, edit(config, await readFile(source, "utf8"), marker)); await writeFile(join(project, cfg), canonicalJson(config));
		await assert.rejects(buildCanonicalProject({ projectRoot: project, outputRoot: out, targets: ["c"], environment: env }), failure);
		await assert.rejects(lstat(out), { code: "ENOENT" }); await assert.rejects(lstat(marker), { code: "ENOENT" });
	}
});
test("ordinary and reviewed native effect handoffs run installed in C, C++, Rust and Python", { skip: !enabled && !replay, timeout: 3_600_000 }, async t => {
	const work = await scratch(t), releases = resolve(replay ?? process.env.LEAN_BRIDGE_NATIVE_EFFECT_EVIDENCE ?? join(work, "releases"));
	if(!replay) await mkdir(releases, { recursive: true });
	const reports = [];
	for(const target of ["c", "cpp", "pypi", "cargo"])
	{
		if(!replay) await buildEffectHandoffs(releases, target, env);
		reports.push(...await runEffectConsumers(work, releases, target, env));
	}
	const all = { schemaVersion: 1, policy: nativeEffectPolicy, routes: reports };
	if(!replay) await writeFile(join(releases, "acceptance.json"), canonicalJson(all), { flag: "wx" });
	else assert.deepEqual(all, JSON.parse(await readFile(join(releases, "acceptance.json"))));
	t.diagnostic("Eight verified handoffs: startup, file read, scheduled read, iterator pull and close.");
});
