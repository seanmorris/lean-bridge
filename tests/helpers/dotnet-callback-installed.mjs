/**
 * Produce retained C# task callbacks from ordinary and reviewed Lean sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { reconcileHostExports } from "../../src/analyze/host-export-model.mjs";

const env = { ...process.env, LEAN_NUM_THREADS: "1" }, build = env.LEAN_BRIDGE_DOTNET_CALLBACK_BUILD;
const parse = async f => JSON.parse(await readFile(f, "utf8"));
/**
 * Independently check the retained signature and reject forged host and lifetime metadata.
 *
 * @param api - Published binding IR.
 * @param evidence - Compiler elaboration and selection.
 * @param peer - Select the independent Relay contract.
 */
export const checkDotnetCallbackContract = (api, evidence, peer) => {
	const err = "error:DotNetCallbackException";
	assert.equal(evidence.selection.dotnetTaskCallbacks, true);
	const d = api.declarations.find(x => x.source.declaration === (peer ? "Relay.run" : "Feedback.once"));
	assert.equal(d.resultMode, "promise"); assert.ok(d.failure.errors.includes(err));
	const site = d.parameters.find(p => p.type.kind === "named"), cb = api.types.find(t => t.id === site.type.id);
	assert.equal(site.ownership, "lease"); assert.equal(site.lifetime.scope, "explicit");
	assert.equal(cb.callable.selfDisposal, "defer"); assert.equal(cb.callable.reentry, "same-agent");
	assert.deepEqual(cb.callable.failure, { mode: "declared", errors: [err], unexpected: "poison-runtime" });
	assert.ok(!api.errors.some(e => /Ruby|Python|CppCallback|RustCallback|CCallback/u.test(e.id)));
	if(!peer) assert.ok(api.types.filter(t => t.kind === "callback").length >= 19);
	const facts = { ...evidence, ir: null, component: api.component };
	const review = next => reconcileHostExports({ ...next, review: { source: canonicalJson(api) } });
	assert.deepEqual(review(facts).api, api);
	assert.throws(() => review({ ...facts, selection: { ...facts.selection, rubyTaskCallbacks: true } }), /Ambiguous/u);
	assert.throws(() => review({ ...facts, selection: { ...facts.selection, dotnetTaskCallbacks: false } }), /Unverified retained-callback/u);
	assert.throws(() => review({ ...facts, selection: { ...facts.selection, dotnetTaskCallbacks: false, rubyTaskCallbacks: true } }), /Reviewed API differs/u);
	const changed = structuredClone(api); changed.types.find(t => t.id === cb.id).callable.selfDisposal = "reject";
	assert.throws(() => reconcileHostExports({ ...facts, review: { source: canonicalJson(changed) } }), /Reviewed API differs/u);
};
test("build original NuGet retained callbacks, compiler-checked review and a separate callback peer", { skip: !build, timeout: 3_600_000 }, async t => {
	const root = resolve(build), fixtures = resolve("tests/fixtures");
	for(const route of env.LEAN_BRIDGE_DOTNET_CALLBACK_ROUTE ? [env.LEAN_BRIDGE_DOTNET_CALLBACK_ROUTE] : ["ordinary", "reviewed", "peer"])
	{
		assert.ok(["ordinary", "reviewed", "peer"].includes(route));
		const peer = route === "peer", dir = join(root, route), src = join(dir, "source"), outputRoot = join(dir, "handoff");
		const upstream = join(fixtures, peer ? "python-lean-stream-only" : "python-retained-tasks");
		await mkdir(src, { recursive: true });
		for(const f of ["lean-toolchain", peer ? "Signals.lean" : "Retained.lean"])
			await copyFile(join(upstream, f), join(src, f), constants.COPYFILE_EXCL);
		const extra = peer ? "Relay" : "Feedback", config = await parse(join(upstream, "lean-bridge.exports.json"));
		await copyFile(join(fixtures, "ruby-retained-tasks", extra + ".lean"), join(src, extra + ".lean"), constants.COPYFILE_EXCL);
		config.modules.push(extra);
		if(peer)
		{
			config.taskExports = ["Relay.run", "Relay.direct"];
			config.taskIOErrors = ["Relay.run"];
		}
		else for(const key of ["exports", "taskExports", "taskIOErrors"]) config[key].push("Feedback.once", "Feedback.early");
		config.targets = { nuget: { name: "Acme." + extra, version: "1.0.0" } };
		if(route === "reviewed")
		{
			await copyFile(join(root, "ordinary/handoff/binding-ir.json"), join(src, "public.binding-ir.json"), constants.COPYFILE_EXCL);
			delete config.exports;
		}
		await writeFile(join(src, "lakefile.toml"), `name="${extra.toLowerCase()}"\nversion="1.0.0"\n`
			+ config.modules.map(n => `[[lean_lib]]\nname="${n}"\n`).join(""), { flag: "wx" });
		await writeFile(join(src, "lean-bridge.exports.json"), canonicalJson(config), { flag: "wx" });
		await buildCanonicalProject({ projectRoot: src, outputRoot, targets: ["nuget"], environment: env })
			.catch(e => { throw new Error(e.message + "\n" + JSON.stringify(e.details), { cause: e }); });
		const api = await parse(join(outputRoot, "binding-ir.json"));
		if(route === "reviewed") assert.deepEqual(api, await parse(join(src, "public.binding-ir.json")));
		checkDotnetCallbackContract(api, await parse(join(outputRoot, "host-export-evidence.json")), peer);
		t.diagnostic("built and reconciled " + route);
	}
});
