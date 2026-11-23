/** @file Exercise retained JavaScript callbacks from independently compiled and offline-installed packages. */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import test from "node:test";
import {installedTaskHarness} from "./javascript-wasm-task-cli-harness.mjs";
import {verifyLostTaskWorker} from "./javascript-wasm-task-worker-fault.mjs";

test("installed Lean workers call their owning JavaScript agent and release cancelled requests",{
	skip: process.env.LEAN_BRIDGE_JS_CALLBACK_CLI_TEST!=="1",timeout: 900000
},async t => {
	const fixtures=resolve("tests/fixtures/javascript-wasm-retained-tasks");
	try
{
		const {file,source,release,review,exercise,refuse,retain}=await installedTaskHarness(t,fixtures);
		const cfg=JSON.parse(await readFile(join(fixtures,file)));
		const peerCfg={schemaVersion: 1, modules: ["Echo"]
			, exports: ["Echo.twice","Echo.relay"], taskExports: ["Echo.relay"]
			, targets: {npm: {name: "@example/lean-echo",version: "1.0.0"}}};
		const relay=await source("Relay",cfg,"Relay"), peer=await source("Echo",peerCfg,"Relay");
		const ordinary=await release(relay,"ordinary"), other=await release(peer,"peer-release"), ir=structuredClone(ordinary.ir);
		const {reviewed,reviewPath}=await review(relay,cfg,ir,"Retained callbacks run on their JavaScript owner.");
		assert.notEqual(ordinary.manifest.componentIdentity,other.manifest.componentIdentity);
		assert.notEqual(ordinary.manifest.componentIdentity,reviewed.manifest.componentIdentity);
		// Preserve the exact verified inputs for replays, even if a host later fails.
		await retain(process.env.LEAN_BRIDGE_JS_TASK_CALLBACK_EVIDENCE,[ordinary,reviewed,other]);
		for(const r of [ordinary,reviewed])
{
			const installed=await exercise(r,other,["@example/lean-relay","@example/lean-echo"],78);
			await verifyLostTaskWorker(installed);
}
		ir.types.find(x => x.kind==="callback").callable.invocation="once";
		await refuse(relay,reviewPath,ir);
} catch(error)
{
		t.diagnostic([error.details?.stderr,error.details?.stdout].filter(Boolean).join("\n").slice(-4400)); throw error;
}
});
