/** @file Build independent nominal resource packages with the installed CLI and exercise their shared heap offline. */
import assert from "node:assert/strict";
import {access,copyFile,cp,mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {createRequire} from "node:module";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {processBuildRunner} from "../../src/build/process-runner.mjs";
import {readTaskInputs} from "../../src/release/javascript-wasm-task-inputs.mjs";
import {packageSetReceiptName,readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runInstalledChromium} from "./javascript-wasm-installed-browser.mjs";

test("installed pthread packages exchange compiler-authenticated leases across tasks, typed errors and cursors",{
	skip: process.env.LEAN_BRIDGE_JS_RESOURCE_CLI_TEST!=="1",timeout: 900000
},async t => {
	const kit=process.env.LEAN_BRIDGE_TEST_TASK_INPUTS,{identity}=await readTaskInputs(kit);
	const root=await mkdtemp(join(tmpdir(),"task-resource-cli-")); t.after(() => rm(root,{recursive: true,force: true}));
	const fixtures=resolve("tests/fixtures/javascript-wasm-resource-tasks"), feed=join(root,"feed");
	const author=join(root,"author"), cli=join(author,"node_modules/.bin/lean-bridge");
	const environment={...process.env,LEAN_BRIDGE_JS_TASK_INPUTS_SHA256: identity};
	for(const k of ["NODE_TEST_CONTEXT","NODE_PATH","LEAN_BRIDGE_TEST_TASK_INPUTS","LEAN_BRIDGE_JS_TASK_INPUTS","LEAN_BRIDGE_RUNTIME_ROOT","LEAN_BRIDGE_JS_INPUTS","LEAN_BRIDGE_JS_TARGET_RUNTIME","LEAN_BRIDGE_JS_THREAD_CORE","LEAN_BRIDGE_JS_THREAD_INIT"]) delete environment[k];
	const run=(command,args,cwd=root,timeoutMs) => processBuildRunner.capture({command,args,cwd,env: environment,timeoutMs});
	const install=(dest,archives) => run("npm",["install","--prefix",dest,"--offline","--ignore-scripts","--no-audit","--no-fund","--cache",dest+"-cache",...archives]);
	const file="lean-bridge.exports.json", source=async (module,cfg) => {
		const dir=join(root,module); await mkdir(dir);
		for(const name of ["Shared.lean",module+".lean","lean-toolchain"]) await copyFile(join(fixtures,name),join(dir,name));
		const lake=await readFile(join(fixtures,"lakefile.toml"),"utf8");
		await writeFile(join(dir,"lakefile.toml"),lake.replace('"Depot"','"'+module+'"').replace('"depot"','"'+module.toLowerCase()+'"'));
		await writeFile(join(dir,file),JSON.stringify(cfg)); return dir;
	};
	const build=(dir,out) => run(process.execPath,[cli,"build","--project",dir,"--target","npm","--output",out,"--json","--progress","none"]);
	const release=async (dir,label) => {
		const out=join(root,label); await build(dir,out);
		await run(process.execPath,[cli,"verify","--receipt",join(out,packageSetReceiptName)]);
		const handoff=join(out,"packages/npm"), {receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(handoff,packageSetReceiptName)});
		const manifest=JSON.parse(await readFile(join(out,"javascript-wasm-task-release.json")));
		assert.equal(manifest.taskInputsSha256,identity);
		const artifact=role => join(handoff,receipt.packages.find(p => p.role===role).artifacts[0].path);
		const extract=name => run("tar",["-xzOf",artifact("component"),"package/metadata/"+name]).then(r => r.stdout);
		const ir=JSON.parse(await extract("binding-ir.json"));
		return {out,label,artifact,extract,ir,manifest};
	};
	try
{
		const pack=JSON.parse((await run(process.execPath,[resolve("scripts/build-cli-npm-package.mjs"),"--output",feed,"--javascript-task-inputs",kit])).stdout);
		assert.equal(pack.javascriptTaskInputsIncluded,true); await install(author,[join(feed,pack.archive.path)]);
		const cfg=JSON.parse(await readFile(join(fixtures,file)));
		const depot=await source("Depot",cfg), peer=await source("Peer",{schemaVersion: 1,modules: ["Peer"],exports: ["Peer.bump"],resources: ["Shared.Ticket"],taskExports: ["Peer.bump"],targets: {npm: {name: "@example/lean-peer",version: "1.0.0"}}});
		const ordinary=await release(depot,"ordinary"), other=await release(peer,"peer-release");
		const nominal=ir => ir.types.find(r => r.source.declaration==="Shared.Ticket").resource.kindId;
		assert.equal(nominal(ordinary.ir),nominal(other.ir)); assert.notEqual(ordinary.manifest.componentIdentity,other.manifest.componentIdentity);
		const ir=structuredClone(ordinary.ir); ir.documentation.summary="Reviewed lifetime contract for shared depot tickets.";
		const reviewText=JSON.stringify(ir,null,4)+"\n", reviewPath=join(depot,"depot.binding-ir.json");
		delete cfg.exports; await writeFile(join(depot,file),JSON.stringify(cfg)); await writeFile(reviewPath,reviewText);
		const reviewed=await release(depot,"reviewed");
		assert.equal(await reviewed.extract("review.binding-ir.json"),reviewText);
		assert.notEqual(reviewed.manifest.componentIdentity,ordinary.manifest.componentIdentity);
		for(const r of [ordinary,reviewed])
{
			assert.deepEqual(await readFile(r.artifact("runtime")),await readFile(other.artifact("runtime")));
			const consumer=join(root,r.label+"-consumer"); await mkdir(consumer);
			await writeFile(join(consumer,"package.json"),'{"private":true,"type":"module"}');
			await install(consumer,[r.artifact("runtime"),r.artifact("component"),other.artifact("component")]);
			for(const name of ["calls.mjs","calls.mts","worker.mjs"]) await copyFile(join(fixtures,name),join(consumer,name));
			await writeFile(join(consumer,"tsconfig.json"),JSON.stringify({files: ["calls.mts"],compilerOptions: {strict: true,noEmit: true,module: "NodeNext",target: "ES2022",types: []}}));
			await run(process.execPath,[createRequire(import.meta.url).resolve("typescript/bin/tsc"),"--project","tsconfig.json"],consumer);
			await writeFile(join(consumer,"run.mjs"),'import {exercise} from "./calls.mjs"; console.log(JSON.stringify(await exercise()));\n');
			const node=JSON.parse((await run(process.execPath,["run.mjs"],consumer,60000)).stdout);
			assert.equal(node.checks,43);
			const worker=JSON.parse((await run(process.execPath,["worker.mjs"],consumer,60000)).stdout);
			assert.deepEqual(worker,node);
			const chromium=await runInstalledChromium({root,consumer,names: ["@example/lean-depot","@example/lean-peer"],isolated: true,timeoutMs: 60000,evaluate: async () => (await import("/calls.mjs")).exercise()});
			assert.deepEqual(chromium,node); t.diagnostic(JSON.stringify({mode: r.label,node,worker,chromium,nominal: nominal(r.ir)}));
}
		const ticket=ir.types.find(x => x.name==="Ticket"), wrong="0".repeat(64);
		ticket.source.extensions["lean-bridge.dev/resource-identity"]=wrong; ticket.resource.kindId="resource:Shared.Ticket/"+wrong;
		await writeFile(reviewPath,JSON.stringify(ir)); const refused=join(root,"wrong-review");
		await assert.rejects(build(depot,refused),error => {
			const report=JSON.parse(error.details.stdout);
			assert.equal(report.status,"failed");
			assert.ok(report.diagnostics.some(d => d.code==="host-export-contract-mismatch" && d.message.startsWith("Reviewed API differs")));
			return true;
		});
		await assert.rejects(access(refused),{code: "ENOENT"});
		if(process.env.LEAN_BRIDGE_JS_TASK_RESOURCE_EVIDENCE)
{
			const dest=process.env.LEAN_BRIDGE_JS_TASK_RESOURCE_EVIDENCE; await mkdir(dest);
			for(const r of [ordinary,reviewed,other]) await cp(r.out,join(dest,r.label),{recursive: true});
}
} catch(error)
{
		t.diagnostic([error.details?.stderr,error.details?.stdout].filter(Boolean).join("\n").slice(-4400)); throw error;
}
});
