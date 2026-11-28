/**
 * Produce independent offline Maven packages with real retained Lean task callbacks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { constants } from "node:fs";
import { access, copyFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { reconcileHostExports } from "../../src/analyze/host-export-model.mjs";
import "./jvm-retained-acceptance.mjs";

const env = { ...process.env, LEAN_NUM_THREADS: "1" }, build = env.LEAN_BRIDGE_JVM_CALLBACK_BUILD;
const base = resolve("tests/fixtures/python-retained-tasks"), fixture = resolve("tests/fixtures/jvm-retained");
const read = async f => JSON.parse(await readFile(f, "utf8"));
const policy = env.LEAN_BRIDGE_JVM_CALLBACK_POLICY;
test("Maven refuses an altered callback scheduler, borrowed lifetime, or non-scalar worker reply", { skip: !policy, timeout: 900_000 }, async t => {
	const dir = await mkdtemp(join(tmpdir(), "jvm-callback-policy-")); t.after(() => rm(dir, { recursive: true, force: true }));
	const src = join(dir, "source"), output = join(dir, "handoff"), root = resolve(policy);
	await cp(join(root, "reviewed/source"), src, { recursive: true });
	const path = join(src, "public.binding-ir.json"), ir = await read(path);
	const refused = async reason => {
		await assert.rejects(buildCanonicalProject({ projectRoot: src, outputRoot: output, targets: ["maven"], environment: env }), e => {
			assert.match([e.message, e.details?.stderr, e.details?.stdout].join("\n"), reason); return true;
		});
		await assert.rejects(access(output), { code: "ENOENT" });
	};
	const scheduler = structuredClone(ir);
	scheduler.types.find(x => x.kind === "callback").source.extensions["lean-bridge.dev/callback-scheduler"] = "owner-event-loop";
	await writeFile(path, canonicalJson(scheduler)); await refused(/Reviewed API differs/u);
	const borrow = structuredClone(ir), param = borrow.declarations.find(d => d.source.declaration === "Feedback.once").parameters[1];
	param.ownership = "borrow"; param.lifetime.scope = "call"; await writeFile(path, canonicalJson(borrow)); await refused(/Reviewed API differs/u);
	await rm(path); const bad = "Feedback.compoundReply", config = await read(join(root, "ordinary/source/lean-bridge.exports.json"));
	for(const k of ["exports", "taskExports", "taskIOErrors"]) config[k].push(bad);
	await writeFile(join(src, "lean-bridge.exports.json"), canonicalJson(config));
	await writeFile(join(src, "Feedback.lean"), "\nnamespace Feedback\ndef compoundReply (f : Nat → IO (List Nat)) : BaseIO (Task (Except IO.Error Nat)) :=\n  IO.asTask do return (← f 0).length\nend Feedback\n", { flag: "a" });
	await refused(/retained task callback arguments and replies must be copied scalars/u);
});
test("build ordinary, peer and compiler-reviewed JVM retained callback packages", { skip: !build, timeout: 3_600_000 }, async t => {
	const root = resolve(build), routes = env.LEAN_BRIDGE_JVM_CALLBACK_ROUTE ? [env.LEAN_BRIDGE_JVM_CALLBACK_ROUTE] : ["ordinary", "peer", "reviewed"];
	for(const route of routes)
	{
		assert.ok(["ordinary", "peer", "reviewed"].includes(route));
		const peer = route === "peer", dir = join(root, route), src = join(dir, "source"), outputRoot = join(dir, "handoff");
		const slug = peer ? "relay" : "feedback"; await mkdir(src, { recursive: true });
		const copy = (from, name) => copyFile(join(from, name), join(src, name), constants.COPYFILE_EXCL);
		await copy(base, "lean-toolchain");
		const config = peer ? { schemaVersion: 1, modules: ["Relay"], exports: ["Relay.run", "Relay.direct"], taskExports: ["Relay.run", "Relay.direct"], taskIOErrors: ["Relay.run"] }
			: await read(join(base, "lean-bridge.exports.json"));
		if(peer) await copy(resolve("tests/fixtures/ruby-retained-tasks"), "Relay.lean");
		else
		{
			await copy(base, "Retained.lean"); await copy(fixture, "Feedback.lean"); config.modules.push("Feedback");
			for(const key of ["exports", "taskExports", "taskIOErrors"]) config[key].push("Feedback.once", "Feedback.early", "Feedback.action");
		}
		config.targets = { maven: { name: "com.acme:" + slug, version: "1.0.0" } };
		if(route === "reviewed")
		{
			await copyFile(join(root, "ordinary/handoff/binding-ir.json"), join(src, "public.binding-ir.json"), constants.COPYFILE_EXCL);
			delete config.exports;
		}
		await writeFile(join(src, "lean-bridge.exports.json"), canonicalJson(config), { flag: "wx" });
		await writeFile(join(src, "lakefile.toml"), `name="${slug}"\nversion="1.0.0"\n` + config.modules.map(n => `[[lean_lib]]\nname="${n}"\n`).join(""), { flag: "wx" });
		await buildCanonicalProject({ projectRoot: src, outputRoot, targets: ["maven"], environment: env })
			.catch(e => { throw new Error(e.message + "\n" + JSON.stringify(e.details), { cause: e }); });
		const ir = await read(join(outputRoot, "binding-ir.json")), evidence = await read(join(outputRoot, "host-export-evidence.json"));
		assert.equal(evidence.selection.jvmTaskCallbacks, true); assert.ok(ir.errors.some(x => x.id === "error:JvmCallbackException"));
		const cb = ir.types.find(x => x.kind === "callback"); assert.equal(cb.source.extensions["lean-bridge.dev/callback-scheduler"], "jvm-virtual-thread");
		const review = structuredClone(ir); review.types.find(x => x.id === cb.id).callable.selfDisposal = "reject";
		const opts = { ...evidence, component: ir.component, ir: null };
		assert.throws(() => reconcileHostExports({ ...opts, review: { source: canonicalJson(review) } }), /Reviewed API differs|selfDisposal/u);
		assert.throws(() => reconcileHostExports({ ...opts, selection: { ...opts.selection, jvmTaskCallbacks: false } }), /Unverified retained-callback/u);
		if(route === "reviewed") assert.deepEqual(ir, await read(join(src, "public.binding-ir.json")));
		t.diagnostic(route + ": real JVM retained task packages with authenticated callback contracts");
	}
});
