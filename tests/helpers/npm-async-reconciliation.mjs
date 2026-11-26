/** @file Reconcile Workshop, Budget and Reader installations across the five npm clients. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {readFile} from "node:fs/promises";
import {join} from "node:path";
import test from "node:test";
import {promisify} from "node:util";
import {sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";

const routes=["ordinary","reviewed"], empty=[0,0,0,0,0];
const json=async path=>JSON.parse(await readFile(join("docs/evidence",path+".json")));
const read=async (family,route)=>json(family+"-20261126/"+route);
const hash=async (fixture,name)=>sha256(await readFile(join("tests/fixtures",fixture,name)));
const clients=r=>[r.node,r.typescript,r.browser.page,r.browser.react,r.browser.worker];
const files=["calls.d.mts","calls.mjs","node.mjs","page.mjs","public.mjs","typed.mts","worker.mjs"];
const methods=["typedClientSha256","reactClientSha256","terminalClientSha256"];
const workshop=await json("javascript-threaded-host-regression-9431fd5");
const captures=async route=>Promise.all(["threaded-pull-cleanup","npm-once-callback","npm-callback-cancellation","npm-parked-reader"].map(f=>read(f,route)));
const run=promisify(execFile);

test("five installed npm hosts distinguish settlement, callback reuse, cursor failures and blocked-reader cleanup",async () => {
	// The original two-component integration record identifies its run revision
	// rather than recording a client digest. This is calls.mjs at 9431fd5.
	assert.equal(await hash("javascript-threaded-host","calls.mjs"),"5420c4c57b681f62894f8ad64d9c2d6b70047a1615d689b7c8e5fd1164653e29");
	for(const route of routes) {
		const [typed,budget,reused,reader]=await captures(route);
		assert.equal(typed.packageSetSha256,workshop.packages[route].receiptSha256);
		assert.equal(Boolean(typed.reviewedSourceSha256),route==="reviewed");
		const suite=workshop.runs[route], {page,worker,...closed}=suite.chromiumDeployment;
		for(const executed of [suite.node,suite.chromium,page,worker]) assert.equal(executed.checks,36);
		assert.deepEqual(closed,{state:"closed",frames:0,allocations:0,pending:0,nativeOwners:0,notifications:0});
		for(const [i,file] of ["installed-delivery.mts","react-delivery.mjs","terminal-delivery.mts"].entries())
			assert.equal(typed[methods[i]],await hash("javascript-threaded-host",file));
		const terminal={reason:"operation-cancelled",visits:1,successes:0,failures:1,state:"closed",drained:true};
		const finalized={level:0,writes:1,reads:1};
		for(const [result,cleanup] of [[typed.typescript,typed.typescript.cleanup],[typed.react,typed.react.stream.cleanup]]) {
			assert.deepEqual(result.nested,["outer","inner-error","caught-original","inner-success","resumed"]);
			assert.deepEqual(result.terminal,terminal); assert.ok(result.drained);
			assert.deepEqual(cleanup,{phase:"step",beforeReturn:finalized,exhausted:true,afterReturns:finalized});
		}
		assert.equal(typed.typescript.yielded,1); assert.equal(typed.typescript.readsAtExhaustion,1);
		assert.equal(typed.react.stream.idleReads,0); assert.equal(typed.react.lateCommits,0); assert.ok(typed.react.empty);
		for(const [capture,fixture] of [[reader,"javascript-parked-reader"],[budget,"javascript-once-callback"],[reused,"javascript-callback-cancellation"]]) {
			assert.equal(capture.route,route); assert.equal(Boolean(capture.reviewedSourceSha256),route==="reviewed");
			assert.deepEqual(Object.keys(capture.sources).sort(),files);
			for(const file of files) {
				const driver=["node.mjs","worker.mjs"].includes(file)?"javascript-parked-reader":
					fixture==="javascript-callback-cancellation" && ["page.mjs","public.mjs"].includes(file)?"javascript-once-callback":fixture;
				assert.equal(capture.sources[file],await hash(driver,file));
			}
		}
		for(const key of ["receiptSha256","installedBytes","archives","reviewedSourceSha256"]) assert.deepEqual(reused[key],budget[key]);
		const stopped={beforeReply:empty,calls:[1,2],failures:1,freshSettlements:1,successes:0};
		for(const r of clients(reused)) assert.deepEqual(r,{earlyEntries:0,lateError:stopped,lateValue:stopped,live:empty,recovered:42});
		for(const r of clients(budget)) assert.deepEqual(r,{first:1,many:2,nested:1,attempted:1,sameFunction:3,recovered:42,live:empty});
		for(const r of clients(reader)) assert.deepEqual(r,{failures:1,finalizers:1,late:73,live:empty,successes:0,
			whileParked:{closes:0,drained:false,nativeOwners:1,pulls:1}});
	}
});

const {LEAN_BRIDGE_JS_DELIVERY_RELEASES:workshops,LEAN_BRIDGE_NPM_ONCE_CALLBACK_REPLAY:budgets,
	LEAN_BRIDGE_NPM_PARKED_READER_REPLAY:readers}=process.env;
test("archived releases contain the exact Wasm deployed by each installed client", {skip:!(workshops && budgets && readers)},async () => {
	const check=async(path,id,expected,wasm)=>{
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath:join(path,"package-set-receipt.json")});
		assert.equal(result.receiptSha256,id); assert.equal(receipt.profiles[0].id,"javascript-wasm-threaded-task-v1");
		const hashes=[];
		for(const p of receipt.packages) {
			const [archive]=p.artifacts; assert.ok(expected.some(a=>a.sha256===archive.sha256 && a.bytes===archive.bytes && a.path===archive.path));
			const member=p.role==="component"?"component":"task";
			const {stdout}=await run("tar",["-xOzf",join(path,archive.path),"package/internal/"+member+".wasm"],{encoding:"buffer",maxBuffer:16<<20});
			hashes.push(sha256(stdout));
		}
		if(wasm) assert.deepEqual(hashes.sort(),wasm);
	};
	for(const route of routes) {
		const [typed,budget,,reader]=await captures(route);
		await check(join(workshops,route,"packages/npm"),typed.packageSetSha256,workshop.packages[route].artifacts,typed.deployed);
		await check(join(budgets,route),budget.receiptSha256,budget.archives,budget.installedBytes);
		await check(join(readers,route),reader.receiptSha256,reader.archives,reader.installedBytes);
	}
	const peer=workshop.packages["peer-release"];
	await check(join(workshops,"peer-release/packages/npm"),peer.receiptSha256,peer.artifacts);
});
