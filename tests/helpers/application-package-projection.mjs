/** @file Build or replay a separate host release from authenticated native Lean bytes. */
import assert from "node:assert/strict";
import {mkdir,readFile,rm} from "node:fs/promises";
import {join,resolve} from "node:path";
import {sha256} from "../../src/capsule/node.mjs";
import {writeNativePackageSet} from "../../src/release/package-set-assembly.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {restoreApplicationWheel} from "./native-application-wheel.mjs";
import {restoreApplicationC} from "./native-application-c.mjs";
import {retainPackageSetEvidence} from "./package-set.mjs";

/**
 * Retain the new release separately from its donor; discard only private
 * producer scratch before installing the destination archive.
 *
 * @param options - Scratch, pinned wheel, destination, author route and native projector.
 */
export const projectApplicationPackage=async options=>{
	const {work,root,handoff,pin,route,target,leanPrefix,project,replayPin,donorTarget="pypi"}=options;
	const stage=join(work,"projection");await mkdir(stage);
	assert.ok(["c","pypi"].includes(donorTarget));
	const restore=donorTarget==="c"?restoreApplicationC:restoreApplicationWheel;
	const donor=await restore(stage,resolve(handoff),pin,route,leanPrefix);
	const {nativeRoot,runtimeRoot,model,runtimeIdentity}=donor,working=join(stage,"producer");
	const srcComponent=JSON.parse(await readFile(join(nativeRoot,"native-component.json")));
	const compiled=sha256(await readFile(join(nativeRoot,srcComponent.library)));
	assert.equal(compiled,srcComponent.nativeLibrary.sha256);
	const set=resolve(root,route,"handoff");
	if(replayPin)assert.match(replayPin,/^[a-f0-9]{64}$/u);
	else
	{
		const projections=await project({working,nativeRoot,runtimeRoot,leanPrefix,environment: process.env});
		await writeNativePackageSet({root: working,model,runtimeIdentity,projections});
		await retainPackageSetEvidence(working,set);
	}
	const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(set,"package-set-receipt.json")});
	if(replayPin)assert.equal(result.receiptSha256,replayPin);
	assert.equal(receipt.packages.length,target==="cpan"?2:1);const pkg=receipt.packages.find(p=>p.role==="component");assert.ok(pkg);
	assert.equal(pkg.target,target);assert.equal(pkg.runtimeIdentity,runtimeIdentity);assert.equal(pkg.artifacts.length,1);
	const runtime=receipt.packages.find(p=>p.role==="runtime");
	if(target==="cpan")
	{
		assert.equal(pkg.name,"LeanBridge-TariffQuotes");assert.equal(runtime?.name,"LeanBridge-Runtime");
		assert.equal(runtime.target,target);assert.equal(runtime.runtimeIdentity,runtimeIdentity);assert.equal(runtime.artifacts.length,1);
	}
	assert.equal(receipt.source.treeSha256,model.sourceIdentity.sourceTreeSha256);
	await rm(stage,{recursive: true});
	const origin=donorTarget==="c"?{cReceiptSha256: donor.receiptSha256,cArchive: donor.cArchive}:{wheelReceiptSha256: donor.receiptSha256,wheel: donor.wheel};
	const row={route,...origin,sourceSha256: donor.sourceSha256,componentSha256: compiled,runtimeIdentity,receiptSha256: result.receiptSha256,archive: pkg.artifacts[0]};
	if(runtime)row.runtimeArchive=runtime.artifacts[0];
	return {set,pkg,profile: receipt.profiles.find(p=>p.id===pkg.profile),row,srcComponent,model};
};
