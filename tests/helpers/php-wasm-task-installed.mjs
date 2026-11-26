/** @file Verify installed npm and Composer PHP task callers in separate PHP hosts. */
import assert from "node:assert/strict";
import {appendFile,cp,mkdir,mkdtemp,readFile,rename,rm,symlink,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {processBuildRunner} from "../../src/build/process-runner.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {assertJsonSchema} from "./json-schema.mjs";
import {brickMathRepository,composerFileUrl} from "./brick-math.mjs";
import {exercisePhpTaskBrowser} from "./php-wasm-task-browser.mjs";

/**
 * Install from both ecosystems before running the moved PHP application.
 *
 * @param release - Release root with its verified package set.
 * @param t - Test context for diagnostics and cleanup.
 * @param peer - Independently built peer package when calls cross components.
 * @param leases - Exercise a nominal resource peer instead of retained callbacks.
 * @param zend - Exercise the generated application class bindings.
 * @param functions - Also require authenticated, object-capturing returned functions.
 * @param [immediate] - Test a standalone component, without importing the worker runtime.
 * @param [records] - Require the installed Zend record and EIO last-owner program in both PHP environments.
 * @param [options] - Optional installed application scenarios.
 */
export const exercisePhpTaskRelease=async(release,t,peer,leases=false,zend=false,functions=false,immediate=false,records=false,options={})=>{
	const host=process.env.LEAN_BRIDGE_PHP_WASM_HOST;assert.ok(host);
	const {receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(release,"package-set-receipt.json")});
	await assertJsonSchema("package-set-receipt",receipt);
	assert.deepEqual(receipt.profiles.map(p=>p.id),[immediate?"php-wasm-zend-host-io-v1":"php-wasm-threaded-task-v1"]);
	const root=await mkdtemp(join(tmpdir(),"php-task-consumer-"));t.after(()=>rm(root,{recursive: true,force: true}));
	const env={...process.env};delete env.NODE_TEST_CONTEXT;delete env.NODE_PATH;
	const run=async(command,args,cwd,environment=env)=>{
		try
		{return await processBuildRunner.capture({command,args,cwd,env: environment,timeoutMs: 60000});}
		catch(e)
		{t.diagnostic(e.details?.stderr || e.details?.stdout || e.message);throw e;}
	};
	const app=join(root,"app"),feed=join(root,"feed"),moved=join(root,"moved");await mkdir(app);await mkdir(feed);
	const npm=[],components=[],composer=[],hashes=new Map();
	for(const [dir,set] of [[release,receipt],...peer?[[peer,(await readVerifiedPackageSetReceipt({receiptPath: join(peer,"package-set-receipt.json")})).receipt]]:[]]) for(const p of set.packages)
	{
		if(hashes.has(p.name))
		{assert.equal(p.role,"runtime");assert.equal(p.artifacts[0].sha256,hashes.get(p.name));continue;}
		hashes.set(p.name,p.artifacts[0].sha256);
		const file=join(dir,p.artifacts[0].path), dest=join(feed,p.artifacts[0].path.split("/").at(-1));await cp(file,dest);
		if(p.role==="component") components.push(p.name);
		if(p.ecosystem==="npm") npm.push(dest);
		else
		{const metadata=JSON.parse((await run("unzip",["-p",dest,"composer.json"],app)).stdout);assert.equal(metadata.name,p.name);metadata.dist={type: "zip",url: composerFileUrl(dest)};composer.push(metadata);}
	}
	assert.equal(npm.length,peer?3:2);assert.equal(composer.length,peer?2:1);const [name,other]=components;
	await run("npm",["install","--prefix",app,"--offline","--ignore-scripts","--no-fund","--no-audit",...npm],app,{...env,npm_config_cache: join(root,"cache")});
	await writeFile(join(app,"composer.json"),JSON.stringify({name: "test/tasks",config: {platform: {php: "8.4.1"}},require: Object.fromEntries(composer.map(p=>[p.name,p.version])),repositories: [...composer.map(p=>({type: "package",package: p})),await brickMathRepository(feed),{packagist: false}]}));
	await run("composer",["--no-plugins","--no-scripts","--no-interaction","--no-cache","install","--prefer-dist"],app,{...env,COMPOSER_DISABLE_NETWORK: "1",COMPOSER_ALLOW_SUPERUSER: "1",COMPOSER_HOME: join(root,"composer-home")});
	await symlink(resolve(host),join(app,"node_modules/php-wasm"),"dir");
	await cp(resolve("tests/fixtures/php-wasm-task-owner",immediate?"zend-sync.php":zend?"zend-installed.php":leases?"leases.php":peer?"callbacks.php":"installed.php"),join(app,"installed.php"));
	if(options.parked) {
		assert.ok(!peer && !immediate && !leases && !zend);
		const sample=await readFile("tests/fixtures/php-wasm-task-owner/parked.php","utf8");
		assert.ok(sample.startsWith("<?php\n"));
		await appendFile(join(app,"installed.php"),"\n"+sample.slice(6));
	}
	if(records)
	{
		assert.ok(immediate && zend && functions && peer);
		const sample=await readFile("tests/fixtures/php-wasm-task-owner/zend-records.php","utf8");
		assert.ok(sample.startsWith("<?php\n"));await appendFile(join(app,"installed.php"),"\n"+sample.slice(6));
	}
	if(functions && !immediate)
	{
		assert.ok(zend && peer);
		const extra=await readFile(resolve("tests/fixtures/php-wasm-task-owner/zend-functions.php"),"utf8");
		assert.ok(extra.startsWith("<?php\n"));await appendFile(join(app,"installed.php"),"\n"+extra.slice(6));
	}
	await cp(resolve("tests/fixtures/php-wasm-task-owner",immediate?"sync-installed.mjs":"installed.mjs"),join(app,"installed.mjs"));
	await cp(resolve("tests/fixtures/php-wasm-task-owner/installed-realms.mjs"),join(app,"installed-realms.mjs"));
	if(peer && !leases && !zend) for(const file of ["trap.php","trap.mjs","malformed.mjs"]) await cp(resolve("tests/fixtures/php-wasm-task-owner",file),join(app,file));
	if(zend && !immediate) for(const [file,dest] of [["zend-trap.php","trap.php"],["trap.mjs","trap.mjs"]])
		await cp(resolve("tests/fixtures/php-wasm-task-owner",file),join(app,dest));
	await rename(app,moved);await rm(feed,{recursive: true});
	const executions={};
	for(const mode of ["embedded","composer"])
	{
		const result=await run(process.execPath,["installed.mjs",mode,...components],moved,{PATH: "/no-producer-tools",CHECK_RETURNED_FUNCTIONS: functions?"1":"0",CHECK_ZEND_RECORDS: records?"1":"0",CHECK_PARKED_READER: options.parked?"1":"0"});
		assert.equal(result.stderr,"");assert.match(result.stdout,immediate?/synchronous identity, failures, reentry and cleanup passed/u:/zero live owners/u);t.diagnostic(result.stdout.trim());
		executions[mode]=result.stdout.trim();
	}
	executions.chromium=await exercisePhpTaskBrowser({root,consumer: moved,name,other,leases,zend,immediate,records,parked:options.parked});t.diagnostic(executions.chromium);
	if(options.parked) return executions;
	if(immediate)return executions;
	if(peer && !leases)
	{
		const result=await run(process.execPath,["trap.mjs",...components],moved,{PATH: "/no-producer-tools"});
		assert.equal(result.stderr,"");t.diagnostic(result.stdout.trim());
		if(zend) return;
		const corrupt=await run(process.execPath,["malformed.mjs",name],moved,{PATH: "/no-producer-tools"});
		assert.equal(corrupt.stderr,"");t.diagnostic(corrupt.stdout.trim());
	}
};
if(process.env.LEAN_BRIDGE_PHP_WASM_TASK_RELEASE) test("installed PHP-Wasm task API survives relocation",t=>exercisePhpTaskRelease(resolve(process.env.LEAN_BRIDGE_PHP_WASM_TASK_RELEASE),t,process.env.LEAN_BRIDGE_PHP_TASK_PEER,process.env.LEAN_BRIDGE_PHP_WASM_TASK_LEASES==="1",process.env.LEAN_BRIDGE_PHP_WASM_ZEND_PACKAGES==="1"));
