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

test("offline npm host objects survive tasks and cursor delivery in Node, page and module workers", {
	skip: process.env.LEAN_BRIDGE_JS_THREADED_HOST_TEST!=="1",timeout: 900000
},async t=>{
	const fixture="javascript-threaded-host",fixtures=resolve("tests/fixtures",fixture);
	try
{
		const h=await installedTaskHarness(t,fixtures),src=join(h.root,"workshop"),other=join(h.root,"peer");
		const {config}=await prepareThreadedHostProject(src);await prepareThreadedHostProject(other);
		const names=[config.targets.npm.name,"@example/threaded-host-peer"];
		for(const file of ["lakefile.toml","Workshop.lean",h.file])
{
			const path=join(other,file),source=await readFile(path,"utf8");
			await writeFile(path,source.replaceAll("Workshop","Peer").replaceAll("workshop", "peer").replace("@lean-bridge/peer-host-example",names[1]));
}
		await rename(join(other,"Workshop.lean"),join(other,"Peer.lean"));
		const ordinary=await h.release(src,"ordinary"),peer=await h.release(other,"peer-release");
		assert.notEqual(peer.manifest.componentIdentity,ordinary.manifest.componentIdentity);
		const {reviewed}=await h.review(src,config,structuredClone(ordinary.ir),"Reviewed application-owned task objects.");
		assert.notEqual(reviewed.manifest.componentIdentity,ordinary.manifest.componentIdentity);
		const runs={};
		for(const pkg of [ordinary,reviewed])
{
			assert.equal(await pkg.extract("host-imports.json"),await readFile(join(src,"lean-bridge.hosts.json"),"utf8"));
			const {consumer,node,worker,chromium}=await h.exercise(pkg,peer,names,36);
			const assembledDirectory=await bundleTaskWeb(consumer,{family: "host",fixture,names});
			const report=await runInstalledChromium({root: h.root,consumer,assembledDirectory,base,isolated: true,timeoutMs: 120000,evaluate: replayTaskWeb});
			assert.deepEqual(report,{worker: {checks: 36},page: {checks: 36},state: "closed",frames: 0,allocations: 0,pending: 0,nativeOwners: 0,notifications: 0});
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
				, command: "npm run test:javascript-threaded-host-installed"
				, sdkManifestSha256: ordinary.manifest.taskInputsSha256
				, runtimeIdentity: ordinary.manifest.runtimeIdentity
				, rejectedBeforePackaging: "Workshop.blocked reaches Task.get"
				, packages
				, runs};
			await writeFile(join(dest,"installed-evidence.json"),JSON.stringify(evidence,null,2)+"\n",{flag: "wx"});
}
} catch(error)
{t.diagnostic([error.details?.stderr,error.details?.stdout].filter(Boolean).join("\n").slice(-3800));throw error;}
});
