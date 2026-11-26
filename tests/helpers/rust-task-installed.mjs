/**
 * Build ordinary and reviewed Cargo releases or replay both from their original archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { copyFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { runInstalledRustTasks } from "./rust-task-install.mjs";
import { generateCTaskExports } from "../../src/backends/c/task-exports.mjs";
import { generateRustTaskSources } from "../../src/backends/rust/task-crate.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { reconcileHostExports } from "../../src/analyze/host-export-model.mjs";

const env = process.env, replay = env.LEAN_BRIDGE_RUST_TASK_REPLAY;
test("Cargo packages all retained-task templates and does not opt an unspecified host into its callback ABI", async () => {
	const manifest = JSON.parse(await readFile("package.json"));
	const cli = JSON.parse(await readFile("config/cli-package.v1.json"));
	const engine = JSON.parse(await readFile("nix/perl-engine-source-boundary.json"));
	for(const file of ["native/task-callback-queue.h"
		, "native/task-callback.mjs"
		, "c/task-callback-port.h"
		, "c/task-callback-exports.mjs"
		, "rust/task-callback.mjs"
		, "rust/task-runtime/src/callback.rs"])
		for(const list of [manifest.files, cli.files, engine.includedFiles]) assert.ok(list.includes("src/backends/" + file), file);
	const config = JSON.parse(await readFile("tests/fixtures/rust-task-lab/lean-bridge.exports.json"));
	validateExportConfiguration(config);
	const scalar = { kind: "primitive", name: "uint32" }, type = { kind: "io-callback", argument: scalar, reply: scalar };
	const entry = { name: "twice"
		, declaration: "Lab.twice"
		, effect: "BaseIO"
		, delivery: "task"
		, taskIO: true
		, parameters: [{ name: "f", type }], result: scalar };
	const id = "a".repeat(64), options = { name: "lab", entries: [entry], modules: ["Lab"], componentIdentity: id };
	for(const integerMode of ["gmp", "words"])
		assert.throws(() => generateCTaskExports({ ...options, integerMode }), /requires Rust/u);
	const gen = generateCTaskExports({ ...options, integerMode: "words", rustCallbacks: true });
	assert.match(gen.entryLean, /cbTrack port inner/u);
	assert.doesNotMatch(gen.header, /lean_object|IO\.Promise/u);
	const plain = generateCTaskExports({ ...options, integerMode: "words", rustCallbacks: true, entries: [{ ...entry, parameters: [] }] });
	assert.doesNotMatch(plain.source, /LB_RETAINED_TASKS|lb_cb_new/u);
	const sources = await generateRustTaskSources({ prefix: gen.prefix
		, entries: [entry]
		, evidence: { library: "liblbc_lab.so", runtimeIdentity: id, libraries: { "liblbc_lab.so": id } } });
	assert.match(sources["src/lib.rs"], /impl Fn\(u32\)->Result<u32,CallbackError>/u);
	assert.doesNotMatch(sources["src/lib.rs"], /unsafe|Handle|BorrowedFd/u);
	const selection = { modules: ["Lab"]
		, exportModules: ["Lab"]
		, members: []
		, exports: [entry.declaration]
		, taskExports: [entry.declaration]
		, taskIOErrors: [entry.declaration]
		, rustTaskCallbacks: true };
	const facts = { ir: null
		, component: { id: "lab@1.0.0", name: "lab", version: "1.0.0" }
		, selection
		, metadata: { kind: "lean-bridge-host-export-metadata"
			, schemaVersion: 1
			, leanVersion: "4.32.2"
			, entries: [{ ...entry, module: "Lab", hostMembers: [] }] } };
	const api = reconcileHostExports(facts).api;
	assert.deepEqual(api.declarations[0].failure.errors, ["error:TaskIO.Error", "error:RustCallbackError"]);
	assert.throws(() => reconcileHostExports({ ...facts, selection: { ...selection, rustTaskCallbacks: false } }), /Unverified/u);
	assert.throws(() => reconcileHostExports({ ...facts, selection: { ...selection, rustTaskCallbacks: false, pythonTaskCallbacks: true }
		, review: { source: canonicalJson(api) } }), /Reviewed API differs/u);
});

test("offline installed Cargo releases deliver real Lean tasks, streams and nominal leases", {
	skip: env.LEAN_BRIDGE_RUST_TASK_TEST !== "1" && !replay, timeout: 3_600_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "rust-tasks-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const kept = resolve(replay ?? env.LEAN_BRIDGE_RUST_TASK_EVIDENCE ?? join(root, "releases"));
	const fixture = resolve("tests/fixtures");
	let api;
	if(!replay)
	{
		await mkdir(kept, { recursive: true });
		await mkdir(join(kept, "client"));
		for(const f of ["consumer.rs", "pulse_checks.rs", "callback_checks.rs"]) await copyFile(join(fixture, "rust-task-lab", f), join(kept, "client", f));
		const guide = (await readFile("docs/consume/rust.md", "utf8")).split("### Pass a callback to a Lean task\n")[1];
		await writeFile(join(kept, "client/callback_example.rs"), guide.match(/\x60{3}rust\n([\s\S]*?)\x60{3}/u)[1], { flag: "wx" });
		for(const route of ["ordinary", "reviewed"])
		{
			const dest = join(kept, route), src = join(root, route), handoff = join(dest, "handoff");
			await mkdir(dest); await mkdir(src);
			for(const [base, paths] of [["rust-task-lab", ["Lab.lean", "lakefile.toml", "lean-bridge.exports.json"]]
				, ["resource-tasks", ["Shared.lean", "Depot.lean", "lean-toolchain"]]
				, ["exact-task-integers", ["Wide.lean"]]
				, ["c-lean-tasks", ["Pulse.lean"]]
				, ["python-retained-tasks", ["Retained.lean"]]])
				for(const path of paths) await copyFile(join(fixture, base, path), join(src, path));
			if(api)
			{
				const config = JSON.parse(await readFile(join(src, "lean-bridge.exports.json")));
				delete config.exports; config.targets.cargo.name = "task-lab-peer";
				await writeFile(join(src, "lean-bridge.exports.json"), canonicalJson(config));
				await writeFile(join(src, "lab.binding-ir.json"), canonicalJson(api));
			}
			await cp(src, join(dest, "source"), { recursive: true, errorOnExist: true });
			await buildCanonicalProject({ projectRoot: src, outputRoot: handoff, targets: ["cargo"], environment: { ...env, LEAN_NUM_THREADS: "1" } })
				.catch(e => { throw new Error(e.message + "\n" + JSON.stringify(e.details), { cause: e }); });
			const fresh = JSON.parse(await readFile(join(handoff, "binding-ir.json")));
			if(api) assert.deepEqual(fresh, api); else api = fresh;
			await rm(src, { recursive: true });
		}
	}
	const extra = env.LEAN_BRIDGE_RUST_TASK_PARKED_OUTPUT;
	const ownerOutput = env.LEAN_BRIDGE_RUST_TASK_DUAL_OUTPUT;
	const { parked, owners, ...result } = await runInstalledRustTasks({
		root, kept, environment: env, swapPrimary: Boolean(ownerOutput)
		, ...extra ? { parkedClient: join(fixture, "rust-task-lab/parked_stream.rs") } : {} });
	if(replay) assert.deepEqual(result, JSON.parse(await readFile(join(kept, "acceptance.json"))));
	else await writeFile(join(kept, "acceptance.json"), canonicalJson(result), { flag: "wx" });
	if(extra)
	{
		await mkdir(resolve(extra), { recursive: true });
		await writeFile(join(resolve(extra), "parked.json"), canonicalJson({ releases: result.reports, ...parked }));
	}
	t.diagnostic(result.output);
	if(ownerOutput)
	{
		await mkdir(resolve(ownerOutput), { recursive: true });
		await writeFile(join(resolve(ownerOutput), "owners.json"), canonicalJson({ ...result, owners }));
	}
});
