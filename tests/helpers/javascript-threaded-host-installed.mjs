/** @file Build ordinary and review-only host packages with an offline installed CLI, then consume them in real heaps. */
import assert from "node:assert/strict";
import {access,readFile,rename,writeFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import test from "node:test";
import {sha256} from "../../src/capsule/node.mjs";
import {packageSetReceiptName} from "../../src/release/package-set-receipt.mjs";
import {installedTaskHarness} from "./javascript-wasm-task-cli-harness.mjs";
import {prepareThreadedHostProject} from "./javascript-threaded-host-source.mjs";
import {base,bundleTaskWeb,replayTaskWeb} from "./javascript-wasm-task-web-bundle.mjs";
import {runInstalledChromium} from "./javascript-wasm-installed-browser.mjs";
import {javaScriptTaskAbi} from "../../src/abi/javascript-wasm-tasks.mjs";

const ports=process.env.LEAN_BRIDGE_JS_NOMINAL_CALLBACK_TEST==="1";
const functions=process.env.LEAN_BRIDGE_TEST_JS_FUNCTIONS==="1";
test(functions?"offline worker functions retain their original objects across callbacks and cancellation":ports?"offline npm retained callbacks transport application objects in both directions":"offline npm host objects survive tasks and cursor delivery in Node, page and module workers", {
	skip: !functions && !ports && process.env.LEAN_BRIDGE_JS_THREADED_HOST_TEST!=="1"
	, timeout: 1200000
},async t=>{
	const baseFixture="javascript-threaded-host",fixture=functions?baseFixture+"-functions":ports?baseFixture+"-callbacks":baseFixture,fixtures=resolve("tests/fixtures",fixture),checks=functions?25:ports?25:36;
	try
{
		const h=await installedTaskHarness(t,fixtures),src=join(h.root,"workshop"),other=join(h.root,"peer");
		const {config}=await prepareThreadedHostProject(src,fixture);await prepareThreadedHostProject(other,fixture);
		const names=[config.targets.npm.name,"@example/threaded-host-peer"];
		for(const file of ["lakefile.toml","Workshop.lean",h.file])
{
			const path=join(other,file),source=await readFile(path,"utf8");
			await writeFile(path,source.replaceAll("Workshop","Peer").replaceAll("workshop", "peer").replace("@lean-bridge/peer-host-example",names[1]));
}
		await rename(join(other,"Workshop.lean"),join(other,"Peer.lean"));
		const ordinary=await h.release(src,"ordinary"),peer=await h.release(other,"peer-release");
		assert.notEqual(peer.manifest.componentIdentity,ordinary.manifest.componentIdentity);
		if(ports && !functions)
{
			const hosts=JSON.parse(await ordinary.extract("host-imports.json")),identity=ordinary.manifest.componentIdentity;
			const abi=javaScriptTaskAbi(ordinary.ir,identity,hosts),type=abi.hostKinds[0].type;
			assert.deepEqual(abi.methods.find(m=>m.name==="relay_box").callbacks,[[1,type,type],[2,type,type]]);
			for(const mutate of [
				c=>{c.parameters[0].mutability="immutable";}
				, c=>{Object.assign(c.result,{ownership: "copy",lifetime: null});}
				, c=>{c.parameters[0].type.id="host:unknown";}
				, c=>{c.result.type={kind: "primitive",name: "uint32"};}
			]) {
				const bad=structuredClone(ordinary.ir);
				mutate(bad.types.find(t=>t.kind==="callback" && t.callable.parameters[0].type.kind==="named" && t.callable.result.type.kind==="named").callable);
				assert.throws(()=>javaScriptTaskAbi(bad,identity,hosts));
			}
}
		const {reviewed}=await h.review(src,config,structuredClone(ordinary.ir),"Reviewed application-owned task objects.");
		if(functions) for(const p of [ordinary,reviewed,peer])
			t.diagnostic(p.label+" worker package-set receipt "+sha256(await readFile(join(p.out,"packages/npm",packageSetReceiptName))));
		assert.notEqual(reviewed.manifest.componentIdentity,ordinary.manifest.componentIdentity);
		const runs={};
		for(const pkg of [ordinary,reviewed])
{
			assert.equal(await pkg.extract("host-imports.json"),await readFile(join(src,"lean-bridge.hosts.json"),"utf8"));
			const {consumer,node,worker,chromium}=await h.exercise(pkg,peer,names,checks,resolve("tests/fixtures",baseFixture));
			const assembledDirectory=await bundleTaskWeb(consumer,{family: "host",fixture,names});
			const report=await runInstalledChromium({root: h.root,consumer,assembledDirectory,base,isolated: true,timeoutMs: 120000,evaluate: replayTaskWeb});
			assert.deepEqual(report,{worker: {checks},page: {checks},state: "closed",frames: 0,allocations: 0,pending: 0,nativeOwners: 0,notifications: 0});
			t.diagnostic(JSON.stringify({mode: pkg.label,hostWorkerDeployment: report}));
			runs[pkg.label]={node,nodeModuleWorker: worker,chromium,chromiumDeployment: report};
}
		const blocked=join(h.root,"blocked"),out=join(h.root,"refused");const bad=await prepareThreadedHostProject(blocked);
		const lean=join(blocked,"Workshop.lean");
		await writeFile(lean,(await readFile(lean,"utf8")).replace("end Workshop",
			"def blocked (b : Box) : IO UInt32 := do\n  let t ← BaseIO.asTask b.read.toBaseIO\n  match t.get with\n  | .ok v => return v\n  | .error e => throw e\nend Workshop"));
		bad.config.exports.push("Workshop.blocked");await writeFile(join(blocked,h.file),JSON.stringify(bad.config));
		await assert.rejects(h.build(blocked,out),error=>{
			assert.match(JSON.parse(error.details.stdout).diagnostics.map(d=>d.message).join("\n"),/Workshop.blocked reaches Task.get .*can block the JavaScript host owner/u);
			return true;
		});
		await assert.rejects(access(out),{code: "ENOENT"});
		const dest=process.env.LEAN_BRIDGE_JS_THREADED_HOST_EVIDENCE;
		if(dest)
{
			const builds=[ordinary,reviewed,peer],packages={};
			await h.retain(dest,builds);
			for(const {label,manifest,out} of builds)
{
				const handoff=join(out,"packages/npm"),path=join(handoff,packageSetReceiptName);
				packages[label]={componentIdentity: manifest.componentIdentity
					, bindingIrSha256: manifest.bindingIrSha256
					, sourceTreeSha256: manifest.source.treeSha256
					, receiptSha256: sha256(await readFile(path))
					, artifacts: manifest.packages.map(p=>({role: p.role,name: p.name,...p.artifacts[0]}))};
}
			const evidence={schemaVersion: 1,profile: ordinary.manifest.profile
				, command: functions?"npm run test:javascript-threaded-host-functions":ports?"npm run test:javascript-threaded-host-callbacks":"npm run test:javascript-threaded-host-installed"
				, sdkManifestSha256: ordinary.manifest.taskInputsSha256
				, runtimeIdentity: ordinary.manifest.runtimeIdentity
				, rejectedBeforePackaging: "Workshop.blocked reaches Task.get"
				, packages
				, runs};
			await writeFile(join(dest,"installed-evidence.json"),JSON.stringify(evidence,null,2)+"\n",{flag: "wx"});
}
} catch(error)
{
	let detail=error.details?.stdout;
	if(detail)
{
		try
{const report=JSON.parse(detail);if(report.diagnostics?.length) detail=JSON.stringify(report.diagnostics);}
		catch { /* A consumer can write plain text rather than CLI JSON. */ }
}
	t.diagnostic([detail,error.details?.stderr].filter(Boolean).join("\n").slice(-3800));throw error;
}
});
