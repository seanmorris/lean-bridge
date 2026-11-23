/** @file Build independent nominal resource packages and exercise their shared heap offline. */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import test from "node:test";
import {installedTaskHarness} from "./javascript-wasm-task-cli-harness.mjs";

test("installed pthread packages exchange compiler-authenticated leases across tasks, typed errors and cursors",{
	skip: process.env.LEAN_BRIDGE_JS_RESOURCE_CLI_TEST!=="1",timeout: 900000
},async t => {
	const fixtures=resolve("tests/fixtures/javascript-wasm-resource-tasks");
	try
{
		const {file,source,release,review,exercise,refuse,retain}=await installedTaskHarness(t,fixtures);
		const cfg=JSON.parse(await readFile(join(fixtures,file)));
		const depot=await source("Depot",cfg,"Depot",["Shared.lean"]);
		const peer=await source("Peer",{schemaVersion: 1,modules: ["Peer"],exports: ["Peer.bump"],resources: ["Shared.Ticket"],taskExports: ["Peer.bump"],targets: {npm: {name: "@example/lean-peer",version: "1.0.0"}}},"Depot",["Shared.lean"]);
		const ordinary=await release(depot,"ordinary"), other=await release(peer,"peer-release");
		const nominal=ir => ir.types.find(r => r.source.declaration==="Shared.Ticket").resource.kindId;
		assert.equal(nominal(ordinary.ir),nominal(other.ir)); assert.notEqual(ordinary.manifest.componentIdentity,other.manifest.componentIdentity);
		const ir=structuredClone(ordinary.ir);
		const {reviewed,reviewPath}=await review(depot,cfg,ir,"Reviewed lifetime contract for shared depot tickets.");
		assert.notEqual(reviewed.manifest.componentIdentity,ordinary.manifest.componentIdentity);
		for(const r of [ordinary,reviewed]) await exercise(r,other,["@example/lean-depot","@example/lean-peer"],43);
		const ticket=ir.types.find(x => x.name==="Ticket"), wrong="0".repeat(64);
		ticket.source.extensions["lean-bridge.dev/resource-identity"]=wrong; ticket.resource.kindId="resource:Shared.Ticket/"+wrong;
		await refuse(depot,reviewPath,ir);
		await retain(process.env.LEAN_BRIDGE_JS_TASK_RESOURCE_EVIDENCE,[ordinary,reviewed,other]);
} catch(error)
{
		t.diagnostic([error.details?.stderr,error.details?.stdout].filter(Boolean).join("\n").slice(-4400)); throw error;
}
});
