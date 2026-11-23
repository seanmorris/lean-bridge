/**
 * Real Maven tasks and pull cursors over leased Lean objects.
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
import { canonicalJson } from "../../src/capsule/node.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { verifyJvmLeaseSites } from "../../src/backends/jvm/io-resources.mjs";
import { assertJsonSchema } from "./json-schema.mjs";
import "./jvm-lease-tasks-acceptance.mjs";
import "./jvm-lease-tasks-compat.mjs";
import "./jvm-lease-tasks-sole.mjs";

const env = { ...process.env, LEAN_NUM_THREADS: "1" }, build = env.LEAN_BRIDGE_JVM_LEASE_TASK_BUILD;
const fixtures = resolve("tests/fixtures/resource-tasks"), json = async p => JSON.parse(await readFile(p, "utf8"));
test("JVM leases authenticate factory and step ownership separately, and ship the tested documentation examples", async () => {
	const a = { id: "lean:Shared.Ticket" }, b = { id: "lean:Shared.Badge" }, leases = new Map([["a", a], ["b", b]]);
	const decl = "Depot.tickets", errors = [{ id: "error:EIO." + decl, payload: a }, { id: "error:AsyncStep." + decl, payload: b }];
	const field = { type: { kind: "primitive", name: "uint32" } }, d = { parameters: [], result: field, failure: { errors: errors.map(e => e.id) } };
	const method = { declaration: decl, args: [], result: "uint32", error: "a", terminal: "b" };
	verifyJvmLeaseSites(leases, method, d, { errors });
	assert.throws(() => verifyJvmLeaseSites(leases, { ...method, error: "b", terminal: "a" }, d, { errors }), /error stage/u);
	for(const f of ["package.json", "config/cli-package.v1.json", "nix/perl-engine-source-boundary.json"])
	{
		const m = await json(f); assert.ok((m.files ?? m.includedFiles).includes("src/backends/jvm/lease-delivery.kt"));
	}
	const example = async (file, heading) => (await readFile(file, "utf8")).split(heading + "\n")[1].match(/\x60{3}\w+\n([\s\S]*?)\x60{3}/u)[1];
	for(const [lang, ext] of [["java", "java"], ["kotlin", "kt"]])
		assert.equal(await example("docs/consume/" + lang + ".md", "### Receive resources from tasks and streams"), await readFile(resolve("tests/fixtures/jvm-lease-tasks/Example." + ext), "utf8"));
	const cfg = JSON.parse(await example("docs/publish/maven.md", "### Export resource-bearing tasks and streams"));
	await assertJsonSchema("lean-export-configuration", cfg); validateExportConfiguration(cfg);
	assert.deepEqual(cfg.resources, ["Shared.Ticket"]); assert.equal(cfg.asyncIterators[0].next, "Depot.next");
});
const policy = env.LEAN_BRIDGE_JVM_LEASE_TASK_POLICY;
test("JVM resource tasks refuse a changed typed step error or stale source review before exposing a handoff", { skip: !policy, timeout: 900_000 }, async t => {
	const dir = await mkdtemp(join(tmpdir(), "jvm-lease-task-policy-")); t.after(() => rm(dir, { recursive: true, force: true }));
	const src = join(dir, "source"), out = join(dir, "handoff");
	await cp(join(resolve(policy), "reviewed/source"), src, { recursive: true });
	const review = join(src, "public.binding-ir.json"), original = await json(review);
	const wrong = async api => {
		await writeFile(review, canonicalJson(api));
		await assert.rejects(buildCanonicalProject({ projectRoot: src, outputRoot: out, targets: ["maven"], environment: env }), e => {
			assert.match([e.message, e.details?.stdout, e.details?.stderr].join("\n"), /Reviewed API differs/u); return true;
		});
		await assert.rejects(access(out), { code: "ENOENT" });
	};
	const bad = structuredClone(original); bad.errors.find(e => e.id === "error:AsyncStep.Depot.tickets").payload.id = "lean:Shared.Badge";
	await wrong(bad);
	const field = original.declarations.find(d => d.name === "pending").parameters[0]; assert.equal(field.mutability, "write");
	field.mutability = "read"; await wrong(original);
});
test("compile ordinary and reviewed JVM tasks, stream steps and retained callbacks carrying real resource leases", { skip: !build, timeout: 3_600_000 }, async t => {
	const root = resolve(build);
	for(const route of env.LEAN_BRIDGE_JVM_LEASE_TASK_ROUTE ? [env.LEAN_BRIDGE_JVM_LEASE_TASK_ROUTE] : ["ordinary", "reviewed"])
	{
		assert.ok(["ordinary", "reviewed"].includes(route));
		const dir = join(root, route), src = join(dir, "source"); await mkdir(src, { recursive: true });
		for(const f of ["Depot.lean", "Shared.lean", "lean-toolchain"])
			await copyFile(join(fixtures, f), join(src, f), constants.COPYFILE_EXCL);
		await copyFile(resolve("tests/fixtures/ruby-task-resources/Exchange.lean"), join(src, "Exchange.lean"), constants.COPYFILE_EXCL);
		const cfg = await json(join(fixtures, "lean-bridge.exports.json"));
		cfg.modules.push("Exchange"); cfg.exports.push("Exchange.revisit"); cfg.taskExports.push("Exchange.revisit"); cfg.taskIOErrors = ["Exchange.revisit"];
		cfg.targets = { maven: { name: "com.acme:depot", version: "1.0.0" } };
		if(route === "reviewed")
		{
			delete cfg.exports;
			await copyFile(join(root, "ordinary/handoff/binding-ir.json"), join(src, "public.binding-ir.json"), constants.COPYFILE_EXCL);
		}
		await writeFile(join(src, "lakefile.toml"), 'name="depot"\nversion="1.0.0"\n' + ["Shared", ...cfg.modules].map(n => `[[lean_lib]]\nname="${n}"\n`).join(""), { flag: "wx" });
		await writeFile(join(src, "lean-bridge.exports.json"), canonicalJson(cfg), { flag: "wx" });
		await buildCanonicalProject({ projectRoot: src, outputRoot: join(dir, "handoff"), targets: ["maven"], environment: env })
			.catch(e => { throw new Error(e.message + "\n" + JSON.stringify(e.details), { cause: e }); });
		if(route === "reviewed") assert.deepEqual(await json(join(src, "public.binding-ir.json")), await json(join(dir, "handoff/binding-ir.json")));
		t.diagnostic("built " + route + " JVM task/resource JAR and POM");
	}
});
