/** @file Qualify a Maven worker release against a separately compiled peer. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { runJvmHostConsumers } from "./jvm-host-installed.mjs";

/**
 * Verify the exact artifact bytes, selection and review before installing
 * the JARs and compiling downstream callers in both host languages.
 *
 * @param root - Holds the published ordinary, peer, and optionally reviewed handoffs.
 * @param route - Main application author route to pair with the peer.
 */
export const qualifyJvmWorkers = async (root,route) => {
	assert.ok(["ordinary","reviewed"].includes(route));
	const packs=[];
	for(const name of [route,"peer"])
	{
		const dir=join(root,name), json=async f=>JSON.parse(await readFile(join(dir,f)));
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(dir,"package-set-receipt.json")});
		const ir=await json("binding-ir.json"), ev=await json("host-export-evidence.json");
		assert.match(ir.errors.find(e=>e.id==="error:JvmCallbackException").documentation.summary,/retained JVM callback/u);
		assert.equal(ev.selection.jvmTaskObjects,true); assert.equal(ev.sourceTreeSha256,receipt.source.treeSha256);
		if(name==="reviewed")
		{
			assert.deepEqual(ir,JSON.parse(await readFile(join(root,"ordinary/binding-ir.json"))));
			assert.equal(ev.reviewedSourceSha256,sha256(canonicalJson(ir)));
		} else assert.equal(ev.reviewedSourceSha256,null);
		const [pkg]=receipt.packages; assert.equal(receipt.packages.length,1);
		const artifact=name==="peer"?"workshop-peer":"workshop";
		assert.equal(pkg.name,"org.leanbridge:"+artifact); assert.equal(pkg.profile,"native-jvm-task-v1");
		assert.equal(pkg.runtimeDelivery,"embedded"); assert.equal(pkg.artifacts.length,2);
		packs.push({name: artifact,receipt: result.receiptSha256,artifacts: pkg.artifacts,files: pkg.artifacts.map(a=>join(dir,a.path))});
	}
	const consumers=await runJvmHostConsumers(root,packs,true);
	assert.equal(consumers.length,6);
	return {packages: packs.map(({name,receipt,artifacts})=>({name,receipt,artifacts})),consumers};
};
