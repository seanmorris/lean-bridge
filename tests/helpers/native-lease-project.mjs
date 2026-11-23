/**
 * Prepare independently built IO and task projects that share an opaque Lean resource.
 *
 * @file
 */
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { reconcileHostExports } from "../../src/analyze/host-export-model.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";

const srcs = resolve("tests/fixtures/resource-tasks"), cases = resolve("tests/fixtures/ruby-task-resources");
const json = async f => JSON.parse(await readFile(f, "utf8"));
/**
 * Prepare one producer from the common Lean fixtures.
 *
 * @param root - Handoff root for this target.
 * @param route - Ordinary source, checked review, or same-named foreign type.
 * @param role - Desk's synchronous or Depot's asynchronous exports.
 * @param target - Native host package ecosystem.
 */
export const prepareLeaseProject = async (root, route, role, target) => {
	const dir = join(root, route, role), src = join(dir, "source"), task = role === "depot";
	const name = (target === "rubygems" ? "ruby-" : "") + (route === "lookalike" ? "other-desk" : "lease-" + role);
	await mkdir(src, { recursive: true });
	const copy = (from, file) => copyFile(join(from, file), join(src, file), constants.COPYFILE_EXCL);
	await copy(srcs, "lean-toolchain");
	if(route === "lookalike")
	{
		const original = await readFile(join(srcs, "Shared.lean"), "utf8");
		await writeFile(join(src, "Shared.lean"), original.replace("namespace Shared", "namespace Shared\n\ndef revision : UInt32 := 2"), { flag: "wx" });
	}
	else await copy(srcs, "Shared.lean");
	const config = task ? await json(join(srcs, "lean-bridge.exports.json")) : { schemaVersion: 1
		, modules: ["Desk"], resources: ["Shared.Ticket", "Shared.Badge"]
		, exports: ["Desk.issue", "Desk.badge", "Desk.count", "Desk.checkTicket"]
		, nativeEffects: ["filesystem"] };
	if(task)
	{
		await copy(srcs, "Depot.lean"); await copy(cases, "Exchange.lean");
		config.modules.push("Exchange"); config.exports.push("Exchange.revisit"); config.taskExports.push("Exchange.revisit");
		config.taskIOErrors = ["Exchange.revisit"];
	}
	else await copy(cases, "Desk.lean");
	const pkg = target === "nuget" ? "Acme." + (task ? "Depot" : route === "lookalike" ? "OtherDesk" : "Desk") : name;
	config.targets = { [target]: { name: pkg, version: "1.0.0" } };
	if(route === "reviewed")
	{
		delete config.exports;
		await copyFile(join(root, "ordinary", role, "handoff/binding-ir.json"), join(src, "public.binding-ir.json"), constants.COPYFILE_EXCL);
	}
	await writeFile(join(src, "lean-bridge.exports.json"), canonicalJson(config), { flag: "wx" });
	await writeFile(join(src, "lakefile.toml"), `name="${name}"\nversion="1.0.0"\n` + ["Shared", ...config.modules].map(n => `[[lean_lib]]\nname="${n}"\n`).join(""), { flag: "wx" });
	return { src, dir };
};

/**
 * Verify nominal identity from the Lean source closure and compiler selection.
 *
 * @param api - Public binding IR.
 * @param evidence - Original elaboration and source evidence.
 * @param task - Whether to check task or synchronous resource positions.
 */
export const verifyLeaseModel = (api, evidence, task) => {
	const nominal = api.types.find(t => t.id === "lean:Shared.Ticket"), d = api.declarations.find(d => d.name === (task ? "pending" : "check_ticket"));
	assert.ok(nominal); assert.equal(d.parameters[task ? 0 : 1].ownership, "borrow"); assert.equal(d.result.ownership, "lease");
	assert.deepEqual(d.parameters[task ? 0 : 1].lifetime, { scope: "call", anchor: null });
	assert.equal(d.parameters[task ? 0 : 1].mutability, "write"); assert.equal(d.result.lifetime.scope, "explicit");
	assert.ok(d.effects.includes("reads-resource") && d.effects.includes("writes-resource") && d.effects.includes("allocates"));
	const checked = api.declarations.find(x => x.name === (task ? "checked" : "check_ticket"));
	assert.equal(api.errors.find(e => e.id === checked.failure.errors[0]).payload.id, nominal.id);
	if(task)
	{
		const step = api.declarations.find(x => x.name === "tickets");
		assert.ok(step.failure.errors.some(id => api.errors.find(e => e.id === id)?.payload?.id === nominal.id));
	}
	const fake = structuredClone(api), bad = fake.types.find(t => t.id === nominal.id), digest = "0".repeat(64);
	bad.source.extensions["lean-bridge.dev/resource-identity"] = digest; bad.resource.kindId = "resource:Shared.Ticket/" + digest;
	const modules = new Map(evidence.lake.resolution.modules.map(m => [m.module, m]));
	const owned = evidence.metadata.leanResources.map(r => {
		const seen = new Set(), visit = n => {
			if(seen.has(n) || !modules.has(n)) return;
			seen.add(n); modules.get(n).imports.forEach(visit);
		};
		visit(r.module);
		const family = [...seen].sort().map(module => ({ module, sourceSha256: evidence.interfaces.find(f => f.module === module).sourceSha256 }));
		const identity = sha256(canonicalJson({ abi: "lean-bridge/heap-resource-v1", declaration: r.declaration, compilerSha256: evidence.compilerSha256, modules: family }));
		return { ...r, identity };
	});
	const review = reviewed => reconcileHostExports({ ...evidence, ir: null, owned, component: api.component, review: { source: canonicalJson(reviewed) } });
	const checkedModel = review(api); assert.deepEqual(checkedModel.api, api);
	assert.throws(() => review(fake), /Reviewed API differs/u);
	assert.equal(d.resultMode, task ? "promise" : "value"); assert.equal(d.result.type.id, nominal.id);
	return { nominal, entries: checkedModel.entries };
};
