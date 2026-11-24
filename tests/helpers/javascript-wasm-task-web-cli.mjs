/** @file Deploy installed task packages in a page and an independent module worker. */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {base,bundleTaskWeb as bundle,replayTaskWeb as replay} from "./javascript-wasm-task-web-bundle.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { packageSetReceiptName, readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { runInstalledChromium } from "./javascript-wasm-installed-browser.mjs";

const cases = [
	{ family: "callback", names: ["@example/lean-relay", "@example/lean-echo"]
		, fixture: "javascript-wasm-retained-tasks", script: "callback"
		, releases: process.env.LEAN_BRIDGE_JS_TASK_WEB_RELEASES
		, enabled: "LEAN_BRIDGE_JS_CALLBACK_CLI_TEST"
		, archive: "LEAN_BRIDGE_JS_TASK_CALLBACK_EVIDENCE"
		, expected: { checks: 78 } }
	, { family: "resource", names: ["@example/lean-depot", "@example/lean-peer"]
		, fixture: "javascript-wasm-resource-tasks", script: "resource"
		, releases: process.env.LEAN_BRIDGE_JS_TASK_WEB_RESOURCES
		, enabled: "LEAN_BRIDGE_JS_RESOURCE_CLI_TEST"
		, archive: "LEAN_BRIDGE_JS_TASK_RESOURCE_EVIDENCE"
		, expected: { checks: 43, earlyBreak: true, exhausted: 1, cursorCloses: 2 } }
];

const receiptsFor = async (t, root, spec) => {
	if(spec.releases) return resolve(spec.releases);
	assert.ok(process.env.LEAN_BRIDGE_TEST_TASK_INPUTS, "Supply a threaded author kit or the retained " + spec.family + " handoffs");
	const dest = join(root, spec.family + "-handoffs");
	const env = { ...process.env, [spec.enabled]: "1", [spec.archive]: dest };
	delete env.NODE_TEST_CONTEXT;
	const file = "tests/helpers/javascript-wasm-task-" + spec.script + "-cli.mjs";
	try
	{ await processBuildRunner.capture({ command: process.execPath, env, cwd: resolve("."), args: ["--test", "--test-concurrency=1", file] }); }
	catch(error)
	{ t.diagnostic(error.details?.stdout?.slice(-2200) ?? error.message); throw error; }
	return dest;
};

const handoff = async (root, label) => {
	const dir = join(root, label, "packages/npm");
	const { receipt } = await readVerifiedPackageSetReceipt({ receiptPath: join(dir, packageSetReceiptName) });
	const file = role => join(dir, receipt.packages.find(p => p.role === role).artifacts[0].path);
	return { component: file("component"), runtime: file("runtime") };
};

const unisolated = async () => {
	try
	{ await globalThis.runInstalledWorker(); return "unexpected success"; }
	catch(error)
	{ return error.message; }
};

const runDeployment = async (t, root, spec, receipts, label) => {
	const consumer = join(root, spec.family + "-" + label); await mkdir(consumer);
	const pkg = await handoff(receipts, label), peer = await handoff(receipts, "peer-release");
	assert.deepEqual(await readFile(pkg.runtime), await readFile(peer.runtime));
	await writeFile(join(consumer, "package.json"), '{"private":true,"type":"module"}');
	const args = ["install", "--offline", "--ignore-scripts", "--no-audit"
		, "--no-fund", "--cache", join(root, "cache")
		, pkg.runtime, pkg.component, peer.component];
	await processBuildRunner.capture({ command: "npm", cwd: consumer, args });
	const assembledDirectory = await bundle(consumer, spec);
	await rm(join(consumer, "node_modules"), { recursive: true });
	const preview = { root, consumer, assembledDirectory, base, timeoutMs: 100000 };
	const result = await runInstalledChromium({ ...preview, isolated: true, evaluate: replay });
	assert.deepEqual(result, { value: 42, worker: spec.expected, state: "closed"
		, frames: 0, allocations: 0, pending: 0, nativeOwners: 0, notifications: 0 });
	const refusal = await runInstalledChromium({ ...preview, isolated: false, evaluate: unisolated });
	assert.match(refusal, /cross-origin isolation/u);
	t.diagnostic(JSON.stringify({ family: spec.family, label, base, result, refusal }));
};

test("offline task and iterator packages deploy under a nested base in independent heaps", {
	skip: !cases.some(s => s.releases) && process.env.LEAN_BRIDGE_JS_TASK_WEB_TEST !== "1"
	, timeout: 2400000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "task-web-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	for(const spec of cases)
	{
		const receipts = await receiptsFor(t, root, spec);
		for(const label of ["ordinary", "reviewed"])
			await t.test(spec.family + " " + label, child => runDeployment(child, root, spec, receipts, label));
	}
});
