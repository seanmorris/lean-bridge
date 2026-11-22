/**
 * Build and replay exact Ruby task gems that retain owner-thread callbacks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { reconcileHostExports } from "../../src/analyze/host-export-model.mjs";
import { installRubyTaskCase } from "./ruby-task-installed.mjs";
import "./ruby-retained-peer.mjs";

const env = { ...process.env, LEAN_NUM_THREADS: "1" };
const build = env.LEAN_BRIDGE_RUBY_CALLBACK_BUILD, record = env.LEAN_BRIDGE_RUBY_CALLBACK_CAPTURE, replay = env.LEAN_BRIDGE_RUBY_CALLBACK_REPLAY;
const fixture = resolve("tests/fixtures/ruby-retained-tasks"), upstream = resolve("tests/fixtures/python-retained-tasks");
const read = async file => JSON.parse(await readFile(file, "utf8"));
const files = ["consumer.rb", "scheduler.rb"], routes = ["ordinary", "reviewed"];

const check = (api, proof) => {
	const name = "error:RubyHostException", d = api.declarations.find(d => d.name === "once");
	assert.deepEqual(d.failure.errors, ["error:TaskIO.Error", name]); assert.equal(d.resultMode, "promise");
	const c = api.types.find(t => t.id === d.parameters[1].type.id);
	assert.equal(d.parameters[1].ownership, "lease"); assert.equal(d.parameters[1].lifetime.scope, "explicit");
	assert.deepEqual(c.callable.failure, { mode: "declared", errors: [name], unexpected: "poison-runtime" });
	assert.equal(c.callable.reentry, "same-agent"); assert.equal(c.callable.selfDisposal, "defer");
	assert.equal(api.types.filter(t => t.kind === "callback").length >= 19, true);
	assert.ok(!api.errors.some(e => /Python|CCallback|CppCallback|Rust/u.test(e.id)));
	assert.equal(proof.selection.rubyTaskCallbacks, true);
	for(const change of [
		x => { x.types.find(t => t.id === c.id).callable.selfDisposal = "reject"; }
		, x => {
			const param = x.declarations.find(t => t.id === d.id).parameters[1];
			param.ownership = "borrow"; param.lifetime.scope = "call";
		}
	]) {
		const next = structuredClone(api); change(next);
		assert.throws(() => reconcileHostExports({ ...proof, component: api.component, ir: null, review: { source: canonicalJson(next) } }), /Reviewed API differs/u);
	}
	const facts = { ...proof, component: api.component, ir: null };
	assert.throws(() => reconcileHostExports({ ...facts, selection: { ...proof.selection, cppTaskCallbacks: true } }), /Ambiguous/u);
	assert.throws(() => reconcileHostExports({ ...facts, selection: { ...proof.selection, rubyTaskCallbacks: false } }), /Unverified retained-callback/u);
	assert.throws(() => reconcileHostExports({ ...facts, selection: { ...proof.selection, rubyTaskCallbacks: false, cppTaskCallbacks: true }
		, review: { source: canonicalJson(api) } }), /Reviewed API differs/u);
};
const rubyRetainedSample = { files, check, marker: /Ruby retained callbacks: .*cleanup passed/u };

test("builds original retained Ruby callback handoffs from source and review", { skip: !build, timeout: 3_600_000 }, async () => {
	const root = resolve(build); let ordinary;
	for(const route of routes)
	{
		const src = join(root, route, "source"), outputRoot = join(root, route, "handoff");
		await mkdir(src, { recursive: true });
		for(const f of ["lean-toolchain", "Retained.lean"]) await copyFile(join(upstream, f), join(src, f), constants.COPYFILE_EXCL);
		await copyFile(join(fixture, "Feedback.lean"), join(src, "Feedback.lean"), constants.COPYFILE_EXCL);
		await writeFile(join(src, "lakefile.toml"), 'name="ruby-feedback"\nversion="1.0.0"\n[[lean_lib]]\nname="Retained"\n[[lean_lib]]\nname="Feedback"\n', { flag: "wx" });
		const config = await read(join(upstream, "lean-bridge.exports.json"));
		config.modules.push("Feedback"); config.targets = { rubygems: { name: "ruby-feedback", version: "1.0.0" } };
		for(const k of ["exports", "taskExports", "taskIOErrors"]) config[k].push("Feedback.once", "Feedback.early");
		if(ordinary)
		{
			delete config.exports;
			await writeFile(join(src, "public.binding-ir.json"), canonicalJson(ordinary), { flag: "wx" });
		}
		await writeFile(join(src, "lean-bridge.exports.json"), canonicalJson(config), { flag: "wx" });
		await buildCanonicalProject({ projectRoot: src, outputRoot, targets: ["rubygems"], environment: env })
			.catch(e => { throw new Error(e.message + "\n" + JSON.stringify(e.details), { cause: e }); });
		const api = await read(join(outputRoot, "binding-ir.json"));
		if(ordinary) assert.deepEqual(api, ordinary); else ordinary = api;
	}
});

test("exact installed Ruby gems retain callback identity through Lean tasks", { skip: !record && !replay, timeout: 3_600_000 }, async t => {
	const root = resolve(replay ?? record), work = await mkdtemp(join(tmpdir(), "ruby-retained-consumer-"));
	t.after(() => rm(work, { recursive: true, force: true }));
	const inputs = replay ? root : join(work, "callers"); if(!replay) await mkdir(inputs);
	if(!replay)
	{
		await copyFile(join(fixture, files[0]), join(inputs, files[0]), constants.COPYFILE_EXCL);
		await copyFile(resolve("tests/fixtures/ruby-task-lab/scheduler.rb"), join(inputs, files[1]), constants.COPYFILE_EXCL);
	}
	const reports = [];
	for(const route of routes) await t.test(route, async () => { reports.push(await installRubyTaskCase(work, root, route, inputs, rubyRetainedSample)); });
	assert.equal(reports.length, 2); assert.equal(reports[0].bindingIrSha256, reports[1].bindingIrSha256);
	assert.notEqual(reports[0].archive.sha256, reports[1].archive.sha256); assert.deepEqual(reports[0].clients, reports[1].clients);
	const result = { schemaVersion: 1, routes: reports }, receipt = join(root, "acceptance.json");
	if(!replay)
	{
		for(const f of files) await copyFile(join(inputs, f), join(root, f), constants.COPYFILE_EXCL);
		await writeFile(receipt, canonicalJson(result), { flag: "wx" });
	}
	else
	{
		const bytes = await readFile(receipt); assert.deepEqual(result, JSON.parse(bytes));
		if(env.LEAN_BRIDGE_RUBY_CALLBACK_EXPECTED)
		{
			const expected = await read(resolve(env.LEAN_BRIDGE_RUBY_CALLBACK_EXPECTED));
			assert.deepEqual(reports, expected.routes); assert.equal(sha256(bytes), expected.acceptanceSha256);
		}
	}
});
