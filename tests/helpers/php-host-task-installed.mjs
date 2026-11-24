/** @file Build real native PHP host tasks and exercise the relocated offline Composer client. */
import assert from "node:assert/strict";
import {copyFile,mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {buildCanonicalProject} from "../../src/build/canonical-build.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {prepareNativeHostFixture} from "./native-host-import-check.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {installPhpIOComponents} from "./php-io-install.mjs";
import {schedulerRepositories} from "./php-task-feed.mjs";

test("installed PHP bindings deliver Lean workers through Amp and Revolt", {timeout: 1_200_000}, async t=>{
	const env=process.env,keep=env.LEAN_BRIDGE_PHP_HOST_TASK_OUTPUT,replay=env.LEAN_BRIDGE_PHP_HOST_TASK_REPLAY;
	if(!env.LEAN_BRIDGE_PHP_SCHEDULER_CACHE) throw new Error("Set LEAN_BRIDGE_PHP_SCHEDULER_CACHE to the verified Amp and Revolt ZIP cache");
	const scheduler=await schedulerRepositories(resolve(env.LEAN_BRIDGE_PHP_SCHEDULER_CACHE));
	const root=await mkdtemp(join(keep??tmpdir(),"php-amp-host-"));
	if(!keep) t.after(()=>rm(root,{recursive: true,force: true}));
	const fixture="tests/fixtures/php-host-tasks";
	let review=null;
	for(const route of ["ordinary","reviewed"])
	{
		const stage=join(root,route),project=join(stage,"source"),handoff=join(replay?resolve(replay,route):stage,"handoff");
		await mkdir(stage);
		if(!replay)
		{
			await prepareNativeHostFixture(project,"php"); await copyFile("LICENSE",join(project,"LICENSE"));
			await copyFile(join(fixture,"Workshop.lean"),join(project,"Workshop.lean"));
			const cfg=JSON.parse(await readFile(join(fixture,"lean-bridge.exports.json"),"utf8"));
			if(review)
			{delete cfg.exports;await writeFile(join(project,"workshop.binding-ir.json"),review);}
			await writeFile(join(project,"lean-bridge.exports.json"),canonicalJson(cfg));
			try
			{
				const built=await buildCanonicalProject({projectRoot: project,outputRoot: handoff,targets: ["php-native"],environment: env});
				assert.equal(built.profile,"native-php-host-task-v1");
			} catch(e)
			{t.diagnostic([e.message,e.details?.stdout,e.details?.stderr].join("\n").slice(-4000));throw e;}
			await rm(project,{recursive: true}); await rm(join(handoff,"packages"),{recursive: true});
		}
		const ir=await readFile(join(handoff,"binding-ir.json"),"utf8");
		const evidence=JSON.parse(await readFile(join(handoff,"host-export-evidence.json"),"utf8"));
		assert.equal(evidence.reviewedSourceSha256,review?sha256(review):null);
		if(review) assert.equal(review,ir); else review=ir;
		const local=join(stage,"client"),deploy=join(stage,"installed elsewhere"); await mkdir(local);
		await copyFile(join(fixture,"installed.php"),join(local,"client.php"));
		const {components}=await installPhpIOComponents(stage,local,deploy,[handoff],scheduler);
		assert.equal(components[0].pkg.profile,"native-php-host-task-v1");
		const results=[];
		try
		{
			for(const php of (env.LEAN_BRIDGE_PHP_HOST_INTERPRETERS??"/usr/bin/php").split(",").map(p=>resolve(p)))
			{
				const isolated={PATH: "/no-tools",LEAN_NUM_THREADS: "1",LANG: "C.UTF-8",TMPDIR: stage};
				const flags=(await run(php,["-n","-r","echo (int)extension_loaded('ffi');"],deploy,isolated))==="1"?["-n"]:["-n","-d","extension=ffi"];
				const record=JSON.parse(await run(php,[...flags,"-d","ffi.enable=1","client.php"],deploy,isolated));
				assert.equal(record.livePhpReferences,0); assert.ok(record.checks>0);
				results.push(record);t.diagnostic(route+" / PHP "+record.php+": "+record.checks+" checks");
			}
			await writeFile(join(stage,"consumer.json"),canonicalJson({route,api: sha256(ir),artifact: components[0].pkg.artifacts[0],receipt: components[0].receiptSha256,results}));
		} finally
		{await rm(deploy,{recursive: true});}
	}
	t.diagnostic(root);
});
