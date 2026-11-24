/** @file Verify installed npm and Composer PHP task callers in separate PHP hosts. */
import assert from "node:assert/strict";
import {cp,mkdir,mkdtemp,rename,rm,symlink,writeFile} from "node:fs/promises";
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
 */
export const exercisePhpTaskRelease=async(release,t)=>{
	const host=process.env.LEAN_BRIDGE_PHP_WASM_HOST;assert.ok(host);
	const {receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(release,"package-set-receipt.json")});
	await assertJsonSchema("package-set-receipt",receipt);
	assert.deepEqual(receipt.profiles.map(p=>p.id),["php-wasm-threaded-task-v1"]);
	const root=await mkdtemp(join(tmpdir(),"php-task-consumer-"));t.after(()=>rm(root,{recursive: true,force: true}));
	const env={...process.env};delete env.NODE_TEST_CONTEXT;delete env.NODE_PATH;
	const run=async(command,args,cwd,environment=env)=>{
		try
		{return await processBuildRunner.capture({command,args,cwd,env: environment,timeoutMs: 60000});}
		catch(e)
		{t.diagnostic(e.details?.stderr || e.details?.stdout || e.message);throw e;}
	};
	const app=join(root,"app"),feed=join(root,"feed"),moved=join(root,"moved");await mkdir(app);await mkdir(feed);
	const npm=[];let metadata,name;
	for(const p of receipt.packages)
	{
		const file=join(release,p.artifacts[0].path), dest=join(feed,p.artifacts[0].path.split("/").at(-1));await cp(file,dest);
		if(p.role==="component") name=p.name;
		if(p.ecosystem==="npm") npm.push(dest);
		else
		{metadata=JSON.parse((await run("unzip",["-p",dest,"composer.json"],app)).stdout);assert.equal(metadata.name,p.name);metadata.dist={type: "zip",url: composerFileUrl(dest)};}
	}
	assert.equal(npm.length,2);assert.ok(metadata && name);
	await run("npm",["install","--prefix",app,"--offline","--ignore-scripts","--no-fund","--no-audit",...npm],app,{...env,npm_config_cache: join(root,"cache")});
	await writeFile(join(app,"composer.json"),JSON.stringify({name: "test/tasks",config: {platform: {php: "8.4.1"}},require: {[metadata.name]: metadata.version},repositories: [{type: "package",package: metadata},await brickMathRepository(feed),{packagist: false}]}));
	await run("composer",["--no-plugins","--no-scripts","--no-interaction","--no-cache","install","--prefer-dist"],app,{...env,COMPOSER_DISABLE_NETWORK: "1",COMPOSER_ALLOW_SUPERUSER: "1",COMPOSER_HOME: join(root,"composer-home")});
	await symlink(resolve(host),join(app,"node_modules/php-wasm"),"dir");
	for(const p of ["installed.php","installed.mjs"]) await cp(resolve("tests/fixtures/php-wasm-task-owner",p),join(app,p));
	await rename(app,moved);await rm(feed,{recursive: true});
	for(const mode of ["embedded","composer"])
	{
		const result=await run(process.execPath,["installed.mjs",name,mode],moved,{PATH: "/no-producer-tools"});
		assert.equal(result.stderr,"");assert.match(result.stdout,/zero live owners/u);t.diagnostic(result.stdout.trim());
	}
	t.diagnostic(await exercisePhpTaskBrowser({root,consumer: moved,name}));
};
if(process.env.LEAN_BRIDGE_PHP_WASM_TASK_RELEASE) test("installed PHP-Wasm task API survives relocation",t=>exercisePhpTaskRelease(resolve(process.env.LEAN_BRIDGE_PHP_WASM_TASK_RELEASE),t));
