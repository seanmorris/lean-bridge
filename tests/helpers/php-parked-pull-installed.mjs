/** @file Verify a real Amp reader interrupted while a compiled Lean pull is parked. */
import assert from "node:assert/strict";
import {copyFile,mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {buildCanonicalProject} from "../../src/build/canonical-build.mjs";
import {hashBindingIr} from "../../src/binding-ir/canonical.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {installPhpIOComponents} from "./php-io-install.mjs";
import {schedulerPackages,schedulerRepositories} from "./php-task-feed.mjs";

const env=process.env,read=async p=>JSON.parse(await readFile(p,"utf8"));
const base=resolve("tests/fixtures/c-lean-tasks"),fixtures=resolve("tests/fixtures/php-tasks");
const pathResult={pulls: 1,closes: 1,items: 0,peer: 42};
const summarize=api=>{
	const reviewed=structuredClone(api);
	reviewed.declarations.find(d=>d.source.declaration==="Pulse.series").documentation.summary="Read one sample per requested pull.";
	return reviewed;
};
test("native PHP interrupts a parked Lean pull exactly once without stopping the peer", {timeout: 3_600_000},async t=>{
	const cache=env.LEAN_BRIDGE_PHP_SCHEDULER_CACHE;
	assert.ok(cache,"Set LEAN_BRIDGE_PHP_SCHEDULER_CACHE to the offline Amp and Revolt cache");
	const scheduler=await schedulerRepositories(resolve(cache)),keep=env.LEAN_BRIDGE_PHP_PARKED_HANDOFFS,replay=env.LEAN_BRIDGE_PHP_PARKED_REPLAY;
	assert.ok(!(keep && replay));
	const work=await mkdtemp(join(keep??tmpdir(),"php-parked-"));
	if(!keep) t.after(()=>rm(work,{recursive: true,force: true}));
	const root=replay?resolve(replay):work;
	const client=join(fixtures,"parked.php"),clientSha256=sha256(await readFile(client));
	const output=resolve(env.LEAN_BRIDGE_PHP_PARKED_OUTPUT??"build/php-parked-pull");
	const phps=JSON.parse(env.LEAN_BRIDGE_TEST_PHPS??'["/usr/bin/php"]');
	assert.ok(phps.length && new Set(phps).size===phps.length);
	await mkdir(output,{recursive: true});
	let ordinary;
	for(const route of ["peer","ordinary","reviewed"])
	{
		const handoff=join(root,route),peer=route==="peer",name=peer?"Signals":"Pulse";
		if(!replay)
		{
			const project=join(work,route+"-source");await mkdir(project);
			await copyFile(join(base,"lean-toolchain"),join(project,"lean-toolchain"));
			await copyFile(join(peer?fixtures:base,name+".lean"),join(project,name+".lean"));
			const lake=(await readFile(join(base,"lakefile.toml"),"utf8")).replaceAll("pulse",name.toLowerCase()).replaceAll("Pulse",name);
			await writeFile(join(project,"lakefile.toml"),lake);
			const cfg=await read(join(base,"lean-bridge.exports.json"));
			cfg.modules=[name];cfg.targets={"php-native": {name: "lean-bridge/"+name.toLowerCase(),version: "1.0.0"}};
			if(peer)
			{
				cfg.exports=["Signals.reading"];cfg.taskExports=[...cfg.exports];delete cfg.asyncIterators;
			}
			if(route==="reviewed")
			{
				delete cfg.exports;
				await writeFile(join(project,"public.binding-ir.json"),canonicalJson(summarize(ordinary)));
			}
			await writeFile(join(project,"lean-bridge.exports.json"),canonicalJson(cfg));
			await buildCanonicalProject({projectRoot: project,outputRoot: handoff,targets: ["php-native"],environment: env})
				.catch(e=>{throw new Error(e.message+"\n"+JSON.stringify(e.details),{cause: e});});
			await rm(project,{recursive: true});
		}
		const ir=await read(join(handoff,"binding-ir.json"));
		const author=await read(join(handoff,"host-export-evidence.json"));
		assert.equal(author.reviewedSourceSha256,route==="reviewed"?sha256(canonicalJson(summarize(ordinary))):null);
		if(route==="ordinary") ordinary=ir;
		if(route==="reviewed") assert.deepEqual(ir,summarize(ordinary));
		if(peer) continue;
		const stage=await mkdtemp(join(work,route+"-app-")),local=join(stage,"source"),deploy=join(stage,"relocated");
		try
		{
			await mkdir(local);await copyFile(client,join(local,"parked.php"));
			const {components,vendor}=await installPhpIOComponents(stage,local,deploy,[handoff,join(root,"peer")],scheduler);
			const [pulse,signals]=components;
			for(const [installed,id] of [[pulse,"pulse"],[signals,"signals"]])
			{
				assert.equal(installed.pkg.profile,"native-php-task-v1");assert.equal(installed.pkg.name,"lean-bridge/"+id);
			}
			assert.equal(typeof pulse.pkg.runtimeIdentity,"string");assert.equal(pulse.pkg.runtimeIdentity,signals.pkg.runtimeIdentity);
			for(const [component,source] of [[pulse,ir],[signals,await read(join(root,"peer","binding-ir.json"))]])
			{
				const pin=await read(join(vendor,component.pkg.name,"lean-bridge/package-receipt.json"));
				assert.equal(pin.bindingIrSha256,hashBindingIr(source));
			}
			const isolated={PATH: "/no-author-tools",LANG: "C.UTF-8",TMPDIR: deploy,LEAN_NUM_THREADS: "1"},results=[];
			for(const php of phps)
			{
				const ffi=await run(php,["-n","-r","echo (int)extension_loaded('ffi');"],deploy,isolated);
				const flags=ffi==="1"?["-n"]:["-n","-d","extension=ffi"];flags.push("-d","ffi.enable=1");
				for(const order of ["pulse-first","peer-first"])
				{
					const row=JSON.parse(await run(php,[...flags,"parked.php",order],deploy,isolated,60_000));
					assert.equal(row.order,order);assert.match(row.php,/^8\./u);
					assert.deepEqual(row.paths,{token: pathResult,close: pathResult});assert.equal(row.owners,0);assert.equal(row.fdDelta,0);
					results.push(row);
				}
			}
			assert.equal(new Set(results.map(r=>r.php)).size,phps.length);
			const packages=components.map(c=>({name: c.pkg.name,receiptSha256: c.receiptSha256,archive: c.pkg.artifacts[0]}));
			await writeFile(join(output,route+".json"),canonicalJson({route,clientSha256,scheduler: schedulerPackages,runtimeIdentity: pulse.pkg.runtimeIdentity,packages,results}));
			t.diagnostic(route+": "+results.length+" relocated PHP executions");
		}
		finally
		{await rm(stage,{recursive: true,force: true});}
	}
	t.diagnostic("Handoffs: "+root);
});
