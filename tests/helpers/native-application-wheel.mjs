/** @file Restore the receipt-verified native Lean component and runtime from a published wheel layout. */
import assert from "node:assert/strict";
import {copyFile,link,lstat,mkdir,readFile,writeFile} from "node:fs/promises";
import {basename,dirname,join} from "node:path";
import {nativeSharedRuntimeHeader} from "../../src/build/native-component.mjs";
import {readVerifiedNativeRuntime,readVerifiedNativeComponent} from "../../src/build/native-artifacts.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runNativeTool} from "./native-effect-consumers.mjs";
import {checkApplicationFunctionPositions,checkStagedQuoteIdentities,checkTicketExchangePositions} from "./staged-quote-project.mjs";

const json=async p=>JSON.parse(await readFile(p));
const restore=async(src,dst)=>{
	assert.ok((await lstat(src)).isFile(),src);await mkdir(dirname(dst),{recursive: true});await link(src,dst);
};

/**
 * Require an independently supplied donor pin; never execute code from the wheel.
 *
 * @param work - Exclusive directory on the destination filesystem.
 * @param handoff - Original complete wheel/gem/crate package set.
 * @param pin - Previously recorded receipt hash for this author route.
 * @param route - Ordinary or reviewed author.
 * @param leanPrefix - Pinned distribution providing headers omitted from consumer packages.
 */
export const restoreApplicationWheel=async(work,handoff,pin,route,leanPrefix)=>{
	assert.match(pin,/^[a-f0-9]{64}$/u);
	const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(handoff,"package-set-receipt.json")});
	assert.equal(result.receiptSha256,pin);assert.deepEqual(receipt.packages.map(p=>p.target).sort(),["cargo","pypi","rubygems"]);
	const pkg=receipt.packages.find(p=>p.target==="pypi");assert.equal(pkg.name,"tariff-quotes");assert.equal(pkg.version,"1.0.0");
	assert.equal(pkg.artifacts.length,1);const [artifact]=pkg.artifacts,file=join(handoff,artifact.path);
	const dist="tariff_quotes-1.0.0.dist-info",mod="lean_tariff_quotes";
	const entries=(await runNativeTool("unzip",["-Z1",file],work,process.env)).split("\n");
	assert.ok(entries.length&&entries.every(p=>[dist,mod].includes(p.split("/")[0])&&p.split("/").every(s=>/^[A-Za-z0-9_+.-]+$/u.test(s)&&s!=="."&&s!=="..")));
	assert.equal(new Set(entries).size,entries.length);
	await runNativeTool("unzip",["-q",file],work,process.env);
	const base=join(work,mod),share=join(base,"lean_bridge"),libs=join(base,"native/linux-x64"),licenses=join(work,dist,"licenses");
	const payload=await restoreApplicationPayload({work,leanPrefix,share,libs,licenses,pkg,receipt,route,tickets: false});
	return {...payload,wheel: artifact,receiptSha256: pin};
};

/**
 * Reconstitute producer inputs from a native distribution. The same component
 * and runtime verifiers authenticate the layout regardless of the host package.
 *
 * @param options - Unpacked metadata, library and notice roots and expected author contract.
 */
export const restoreApplicationPayload=async options=>{
	const {work,leanPrefix,share,libs,licenses,pkg,receipt,route,tickets}=options,meta=join(share,"component");
	const nativeRoot=join(work,"component"),runtimeRoot=join(work,"runtime");
	const model=await json(join(meta,"model.json")),ir=await json(join(meta,"binding-ir.json"));
	checkStagedQuoteIdentities(model,ir,receipt.profiles.find(p=>p.id===pkg.profile),route,{hostFunctions: true,ticketExchange: tickets});
	checkApplicationFunctionPositions(ir);if(tickets)checkTicketExchangePositions(ir);
	const source=model.sourceIdentity.modules.find(m=>m.module==="Owned").source;
	assert.equal(source.path,"Owned.lean");assert.equal(source.sha256,tickets?"a758f8e7a4210d99fe965aa06c4b42006df3c087c70f2bde8d0e1403c30a98fb":"a5b7145185c50be1f7984d06b262556e5ef1ec94d67b8c9bab9dbb301b074415");
	assert.equal(model.sourceIdentity.sourceTreeSha256,receipt.source.treeSha256);
	const component=await json(join(meta,"native-component.json")),inventory=await json(join(meta,"artifacts.json"));
	for(const name of ["artifacts.json",...Object.keys(inventory.files)])
	{
		const notice=name==="source-notices.json"||/^source-notices\/[a-f0-9]{64}\.txt$/u.test(name);
		assert.ok(notice||basename(name)===name&&/^[\w.-]+$/u.test(name)&&name!=="."&&name!=="..");
		await restore(join(notice?licenses:name===component.library?libs:meta,name),join(nativeRoot,name));
	}
	await restore(join(share,"runtime.json"),join(runtimeRoot,"runtime.json"));
	const runtime=await json(join(runtimeRoot,"runtime.json"));
	for(const path of Object.keys(runtime.files))
	{
		const dest=join(runtimeRoot,path);
		if(/^lib\/lib(?:leanshared|lean_bridge_native)\.so$/u.test(path))await restore(join(libs,basename(path)),dest);
		else
		{
			assert.ok(/^include\/lean\/\w+\.h$/u.test(path)||path==="include/lean_bridge_native_runtime.h");await mkdir(dirname(dest),{recursive: true});
			if(path==="include/lean_bridge_native_runtime.h")await writeFile(dest,nativeSharedRuntimeHeader,{flag: "wx"});
			else await copyFile(join(leanPrefix,path),dest);
		}
	}
	const {identity}=await readVerifiedNativeRuntime(runtimeRoot);assert.equal(identity,pkg.runtimeIdentity);
	const verified=await readVerifiedNativeComponent(nativeRoot,identity,{ownedGraphs: true,ownedHostCallbacks: true});
	assert.deepEqual(verified.model,model);assert.deepEqual(verified.receipt,component);
	return {nativeRoot,runtimeRoot,model,runtimeIdentity: identity,sourceSha256: source.sha256};
};
