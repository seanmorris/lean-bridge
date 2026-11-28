/** @file Exercise effect grants on independently published, relocated host-worker packages. */
import assert from "node:assert/strict";
import {access,appendFile,copyFile,link,mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {dirname,join,resolve} from "node:path";
import {hashBindingIr} from "../../src/binding-ir/canonical.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";

const json=async path=>JSON.parse(await readFile(path,"utf8")),family="tests/fixtures/native-host-effects";
const cfgFile="lean-bridge.exports.json",receiptFile="package-set-receipt.json";
const environment="capability:native.environment",filesystem="capability:native.filesystem";
const verify=dir=>readVerifiedPackageSetReceipt({receiptPath: join(dir,receiptFile)});
const retain=async(out,dir,r)=>{
	await mkdir(dir);
	const files=[receiptFile,receiptFile+".sha256","binding-ir.json","host-export-evidence.json",...r.packages.flatMap(p=>p.artifacts.map(a=>a.path))];
	for(const f of files)
	{
		const src=join(out,f),dest=join(dir,f);await mkdir(dirname(dest),{recursive: true});
		try
		{await link(src,dest);}
		catch(e)
		{if(e.code!=="EXDEV")throw e;await copyFile(src,dest);}
	}
};
/**
 * Run the same real Lean IO implementation on each host. A consumer failure
 * can be replayed from the original receipts without recompiling Lean.
 *
 * @param t - Node test context.
 * @param spec - Target, receipt profile, author project factory and installer/client.
 */
export const checkHostWorkerEffects=async(t,spec)=>{
	const {target,profile,prepare,consume}=spec,root=await mkdtemp(join(tmpdir(),target+"-worker-effects-"));
	t.after(()=>rm(root,{recursive: true,force: true}));
	const env=process.env,prior=env.LEAN_BRIDGE_HOST_EFFECT_ORDINARY,replay=env.LEAN_BRIDGE_HOST_EFFECT_REPLAY;
	const kept=env.LEAN_BRIDGE_HOST_EFFECT_HANDOFFS;
	const releases=kept?await mkdtemp(join(kept,target+"-effects-releases-")):null;
	if(releases)t.diagnostic("handoffs: "+releases);
	let review;
	for(const route of ["denied",...spec.blockingOwner?["blocked-owner"]:[],"ordinary","reviewed"])
	{
		if(replay && (route==="denied" || route==="blocked-owner"))continue;
		const stage=join(root,route),src=join(stage,"source"),fresh=join(stage,"release");
		await mkdir(stage);
		let dir=replay?resolve(replay,route):prior && route==="ordinary"?resolve(prior):null;
		if(!dir)
		{
			await prepare(src);const cfg=await json(join(src,cfgFile)),extra=await json(join(family,cfgFile));
			await copyFile("LICENSE",join(src,"LICENSE"));await copyFile(join(family,"Effects.lean"),join(src,"Effects.lean"));
			await appendFile(join(src,"lakefile.toml"),'\n[[lean_lib]]\nname = "Effects"\n');
			for(const field of ["modules","exports","taskExports","asyncIterators"])(cfg[field]??=[]).push(...extra[field]);
			cfg.nativeEffects=route==="denied"?["environment"]:extra.nativeEffects;
			if(route==="blocked-owner")
			{
				const cursor=cfg.asyncIterators.find(x=>x.open==="Effects.walk");
				assert.equal(cursor.close,"Effects.close");cursor.close="Effects.blockingClose";
				await appendFile(join(src,"Effects.lean"),await readFile(join(family,"owner-wait.lean.in")));
			}
			if(route==="reviewed")
			{delete cfg.exports;await writeFile(join(src,"worker.binding-ir.json"),canonicalJson(review));}
			await writeFile(join(src,cfgFile),canonicalJson(cfg));
			const args=[resolve("scripts/lean-bridge.mjs"),"build","--project",src,"--target",target,"--output",fresh,"--json","--progress","none"];
			const build=()=>run(process.execPath,args,stage,env,1200000);
			if(route==="denied" || route==="blocked-owner")
			{
				const refused=route==="denied"
					? e=>["Effects.worker","Effects.pull","Effects.close"].every(n=>e.message.includes(n+" requires nativeEffects")) && e.message.includes("filesystem")
					: e=>["Effects.blockingClose","lean_io_wait","can block the "+spec.blockingOwner+" host owner"].every(s=>e.message.includes(s));
				await assert.rejects(build(),refused);
				await assert.rejects(access(fresh),{code: "ENOENT"});continue;
			}
			await build();await rm(src,{recursive: true});dir=fresh;
		}
		const {receipt,result}=await verify(dir);
		assert.deepEqual(result.profiles,[profile]);assert.ok(receipt.packages.every(p=>p.target===target));
		const api=await json(join(dir,"binding-ir.json")),ev=await json(join(dir,"host-export-evidence.json"));
		assert.equal(receipt.profiles[0].bindingIrSha256,hashBindingIr(api));assert.equal(ev.sourceTreeSha256,receipt.source.treeSha256);
		if(route==="ordinary")review=api;else assert.deepEqual(api,review);
		assert.equal(ev.reviewedSourceSha256,route==="ordinary"?null:sha256(canonicalJson(review)));
		const phases=n=>api.declarations.find(d=>d.source.declaration==="Effects."+n).source.extensions["lean-bridge.dev/native-effects-v1"];
		assert.deepEqual(phases("walk"),{startup: [environment],pull: [filesystem],close: [filesystem]});
		assert.deepEqual(phases("worker"),{startup: [environment],call: [filesystem]});
		const leaves=n=>ev.metadata.nativeEffectAudit.roots.find(r=>r.declaration===n).leaves.map(l=>l.symbol);
		assert.ok(leaves("Effects.pull").includes("lean_io_prim_handle_read"));assert.ok(leaves("Effects.close").includes("lean_io_prim_handle_put_str"));
		// Install from a handoff containing only the original deliverables and evidence.
		const handoff=releases?join(releases,route):join(stage,"handoff");
		await retain(dir,handoff,receipt);
		if(dir===fresh)await rm(fresh,{recursive: true});
		assert.equal((await verify(handoff)).result.receiptSha256,result.receiptSha256);
		const count=await consume(root,handoff,receipt,route);
		t.diagnostic(route+" "+result.receiptSha256+" "+count+" relocated clients");
	}
};
