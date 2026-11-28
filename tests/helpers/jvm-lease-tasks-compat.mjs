/**
 * Compare the current generator to previously accepted, original Maven JARs without rebuilding old commits.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { reconcileHostExports } from "../../src/analyze/host-export-model.mjs";
import { generateSyncWire } from "../../src/backends/c/sync-wire.mjs";
import { generateJvmIO } from "../../src/backends/jvm/sync-io.mjs";
import { jvmIOEntry } from "../../src/build/jvm-io-owner.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { verifyLeaseModel } from "./native-lease-project.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

const env = process.env, output = env.LEAN_BRIDGE_JVM_LEASE_TASK_COMPAT;
const json = async f => JSON.parse(await readFile(f, "utf8"));
test("copied tasks, retained callbacks and synchronous resource Maven profiles retain their original generated files", { skip: !output, timeout: 600_000 }, async () => {
	const routes = [["jvm-tasks-20261123", env.LEAN_BRIDGE_JVM_PRIOR_TASK]
		, ["jvm-retained-tasks-20261123", env.LEAN_BRIDGE_JVM_PRIOR_CALLBACK]
		, ["jvm-sync-resources-20261123", env.LEAN_BRIDGE_JVM_LEASE_TASK_SYNC]];
	const notes = [];
	for(const [pin, root] of routes)
	{
		const prior = (await json("docs/evidence/" + pin + ".json")).installed.packages.find(p => p.route === "ordinary");
		const dir = join(resolve(root), "ordinary/handoff");
		const { receipt, result } = await readVerifiedPackageSetReceipt({ receiptPath: join(dir, "package-set-receipt.json") });
		assert.equal(result.receiptSha256, prior.receiptSha256);
		const jar = join(dir, receipt.packages[0].artifacts.find(a => a.path.endsWith(".jar")).path);
		const r = JSON.parse(await run("unzip", ["-p", jar, "META-INF/lean-bridge/package-receipt.json"], dir, env));
		const api = await json(join(dir, "binding-ir.json")), evidence = await json(join(dir, "host-export-evidence.json"));
		const resources = api.types.filter(t => t.kind === "resource"), tasks = r.profile === "native-jvm-task-v1";
		const model = resources.length ? verifyLeaseModel(api, evidence, false) : reconcileHostExports({ ...evidence, ir: null, component: api.component });
		const p = "lbc_jvm_" + sha256(r.name), library = "lib" + p + ".so"; assert.ok(r.libraries[library]);
		const auth = { library, libraries: r.libraries, runtimeIdentity: r.runtimeIdentity, componentId: r.component.id, componentReceiptSha256: r.componentIdentity, ...r.ledger ? { ledgerId: r.ledger.id } : {} };
		const wire = generateSyncWire(p, model.entries, { tasks, resources });
		const entry = jvmIOEntry(wire, p, tasks && await readFile("src/backends/jvm/task-reactor.c"));
		const { files } = await generateJvmIO({ api, wire, ...entry, evidence: auth });
		const prefix = "META-INF/lean-bridge/generated/", original = Object.keys(r.files).filter(n => n.startsWith(prefix)).map(n => n.slice(prefix.length)).sort();
		assert.deepEqual(Object.keys(files).sort(), original);
		for(const f of original) assert.equal(sha256(files[f]), r.files[prefix + f].sha256, pin + ": " + f);
		notes.push({ name: r.name, receiptSha256: prior.receiptSha256, generatedFiles: original.length });
	}
	await writeFile(resolve(output), canonicalJson(notes), { flag: "wx" });
});
