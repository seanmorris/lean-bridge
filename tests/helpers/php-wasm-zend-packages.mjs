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
	const records=process.env.LEAN_BRIDGE_PHP_ZEND_RECORDS==="1";
	if(records) assert.ok(immediate,"Record acceptance requires the standalone Zend runtime");
	const replay=process.env.LEAN_BRIDGE_PHP_ZEND_PACKAGE_REPLAY;
	assert.ok(!(replay && keep),"Choose either replay or a new package output directory");
	assert.ok((replay || immediate || sdk) && process.env.LEAN_BRIDGE_PHP_WASM_HOST,"Set the selected SDK and PHP-Wasm interpreter");
	const root=await mkdtemp(join(keep??tmpdir(),"zend-packages-"));
	if(!keep) t.after(()=>rm(root,{recursive: true,force: true}));
	const env={...process.env,npm_config_cache: join(root,"npm-cache")};
	for(const name of ["NODE_TEST_CONTEXT","NODE_PATH","LEAN_BRIDGE_JS_TASK_INPUTS","LEAN_BRIDGE_TEST_TASK_INPUTS","LEAN_BRIDGE_JS_THREAD_CORE","LEAN_BRIDGE_JS_THREAD_INIT",...immediate?[]:["LEAN_BRIDGE_RUNTIME_ROOT","LEAN_BRIDGE_JS_TARGET_RUNTIME"]]) delete env[name];
	const run=async(command,args)=>{
		try
{return await processBuildRunner.capture({command,args,cwd: root,env,timeoutMs: 360000});}
		catch(e)
		{
			let reason;
			try
			{reason=JSON.parse(e.details?.stdout).diagnostics;}
			catch
			{reason=null;}
			t.diagnostic(reason?.length?JSON.stringify(reason):(e.details?.stderr || e.details?.stdout || e.message).slice(-5000));
			throw e;
		}
	};
	const reports=[],inspect=async route=>{
		const out=resolve(replay??root,route),receiptPath=join(out,"package-set-receipt.json");
		const {receipt}=await readVerifiedPackageSetReceipt({receiptPath});
		const profile=immediate?"php-wasm-zend-host-io-v1":"php-wasm-threaded-task-v1";
		assert.deepEqual(receipt.profiles.map(p=>p.id),[profile]);
		assert.ok(receipt.packages.every(p=>p.profile===profile && p.target==="php-wasm"));
		const component=receipt.packages.find(p=>p.role==="component"),archive=join(out,component.artifacts[0].path);
		const ir=JSON.parse((await run("tar",["-xOzf",archive,"package/metadata/binding-ir.json"])).stdout);
		assert.ok(ir.types.some(t=>t.host?.targets.includes("php")));assert.ok(ir.errors.some(e=>e.id==="error:PhpHostException"));
		if(records) assert.equal(ir.schemaVersion,route!=="peer"?4:3);
		assert.equal(ir.types.filter(t=>t.source.extensions["lean-bridge.dev/closure-owner"]==="php-wasm-zend-binding").length,records && route!=="peer"?4:3);
		assert.deepEqual(receipt.packages.map(p=>p.role).sort(),["api","component","runtime"]);
		if(route==="reviewed") assert.deepEqual(JSON.parse((await run("tar",["-xOzf",archive,"package/metadata/review.binding-ir.json"])).stdout),ir);
		const report={route,receipt: sha256(await readFile(receiptPath)),packages: receipt.packages.map(p=>({role: p.role,name: p.name,sha256: p.artifacts[0].sha256}))};
		reports.push(report);t.diagnostic(JSON.stringify(report));return {out,ir};
	};
	let peer,ordinary,reviewed;
	if(replay)
	{
		peer=(await inspect("peer")).out;ordinary=await inspect("ordinary");reviewed=await inspect("reviewed");
	} else
	{
		const cliPkg=await buildCliNpmPackage({outputRoot: join(root,"cli-feed"),...immediate?{}:{javascriptTaskInputsRoot: resolve(sdk)}});
		const author=join(root,"author"),cli=join(author,"node_modules/.bin/lean-bridge");
		await run("npm",["install","--prefix",author,"--offline","--ignore-scripts","--no-audit","--no-fund",cliPkg.archive]);
		const build=async(project,route)=>{
			const out=join(root,route);
			await run(process.execPath,[cli,"build","--project",project,"--target","php-wasm","--output",out,"--json","--progress","none"]);
			await run(process.execPath,[cli,"verify","--receipt",join(out,"package-set-receipt.json")]);return inspect(route);
		};
		const side=join(root,"peer-src");await mkdir(side);
		peer=(await build((await prepareZendAuthorProject(side,"sidekick",true,immediate)).project,"peer")).out;
		const {project,configPath,cfg}=await prepareZendAuthorProject(root,"workshop",true,immediate,records);
		ordinary=await build(project,"ordinary");
		const reviewedApi=structuredClone(ordinary.ir);
		if(records) reviewedApi.types.find(t=>t.id==="lean:Gauge.Pair").fields[0].documentation.summary="The application's original Zend object.";
		delete cfg.exports;await writeFile(configPath,canonicalJson(cfg));await writeFile(join(project,"workshop.binding-ir.json"),canonicalJson(reviewedApi));
		reviewed=await build(project,"reviewed");
		if(records)
		{
			const fields=reviewedApi.types.find(t=>t.id==="lean:Gauge.Pair").fields;
			[fields[0],fields[3]]=[fields[3],fields[0]];
			await writeFile(join(project,"workshop.binding-ir.json"),canonicalJson(reviewedApi));
			await assert.rejects(run(process.execPath,[cli,"build","--project",project,"--target","php-wasm","--output",join(root,"invalid"),"--json","--progress","none"]),
				e=>/Reviewed API differs/u.test([e.message,e.details?.stderr,e.details?.stdout].join("\n")));
			await assert.rejects(readFile(join(root,"invalid/package-set-receipt.json")),{code: "ENOENT"});
		}
		// Remove only the producer trees from this test's fresh directory, never a replay input.
		for(const dir of [project,side,author]) await rm(dir,{recursive: true});
	}
	const expected=structuredClone(ordinary.ir);
	if(records) expected.types.find(t=>t.id==="lean:Gauge.Pair").fields[0].documentation.summary="The application's original Zend object.";
	assert.deepEqual(reviewed.ir,expected);
	assert.equal(new Set(reports.map(r=>r.packages.find(p=>p.role==="component").sha256)).size,3);
	assert.equal(new Set(reports.map(r=>r.packages.find(p=>p.role==="runtime").sha256)).size,1);
	for(const [route,{out}] of [["ordinary",ordinary],["reviewed",reviewed]])
	{
		const executions=await exercisePhpTaskRelease(out,t,peer,false,true,true,immediate,records);
		if(records)
		{
			for(const mode of ["embedded","composer","chromium"]) assert.match(executions[mode],/Zend record and EIO ownership passed$/u);
			const output=resolve(process.env.LEAN_BRIDGE_PHP_ZEND_RECORD_OUTPUT??"build/php-wasm-host-record");
			await mkdir(output,{recursive: true});
			const clientSha256=sha256(await readFile("tests/fixtures/php-wasm-task-owner/zend-records.php"));
			const baseClientSha256=sha256(await readFile("tests/fixtures/php-wasm-task-owner/zend-sync.php"));
			await writeFile(join(output,route+".json"),canonicalJson({route,clientSha256,baseClientSha256,executions,packages: reports.filter(p=>p.route===route || p.route==="peer")}));
		}
	}
	t.diagnostic((replay?"Replayed verified Zend handoffs from ":"Prepared Zend package matrix in ")+(replay??root));
});
