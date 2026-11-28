/** @file Match scalar error and guest-trap observations to the same installed releases. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {readFile} from "node:fs/promises";
import {join} from "node:path";
import test from "node:test";
import {promisify} from "node:util";
import {hashBindingIr} from "../../src/binding-ir/canonical.mjs";
import {sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";

const ledger = "docs/evidence/npm-synchronous-io-delivery-20261126";
const traps = "docs/evidence/npm-callback-trap-delivery-20261126";
const realms = "docs/evidence/npm-matched-realm-errors-20261126";
const json = async path => JSON.parse(await readFile(path));
const digest = async path => sha256(await readFile(path));
const run = promisify(execFile);
const root = process.env.LEAN_BRIDGE_LEDGER_RELEASE_PAIR;

test("all three JavaScript realms match the scalar installation and the independently checked typed-client traps", async () => {
	for(const route of ["ordinary","reviewed"])
	{
		const scalar = await json(join(ledger, route + ".json"));
		const original = await json(join(traps, route + ".json"));
		const {otherRealms, ...delivery} = await json(join(realms, route + ".json"));
		assert.deepEqual(delivery, original);
		assert.equal(delivery.io, scalar.packageSetSha256);
		assert.equal(delivery.io, await digest(join(ledger, route + ".package-set.json")));
		assert.equal(delivery.callbacks, await digest(join(traps, "package-set-receipt.json")));
		assert.equal(delivery.reviewedSourceSha256, scalar.reviewedSourceSha256);
		assert.equal(Boolean(delivery.reviewedSourceSha256), route === "reviewed");
		assert.deepEqual(otherRealms.drivers, {
			nodeWorkerSha256: await digest("tests/helpers/javascript-wasm-callback-io-worker.mjs"),
			chromiumWorkerSha256: await digest("tests/helpers/javascript-wasm-callback-io-browser-worker.mjs"),
			diagnosticSourceSha256: await digest("tests/fixtures/javascript-wasm-callback-io/fault.c")
		});
		const expected = ["io-first","owned-first"].flatMap(order => [false,true].map(propagate =>
			({order, propagate, checks: 23, counterBeforeTrap: 4, healthyFinishes: 8, finishesAfterTrap: 0})));
		for(const [calls, faults] of [[scalar.node, otherRealms.node], [scalar.chromium, otherRealms.chromium],
			[scalar.ui.worker, otherRealms.chromiumWorkers.workers]])
		{
			assert.deepEqual(calls, {checks: 45, scalarKinds: 19, counter: 3});
			assert.deepEqual(faults, expected);
		}
		assert.deepEqual(otherRealms.nodeWorker, {worker: expected[3], parentCounter: 21});
		assert.equal(otherRealms.chromiumWorkers.parentCounter, 24);
	}
});

const verifySources = async (observed, fixture, common) => {
	for(const [name,hash] of Object.entries(observed))
	{
		if(name === "calls.mjs") assert.equal(await digest(join("tests/helpers",common)),hash);
		else if(name !== "loaders.mjs") assert.equal(await digest(join("tests/fixtures",fixture,name)),hash);
	}
};

test("retained TypeScript and React EIO and named failures match their compiled poison policy", {skip: !root}, async t => {
	const cbReceipt = join(traps,"package-set-receipt.json");
	const callbacks = await json(cbReceipt);
	const runtime = receipt => receipt.packages.find(p=>p.role==="runtime").artifacts[0].sha256;
	for(const route of ["ordinary","reviewed"])
	{
		const set = join(root,route,"packages/npm"), path = join(set,"package-set-receipt.json");
		const {receipt,result} = await readVerifiedPackageSetReceipt({receiptPath:path});
		const observed = await json(join(ledger,route+".json")), fault = await json(join(traps,route+".json"));
		const receiptHash = result.receiptSha256;
		assert.equal(receiptHash,await digest(join(ledger,route+".package-set.json")));
		assert.equal(observed.packageSetSha256,receiptHash); assert.equal(fault.io,receiptHash);
		assert.equal(fault.callbacks,await digest(cbReceipt)); assert.equal(runtime(receipt),runtime(callbacks));
		assert.equal(fault.reviewedSourceSha256,observed.reviewedSourceSha256);
		assert.equal(Boolean(fault.reviewedSourceSha256),route==="reviewed");
		assert.deepEqual(Object.keys(observed.sources).sort(),["calls.mjs","consumer.mts","react.mjs","worker.mjs"]);
		assert.deepEqual(Object.keys(fault.sources).sort(),["calls.mjs","consumer.mts","loaders.mjs","react.mjs"]);
		await verifySources(observed.sources,"javascript-ledger","javascript-wasm-io-calls.mjs");
		await verifySources(fault.sources,"javascript-wasm-callback-io","javascript-wasm-callback-io-calls.mjs");
		const component = r => r.packages.find(p=>p.role==="component");
		const names = [component(receipt).name,component(callbacks).name,"@lean-bridge/runtime"];
		const loaders = names.map(n=>"["+JSON.stringify(n)+",()=>import("+JSON.stringify(n)+")]");
		assert.equal(fault.sources["loaders.mjs"],sha256("const packages=new Map(["+loaders.join(",")+"]);export const load=n=>packages.get(n)();"));
		const archive = join(set,component(receipt).artifacts[0].path);
		const {stdout} = await run("tar",["-xOzf",archive,"package/metadata/binding-ir.json"]);
		const ir = JSON.parse(stdout);
		assert.equal(hashBindingIr(ir),receipt.profiles[0].bindingIrSha256);
		for(const name of ["Ledger.choose","RubyIO.nested"])
		{
			const decl = ir.declarations.find(d=>d.source.declaration===name);
			assert.equal(decl.source.extensions["lean-lang.org/effect"],"EIO");
			const id = "error:EIO."+name;
			assert.deepEqual(decl.failure,{mode:"declared",errors:[id],unexpected:"poison-runtime"});
			assert.equal(ir.errors.find(e=>e.id===id).payload.constructor,"result");
		}
		for(const profile of ["typescript","react"])
		{
			const common = profile === "typescript" ? observed.typescript.common : observed.ui.react;
			assert.deepEqual(common,{checks:45,scalarKinds:19,counter:3});
			const cases = [];
			for(const row of fault[profile])
			{
				const {order,propagate,checks,healthyFinishes,finishesAfterTrap,counterBeforeTrap} = row.common;
				assert.deepEqual([checks,healthyFinishes,finishesAfterTrap,counterBeforeTrap],[23,8,0,4]);
				if(profile==="react") assert.deepEqual(row.labels,["Run","Runtime retired","Peer update refused"]);
				else assert.deepEqual([row.entries,row.rejected],[1,true]);
				cases.push(order+":"+propagate);
			}
			assert.deepEqual(cases.sort(),["io-first:false","io-first:true","owned-first:false","owned-first:true"]);
		}
		t.diagnostic(route+" "+receiptHash+": EIO and failure:declared; strict TS and mounted React");
	}
});
