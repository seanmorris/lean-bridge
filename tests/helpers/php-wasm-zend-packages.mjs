/** @file Build class-bound PHP packages with an installed author CLI and run their relocated consumers. */
import assert from "node:assert/strict";
import {mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {processBuildRunner} from "../../src/build/process-runner.mjs";
import {buildCliNpmPackage} from "../../src/release/cli-npm-package.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {prepareZendAuthorProject} from "./php-wasm-zend-project.mjs";
import {exercisePhpTaskRelease} from "./php-wasm-task-installed.mjs";

test("installed PHP-Wasm packages bind PHP classes on both author routes",async t=>{
	const sdk=process.env.LEAN_BRIDGE_TEST_TASK_INPUTS,keep=process.env.LEAN_BRIDGE_PHP_ZEND_PACKAGE_OUTPUT;
	const immediate=process.env.LEAN_BRIDGE_PHP_ZEND_STANDALONE==="1";
	assert.ok((immediate || sdk) && process.env.LEAN_BRIDGE_PHP_WASM_HOST,"Set the selected SDK and PHP-Wasm interpreter");
	const root=await mkdtemp(join(keep??tmpdir(),"zend-packages-"));
	if(!keep) t.after(()=>rm(root,{recursive: true,force: true}));
	const cliPkg=await buildCliNpmPackage({outputRoot: join(root,"cli-feed"),...immediate?{}:{javascriptTaskInputsRoot: resolve(sdk)}});
	const env={...process.env,npm_config_cache: join(root,"npm-cache")};
	for(const name of ["NODE_TEST_CONTEXT","NODE_PATH","LEAN_BRIDGE_JS_TASK_INPUTS","LEAN_BRIDGE_TEST_TASK_INPUTS","LEAN_BRIDGE_JS_THREAD_CORE","LEAN_BRIDGE_JS_THREAD_INIT",...immediate?[]:["LEAN_BRIDGE_RUNTIME_ROOT","LEAN_BRIDGE_JS_TARGET_RUNTIME"]]) delete env[name];
	const run=async(command,args)=>{
		try
{return await processBuildRunner.capture({command,args,cwd: root,env,timeoutMs: 360000});}
		catch(e)
{t.diagnostic((e.details?.stderr || e.details?.stdout || e.message).slice(-5000));throw e;}
	};
	const author=join(root,"author");
	await run("npm",["install","--prefix",author,"--offline","--ignore-scripts","--no-audit","--no-fund",cliPkg.archive]);
	const cli=join(author,"node_modules/.bin/lean-bridge"),reports=[],build=async(project,route)=>{
		const out=join(root,route),receiptPath=join(out,"package-set-receipt.json");
		await run(process.execPath,[cli,"build","--project",project,"--target","php-wasm","--output",out,"--json","--progress","none"]);
		await run(process.execPath,[cli,"verify","--receipt",receiptPath]);
		const {receipt}=await readVerifiedPackageSetReceipt({receiptPath});
		const profile=immediate?"php-wasm-zend-host-io-v1":"php-wasm-threaded-task-v1";
		assert.deepEqual(receipt.profiles.map(p=>p.id),[profile]);
		assert.ok(receipt.packages.every(p=>p.profile===profile && p.target==="php-wasm"));
		const component=receipt.packages.find(p=>p.role==="component"),archive=join(out,component.artifacts[0].path);
		const ir=JSON.parse((await run("tar",["-xOzf",archive,"package/metadata/binding-ir.json"])).stdout);
		assert.ok(ir.types.some(t=>t.host?.targets.includes("php")));assert.ok(ir.errors.some(e=>e.id==="error:PhpHostException"));
		assert.equal(ir.types.filter(t=>t.source.extensions["lean-bridge.dev/closure-owner"]==="php-wasm-zend-binding").length,3);
		assert.deepEqual(receipt.packages.map(p=>p.role).sort(),["api","component","runtime"]);
		if(route==="reviewed") assert.deepEqual(JSON.parse((await run("tar",["-xOzf",archive,"package/metadata/review.binding-ir.json"])).stdout),ir);
		const report={route,receipt: sha256(await readFile(receiptPath)),packages: receipt.packages.map(p=>({role: p.role,name: p.name,sha256: p.artifacts[0].sha256}))};
		reports.push(report);t.diagnostic(JSON.stringify(report));return {out,ir};
	};
	const side=join(root,"peer-src");await mkdir(side);
	const {out: peer}=await build((await prepareZendAuthorProject(side,"sidekick",true,immediate)).project,"peer");
	const {project,configPath,cfg}=await prepareZendAuthorProject(root,"workshop",true,immediate);
	const ordinary=await build(project,"ordinary");
	delete cfg.exports;await writeFile(configPath,canonicalJson(cfg));await writeFile(join(project,"workshop.binding-ir.json"),canonicalJson(ordinary.ir));
	const reviewed=await build(project,"reviewed");
	assert.deepEqual(reviewed.ir,ordinary.ir);
	assert.equal(new Set(reports.map(r=>r.packages.find(p=>p.role==="component").sha256)).size,3);
	assert.equal(new Set(reports.map(r=>r.packages.find(p=>p.role==="runtime").sha256)).size,1);
	// The installed applications must not fall back to either Lake project or
	// to the author's CLI and SDK. Keep only their handoffs and build records.
	for(const dir of [project,side,author]) await rm(dir,{recursive: true});
	for(const {out} of [ordinary,reviewed]) await exercisePhpTaskRelease(out,t,peer,false,true,true,immediate);
	t.diagnostic("Prepared Zend package matrix in "+root);
});
