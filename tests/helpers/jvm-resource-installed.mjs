/**
 * Build independently authored Maven packages sharing compiler-identified Lean types.
 *
 * @file
 */
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { access, copyFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { taskResourceLedger } from "../../src/build/task-resource-ledger.mjs";
import { jvmIOEntry } from "../../src/build/jvm-io-owner.mjs";
import { generateSyncWire } from "../../src/backends/c/sync-wire.mjs";
import { jvmLeaseModels, verifyJvmLeaseSites } from "../../src/backends/jvm/io-resources.mjs";
import "./jvm-resource-acceptance.mjs";

const env = { ...process.env, LEAN_NUM_THREADS: "1" };
const build = env.LEAN_BRIDGE_JVM_RESOURCE_BUILD;
const fixture = resolve("tests/fixtures/jvm-sync-resources"), shared = resolve("tests/fixtures/resource-tasks");
const routes = ["ordinary", "peer", "lookalike", "reviewed"];
const json = async f => JSON.parse(await readFile(f, "utf8"));
const policy = env.LEAN_BRIDGE_JVM_RESOURCE_POLICY;
test("resource Maven builds refuse missing OS grants, false task selection and forged source identity before handoff", { skip: !policy, timeout: 600_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "jvm-resource-policy-")); t.after(() => rm(root, { recursive: true, force: true }));
	const src = join(root, "project"), out = join(root, "release");
	await cp(join(resolve(policy), "ordinary/source"), src, { recursive: true });
	const file = join(src, "lean-bridge.exports.json"), cfg = await json(file);
	const refuse = async (config, pattern) => {
		await writeFile(file, canonicalJson(config));
		await assert.rejects(buildCanonicalProject({ projectRoot: src, outputRoot: out, targets: ["maven"], environment: env }), e => {
			assert.match([e.message, e.details?.stdout, e.details?.stderr].join("\n"), pattern); return true;
		});
		await assert.rejects(access(out), { code: "ENOENT" });
	};
	await refuse({ ...cfg, taskExports: ["Desk.issue"] }, /taskExports requires a real Lean Task result/u);
	await refuse({ ...cfg, nativeEffects: [] }, /requires nativeEffects "filesystem"/u);
	const ir = await json(join(resolve(policy), "ordinary/handoff/binding-ir.json")), type = ir.types.find(t => t.id === "lean:Shared.Ticket");
	const hash = "0".repeat(64); type.resource.kindId = "resource:Shared.Ticket/" + hash;
	type.source.extensions["lean-bridge.dev/resource-identity"] = hash;
	delete cfg.exports;
	await writeFile(join(src, "public.binding-ir.json"), canonicalJson(ir), { flag: "wx" });
	await refuse(cfg, /Reviewed API differs/u);
});
test("JVM resource operations require the shared owner, source kind and declared borrow or lease", async () => {
	const runtimeIdentity = "a".repeat(64), ownerId = "b".repeat(64), hash = "c".repeat(64);
	const normal = await taskResourceLedger(runtimeIdentity);
	const source = await readFile("src/backends/native/task-resource-ledger.c"), header = await readFile("src/backends/native/task-resource-ledger.h");
	assert.deepEqual(normal.source, source); assert.deepEqual(normal.header, header);
	assert.equal(normal.id, sha256(canonicalJson({ runtimeIdentity, header: sha256(header), source: sha256(source) })));
	const owner = { id: ownerId, name: "liblb_jvm_owner_" + runtimeIdentity + ".so", flag: "-DLB_JVM_OWNER_PREFIX=lb_jvm_owner_" + ownerId + "_" };
	const l = await taskResourceLedger(runtimeIdentity, owner);
	assert.notEqual(l.id, normal.id); assert.match(l.source.toString(), /LB_JVM_OWNER\(current\)\(\) && lean_bridge_native_process_valid/u);
	await assert.rejects(taskResourceLedger(runtimeIdentity, { ...owner, flag: normal.flag }), /Invalid JVM resource owner/u);
	const id = "lean:Shared.Ticket", type = { kind: "named", id };
	const kind = { id, kind: "resource", host: null
		, resource: { kindId: "resource:Shared.Ticket/" + hash }
		, source: { declaration: "Shared.Ticket", extensions: { "lean-bridge.dev/resource-identity": hash } } };
	const entry = { declaration: "Desk.keep", name: "keep", effect: "EIO", parameters: [{ type }], result: type, error: type };
	const w = generateSyncWire("lbc_desk", [entry], { resources: [kind] }), m = w.methods[0];
	const errorId = "error:EIO.Desk.keep", api = { types: [kind], errors: [{ id: errorId, payload: type }] };
	const evidence = { ledgerId: l.id, libraries: { [l.name]: hash } };
	const kinds = jvmLeaseModels(api, w, evidence, new Set());
	const site = (ownership, scope) => ({ type, ownership, lifetime: { scope, anchor: null } });
	const decl = { parameters: [site("borrow", "call")], result: site("lease", "explicit"), failure: { errors: [errorId] } };
	verifyJvmLeaseSites(kinds, m, decl, api);
	for(const d of [{ ...decl, parameters: [site("lease", "explicit")] }, { ...decl, result: site("copy", "explicit") }])
		assert.throws(() => verifyJvmLeaseSites(kinds, m, d, api), /resource ownership/u);
	assert.throws(() => verifyJvmLeaseSites(kinds, { ...m, error: "string" }, decl, api), /resource error/u);
	const direct = {...m, delivery: "iterator", error: null, terminal: m.error};
	const stepId = "error:Step.Desk.keep", asyncId = "error:AsyncStep.Desk.keep";
	const stepApi = {...api, errors: [stepId, asyncId].map(id => ({id, payload: type}))};
	const at = id => ({...decl, failure: {errors: [id]}});
	verifyJvmLeaseSites(kinds, direct, at(stepId), stepApi);
	assert.throws(() => verifyJvmLeaseSites(kinds, direct, at(asyncId), stepApi), /resource error stage/u);
	assert.throws(() => jvmLeaseModels(api, w, { ...evidence, ledgerId: hash }, new Set()), /kind or ledger/u);
	assert.throws(() => jvmLeaseModels(api, { ...w, leases: [{ ...w.leases[0], hash: runtimeIdentity }] }, evidence, new Set()), /kind or ledger/u);
	assert.throws(() => jvmIOEntry({ ...w, leases: [{ ...w.leases[0], symbol: w.clear }] }, "lbc_desk"), /Unverified JVM/u);
	assert.match(jvmIOEntry(w, "lbc_desk").source, /case INT32_MIN: lbwire_lbc_desk_v1_clear\(r->out\)/u);
	for(const path of ["package.json", "config/cli-package.v1.json", "nix/perl-engine-source-boundary.json"])
	{
		const mf = await json(path);
		for(const f of ["io-resources.mjs", "resource-port.java"]) assert.ok((mf.files ?? mf.includedFiles).includes("src/backends/jvm/" + f));
	}
});
test("the Maven resource examples match the installed Java and Kotlin clients", async () => {
	for(const [lang, ext] of [["java", "java"], ["kotlin", "kt"]])
	{
		const docs = (await readFile("docs/consume/" + lang + ".md", "utf8")).split("### Share a Lean resource between packages\n")[1];
		assert.equal(docs.match(/\x60{3}(?:java|kotlin)\n([\s\S]*?)\x60{3}/u)[1], await readFile(join(fixture, "Example." + ext), "utf8"));
	}
});
test("ordinary and reviewed JVM builds export synchronous Lean heap resources", { skip: !build, timeout: 3_600_000 }, async t => {
	const root = resolve(build);
	for(const route of env.LEAN_BRIDGE_JVM_RESOURCE_ROUTE ? [env.LEAN_BRIDGE_JVM_RESOURCE_ROUTE] : routes)
	{
		assert.ok(routes.includes(route));
		const peer = route === "peer", other = route === "lookalike", dir = join(root, route), src = join(dir, "source");
		await mkdir(src, { recursive: true });
		const name = peer ? "counter" : other ? "other-desk" : "desk", mod = peer ? "Counter" : "Desk";
		let source = await readFile(join(shared, "Shared.lean"), "utf8");
		if(other) source = source.replace("namespace Shared", "namespace Shared\n\ndef revision : UInt32 := 2");
		await writeFile(join(src, "Shared.lean"), source, { flag: "wx" });
		await copyFile(join(shared, "lean-toolchain"), join(src, "lean-toolchain"), constants.COPYFILE_EXCL);
		await copyFile(join(peer ? fixture : resolve("tests/fixtures/ruby-task-resources"), mod + ".lean"), join(src, mod + ".lean"), constants.COPYFILE_EXCL);
		const maven = { name: "com.acme:" + name, version: "1.0.0" };
		const cfg = { schemaVersion: 1, modules: [mod]
			, resources: ["Shared.Ticket", "Shared.Badge"]
			, nativeEffects: ["filesystem"], targets: { maven } };
		if(route === "reviewed")
			await copyFile(join(root, "ordinary/handoff/binding-ir.json"), join(src, "public.binding-ir.json"), constants.COPYFILE_EXCL);
		else cfg.exports = peer ? ["Counter.issue", "Counter.bump", "Counter.readBadge"] : ["Desk.issue", "Desk.badge", "Desk.count", "Desk.checkTicket"];
		await writeFile(join(src, "lean-bridge.exports.json"), canonicalJson(cfg), { flag: "wx" });
		await writeFile(join(src, "lakefile.toml"), `name="${name}"\nversion="1.0.0"\n[[lean_lib]]\nname="Shared"\n[[lean_lib]]\nname="${mod}"\n`, { flag: "wx" });
		await buildCanonicalProject({ projectRoot: src, outputRoot: join(dir, "handoff"), targets: ["maven"], environment: env })
			.catch(e => { throw new Error(e.message + "\n" + JSON.stringify(e.details), { cause: e }); });
		if(route === "reviewed") assert.deepEqual(await json(join(src, "public.binding-ir.json")), await json(join(dir, "handoff/binding-ir.json")));
		t.diagnostic("built " + route + " resource JAR/POM");
	}
});
