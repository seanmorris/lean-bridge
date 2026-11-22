/**
 * Accept real installed C++ callback packages, or replay the exact original archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { reconcileHostExports } from "../../src/analyze/host-export-model.mjs";
import { generateCTaskExports } from "../../src/backends/c/task-exports.mjs";
import { generateCppTaskHeader } from "../../src/backends/cpp/task-exports.mjs";
import { compileHostSources } from "../../src/build/host-elaboration.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { buildCppCallbackPackages } from "./cpp-retained-task-packages.mjs";
import { captureCppCallbackClient, runCppCallbackInstall } from "./cpp-retained-task-install.mjs";

test("C++ retained callbacks require a checked C++ scheduler, exact exception policy and packaged support", async () => {
	for(const f of ["package.json", "config/cli-package.v1.json", "nix/perl-engine-source-boundary.json"])
	{
		const record = JSON.parse(await readFile(f)), paths = record.files ?? record.includedFiles;
		for(const name of ["cpp/task-callback.hpp", "cpp/task-callback.mjs", "native/task-callback-queue.h", "c/task-callback-port.h"])
			assert.ok(paths.includes("src/backends/" + name), f + ": " + name);
	}
	const scalar = { kind: "primitive", name: "uint32" }, callback = { kind: "io-callback", argument: scalar, reply: scalar };
	const entry = { name: "invoke", declaration: "Lab.invoke", module: "Lab"
		, effect: "BaseIO", delivery: "task", taskIO: true
		, parameters: [{ name: "f", type: callback }]
		, result: scalar, hostMembers: [] };
	const selection = { cppTaskCallbacks: true, modules: ["Lab"]
		, exportModules: ["Lab"], members: [], exports: [entry.declaration]
		, taskExports: [entry.declaration], taskIOErrors: [entry.declaration] };
	const facts = { ir: null, selection
		, component: { id: "lab@1.0.0", name: "lab", version: "1.0.0" }
		, metadata: { kind: "lean-bridge-host-export-metadata", schemaVersion: 1, leanVersion: "4.32.2", entries: [entry] } };
	const { api } = reconcileHostExports(facts);
	assert.deepEqual(api.declarations[0].failure.errors, ["error:TaskIO.Error", "error:CppCallbackException"]);
	for(const change of [
		v => { v.types[0].callable.selfDisposal = "reject"; }
		, v => { v.declarations[0].parameters[0].ownership = "borrow"; v.declarations[0].parameters[0].lifetime.scope = "call"; }
		, v => { delete v.declarations[0].source.extensions["lean-bridge.dev/task-failure"]; }
	]) {
		const changed = structuredClone(api); change(changed);
		assert.throws(() => reconcileHostExports({ ...facts, review: { source: canonicalJson(changed) } }), /Reviewed API differs/u);
	}
	for(const host of [{ rustTaskCallbacks: true }, { pythonTaskCallbacks: true }])
	{
		assert.throws(() => reconcileHostExports({ ...facts, selection: { ...selection, ...host } }), /Ambiguous/u);
		assert.throws(() => reconcileHostExports({ ...facts, selection: { ...selection, cppTaskCallbacks: false, ...host }
			, review: { source: canonicalJson(api) } }), /Reviewed API differs/u);
	}
	const plain = { ...entry, parameters: [] }, options = { name: "lab", prefix: "lbc_lab", modules: ["Lab"], entries: [entry], componentIdentity: "a".repeat(64) };
	for(const config of [{}, { cppCallbacks: true, integerMode: "gmp" }, { cppCallbacks: true, rustCallbacks: true, integerMode: "words" }])
		assert.throws(() => generateCTaskExports({ ...options, ...config }), /callback ABI/u);
	assert.match(generateCppTaskHeader(options), /Future<std::uint32_t> invoke\(RetainedCallback<std::uint32_t\(std::uint32_t\)> v0\)/u);
	const regular = generateCppTaskHeader({ ...options, entries: [plain] });
	assert.match(regular, /throw TaskIOError/u); assert.doesNotMatch(regular, /task-callback.hpp|callback_trap/u);
});

const replay = process.env.LEAN_BRIDGE_CPP_CALLBACK_REPLAY, enabled = process.env.LEAN_BRIDGE_CPP_CALLBACK_TEST === "1";
test("the C++ compiler selection refuses unsupported replies, false terminal errors and callbacks without a scheduler", {
	skip: Boolean(replay) || !(enabled || process.env.LEAN_BRIDGE_CPP_CALLBACK_COMPILER_TEST === "1")
	, timeout: 240_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "cpp-callback-signatures-")); t.after(() => rm(root, { recursive: true, force: true }));
	const source = `namespace Bad
def reply (_ : UInt32 → IO (Array UInt32)) : Task UInt32 := Task.pure 0
def wrong : Task (Except String Nat) := Task.pure (.ok 1)
def retained (_ : Nat → IO Nat) : Task Nat := Task.pure 1
end Bad`;
	const invalid = [["Bad.reply", "cpp", /must be copied scalars/u]
		, ["Bad.wrong", "cpp", /taskIOErrors requires Task/u]
		, ["Bad.retained", undefined, /unsupported .*carrier/u]];
	for(const [name, target, pattern] of invalid)
	{
		const compile = compileHostSources({ app: await mkdtemp(join(root, "source-"))
			, ir: null, target
			, leanPrefix: resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
			, environment: { ...process.env, LEAN_NUM_THREADS: "1" }
			, sources: [{ module: "Bad", source }]
			, projectContract: { modules: ["Bad"], exports: [name], taskExports: [name], ...name === "Bad.wrong" ? { taskIOErrors: [name] } : {} }
			, run: (command, args, cwd, env) => processBuildRunner.capture({ command, args, cwd, env }) });
		await assert.rejects(compile, e => {
			assert.match([e.message, e.details?.stdout, e.details?.stderr].join("\n"), pattern); return true;
		});
	}
});
test("installed ordinary and reviewed C++ tasks run retained host closures on their main dispatcher", {
	skip: !enabled && !replay, timeout: 1_800_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "cpp-callbacks-")); t.after(() => rm(root, { recursive: true, force: true }));
	const release = resolve(replay ?? process.env.LEAN_BRIDGE_CPP_CALLBACK_EVIDENCE ?? join(root, "releases"));
	if(!replay)
	{
		await mkdir(release); await captureCppCallbackClient(release);
		await buildCppCallbackPackages({ root, release });
	}
	const result = await runCppCallbackInstall({ root, release }), record = join(release, "acceptance.json");
	if(replay) assert.deepEqual(result, JSON.parse(await readFile(record)));
	else await writeFile(record, canonicalJson(result), { flag: "wx" });
	t.diagnostic("Both relocated executables passed normal, retirement, non-standard exception and shutdown checks.");
});
