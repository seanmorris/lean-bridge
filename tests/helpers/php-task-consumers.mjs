/**
 * Install a real Composer task release and pinned upstream scheduler ZIPs offline.
 *
 * @file
 */
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { schedulerPackages, schedulerRepositories } from "./php-task-feed.mjs";
import { installPhpIOComponents } from "./php-io-install.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

const env=process.env, root=env.LEAN_BRIDGE_PHP_TASK_CONSUME;
test("relocated native PHP tasks settle through Amp and Revolt without a compiler on PATH"
	,{skip: !root,timeout: 3_600_000},async t=>{
	const versions=JSON.parse(env.LEAN_BRIDGE_TEST_PHPS??'["/usr/bin/php"]');
	assert.ok(versions.length>0 && new Set(versions).size===versions.length);
	const sched=await schedulerRepositories(resolve(env.LEAN_BRIDGE_PHP_SCHEDULER_CACHE));
	const fixtures=resolve("tests/fixtures/php-tasks"), reports=[];
	const sources={};
	for(const name of ["installed.php","example.php","shutdown.php"]) sources[name]=sha256(await readFile(join(fixtures,name)));
	for(const route of env.LEAN_BRIDGE_PHP_TASK_ROUTE ? [env.LEAN_BRIDGE_PHP_TASK_ROUTE] : ["ordinary","reviewed"])
	{
		const stage=await mkdtemp(join(tmpdir(),"php-task-client-"));
		try
		{
			const local=join(stage,"source"), deploy=join(stage,"moved project");
			await mkdir(local);
			for(const name of Object.keys(sources)) await copyFile(join(fixtures,name),join(local,name));
			const {components}=await installPhpIOComponents(stage,local,deploy,[resolve(root,route,"handoff")],sched);
			for(const php of versions)
			{
				const args=["-n","-d","extension=ffi","-d","ffi.enable=1"];
				const exec=name=>run(php,[...args,name],deploy,{...env,PATH: "/unavailable"},120000);
				const row=JSON.parse(await exec("installed.php"));
				assert.ok(row.checks>=60); assert.equal(row.live,0);
				assert.equal((await exec("example.php")).trim(),"hello\nfirst item");
				assert.equal((await exec("shutdown.php")).trim(),"shutdown released all owners");
				reports.push({route,...row,example: true,shutdown: true,receipt: components[0].receiptSha256});
				t.diagnostic(route+" / PHP "+row.php+": "+row.checks+" checks");
			}
		}
		finally
{await rm(stage,{recursive: true,force: true});}
	}
	const capture={sources,scheduler: schedulerPackages,reports};
	const bytes=canonicalJson(capture);
	if(env.LEAN_BRIDGE_PHP_TASK_EXPECTED) assert.equal(bytes,await readFile(env.LEAN_BRIDGE_PHP_TASK_EXPECTED,"utf8"));
		else await writeFile(join(root,"installed-php-tasks-"+(env.LEAN_BRIDGE_PHP_TASK_ROUTE??"both")+".json"),bytes,{flag: "wx"});}
);
