/**
 * Verify actual Lean task execution after independent source and reviewed releases.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { buildCliNpmPackage } from "../../src/release/cli-npm-package.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { compileHostSources } from "../../src/build/host-elaboration.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import config from "../fixtures/python-lean-tasks/lean-bridge.exports.json" with { type: "json" };
import { assertJsonSchema } from "./json-schema.mjs";

const exec = promisify(execFile), fixture = resolve("tests/fixtures/python-lean-tasks");
const enabled = process.env.LEAN_BRIDGE_HOST_OBJECT_TEST === "1";
const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const python = resolve(process.env.LEAN_BRIDGE_HOST_PYTHON ?? ".toolchains/python311/bin/python3");
const env = { ...process.env, LEAN_BRIDGE_LEAN_PREFIX: leanPrefix, LEAN_BRIDGE_PYTHON: python };
const scratch = async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-task-install-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	return root;
};

test("task delivery is an explicit selection, not permission to make ordinary IO asynchronous", async () => {
	await assertJsonSchema("lean-export-configuration", config);
	assert.doesNotThrow(() => validateExportConfiguration(config));
	for(const names of [[], ["Timers.elsewhere"], ["Timers.later", "Timers.later"]])
		assert.throws(() => validateExportConfiguration({ ...config, taskExports: names }), /taskExports/u);
});

test("fresh Lean signatures reject a false task contract and an unselected Task", { skip: !enabled }, async t => {
	const root = await scratch(t);
	const cases = [
		["IO Nat := pure 5", ["Probe.f"], /requires a real Lean Task/u]
		, ["Task Nat := Task.pure 5", [], /expected synchronous IO result/u]
	];
	for(const [signature, taskExports, reason] of cases)
	{
		const source = `namespace Probe\ndef f : ${signature}\nend Probe\n`;
		await assert.rejects(compileHostSources({
			app: await mkdtemp(join(root, "compiled-")), ir: null, leanPrefix
			, environment: env, sources: [{ module: "Probe", source }]
			, projectContract: { exports: ["Probe.f"], modules: ["Probe"], taskExports }
			, run: (command, args, cwd, env) => processBuildRunner.capture({ command, args, cwd, env })
		}), error => {
			assert.match(`${error.message} ${error.details?.stdout} ${error.details?.stderr}`, reason);
			return true;
		});
	}
});

test("offline installed Lean tasks wake asyncio, forward cancellation and clean up on both source routes", { skip: !enabled, timeout: 600_000 }, async t => {
	const root = await scratch(t), project = join(root, "project"), tools = join(root, "tools");
	const packed = await buildCliNpmPackage({ outputRoot: join(root, "candidate") });
	await exec("npm", ["install", "--prefix", tools, "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", join(root, "cache"), packed.archive], { env, cwd: root });
	await rm(packed.output, { recursive: true });
	const cli = join(tools, "node_modules/.bin/lean-bridge");
	const run = async (...args) => {
		const r = await exec(process.execPath, [cli, ...args, "--format", "json"], { env, cwd: root })
			.catch(e => { throw new Error(`${e.message}\n${e.stdout}\n${e.stderr}`); });
		return JSON.parse(r.stdout);
	};
	await mkdir(project);
	const inputs = ["Timers.lean", "lakefile.toml", "lean-toolchain", "lean-bridge.exports.json"];
	for(const f of inputs) await copyFile(join(fixture, f), join(project, f));
	let previous, shared;
	const kept = new Map();
	for(const route of ["ordinary", "reviewed"])
	{
		if(previous)
		{
			await writeFile(join(project, "api.binding-ir.json"), canonicalJson(previous));
			const selection = { ...config }; delete selection.exports;
			await writeFile(join(project, "lean-bridge.exports.json"), canonicalJson(selection));
		}
		const output = join(root, route), result = await run("build", "--project", project, "--target", "pypi", "--output", output);
		assert.equal(result.status, "ok");
		const api = JSON.parse(await readFile(join(output, "binding-ir.json")));
		const evidence = JSON.parse(await readFile(join(output, "host-export-evidence.json")));
		assert.equal(evidence.reviewedSourceSha256 !== null, route === "reviewed");
		assert.equal(evidence.hostImportsSourceSha256, null);
		assert.deepEqual(evidence.interfaces.map(m => m.module), ["Timers"]);
		assert.deepEqual(api.declarations.filter(d => d.resultMode === "promise").map(d => d.source.declaration).sort(), [...config.taskExports].sort());
		assert.ok(api.declarations.filter(d => d.resultMode === "promise").every(d => d.effects.includes("async") && d.source.extensions["lean-lang.org/delivery"] === "Task"));
		assert.ok(api.declarations.filter(d => d.resultMode === "value").every(d => !d.effects.includes("async")));
		if(previous) assert.deepEqual(api, previous);
		previous = api;
		const receipt = JSON.parse(await readFile(join(output, "package-set-receipt.json")));
		assert.equal((await run("verify", "--receipt", join(output, "package-set-receipt.json"))).result.archives, 2);
		assert.equal(receipt.profiles[0].id, "native-python-task-v1");
		assert.equal(receipt.profiles[0].bindingIrSha256, hashBindingIr(api));
		const wheel = receipt.packages.find(p => p.role === "component").artifacts[0];
		const runtime = receipt.packages.find(p => p.role === "runtime").artifacts[0];
		if(shared) assert.deepEqual(runtime, shared);
		shared = runtime;
		const retain = process.env.LEAN_BRIDGE_HOST_OBJECT_EVIDENCE_DIR;
		if(retain)
		{
			const tag = basename(wheel.path).split("-").slice(-3).join("-").replace(/\.whl$/u, "");
			const dest = resolve(retain, "tasks", tag, route), wheels = resolve(retain, "wheels");
			await mkdir(join(dest, "source"), { recursive: true }); await mkdir(wheels, { recursive: true });
			for(const p of [...inputs, ...(route === "reviewed" ? ["api.binding-ir.json"] : [])])
				await copyFile(join(project, p), join(dest, "source", p), constants.COPYFILE_EXCL);
			for(const p of ["package-set-receipt.json", "package-set-receipt.json.sha256", "binding-ir.json", "host-export-evidence.json", "native-release.json"])
				await copyFile(join(output, p), join(dest, p), constants.COPYFILE_EXCL);
			await copyFile(join(output, wheel.path), join(dest, basename(wheel.path)), constants.COPYFILE_EXCL);
			const path = join(wheels, basename(runtime.path));
			try
			{ await copyFile(join(output, runtime.path), path, constants.COPYFILE_EXCL); }
			catch(error)
			{ if(error.code !== "EEXIST") throw error; }
			assert.equal(sha256(await readFile(path)), runtime.sha256);
			kept.set(route, dest);
		}
		await exec(python, ["-I", "-m", "pip", "--isolated", "--disable-pip-version-check", "install", "--no-index", "--no-cache-dir", "--only-binary", ":all:", "--find-links", join(output, "archives"), "--target", join(root, "installed", route), "lean-timers==1.0.0"], { env });
		await rm(output, { recursive: true });
	}
	const wrong = structuredClone(previous), changed = wrong.declarations.find(d => d.name === "later");
	changed.resultMode = "value"; changed.effects = changed.effects.filter(e => e !== "async");
	delete changed.source.extensions["lean-lang.org/delivery"];
	await writeFile(join(project, "api.binding-ir.json"), canonicalJson(wrong));
	const rejected = join(root, "invalid");
	await assert.rejects(run("build", "--project", project, "--target", "pypi", "--output", rejected), /Reviewed API differs/u);
	await assert.rejects(access(rejected), { code: "ENOENT" });
	await rm(project, { recursive: true }); await rm(tools, { recursive: true });
	await rename(join(root, "installed"), join(root, "relocated"));
	await copyFile(join(fixture, "installed.py"), join(root, "consumer.py"));
	await copyFile(join(fixture, "audit.py"), join(root, "audit.py"));
	for(const route of ["ordinary", "reviewed"])
	{
		const path = join(root, "relocated", route);
		const { stdout, stderr } = await exec(python, ["-S", "-B", "audit.py"], {
			cwd: root, timeout: 90000
			, env: { PATH: "/unavailable", PYTHONPATH: path, LEAN_NUM_THREADS: "1", PYTHONNOUSERSITE: "1" } });
		assert.equal(stderr, ""); assert.match(stdout, /loop shutdown, fork rejection and descriptor baseline/u);
		assert.match(stdout, /0\/1\/1\/0 leases and prompt process shutdown/u);
		await assert.rejects(access(join(path, "lean_timers", "host-imports.json")), { code: "ENOENT" });
		if(kept.has(route))
		{
			await copyFile(join(root, "consumer.py"), join(kept.get(route), "consumer.py"));
			await copyFile(join(root, "audit.py"), join(kept.get(route), "audit.py"));
			await writeFile(join(kept.get(route), "acceptance.json"), canonicalJson({ route, stdout, cliArchiveSha256: packed.report.archive.sha256, offline: true, relocated: true }));
		}
	}
});
