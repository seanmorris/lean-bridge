/** @file Restore the component, not the C adapter, from the canonical Ticket and forwarding release. */
import assert from "node:assert/strict";
import {join} from "node:path";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {restoreApplicationPayload} from "./native-application-wheel.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";

/**
 * Authenticate the complete handoff before opening its C archive. Reject
 * links and non-regular metadata; no program from the donor is executed.
 *
 * @param work - Empty private extraction directory.
 * @param handoff - Original verified C/WIT package set.
 * @param pin - Independent original receipt digest for this route.
 * @param route - Ordinary or reviewed author.
 * @param leanPrefix - Lean distribution supplying receipt-checked headers.
 */
export const restoreApplicationC=async(work,handoff,pin,route,leanPrefix)=>{
	assert.match(pin,/^[a-f0-9]{64}$/u);
	const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(handoff,"package-set-receipt.json")});
	assert.equal(result.receiptSha256,pin);
	const targets=receipt.packages.map(p=>p.target).sort();assert.deepEqual(targets,targets.length===2?["c","wit-wasi"]:["c","cpp","wit-wasi"]);
	const pkg=receipt.packages.find(p=>p.target==="c");assert.equal(pkg.name,"tariff-quotes");assert.equal(pkg.version,"1.0.0");
	assert.equal(pkg.artifacts.length,1);const [artifact]=pkg.artifacts,top="tariff-quotes-1.0.0-c";
	assert.equal(artifact.path,"archives/"+top+".tar.gz");
	const file=join(handoff,artifact.path),listing=await run("tar",["--numeric-owner","-tvzf",file],work,process.env);
	const members=new Set();
	for(const entry of listing.split("\n"))
	{
		const match=/^[-d][^\s]*\s+\d+\/\d+\s+\d+\s+[\d-]+\s+[\d:]+\s+([^\s]+)$/u.exec(entry);assert.ok(match,entry);
		const path=match[1].replace(/\/$/u,"");assert.ok(path.startsWith(top+"/")||path===top);
		assert.ok(path.split("/").every(p=>/^[\w+.-]+$/u.test(p)&&p!=="."&&p!==".."));assert.ok(!members.has(path));members.add(path);
	}
	await run("tar",["-xzf",file,"--no-same-owner","--no-same-permissions"],work,process.env);
	const base=join(work,top),share=join(base,"share/lean-bridge"),libs=join(base,"lib"),licenses=join(share,"licenses");
	const payload=await restoreApplicationPayload({work,leanPrefix,share,libs,licenses,pkg,receipt,route,tickets: true});
	return {...payload,cArchive: artifact,receiptSha256: pin};
};
