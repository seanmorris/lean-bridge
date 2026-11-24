/** @file Compile the JVM class-worker contract and challenge its selection, effects and ownership. */
import assert from "node:assert/strict";
import { appendFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { inspectLeanProject } from "../../src/analyze/lean-project.mjs";
import { elaboratedComponent } from "../../src/analyze/semantic-model.mjs";
import { taskWorkerInterface } from "../../src/analyze/host-export-model.mjs";
import { generateSyncWire } from "../../src/backends/c/sync-wire.mjs";
import { generateCTaskExports } from "../../src/backends/c/task-exports.mjs";
import { dotnetWorkerKinds } from "../../src/backends/dotnet/host-members.mjs";
import { jvmWorkerKinds } from "../../src/backends/jvm/host-members.mjs";
import { compileHostSources } from "../../src/build/host-elaboration.mjs";
import { openHostProjectSource } from "../../src/build/host-project-source.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { prepareJvmWorkerProject } from "./jvm-worker-project.mjs";

test("real JVM workers carry classes but cannot call their members on Lean threads", { timeout: 600000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "jvm-worker-source-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const project = join(root, "source"), cfg = await prepareJvmWorkerProject(project);
	const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const build = async () => {
		const inventory = await inspectLeanProject(project), component = elaboratedComponent(inventory.project);
		const source = await openHostProjectSource({ project, inventory, component, targets: ["maven"], leanPrefix });
		try
		{
			const app = await mkdtemp(join(root, "compile-")), { projectContract } = source;
			const args = { ...source, app, target: "maven", ir: projectContract.ir, environment: process.env };
			await assert.rejects(compileHostSources({ ...args, projectContract: { ...projectContract, hostImportsSource: projectContract.hostImportsSource + " " }
				, run: () => assert.fail("forged input reached the compiler") }), /captured host source/u);
			const run = (command, argv, cwd, env) => processBuildRunner.capture({ command, args: argv, cwd, env });
			const checked = await compileHostSources({ ...args, run });
			const kinds = jvmWorkerKinds(args.ir), entries = checked.entries.filter(e => e.delivery);
			const foreign = structuredClone(args.ir);
			for(const t of foreign.types) t.host.targets = ["dotnet"];
			assert.throws(() => jvmWorkerKinds(foreign));
			assert.notEqual(dotnetWorkerKinds(foreign)[0].hash, kinds[0].hash);
			const renamed = structuredClone(args.ir); renamed.component.id += ".other";
			assert.notEqual(jvmWorkerKinds(renamed)[0].hash, kinds[0].hash);
			const options = { name: "jvm-probe", modules: cfg.modules, entries, componentIdentity: sha256(canonicalJson(checked.api))
				, jvmDelivery: true, integerMode: "words", jvmHostKinds: kinds };
			const gen = generateCTaskExports(options), wire = generateSyncWire(gen.prefix, entries, { tasks: true, jvmHostKinds: kinds });
			assert.throws(() => generateCTaskExports({ ...options, dotnetDelivery: true }), /exclusive native JVM/u);
			assert.throws(() => generateSyncWire(gen.prefix, entries, { tasks: true, jvmHostKinds: kinds, wasmCallbacks: true }), /native JVM task wire/u);
			const box = "host:" + kinds[0].hash;
			assert.deepEqual(wire.methods.find(m => m.name === "relay").callbacks, [[1, box, box]]);
			assert.deepEqual(wire.methods.find(m => m.name === "outcome").result, ["uint32", box]);
			assert.equal(wire.methods.find(m => m.name === "boxes").terminal, box);
			assert.equal(wire.leases[0].type, box); assert.equal(wire.leases[0].host, true);
			await writeFile(join(app, "BridgeCAsync.lean"), gen.entryLean);
			await run(join(leanPrefix, "bin/lean"), ["-j1", "-c", "worker.c", "BridgeCAsync.lean"], app, checked.env);
			await writeFile(join(app, "entry-abi.c"), '#include "worker.c"\n' + gen.declarations + "\n");
			await run(process.env.CC ?? "cc", ["-std=gnu11", "-O0", "-fPIC", "-Werror=incompatible-pointer-types"
				, "-I" + join(leanPrefix, "include"), "-c", "entry-abi.c", "-o", "entry-abi.o"], app, checked.env);
			return checked;
		} finally
		{ await source.dispose(); }
	};
	const { api, evidence } = await build(), decl = n => api.declarations.find(d => d.source.declaration === n);
	assert.equal(evidence.selection.jvmTaskObjects, true);
	assert.throws(() => taskWorkerInterface(api, evidence), /JVM task object carriers/u);
	assert.equal(decl("Workshop.identity").resultMode, "value");
	assert.equal(decl("Jobs.relay").resultMode, "promise");
	const cb = api.types.find(t => t.id === decl("Jobs.relay").parameters[1].type.id).callable;
	assert.equal(cb.result.type.id, "host:meter.Box"); assert.equal(cb.result.ownership, "lease");
	assert.deepEqual(cb.failure.errors, ["error:JvmCallbackException"]);
	assert.equal(decl("Jobs.outcome").result.ownership, "lease");
	assert.equal(decl("Jobs.refuse").source.extensions["lean-bridge.dev/error-payload-site"].type.id, "host:meter.Box");
	assert.equal(decl("Jobs.boxes").source.extensions["lean-bridge.dev/step-error-payload-site"].ownership, "lease");
	assert.equal(decl("Jobs.ioBoxes").source.extensions["lean-bridge.dev/step-failure"], "IO.Error");
	const review = join(project, "public.binding-ir.json"), file = join(project, "lean-bridge.exports.json");
	await writeFile(review, canonicalJson(api)); delete cfg.exports; await writeFile(file, canonicalJson(cfg));
	assert.deepEqual((await build()).api, api);
	await rm(review);
	cfg.exports = ["Jobs.forbidden"]; cfg.taskExports = cfg.exports; delete cfg.taskIOErrors; delete cfg.asyncIterators;
	await appendFile(join(project, "Jobs.lean"), "\nprivate def member (b : LeanBridge.Host.Jvm.Box) := b.read\ndef Jobs.forbidden (b : LeanBridge.Host.Jvm.Box) := IO.asTask (member b)\n");
	await writeFile(file, canonicalJson(cfg));
	await assert.rejects(build(), /JVM task calls a JVM member outside its owner: Jobs\.forbidden/u);
	t.diagnostic("ordinary/reviewed JVM worker IR: " + sha256(canonicalJson(api)));
});
