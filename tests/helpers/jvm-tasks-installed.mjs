/**
 * Build original ordinary, independently reviewed and peer Maven task packages.
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
import { jvmIOEntry } from "../../src/build/jvm-io-owner.mjs";
import { generateCTaskExports } from "../../src/backends/c/task-exports.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { assertJsonSchema } from "./json-schema.mjs";
import "./jvm-tasks-acceptance.mjs";

const env = { ...process.env, LEAN_NUM_THREADS: "1" }, build = env.LEAN_BRIDGE_JVM_TASK_BUILD;
const timers = resolve("tests/fixtures/python-lean-tasks"), fixture = resolve("tests/fixtures/jvm-tasks");
const parse = async p => JSON.parse(await readFile(p, "utf8"));
const policy = env.LEAN_BRIDGE_JVM_TASK_POLICY;
test("the JVM owner exposes only the compiler-selected task and pull operations", () => {
	const symbol = "lb_test_task", p = "lbc_test";
	const names = Object.fromEntries(["start", "take", "close", "poll"].map(k => [k, symbol + "_" + k]));
	const make = (delivery, ports) => jvmIOEntry({ wait: {}, methods: [{ name: "fetch", declaration: "Test.fetch", symbol, delivery, names: ports }] }, p, "__WATCH__");
	assert.match(make("task", names).source, /case 0: r->status = lb_test_task_start/u);
	assert.throws(() => make("task", { ...names, poll: "other_poll" }), /Unverified JVM task operations/u);
	assert.throws(() => make("async-iterator", names), /Unverified JVM task operations/u);
	assert.throws(() => make("task", { ...names, pull: symbol + "_pull" }), /Unverified JVM task operations/u);
	assert.match(make("async-iterator", { ...names, pull: symbol + "_pull" }).source, /case 4: r->status = lb_test_task_pull/u);
	const retainedNames = { ...names, ...Object.fromEntries(["callbacks", "next", "arg", "reply", "fail", "trap"].map(k => [k, symbol + "_" + k])) };
	const withCallback = (delivery, selected) => jvmIOEntry({ wait: {}, methods: [{ name: "fetch", symbol, delivery, callbacks: [[0, "nat", "nat"]], names: selected }] }, p, "__WATCH__");
	assert.match(withCallback("task", retainedNames).source, /case 8: .*lb_test_task_reply/u);
	assert.throws(() => withCallback("task", { ...retainedNames, fail: "foreign_fail" }), /Unverified JVM task operations/u);
	assert.throws(() => withCallback("async-iterator", retainedNames), /callback port requires an actual task/u);
	assert.throws(() => make("task", retainedNames), /Unverified JVM task operations/u);
	const retained = { delivery: "task", parameters: [{ type: { kind: "io-callback" } }] };
	assert.throws(() => generateCTaskExports({ name: "test", modules: ["Test"], entries: [retained], componentIdentity: "0".repeat(64), integerMode: "gmp", jvmDelivery: true }), /JVM task ABI requires word carriers/u);
});
test("Maven task packaging rejects false terminal errors and a changed reviewed payload before exposing a release", { skip: !policy, timeout: 900_000 }, async t => {
	const dir = await mkdtemp(join(tmpdir(), "jvm-task-policy-")); t.after(() => rm(dir, { recursive: true, force: true }));
	const root = resolve(policy), src = join(dir, "source"), output = join(dir, "release");
	await cp(join(root, "ordinary/source"), src, { recursive: true });
	const f = join(src, "lean-bridge.exports.json"), config = await parse(f);
	const refused = async reason => {
		await assert.rejects(buildCanonicalProject({ projectRoot: src, outputRoot: output, targets: ["maven"], environment: env }), e => {
			assert.match([e.message, e.details?.stderr, e.details?.stdout].join("\n"), reason); return true;
		});
		await assert.rejects(access(output), { code: "ENOENT" });
	};
	await writeFile(f, canonicalJson({ ...config, taskIOErrors: ["Timers.compute"] })); await refused(/taskIOErrors requires Task/u);
	const ir = await parse(join(root, "ordinary/handoff/binding-ir.json")), result = ir.declarations.find(d => d.source.declaration === "Timers.immediate").result.type;
	assert.equal(result.name, "nat"); result.name = "uint32";
	delete config.exports; await writeFile(f, canonicalJson(config)); await writeFile(join(src, "public.binding-ir.json"), canonicalJson(ir), { flag: "wx" });
	await refused(/Reviewed API differs/u);
});
test("the Maven task release contains its private runtime and the docs use the installed API", async () => {
	for(const f of ["package.json", "config/cli-package.v1.json", "nix/perl-engine-source-boundary.json"])
	{
		const m = await parse(f), files = m.files ?? m.includedFiles;
		for(const n of ["task-delivery.java", "task-flow.kt", "task-port.java", "task-reactor.c", "task-reactor.java", "callback-port.java", "retained-callback.java"])
			assert.ok(files.includes("src/backends/jvm/" + n), f + ": " + n);
	}
	const section = async (f, head) => (await readFile(f, "utf8")).split(head + "\n")[1];
	const snippet = s => s.match(/\x60{3}(?:java|kotlin|json)\n([\s\S]*?)\x60{3}/u)[1];
	for(const [lang, ext] of [["java", "java"], ["kotlin", "kt"]])
	{
		assert.equal(snippet(await section("docs/consume/" + lang + ".md", "### Await tasks and consume streams")), await readFile(join(fixture, "Example." + ext), "utf8"));
		assert.equal(snippet(await section("docs/consume/" + lang + ".md", "### Pass a callback to a Lean task")), await readFile(resolve("tests/fixtures/jvm-retained", "Example." + ext), "utf8"));
	}
	const config = JSON.parse(snippet(await section("docs/publish/maven.md", "## Export tasks and streams")));
	await assertJsonSchema("lean-export-configuration", config); validateExportConfiguration(config);
	assert.deepEqual(config.taskExports, ["Timers.immediate"]); assert.equal(config.asyncIterators[0].open, "Timers.units");
	const retained = await section("docs/publish/maven.md", "### Export a retained task callback");
	const once = JSON.parse(snippet(retained)); await assertJsonSchema("lean-export-configuration", once);
	validateExportConfiguration(once); assert.deepEqual(once.taskExports, ["Feedback.once"]); assert.deepEqual(once.taskIOErrors, once.taskExports);
	const source = await readFile(resolve("tests/fixtures/jvm-retained/Feedback.lean"), "utf8");
	assert.ok(source.includes(retained.match(/\x60{3}lean\n([\s\S]*?)\x60{3}/u)[1].split("\n\nend Feedback")[0].trimEnd()));
});
test("compiler-selected and reviewed Java and Kotlin task JARs contain native Lean tasks and cursors", { skip: !build, timeout: 3_600_000 }, async t => {
	const root = resolve(build), routes = env.LEAN_BRIDGE_JVM_TASK_ROUTE ? [env.LEAN_BRIDGE_JVM_TASK_ROUTE] : ["ordinary", "peer", "reviewed"];
	for(const route of routes)
	{
		assert.ok(["ordinary", "peer", "reviewed"].includes(route));
		const dir = join(root, route), src = join(dir, "source"), peer = route === "peer", mod = peer ? "Alarm" : "Timers";
		await mkdir(src, { recursive: true });
		await copyFile(join(timers, "lean-toolchain"), join(src, "lean-toolchain"), constants.COPYFILE_EXCL);
		const source = peer ? await readFile(join(fixture, "Alarm.lean"), "utf8") : await readFile(join(timers, "Timers.lean"), "utf8") + await readFile(join(fixture, "extra.lean"), "utf8");
		await writeFile(join(src, mod + ".lean"), source, { flag: "wx" });
		const config = peer ? { schemaVersion: 1, modules: [mod], exports: ["Alarm.reset", "Alarm.release", "Alarm.wait", "Alarm.owner"], taskExports: ["Alarm.wait"] } : await parse(join(timers, "lean-bridge.exports.json"));
		if(!peer)
		{
			config.exports.push("Timers.finalIO", "Timers.owner", "Timers.octets");
			config.taskExports.push("Timers.finalIO", "Timers.octets"); config.taskIOErrors = ["Timers.finalIO"];
		}
		config.nativeEffects = ["filesystem"];
		const slug = mod.toLowerCase();
		config.targets = { maven: { name: "com.acme:" + slug, version: "1.0.0" } };
		if(route === "reviewed")
		{
			await copyFile(join(root, "ordinary/handoff/binding-ir.json"), join(src, "public.binding-ir.json"), constants.COPYFILE_EXCL);
			delete config.exports;
		}
		await writeFile(join(src, "lean-bridge.exports.json"), canonicalJson(config), { flag: "wx" });
		await writeFile(join(src, "lakefile.toml"), `name="${slug}"\nversion="1.0.0"\n[[lean_lib]]\nname="${mod}"\n`, { flag: "wx" });
		const out = join(dir, "handoff");
		await buildCanonicalProject({ projectRoot: src, outputRoot: out, targets: ["maven"], environment: env })
			.catch(e => { throw new Error(e.message + "\n" + JSON.stringify(e.details), { cause: e }); });
		const ir = await parse(join(out, "binding-ir.json"));
		assert.equal(ir.declarations.find(d => d.source.declaration === mod + ".owner").resultMode, "value");
		assert.ok(ir.declarations.some(d => d.resultMode === "promise"));
		assert.equal(ir.declarations.some(d => d.resultMode === "async-iterator"), !peer);
		if(route === "reviewed") assert.deepEqual(ir, await parse(join(src, "public.binding-ir.json")));
		t.diagnostic("built " + route + " independently pinned JVM task JAR and POM");
	}
});
