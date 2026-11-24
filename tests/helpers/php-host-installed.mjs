/** @file Compile real native PHP host imports, then run ordinary and reviewed offline Composer consumers. */
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { prepareNativeHostFixture } from "./native-host-import-check.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";
import { installPhpIOComponents } from "./php-io-install.mjs";

test("compiled Lean calls real PHP objects through relocated offline Composer packages", {timeout: 1_800_000}, async t => {
	const env=process.env, keep=env.LEAN_BRIDGE_PHP_HOST_OUTPUT;
	const root=await mkdtemp(join(keep ?? tmpdir(),"php-host-handoffs-"));
	if(!keep) t.after(()=>rm(root,{recursive: true,force: true}));
	t.diagnostic("Verified handoffs: "+root);
	let review;
	for(const route of ["ordinary","reviewed"])
	{
		const stage=join(root,route), project=join(stage,"source"), handoff=join(stage,"handoff");
		await mkdir(stage); await prepareNativeHostFixture(project,"php");
		await copyFile("LICENSE",join(project,"LICENSE"));
		if(review) await writeFile(join(project,"workshop.binding-ir.json"),review);
		const built=await buildCanonicalProject({projectRoot: project,outputRoot: handoff,targets: ["php-native"],environment: env});
		assert.equal(built.profile,"native-php-host-v1");
		const ir=await readFile(join(handoff,"binding-ir.json"),"utf8");
		const evidence=JSON.parse(await readFile(join(handoff,"host-export-evidence.json"),"utf8"));
		assert.equal(evidence.reviewedSourceSha256,review?sha256(review):null);
		if(review) assert.equal(ir,review); else review=ir;
		await rm(project,{recursive: true}); await rm(join(handoff,"packages"),{recursive: true});
		const local=join(stage,"client"), deploy=join(stage,"installed elsewhere"); await mkdir(local);
		await copyFile("tests/fixtures/php-host-members/compiled.php",join(local,"client.php"));
		const {vendor,components}=await installPhpIOComponents(stage,local,deploy,[handoff]);
		const results=[];
		for(const php of (env.LEAN_BRIDGE_PHP_HOST_INTERPRETERS ?? "/usr/bin/php").split(",").map(p=>resolve(p)))
		{
			const isolated={PATH: "/no-tools",LANG: "C.UTF-8",LEAN_NUM_THREADS: "1",TMPDIR: stage};
			const args=await run(php,["-n","-r","echo (int)extension_loaded('ffi');"],deploy,isolated)==="1" ? ["-n"] : ["-n","-d","extension=ffi"];
			const parsed=JSON.parse(await run(php,[...args,"-d","ffi.enable=1","client.php",join(vendor,"autoload.php")],deploy,isolated));
			assert.equal(parsed.checks,22); results.push(parsed); t.diagnostic(route+" / "+parsed.php+": "+parsed.checks+" checks");
		}
		await writeFile(join(stage,"consumer.json"),canonicalJson({route,results,archive: components[0].pkg.artifacts[0],receipt: components[0].receiptSha256}));
		await rm(deploy,{recursive: true}); t.diagnostic("Installed "+components[0].pkg.artifacts[0].sha256);
	}
});
