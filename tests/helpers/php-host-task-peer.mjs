/** @file Run independently linked PHP worker packages against shared application objects. */
import assert from "node:assert/strict";
import {copyFile,mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {buildCanonicalProject} from "../../src/build/canonical-build.mjs";
import {canonicalJson} from "../../src/capsule/node.mjs";
import {prepareNativeHostFixture} from "./native-host-import-check.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {installPhpIOComponents} from "./php-io-install.mjs";
import {schedulerRepositories} from "./php-task-feed.mjs";

test("two installed native PHP worker packages share a class registry but not a scheduler lifetime", {timeout: 1_200_000}, async t=>{
	const env=process.env,keep=env.LEAN_BRIDGE_PHP_HOST_TASK_OUTPUT,base=env.LEAN_BRIDGE_PHP_HOST_TASK_MATRIX;
	if(!base) throw new Error("First run test:php-host-task-installed and set LEAN_BRIDGE_PHP_HOST_TASK_MATRIX to its retained directory");
	const root=await mkdtemp(join(keep??tmpdir(),"php-amp-peer-"));
	if(!keep) t.after(()=>rm(root,{recursive: true,force: true}));
	const replay=env.LEAN_BRIDGE_PHP_HOST_TASK_PEER_REPLAY;
	const handoff=replay?resolve(replay,"peer"):join(root,"peer"),project=join(root,"source"),sample="tests/fixtures/php-host-tasks";
	if(!env.LEAN_BRIDGE_PHP_SCHEDULER_CACHE) throw new Error("Set LEAN_BRIDGE_PHP_SCHEDULER_CACHE to the verified Amp and Revolt ZIP cache");
	const scheduler=await schedulerRepositories(resolve(env.LEAN_BRIDGE_PHP_SCHEDULER_CACHE));
	if(!replay)
	{
		await prepareNativeHostFixture(project,"php");
		await copyFile("LICENSE",join(project,"LICENSE")); await copyFile(join(sample,"Workshop.lean"),join(project,"Workshop.lean"));
		await mkdir(join(project,"Workshop")); await copyFile(join(sample,"Parcel.lean"),join(project,"Workshop/Parcel.lean"));
		const lake=join(project,"lakefile.toml"),cfg=JSON.parse(await readFile(join(sample,"lean-bridge.exports.json"),"utf8"));
		await writeFile(lake,(await readFile(lake,"utf8")).replace('name = "workshop"','name = "workshop-peer"'));
		cfg.modules.push("Workshop.Parcel"); cfg.exports.push("Workshop.countBytes"); cfg.taskExports.push("Workshop.countBytes");
		cfg.targets["php-native"].name="lean-bridge/workshop-peer"; await writeFile(join(project,"lean-bridge.exports.json"),canonicalJson(cfg));
		try
		{
			const built=await buildCanonicalProject({projectRoot: project,outputRoot: handoff,targets: ["php-native"],environment: env});
			assert.equal(built.profile,"native-php-host-task-v1");
		} catch(e)
		{t.diagnostic([e.message,e.details?.stdout,e.details?.stderr].join("\n").slice(-4000));throw e;}
		await rm(project,{recursive: true}); await rm(join(handoff,"packages"),{recursive: true});
	}
	for(const route of ["ordinary","reviewed"])
	{
		const at=join(root,route),local=join(at,"client"),deploy=join(at,"relocated"); await mkdir(local,{recursive: true});
		await copyFile(join(sample,"peer.php"),join(local,"app.php"));
		const {vendor,components}=await installPhpIOComponents(at,local,deploy,[join(resolve(base),route,"handoff"),handoff],scheduler);
		assert.deepEqual(components.map(c=>[c.pkg.name,c.pkg.profile]),[["lean-bridge/workshop","native-php-host-task-v1"],["lean-bridge/workshop-peer","native-php-host-task-v1"]]);
		const pins=await Promise.all(components.map(c=>readFile(join(vendor,c.pkg.name,"lean-bridge/package-receipt.json"),"utf8").then(JSON.parse)));
		assert.notEqual(pins[0].componentIdentity,pins[1].componentIdentity); assert.equal(pins[0].runtimeIdentity,pins[1].runtimeIdentity);
		const workerImages=pins.map(pin=>pin.libraries["liblb_php_host_"+pin.componentIdentity+".so"]);
		for(const image of workerImages) assert.match(image,/^[0-9a-f]{64}$/u);
		assert.notEqual(...workerImages);
		const registry=p=>Object.fromEntries(Object.entries(p.libraries).filter(([k])=>k.startsWith("liblb_php_host_domain_") || k.startsWith("liblb_task_resources_")));
		assert.equal(Object.keys(registry(pins[0])).length,2); assert.deepEqual(registry(pins[0]),registry(pins[1]));
		const results=[];
		try
		{
			for(const php of (env.LEAN_BRIDGE_PHP_HOST_INTERPRETERS??"/usr/bin/php").split(",").map(p=>resolve(p)))
			{
				const isolated={PATH: "/no-tools",LEAN_NUM_THREADS: "1",LANG: "C.UTF-8",TMPDIR: at};
				const flags=(await run(php,["-n","-r","echo (int)extension_loaded('ffi');"],deploy,isolated))==="1"?["-n"]:["-n","-d","extension=ffi"];
				for(const order of ["peer","workshop"])
				{
					const result=JSON.parse(await run(php,[...flags,"-d","ffi.enable=1","app.php",order],deploy,isolated));
					assert.equal(result.livePhpReferences,0); assert.equal(result.order,order); results.push(result);
				}
			}
			await writeFile(join(at,"consumer.json"),canonicalJson({route,results
				, runtime: pins[0].runtimeIdentity
				, packages: components.map((c,i)=>({name: c.pkg.name
					, component: pins[i].componentIdentity
					, workerSha256: workerImages[i]
					, receipt: c.receiptSha256,artifact: c.pkg.artifacts[0]}))
				, registry: registry(pins[0])}));
			t.diagnostic(route+": "+results.length+" paired executions; shared domain and ledger verified");
		} finally
		{await rm(deploy,{recursive: true});}
	}
	t.diagnostic(root);
});
