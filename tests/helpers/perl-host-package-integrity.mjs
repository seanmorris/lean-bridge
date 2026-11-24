/** @file Recompute the inventory after a mutation and require semantic verification to catch it. */
import assert from "node:assert/strict";
import {cp,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {readVerifiedCpanPackage,refreshCpanInventory} from "../../src/release/cpan-package.mjs";

/**
 * Check the archive boundary, not just a stale checksum on a changed file.
 *
 * @param directory - Verified component distribution with prebuilt XS.
 * @param scratch - Parent of the private mutation copies.
 */
export const checkPerlHostIntegrity = async (directory,scratch) => {
	const {manifest}=await readVerifiedCpanPackage(directory);
	const v=manifest.prebuilt[0], xsReceipt="prebuilt/"+v.abiKey+"/receipt.json";
	const cases=[
		["erased profile",async(_,m)=>{delete m.hostImports;},/select different profiles/u],
		["ambiguous profile",async(_,m)=>{m.syncIO=m.hostImports;},/select different profiles/u],
		["shadow module",async d=>writeFile(join(d,"lib/Unexpected.pm"),"1;\n"),/unexpected installed file/u],
		["extra test",async d=>writeFile(join(d,"t/extra.t"),"1;\n"),/unexpected installed file/u],
		["source receipt",async d=>{
			const p=join(d,xsReceipt), r=JSON.parse(await readFile(p));r.sourceSha256="0".repeat(64);await writeFile(p,JSON.stringify(r));
		},/XS compile receipt differs/u],
		["installer",async d=>writeFile(join(d,"Makefile.PL"),"1;\n"),/configuration or load test differs/u]
	];
	for(const [label,change,message] of cases) {
		const d=await mkdtemp(join(scratch,"host-integrity-"));
		try {
			await cp(directory,d,{recursive:true});
			const m=structuredClone(manifest);await change(d,m);await refreshCpanInventory(d,m);
			await assert.rejects(readVerifiedCpanPackage(d),message,label);
		} finally {await rm(d,{recursive:true,force:true});}
	}
};
