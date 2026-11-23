/**
 * Exercise a relocated Composer release through real PHP/Amp consumers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { installPhpIOComponents } from "./php-io-install.mjs";
import { schedulerPackages, schedulerRepositories } from "./php-task-feed.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

const env=process.env,root=env.LEAN_BRIDGE_PHP_RETAINED_CONSUME;
test("installed PHP retained callbacks settle on the application's event loop",{skip: !root,timeout: 3_600_000},async t=>{
	const versions=JSON.parse(env.LEAN_BRIDGE_TEST_PHPS??'["/usr/bin/php"]');
	assert.ok(versions.length && new Set(versions).size===versions.length);
	const sched=await schedulerRepositories(resolve(env.LEAN_BRIDGE_PHP_SCHEDULER_CACHE));
	const fixtures=resolve("tests/fixtures/php-retained-tasks"),reports=[],sources={};
	for(const f of ["installed.php","example.php","shutdown.php"]) sources[f]=sha256(await readFile(join(fixtures,f)));
	for(const route of env.LEAN_BRIDGE_PHP_RETAINED_ROUTE?[env.LEAN_BRIDGE_PHP_RETAINED_ROUTE]:["ordinary","reviewed"])
	{
		const stage=await mkdtemp(join(tmpdir(),"php-retained-client-"));
		try
		{
			const local=join(stage,"source"),deploy=join(stage,"moved project");
			await mkdir(local);
			for(const n of Object.keys(sources)) await copyFile(join(fixtures,n),join(local,n));
			const {components}=await installPhpIOComponents(stage,local,deploy,[resolve(root,route,"handoff")],sched);
			for(const php of versions)
			{
				const exec=name=>run(php,["-n","-d","extension=ffi","-d","ffi.enable=1",name],deploy,{...env,PATH: "/unavailable"},180000);
				const row=JSON.parse(await exec("installed.php"));
				assert.ok(row.checks>=55); assert.equal(row.live,0); assert.equal(row.fdDelta,0);
				assert.equal((await exec("example.php")).trim(),"hello!!");
				assert.equal((await exec("shutdown.php")).trim(),"shutdown released retained owners");
				reports.push({route,...row,receipt: components[0].receiptSha256,example: true,shutdown: true});
				t.diagnostic(route+" / PHP "+row.php+": "+row.checks+" checks");
			}
		}
		finally
{ await rm(stage,{recursive: true,force: true}); }
	}
	const bytes=canonicalJson({sources,scheduler: schedulerPackages,reports});
	if(env.LEAN_BRIDGE_PHP_RETAINED_EXPECTED) assert.equal(bytes,await readFile(env.LEAN_BRIDGE_PHP_RETAINED_EXPECTED,"utf8"));
	else await writeFile(join(root,"installed-retained-"+(env.LEAN_BRIDGE_PHP_RETAINED_ROUTE??"both")+".json"),bytes,{flag: "wx"});
});
