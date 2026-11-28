/** @file Exercise pip or Cargo offline against one authenticated, compiled Ticket application. */
import assert from "node:assert/strict";
import {mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {projectOwnedNativeCFamily} from "../../src/build/owned-c-projection.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {projectApplicationPackage} from "./application-package-projection.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runIncomingConsumer} from "./native-incoming-consumers.mjs";

test("a newly projected Python wheel or Rust crate forwards the installed user's callback",async t=>{
	const env=process.env,target=env.LEAN_BRIDGE_FAMILY_APP_TARGET,route=env.LEAN_BRIDGE_FAMILY_APP_ROUTE;
	const root=env.LEAN_BRIDGE_FAMILY_APP_OUTPUT,handoff=env.LEAN_BRIDGE_FAMILY_APP_C,pin=env.LEAN_BRIDGE_FAMILY_APP_C_SHA256;
	assert.ok(["pypi","cargo"].includes(target)&&["ordinary","reviewed"].includes(route)&&root&&handoff&&pin);
	const leanPrefix=env.LEAN_BRIDGE_LEAN_PREFIX;assert.ok(leanPrefix);
	let dependencies,depRoot,dependenciesReceiptSha256;
	if(target==="cargo")
	{
		assert.ok(env.LEAN_BRIDGE_CARGO&&env.LEAN_BRIDGE_RUSTC&&env.LEAN_BRIDGE_FAMILY_APP_RUST_DEPS);
		depRoot=resolve(env.LEAN_BRIDGE_FAMILY_APP_RUST_DEPS);
		const manifest=await readFile(join(depRoot,"dependencies.json"));dependenciesReceiptSha256=sha256(manifest);
		assert.equal(dependenciesReceiptSha256,env.LEAN_BRIDGE_FAMILY_APP_RUST_DEPS_SHA256);
		dependencies=JSON.parse(manifest);assert.equal(dependencies.archive,"rust-dependencies.tar.gz");
		assert.equal(sha256(await readFile(join(depRoot,dependencies.archive))),dependencies.sha256);
	}
	else assert.ok(env.LEAN_BRIDGE_PYTHON);
	const work=await mkdtemp(join(tmpdir(),"family-forward-"));t.after(()=>rm(work,{recursive: true,force: true}));
	const project=o=>projectOwnedNativeCFamily({...o,targets: [target]
		, settings: {[target]: {name: "tariff-quotes",version: "1.0.0"}}
		, environment: {...o.environment,CARGO_NET_OFFLINE: "true",CARGO_BUILD_JOBS: "1"}});
	const replayPin=env.LEAN_BRIDGE_FAMILY_APP_REPLAY_SHA256;
	const {set,pkg,profile,row}=await projectApplicationPackage({work,root: join(root,target),handoff,pin,route,leanPrefix,target,project,replayPin,donorTarget: "c"});
	const checked=await runIncomingConsumer({app: join(work,"client"),handoff: set
		, env,sourceSha256: row.sourceSha256,route,pkg,profile,dependencies,depRoot
		, application: true,tickets: true});
	assert.equal(checked.componentSha256,row.componentSha256);
	const report={...row,...checked,target,...dependencies?{dependenciesReceiptSha256}:{}};
	await saveLakeFile(join(root,target),route+".json",canonicalJson(report));
	t.diagnostic(route+"/"+target+": "+row.receiptSha256);
});
