/** @file Install a Composer release built from the authenticated C handoff's Lean component. */
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {projectOwnedPhp} from "../../src/build/owned-php-projection.mjs";
import {canonicalJson} from "../../src/capsule/node.mjs";
import {projectApplicationPackage} from "./application-package-projection.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runInstalledPhpApplication} from "./php-application-client.mjs";

test("the Composer projection forwards host functions and returns distinct Tickets from the original Lean component",async t=>{
	const env=process.env,root=env.LEAN_BRIDGE_PHP_APP_OUTPUT,route=env.LEAN_BRIDGE_PHP_APP_ROUTE;
	const handoff=env.LEAN_BRIDGE_PHP_APP_C,pin=env.LEAN_BRIDGE_PHP_APP_C_SHA256,leanPrefix=env.LEAN_BRIDGE_LEAN_PREFIX;
	assert.ok(root&&["ordinary","reviewed"].includes(route)&&handoff&&pin&&leanPrefix);
	const work=await mkdtemp(join(tmpdir(),"php-forward-"));t.after(()=>rm(work,{recursive: true,force: true}));
	const project=async o=>[await projectOwnedPhp({...o,settings: {name: "example/tariff-quotes",version: "1.0.0"}})];
	const replayPin=env.LEAN_BRIDGE_PHP_APP_REPLAY_SHA256,target="php-native",donorTarget="c";
	const {set,pkg,profile,row}=await projectApplicationPackage({work,root,handoff,pin,route,leanPrefix,target,project,replayPin,donorTarget});
	const checked=await runInstalledPhpApplication({root: join(work,"client"),env,route,handoff: set,pkg,profile});
	assert.equal(checked.componentSha256,row.componentSha256);assert.equal(checked.leanSourceSha256,row.sourceSha256);
	assert.equal(checked.runtimeIdentity,row.runtimeIdentity);assert.deepEqual(checked.artifacts,[row.archive]);
	await saveLakeFile(root,route+".json",canonicalJson({...row,...checked}));
	t.diagnostic(route+": "+row.receiptSha256);
});
