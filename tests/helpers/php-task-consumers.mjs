/**
 * Install a real Composer task release and pinned upstream scheduler ZIPs offline.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { composerFileUrl } from "./brick-math.mjs";
import { installPhpIOComponents } from "./php-io-install.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";

const packages=[
	["amphp/amp","v3.1.3","6b9051b59037d5a763a43bed0c44571671ce8dc8d45be4cd256c9afa1fe3cd51"]
	, ["revolt/event-loop","v1.1.0","a316f5d942d896aeae5826db5331738585fe4d8ebb603cbefc01ae4f6e18e4cf"]
];
const env=process.env, root=env.LEAN_BRIDGE_PHP_TASK_CONSUME;
const repositories=async cache=>{
	const repos=[];
	for(const [name,version,hash] of packages)
	{
		const dir=join(cache,"files",name);
		let archive, bytes;
		for(const f of (await readdir(dir)).filter(f=>f.endsWith(".zip")))
		{
			const b=await readFile(join(dir,f));
			if(sha256(b)===hash)
			{archive=join(dir,f);bytes=b;break;}
		}
		assert.ok(archive,"Missing exact "+name+" "+version+" upstream ZIP in "+dir);
		const paths=(await run("unzip",["-Z1",archive],dir,env)).trim().split("\n").filter(p=>/^[^/]+\/composer\.json$/u.test(p));
		assert.equal(paths.length,1);
		const meta=JSON.parse(await run("unzip",["-p",archive,paths[0]],dir,env));
		assert.equal(meta.name,name);
		repos.push({type: "package",package: {...meta,version,dist: {type: "zip",url: composerFileUrl(archive),shasum: createHash("sha1").update(bytes).digest("hex")}}});
	}
	return repos;
};
test("relocated native PHP tasks settle through Amp and Revolt without a compiler on PATH"
	,{skip: !root,timeout: 3_600_000},async t=>{
	const versions=JSON.parse(env.LEAN_BRIDGE_TEST_PHPS??'["/usr/bin/php"]');
	assert.ok(versions.length>0 && new Set(versions).size===versions.length);
	const sched=await repositories(resolve(env.LEAN_BRIDGE_PHP_SCHEDULER_CACHE));
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
	const capture={sources,scheduler: packages,reports};
	const bytes=canonicalJson(capture);
	if(env.LEAN_BRIDGE_PHP_TASK_EXPECTED) assert.equal(bytes,await readFile(env.LEAN_BRIDGE_PHP_TASK_EXPECTED,"utf8"));
		else await writeFile(join(root,"installed-php-tasks-"+(env.LEAN_BRIDGE_PHP_TASK_ROUTE??"both")+".json"),bytes,{flag: "wx"});}
);
