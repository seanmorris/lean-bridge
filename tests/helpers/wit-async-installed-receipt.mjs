/** @file Bind a WIT consumer observation to the release actually installed. */
import assert from "node:assert/strict";
import {access,readFile} from "node:fs/promises";
import {join} from "node:path";
import {hostPublicHash} from "../../src/analyze/host-records.mjs";
import {sha256} from "../../src/capsule/node.mjs";

/** Read the authoring route from the installed compiler and review, not the handoff directory name. */
export const witInstalledReceipt=async(prefix,{receipt,result})=>{
	const [pkg]=receipt.packages,[archive]=pkg.artifacts, metadata=join(prefix,"share/lean-bridge");
	const parse=async path=>JSON.parse(await readFile(path,"utf8"));
	const reviewPath=join(metadata,"reviewed.binding-ir.json");
	const [manifest,ir,compiler]=await Promise.all([parse(join(prefix,"lean-bridge-package.json")),parse(join(metadata,"binding-ir.json")),parse(join(metadata,"elaboration.json"))]);
	const irHash=hostPublicHash(ir), reviewed=compiler.reviewedSourceSha256;
	assert.deepEqual([manifest.name,manifest.profile,manifest.bindingIrSha256,manifest.runtimeIdentity],[pkg.name,pkg.profile,irHash,pkg.runtimeIdentity]);
	assert.equal(receipt.profiles.find(p=>p.id===pkg.profile)?.bindingIrSha256,irHash);
	assert.equal(manifest.reviewedSourceSha256??null,reviewed);
	if(reviewed===null)await assert.rejects(access(reviewPath),{code:"ENOENT"});
	else {
		const review=await readFile(reviewPath);
		assert.equal(sha256(review),reviewed);
		assert.deepEqual(JSON.parse(review),ir);
	}
	return {name:pkg.name,profile:pkg.profile,route:reviewed===null?"ordinary":"reviewed",
		receiptSha256:result.receiptSha256,archiveSha256:archive.sha256,bindingIrSha256:irHash,reviewedSourceSha256:reviewed};
};
