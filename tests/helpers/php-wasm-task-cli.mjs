/** @file Build ordinary and independently reviewed PHP-Wasm task releases with an offline-installed author CLI. */
import assert from "node:assert/strict";
import {access,cp,mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {processBuildRunner} from "../../src/build/process-runner.mjs";
import {buildCliNpmPackage} from "../../src/release/cli-npm-package.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {exercisePhpTaskRelease} from "./php-wasm-task-installed.mjs";

test("prepared PHP-Wasm task releases compile ordinary and reviewed Lean with the packed author CLI",async t=>{
	const sdk=process.env.LEAN_BRIDGE_TEST_TASK_INPUTS,evidence=process.env.LEAN_BRIDGE_PHP_TASK_EVIDENCE;
	assert.ok(sdk && process.env.LEAN_BRIDGE_PHP_WASM_HOST,"Set the verified task SDK and php-wasm host");
	const root=await mkdtemp(join(tmpdir(),"php-task-author-"));t.after(()=>rm(root,{recursive: true,force: true}));
	if(evidence) await mkdir(evidence);
	const author=join(root,"author"),pkg=await buildCliNpmPackage({outputRoot: join(root,"feed"),javascriptTaskInputsRoot: sdk});
	const env={...process.env,npm_config_cache: join(root,"cache")};
	for(const k of ["NODE_TEST_CONTEXT","NODE_PATH","LEAN_BRIDGE_JS_TASK_INPUTS","LEAN_BRIDGE_TEST_TASK_INPUTS","LEAN_BRIDGE_JS_THREAD_CORE","LEAN_BRIDGE_JS_THREAD_INIT","LEAN_BRIDGE_RUNTIME_ROOT","LEAN_BRIDGE_JS_TARGET_RUNTIME"]) delete env[k];
	const run=async(cmd,args)=>{try
{return await processBuildRunner.capture({command: cmd,args,cwd: root,env,timeoutMs: 360000});}
		catch(e)
{t.diagnostic((e.details?.stderr || e.details?.stdout || e.message).slice(-3000));throw e;}};
	await run("npm",["install","--prefix",author,"--offline","--ignore-scripts","--no-fund","--no-audit",pkg.archive]);
	const cli=join(author,"node_modules/.bin/lean-bridge"),fixture=resolve("tests/fixtures/javascript-wasm-generated-tasks");
	let ir;const receipts=[];
	for(const route of ["ordinary","reviewed","stale"])
{
		const src=join(root,route+"-src"),out=join(root,route);
		await cp(fixture,src,{recursive: true});
		const cfgPath=join(src,"lean-bridge.exports.json"),cfg=JSON.parse(await readFile(cfgPath,"utf8"));
		cfg.targets={"php-wasm": {npm: {name: "@example/jobs-php",version: "1.0.0"},composer: {name: "example/lean-jobs",version: "1.0.0"}}};
		if(route!=="ordinary")
{
			delete cfg.exports;ir.documentation.summary="Checked PHP worker delivery";
			if(route==="stale")
{
				const path=join(src,"Jobs.lean"),before=await readFile(path,"utf8");
				const after=before.replace("exact (value : Int) : Task Int := Task.pure value","exact (_value : Int) : Task Bool := Task.pure true");
				assert.notEqual(after,before);await writeFile(path,after);
}
			await writeFile(join(src,"author.binding-ir.json"),JSON.stringify(ir));
}
		await writeFile(cfgPath,JSON.stringify(cfg));
		const build=()=>run(process.execPath,[cli,"build","--project",src,"--target","php-wasm","--output",out,"--json","--progress","none"]);
		if(route==="stale")
{
			await assert.rejects(build,e=>{
				const report=JSON.parse(e.details.stdout);assert.equal(report.status,"failed");
				assert.ok(report.diagnostics.some(d=>d.code==="host-export-contract-mismatch" && d.message.startsWith("Reviewed API differs")));
				return true;
			});
			await assert.rejects(access(out),{code: "ENOENT"});break;
}
		await build();await run(process.execPath,[cli,"verify","--receipt",join(out,"package-set-receipt.json")]);
		const {receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(out,"package-set-receipt.json")});
		const component=receipt.packages.find(p=>p.role==="component");assert.equal(component.name,"@example/jobs-php");
		assert.equal(receipt.packages.find(p=>p.role==="api").name,"example/lean-jobs");
		const archive=join(out,component.artifacts[0].path);receipts.push(component.artifacts[0].sha256);
		if(route==="ordinary") ir=JSON.parse((await run("tar",["-xOzf",archive,"package/metadata/binding-ir.json"])).stdout);
		else assert.deepEqual(JSON.parse((await run("tar",["-xOzf",archive,"package/metadata/review.binding-ir.json"])).stdout),ir);
		await rm(src,{recursive: true});if(evidence) await cp(out,join(evidence,route),{recursive: true});
		await exercisePhpTaskRelease(out,t);
		t.diagnostic(route+" "+JSON.stringify(receipt.packages.map(p=>[p.role,p.artifacts[0].sha256])));
}
	assert.notEqual(receipts[0],receipts[1]);
});
