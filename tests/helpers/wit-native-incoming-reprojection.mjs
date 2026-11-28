/** @file Install a real WIT projection of the exact native objects retained from the two C releases. */
import assert from "node:assert/strict";
import {copyFile,link,mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {basename,dirname,join} from "node:path";
import {nativeSharedRuntimeHeader} from "../../src/build/native-component.mjs";
import {readVerifiedNativeRuntime} from "../../src/build/native-artifacts.mjs";
import {projectOwnedWasi} from "../../src/build/owned-wit-projection.mjs";
import {writeNativePackageSet} from "../../src/release/package-set-assembly.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {checkStagedQuoteIdentities} from "./staged-quote-project.mjs";
import {copyPackageSetHandoff} from "./package-set.mjs";
import {runNativeTool} from "./native-effect-consumers.mjs";

const json=async path=>JSON.parse(await readFile(path));
const immutableRecord=route=>new URL("../../docs/evidence/c-incoming-functions-20261126/"+route+".json",import.meta.url);

/**
 * Qualify another host against existing compiled inputs, not a new author build.
 * Nothing inside the C archive executes. Verify its independently recorded pin
 * before extraction; use the production WIT verifier, producer and receipt writer.
 *
 * @param options - Scratch area, original retained handoffs, destination and route.
 * @param options.work - Private temporary parent directory.
 * @param options.donors - Directory containing the original C handoffs.
 * @param options.destination - New location for the verified WIT handoff.
 * @param options.route - Ordinary or independently reviewed author package.
 */
export const buildWitFromIncomingC=async ({work,donors,destination,route})=>{
	assert.ok(["ordinary","reviewed"].includes(route));
	const leanPrefix=process.env.LEAN_BRIDGE_LEAN_PREFIX;assert.ok(leanPrefix);
	const donor=join(donors,route),original=await json(immutableRecord(route));
	const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(donor,"package-set-receipt.json")});
	assert.equal(result.receiptSha256,original.receiptSha256);
	assert.equal(receipt.packages.length,1);const [pkg]=receipt.packages;
	assert.equal(pkg.target,"c");assert.deepEqual(pkg.artifacts,[original.archive]);
	const tmp=await mkdtemp(join(work,"reproject-"));
	try
	{
		const archive=join(donor,original.archive.path),top="tariff-quotes-1.0.0-c";
		const tar=async args=>runNativeTool("tar",args,tmp,process.env);
		const entries=(await tar(["-tzf",archive])).split("\n");
		assert.ok(entries.length && entries.every(p=>p.startsWith(top+"/")&&!p.split("/").includes("..")));
		await tar(["-xzf",archive]);
		const installed=join(tmp,top),share=join(installed,"share/lean-bridge");
		const nativeRoot=join(tmp,"component"),runtimeRoot=join(tmp,"runtime"),working=join(tmp,"out");
		const restore=async (src,dst)=>{await mkdir(dirname(dst),{recursive: true});await link(src,dst);};
		const meta=join(share,"component"),model=await json(join(meta,"model.json"));
		const moduleSource=model.sourceIdentity.modules.find(m=>m.module==="Owned").source;
		assert.equal(moduleSource.path,"Owned.lean");
		assert.equal(moduleSource.sha256,"8df990ee7666a9ea95544392fd379b3e656eefaaebce56dc1d92fdaa69661793");
		assert.equal(model.sourceIdentity.sourceTreeSha256,receipt.source.treeSha256);
		checkStagedQuoteIdentities(model,await json(join(meta,"binding-ir.json")),receipt.profiles.find(p=>p.id===pkg.profile),route,{incoming: true});
		const component=await json(join(meta,"native-component.json")),inventory=await json(join(meta,"artifacts.json"));
		for(const name of ["artifacts.json",...Object.keys(inventory.files)])
		{
			const notice=name==="source-notices.json"||/^source-notices\/[a-f0-9]{64}\.txt$/u.test(name);
			assert.ok(notice||basename(name)===name && /^[\w.-]+$/u.test(name) && name!==".." && name!==".");
			const from=name===component.library?join(installed,"lib"):notice?join(share,"licenses"):meta;
			await restore(join(from,name),join(nativeRoot,name));
		}
		const runtime=await json(join(share,"runtime.json"));
		await restore(join(share,"runtime.json"),join(runtimeRoot,"runtime.json"));
		for(const path of Object.keys(runtime.files))
		{
			const dest=join(runtimeRoot,path);
			if(/^lib\/lib(?:leanshared|lean_bridge_native)\.so$/u.test(path)) await restore(join(installed,path),dest);
			else
			{
				assert.ok(/^include\/lean\/[\w]+\.h$/u.test(path)||path==="include/lean_bridge_native_runtime.h");
				await mkdir(dirname(dest),{recursive: true});
				if(path==="include/lean_bridge_native_runtime.h") await writeFile(dest,nativeSharedRuntimeHeader,{flag: "wx"});
				else await copyFile(join(leanPrefix,path),dest);
			}
		}
		const {identity: runtimeIdentity}=await readVerifiedNativeRuntime(runtimeRoot);
		assert.equal(runtimeIdentity,original.runtimeIdentity);
		const projection=await projectOwnedWasi({working,nativeRoot,runtimeRoot,leanPrefix,settings: {name: pkg.name,version: pkg.version}});
		await writeNativePackageSet({root: working,model,runtimeIdentity,projections: [projection]});
		await copyPackageSetHandoff(working,destination);
		return {sourceTarget: "c",sourceReceiptSha256: result.receiptSha256,sourceArchiveSha256: original.archive.sha256,leanSourceSha256: moduleSource.sha256};
	}
	finally
	{ await rm(tmp,{recursive: true,force: true}); }
};
