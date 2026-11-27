/** @file Rebuild the actual Ruby binding without recompiling or replacing the donor Lean release. */
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {projectOwnedRuby} from "../../src/build/owned-ruby-projection.mjs";
import {canonicalJson} from "../../src/capsule/node.mjs";
import {projectApplicationWheel} from "./application-wheel-projection.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runIncomingConsumer} from "./native-incoming-consumers.mjs";

test("a newly installed Ruby projection forwards a host function without losing its synchronous guard",async t=>{
	const env=process.env,root=env.LEAN_BRIDGE_RUBY_APP_OUTPUT,route=env.LEAN_BRIDGE_RUBY_APP_ROUTE;
	const handoff=env.LEAN_BRIDGE_RUBY_APP_WHEEL,pin=env.LEAN_BRIDGE_RUBY_APP_WHEEL_SHA256,leanPrefix=env.LEAN_BRIDGE_LEAN_PREFIX;
	assert.ok(root&&["ordinary","reviewed"].includes(route)&&handoff&&pin&&leanPrefix&&env.LEAN_BRIDGE_RUBY);
	const work=await mkdtemp(join(tmpdir(),"ruby-forward-"));t.after(()=>rm(work,{recursive: true,force: true}));
	const project=async o=>[await projectOwnedRuby({...o,settings: {name: "tariff-quotes",version: "1.0.0"}})];
	const replayPin=env.LEAN_BRIDGE_RUBY_APP_REPLAY_SHA256;
	const {set,pkg,profile,row}=await projectApplicationWheel({work,root,handoff,pin,route,leanPrefix,target: "rubygems",project,replayPin});
	const checked=await runIncomingConsumer({app: join(work,"app"),handoff: set,env,sourceSha256: row.sourceSha256,route,pkg,profile,application: true});
	assert.equal(checked.componentSha256,row.componentSha256);
	await saveLakeFile(root,route+".json",canonicalJson({...row,...checked}));
	t.diagnostic(route+": "+row.receiptSha256);
});
