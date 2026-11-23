/**
 * Derive the public CPAN resource evidence summary from retained archives,
 * installed TAP and a second build made by a separately installed CLI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";

/**
 * Require both the authentic producer receipts and the actual consumer results.
 *
 * @param root - Directory of original independent handoffs and retained TAP files.
 * @param rebuilt - Independently reproduced ordinary task handoff and CLI receipt.
 */
export const perlLeasePin=async(root,rebuilt)=>{
	const original=await readFile(join(root,"acceptance.json")), second=await readFile(join(rebuilt,"reproduction.json"));
	const evidence=JSON.parse(original),offlineCLI=JSON.parse(second);
	const {runtime,ledger,sources}=evidence;
	const routes=["ordinary","reviewed","counter","peer","foreign"];
	assert.deepEqual(evidence.packages.map(p=>p.route),routes);
	for(const [file,hash] of Object.entries(sources))
	{
		assert.match(file,/^[a-zA-Z0-9.-]+$/u);
		assert.equal(sha256(await readFile(join(root,file))),hash);
	}
	const packages=[];
	for(const p of evidence.packages)
	{
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(root,p.route,"handoff/package-set-receipt.json")});
		assert.equal(result.receiptSha256,p.receiptSha256);
		const component=receipt.packages.find(q=>q.role==="component"), rt=receipt.packages.find(q=>q.role==="runtime");
		assert.deepEqual(receipt.profiles,[{id: p.id,bindingIrSha256: p.bindingIrSha256,runtimeIdentity: p.audit.nativeRuntime}]);
		assert.equal(rt.artifacts[0].sha256,runtime.sha256); assert.equal(rt.version,runtime.version);
		assert.equal(component.artifacts[0].sha256,p.componentSha256);
		if(["ordinary","reviewed","counter"].includes(p.route)) assert.deepEqual(p.audit.ledger,ledger);
		const modules=p.audit.sourceModules;
		for(const [name,hash] of Object.entries(modules))
		{
			assert.match(name,/^[A-Za-z][A-Za-z0-9_]*$/u);
			assert.equal(sha256(await readFile(join(root,p.route,"source",name+".lean"))),hash);
		}
		packages.push({route: p.route,profile: p.id,bindingIrSha256: p.bindingIrSha256,receiptSha256: result.receiptSha256,component: component.artifacts[0],modules});
	}
	const build=await readVerifiedPackageSetReceipt({receiptPath: join(rebuilt,"handoff/package-set-receipt.json")});
	assert.equal(offlineCLI.receiptSha256,packages[0].receiptSha256);
	assert.equal(build.result.receiptSha256,offlineCLI.receiptSha256);
	assert.deepEqual(offlineCLI.artifacts,build.receipt.packages.flatMap(p=>p.artifacts));
	assert.equal(packages[0].bindingIrSha256,packages[1].bindingIrSha256);
	assert.notEqual(packages[0].modules.Shared,packages[4].modules.Shared);
	const counts=()=>({passed: 0,skipped: 0,planned: 0}),prebuilt=counts(),sourceBuild=counts();
	const sum=async(file,record,skips,total)=>{
		const tap=await readFile(join(root,file),"utf8");
		assert.equal(sha256(tap),record.tapSha256);
		const lines=tap.split("\n").filter(s=>/^ok \d+\b/u.test(s));
		assert.doesNotMatch(tap,/^not ok\b/mu);
		assert.equal(Number(/^1\.\.(\d+)$/mu.exec(tap)?.[1]),lines.length);
		assert.ok(lines.length>0); assert.equal(lines.length,record.tests);
		assert.equal(lines.filter(s=>/# skip\b/iu.test(s)).length,skips); assert.equal(record.skips,skips);
		total.planned+=lines.length; total.skipped+=skips; total.passed+=lines.length-skips;
	};
	const cases=["ordinary-first","task-first","retirement","bad-ledger","foreign-first","foreign-last"];
	assert.equal(evidence.rows.length,8);
	for(const route of ["ordinary","reviewed"])
	{
		const rows=evidence.rows.filter(r=>r.route===route);
		assert.deepEqual(rows.map(r=>r.version+":"+r.threaded).sort(),["5.36.3:0","5.36.3:1","5.38.2:0","5.38.2:1"]);
		for(const r of rows)
		{
			assert.match(r.key,/^[0-9a-f]{64}$/u); assert.deepEqual(Object.keys(r.orders).sort(),[...cases].sort());
			for(const p of evidence.packages.filter(p=>p.route===route||!["ordinary","reviewed"].includes(p.route)))
				assert.equal(r.installed[p.route],p.audit.installedVariants[r.key]);
			for(const c of cases) await sum(route+"-"+r.key+"-"+c+".tap",r.orders[c],!r.threaded&&["ordinary-first","task-first"].includes(c)?2:0,prebuilt);
		}
	}
	assert.equal(evidence.fallback.length,1); const [f]=evidence.fallback;
	assert.equal(f.key,evidence.rows[0].key); assert.deepEqual(Object.keys(f.installed).sort(),["counter","ordinary"]);
	await sum("fallback-"+f.key+".tap",f,0,sourceBuild);
	return { schemaVersion: 1, kind: "installed-cpan-shared-heap-resources"
		, planNodes: [1221,1222,1223], acceptanceSha256: sha256(original)
		, reproductionSha256: sha256(second), runtime, ledger, sources, packages
		, rows: evidence.rows.length, cases, prebuilt, sourceBuild, offlineCLI };
};
const root=process.env.LEAN_BRIDGE_PERL_LEASE_AUDIT;
test("retained Perl resource handoffs, TAP and offline CLI rebuild match the published summary",{skip: !root,timeout: 900_000},async()=>{
	const pin=JSON.parse(await readFile("docs/evidence/perl-lease-delivery-20261123.json","utf8"));
	assert.deepEqual(await perlLeasePin(root,process.env.LEAN_BRIDGE_PERL_LEASE_REBUILT),pin);
});
