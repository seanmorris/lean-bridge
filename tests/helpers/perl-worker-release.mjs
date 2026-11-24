/** @file Verify the retained CPAN archives and install the same bytes without the publisher. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { checkInstalledPerlHostPair } from "./perl-host-installed.mjs";

/**
 * Recheck each original receipt, API and review selection before installation.
 *
 * @param o - Release root, isolated consumer staging, interpreters, dependencies and progress callback.
 * @param o.releases - Parent of the three retained handoffs.
 * @param o.scratch - Temporary consumer installations, separate from immutable handoffs.
 * @param o.perls - The real Perl interpreters to exercise.
 * @param o.workerDeps - Offline Future and IO::Async modules.
 * @param o.report - Called after each complete relocated three-process consumer check.
 */
export const qualifyInstalledPerlWorkers=async ({releases,scratch,perls,workerDeps,report})=>{
	const packs=new Map(), archives=new Set();
	let ordinary;
	for(const route of ["ordinary","peer","reviewed"])
	{
		const dir=join(releases,route), json=async name=>JSON.parse(await readFile(join(dir,name)));
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(dir,"package-set-receipt.json")});
		const api=await json("binding-ir.json"), ev=await json("host-export-evidence.json");
		assert.equal(ev.selection.perlTaskObjects,true); assert.equal(ev.sourceTreeSha256,receipt.source.treeSha256);
		assert.equal(receipt.profiles[0].bindingIrSha256,hashBindingIr(api));
		if(route==="ordinary") ordinary=api;
		if(route==="reviewed") assert.deepEqual(api,ordinary);
		assert.equal(ev.reviewedSourceSha256,route==="reviewed"?sha256(canonicalJson(ordinary)):null);
		assert.deepEqual(result.profiles,["native-perl-task-v1"]);
		const pack={}; packs.set(route,pack);
		assert.equal(receipt.packages.length,2);
		for(const p of receipt.packages)
		{
			assert.equal(p.name,p.role==="runtime"?"LeanBridge-Runtime":route==="peer"?"LeanBridge-Peer":"LeanBridge-Workshop");
			assert.equal(p.artifacts.length,1);
			const [a]=p.artifacts; archives.add(a.sha256);
			pack[p.role]=join(dir,a.path); pack[p.role+"Sha"]=a.sha256;
		}
	}
	assert.equal(archives.size,4,"Three independent components and one shared runtime");
	const peer=packs.get("peer");
	for(const route of ["ordinary","reviewed"])
	{
		const main=packs.get(route); assert.equal(main.runtimeSha,peer.runtimeSha);
		const set={runtime: main.runtime,Workshop: main.component,Peer: peer.component};
		for(const perl of perls) for(const componentMode of ["prebuilt-only","build-xs"])
		{
			await checkInstalledPerlHostPair({scratch,set,route,interpreter: perl,workerDeps,componentMode});
			report(route+" "+componentMode+" "+perl+": relocated applications passed in both load orders");
		}
	}
};
