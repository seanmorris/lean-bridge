/**
 * Exercise standalone synchronous Lean IO through authenticated, installed packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { analyzeLeanProject } from "../../src/analyze/lean-project.mjs";
import { generateCTaskExports } from "../../src/backends/c/task-exports.mjs";
import { generatePythonHostExtension } from "../../src/backends/python/host-exports.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertJsonSchema } from "./json-schema.mjs";
import { buildEffectHandoffs } from "./native-effect-packages.mjs";
import { runEffectConsumers } from "./native-effect-consumers.mjs";
import { profiles, sample } from "./native-sync-handoffs.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const cfg = "lean-bridge.exports.json", enabled = process.env.LEAN_BRIDGE_NATIVE_SYNC_TEST === "1", replay = process.env.LEAN_BRIDGE_NATIVE_SYNC_REPLAY;
const env = { ...process.env, LEAN_NUM_THREADS: "1", CMAKE_BUILD_PARALLEL_LEVEL: "1", CARGO_BUILD_JOBS: "1" };
const scratch = async t => {
	const work = await mkdtemp(join(tmpdir(), "native-sync-check-")); t.after(() => rm(work, { recursive: true, force: true })); return work;
};
test("standalone IO uses existing selection and grant fields", async () => {
	const config = await json(join(sample.fixture, cfg));
	for(const nativeEffects of [[], ["filesystem"]])
	{
		const value = { ...config, nativeEffects }; validateExportConfiguration(value); await assertJsonSchema("lean-export-configuration", value);
	}
	await assert.rejects(analyzeLeanProject(sample.fixture), { code: "native-io-requires-elaboration" });
});
test("standalone IO generates no polling or awaitable API and rejects a mixed delivery request", () => {
	const type = { kind: "primitive", name: "uint32" }, identity = "0".repeat(64);
	const entry = { name: "read", declaration: "Journal.read", effect: "IO", parameters: [{ name: "value", type }], result: type };
	const common = { entries: [entry], modules: ["Journal"], name: "journal", module: "Journal", synchronousIO: true, componentIdentity: identity, runtimeIdentity: identity };
	const c = generateCTaskExports(common), py = generatePythonHostExtension(common);
	assert.match(c.header, /lbc_journal_read_call\(/u); assert.doesNotMatch(c.header, /_handle|_start\(|_poll\(|_PENDING/u);
	assert.match(py.stub, /def read\(value: int\) -> int/u); assert.doesNotMatch(py.python, /import asyncio|async def|_lb_await/u);
	for(const gen of [generateCTaskExports, generatePythonHostExtension])
		for(const e of [{ ...entry, delivery: "task" }, { ...entry, effect: "pure" }])
			assert.throws(() => gen({ ...common, entries: [e] }), /delivery contract/u);
});
test("standalone IO checks actual effects and does not reinterpret tasks or pure-only packages", { skip: !enabled, timeout: 600_000 }, async t => {
	const work = await scratch(t);
	const cases = [
		["missing-grant", ["Journal.store"], "", /requires nativeEffects "filesystem"/u]
		, ["pure-only", ["Journal.echo"], "", /requires a checked IO, BaseIO or EIO/u]
		, ["unselected-task", ["Journal.work"], "def Journal.work : BaseIO (Task UInt32) := pure (Task.pure 5)", /unsupported host export carrier/u]
	];
	for(const [label, exports, suffix, failure] of cases)
	{
		const project = join(work, label), outputRoot = join(work, label + "-handoff");
		await cp(sample.fixture, project, { recursive: true });
		const config = { ...await json(join(project, cfg)), nativeEffects: [], exports };
		await writeFile(join(project, cfg), canonicalJson(config));
		if(suffix) await writeFile(join(project, sample.module), await readFile(join(project, sample.module), "utf8") + "\n" + suffix + "\n");
		await assert.rejects(buildCanonicalProject({ projectRoot: project, outputRoot, targets: ["c"], environment: env }), error => {
			assert.match([error.message, error.details?.stdout, error.details?.stderr].join("\n"), failure); return true;
		});
		await assert.rejects(lstat(outputRoot), { code: "ENOENT" });
	}
});
test("an in-memory standalone API needs no grant for an unselected file operation", { skip: !enabled, timeout: 600_000 }, async t => {
	const work = await scratch(t), project = join(work, "project"), outputRoot = join(work, "handoff");
	await cp(sample.fixture, project, { recursive: true });
	await writeFile(join(project, cfg), canonicalJson({ ...await json(join(project, cfg)), nativeEffects: [], exports: ["Journal.bump", "Journal.choose"] }));
	await buildCanonicalProject({ projectRoot: project, outputRoot, targets: ["c"], environment: env });
	const api = await json(join(outputRoot, "binding-ir.json"));
	assert.deepEqual(api.capabilities, []); assert.deepEqual(api.declarations.map(d => d.name).sort(), ["bump", "choose"]);
});
test("ordinary and reviewed standalone IO packages run from installed archives", { skip: !enabled && !replay, timeout: 3_600_000 }, async t => {
	const work = await scratch(t), releases = resolve(replay ?? process.env.LEAN_BRIDGE_NATIVE_SYNC_EVIDENCE ?? join(work, "releases"));
	if(!replay) await mkdir(releases, { recursive: true });
	const reports = [];
	for(const target of Object.keys(profiles))
	{
		if(!replay) await buildEffectHandoffs(releases, target, env, sample);
		reports.push(...await runEffectConsumers(work, releases, target, env, sample));
	}
	const report = { schemaVersion: 1, routes: reports };
	if(!replay) await writeFile(join(releases, "acceptance.json"), canonicalJson(report), { flag: "wx" });
	else
	{
		const bytes = await readFile(join(releases, "acceptance.json"));
		assert.deepEqual(report, JSON.parse(bytes));
		if(process.env.LEAN_BRIDGE_NATIVE_SYNC_EXPECTED)
		{
			const pinned = await json(resolve(process.env.LEAN_BRIDGE_NATIVE_SYNC_EXPECTED));
			assert.equal(sha256(bytes), pinned.acceptanceSha256); assert.deepEqual(reports, pinned.routes);
		}
	}
});
