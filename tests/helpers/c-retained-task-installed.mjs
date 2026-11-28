/**
 * Check the public C callback contract and exercise real mounted C11 releases.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { reconcileHostExports } from "../../src/analyze/host-export-model.mjs";
import { generateCTaskExports } from "../../src/backends/c/task-exports.mjs";
import { generateOwnedWasmBroker } from "../../src/backends/javascript/owned-wasm-broker.mjs";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { buildNativeCallbackPackages } from "./native-retained-task-packages.mjs";
import { verifyNativeTaskRefusals } from "./native-retained-task-refusals.mjs";
import { captureNativeCallbackClient, runNativeCallbackInstall } from "./native-retained-task-install.mjs";

test("public C retained callbacks require the C error policy and expose only one polling descriptor", async () => {
	const u = { kind: "primitive", name: "uint32" }, cb = { kind: "io-callback", argument: u, reply: u };
	const entry = { declaration: "Lab.work"
		, name: "work", module: "Lab", result: u, hostMembers: []
		, parameters: [{ name: "callback", type: cb }]
		, delivery: "task"
		, effect: "BaseIO"
		, taskIO: true };
	const gen = { name: "lab", componentIdentity: "b".repeat(64), modules: ["Lab"], entries: [entry], cCallbacks: true };
	const { header, symbols } = generateCTaskExports(gen);
	assert.match(header, /lbc_lab_work_start\(lbc_lab_callback_uint32_to_uint32 v0, lbc_lab_work_handle \*out\)/u);
	assert.match(header, /lbc_lab_work_poll\(lbc_lab_work_handle h, int \*fd\)/u);
	assert.match(header, /lbc_lab_work_take\(lbc_lab_work_handle \*h, uint32_t \*out, lbc_lab_callback_error \*failure\)/u);
	assert.doesNotMatch([header, ...symbols].join("\n"), /lean_object|lb_c_private|work_(?:next|callbacks|fail|poison|arg_0|reply_0)\b/u);
	for(const options of [{ integerMode: "words" }, { rustCallbacks: true }, { cppCallbacks: true }, { cCallbacks: false }])
		assert.throws(() => generateCTaskExports({ ...gen, ...options }), /callback ABI/u);
	const plain = generateCTaskExports({ ...gen, entries: [{ ...entry, parameters: [] }] });
	assert.match(plain.header, /TASK_IO_ERROR/u); assert.doesNotMatch(plain.header, /CALLBACK_(?:TRAP|ERROR)/u);
	assert.doesNotMatch(plain.source, /LB_RETAINED_TASKS|task-host-callback.h/u);
	assert.ok(!generateOwnedWasmBroker().exports.some(name => name.startsWith("lean_bridge_native_retirement_")));
	const selection = { modules: ["Lab"]
		, exportModules: ["Lab"], taskExports: ["Lab.work"], exports: ["Lab.work"]
		, members: [], taskIOErrors: ["Lab.work"], cTaskCallbacks: true };
	const facts = { selection
		, component: { id: "lab@1.0.0", name: "lab", version: "1.0.0" }
		, metadata: { schemaVersion: 1, kind: "lean-bridge-host-export-metadata", leanVersion: "4.32.2", entries: [entry] } };
	const { api } = reconcileHostExports(facts);
	assert.deepEqual(api.declarations[0].failure.errors, ["error:TaskIO.Error", "error:CCallbackError"]);
	for(const wrongHost of ["cppTaskCallbacks", "rustTaskCallbacks", "pythonTaskCallbacks"])
	{
		assert.throws(() => reconcileHostExports({ ...facts, selection: { ...selection, [wrongHost]: true } }), /Ambiguous/u);
		assert.throws(() => reconcileHostExports({ ...facts, selection: { ...selection, cTaskCallbacks: false, [wrongHost]: true }
			, review: { source: canonicalJson(api) } }), /Reviewed API differs/u);
	}
	for(const path of ["package.json", "config/cli-package.v1.json", "nix/perl-engine-source-boundary.json"])
	{
		const record = JSON.parse(await readFile(path)); const files = record.files ?? record.includedFiles;
		for(const file of ["task-host-callback.h", "task-host-callback.mjs"]) assert.ok(files.includes("src/backends/c/" + file));
	}
});

const enabled = process.env.LEAN_BRIDGE_C_CALLBACK_TEST === "1", replay = process.env.LEAN_BRIDGE_C_CALLBACK_REPLAY;
test("the C11 compiler selection refuses unsupported replies, false terminal errors and callbacks without a scheduler", {
	skip: Boolean(replay) || !(enabled || process.env.LEAN_BRIDGE_C_CALLBACK_COMPILER_TEST === "1")
	, timeout: 240_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "c-callback-signatures-")); t.after(() => rm(root, { recursive: true, force: true }));
	await verifyNativeTaskRefusals(root, "c");
});
test("installed ordinary and reviewed C11 tasks service retained host callbacks through one borrowed descriptor", {
	skip: !enabled && !replay, timeout: 1_800_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "c-callbacks-")); t.after(() => rm(root, { recursive: true, force: true }));
	const release = resolve(replay ?? process.env.LEAN_BRIDGE_C_CALLBACK_EVIDENCE ?? join(root, "releases"));
	if(!replay)
	{
		await mkdir(release); await captureNativeCallbackClient(release, "c");
		await buildNativeCallbackPackages({ root, release, target: "c" });
	}
	const result = await runNativeCallbackInstall({ root, release, target: "c" }), record = join(release, "acceptance.json");
	if(replay)
	{
		assert.deepEqual(result, JSON.parse(await readFile(record)));
		const pinned = JSON.parse(await readFile("docs/evidence/c-retained-tasks-20261122.json"));
		assert.deepEqual(result.routes, pinned.releases); assert.equal(result.runtimeIdentity, pinned.runtimeIdentity);
		assert.deepEqual(result.clientSources, pinned.clientSources);
	}
	else await writeFile(record, canonicalJson(result), { flag: "wx" });
});
