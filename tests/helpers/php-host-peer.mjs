/** @file Build an independent Composer peer and replay a verified first component against it. */
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { prepareNativeHostFixture } from "./native-host-import-check.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";
import { installPhpIOComponents } from "./php-io-install.mjs";

const ordinary=process.env.LEAN_BRIDGE_PHP_HOST_HANDOFF;
test("independent Composer packages share nominal PHP identity in either load order",{timeout: 1_800_000},async t=>{
	const env=process.env,keep=env.LEAN_BRIDGE_PHP_HOST_OUTPUT;
	const stage=await mkdtemp(join(keep ?? tmpdir(),"php-host-peer-"));
	if(!keep) t.after(()=>rm(stage,{recursive: true,force: true}));
	const project=join(stage,"producer"),handoff=join(stage,"handoff");
	await prepareNativeHostFixture(project,"php"); await copyFile("LICENSE",join(project,"LICENSE"));
	const first=ordinary ? resolve(ordinary) : join(stage,"first-handoff");
	if(!ordinary)
	{
		await buildCanonicalProject({projectRoot: project,outputRoot: first,targets: ["php-native"],environment: env});
		await rm(join(first,"packages"),{recursive: true});
	}
	const lake=join(project,"lakefile.toml"),config=join(project,"lean-bridge.exports.json");
	await writeFile(lake,(await readFile(lake,"utf8")).replace('name = "workshop"','name = "workshop-peer"'));
	const cfg=JSON.parse(await readFile(config,"utf8")); cfg.targets["php-native"].name="lean-bridge/workshop-peer";
	await writeFile(config,canonicalJson(cfg));
	await buildCanonicalProject({projectRoot: project,outputRoot: handoff,targets: ["php-native"],environment: env});
	await rm(project,{recursive: true}); await rm(join(handoff,"packages"),{recursive: true});
	const local=join(stage,"client"),deploy=join(stage,"installed elsewhere"); await mkdir(local);
	await copyFile("tests/fixtures/php-host-members/peer.php",join(local,"app.php"));
	const {vendor,components}=await installPhpIOComponents(stage,local,deploy,[first,handoff]);
	const report=[];
	for(const php of (env.LEAN_BRIDGE_PHP_HOST_INTERPRETERS ?? "/usr/bin/php").split(","))
	{
		const isolated={PATH: "/no-publisher-tools",LANG: "C.UTF-8",LEAN_NUM_THREADS: "1"};
		const flags=await run(resolve(php),["-n","-r","echo (int)extension_loaded('ffi');"],deploy,isolated)==="1" ? ["-n"] : ["-n","-d","extension=ffi"];
		for(const order of ["peer","workshop"])
		{
			const result=await run(resolve(php),[...flags,"-d","ffi.enable=1","app.php",join(vendor,"autoload.php"),order],deploy,isolated);
			assert.match(result,/independent close; zero tokens/u); report.push({php,order,result});
		}
	}
	await writeFile(join(stage,"consumer.json"),canonicalJson({report,archives: components.map(r=>r.pkg.artifacts[0])}));
	await rm(deploy,{recursive: true}); t.diagnostic("Verified peer: "+stage);
});
