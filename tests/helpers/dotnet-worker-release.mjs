/** @file Verify two public NuGet handoffs, then run their relocated offline C# consumer. */
import assert from "node:assert/strict";
import { link, mkdtemp, readFile, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { runDotnetHostConsumers } from "./dotnet-host-installed.mjs";

/**
 * Check the handoff receipt and review evidence before the NuGet restore.
 *
 * @param root - Contains ordinary, peer, and (on that route) reviewed CLI outputs.
 * @param route - Which primary build to pair with the independently built peer.
 */
export const qualifyDotnetWorkers = async (root,route) => {
	assert.ok(["ordinary","reviewed"].includes(route));
	const feed=await mkdtemp(join(root,"feed-")), packages=[];
	try
	{
		for(const dir of [route,"peer"])
		{
			const output=join(root,dir);
			const {result,receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(output,"package-set-receipt.json")});
			const evidence=JSON.parse(await readFile(join(output,"host-export-evidence.json")));
			const ir=JSON.parse(await readFile(join(output,"binding-ir.json")));
			assert.equal(evidence.selection.dotnetTaskObjects,true);
			assert.equal(evidence.sourceTreeSha256,receipt.source.treeSha256);
			if(dir==="reviewed")
			{
				const ordinary=JSON.parse(await readFile(join(root,"ordinary/binding-ir.json")));
				assert.deepEqual(ir,ordinary); assert.equal(evidence.reviewedSourceSha256,sha256(canonicalJson(ordinary)));
			} else assert.equal(evidence.reviewedSourceSha256,null);
			assert.equal(receipt.packages.length,1); const [pkg]=receipt.packages;
			assert.equal(pkg.name,dir==="peer"?"Acme.Peer":"Acme.Workshop"); assert.equal(pkg.profile,"native-dotnet-task-v1");
			assert.equal(pkg.runtimeDelivery,"embedded"); assert.equal(pkg.artifacts.length,1);
			const [artifact]=pkg.artifacts;
			await link(join(output,artifact.path),join(feed,basename(artifact.path)));
			packages.push({route: dir,receipt: result.receiptSha256,archive: artifact.sha256});
		}
		return {packages,consumers: await runDotnetHostConsumers(root,feed,true)};
	} finally
	{ await rm(feed,{recursive: true,force: true}); }
};
