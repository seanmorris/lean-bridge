/**
 * Check saved CPAN worker archives, client TAP and a separately installed CLI rebuild.
 * Usage: node scripts/audit-perl-worker-evidence.mjs <capture> <reproduction> [expected.json].
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../src/release/package-set-receipt.mjs";

if(![4,5].includes(process.argv.length)) throw new Error("Provide the capture and reproduction directories, then an optional release pin");
const [root,repro,expected]=process.argv.slice(2).map(p=>resolve(p));
const read=async (base,file)=>readFile(join(base,file));
const json=async (base,file)=>JSON.parse(await read(base,file));
const acceptance=await read(root,"acceptance.json"), replay=await read(repro,"reproduction.json");
const report=JSON.parse(acceptance), rebuilt=JSON.parse(replay);
const hash=/^[0-9a-f]{64}$/u;
const labels=["primary-first","public","registration","relay-first","retirement"];
const fixtures=["Observe.xs","build-observer.pl","compose.t","example.pl","installed.t","registration.t","retired.t","verify.py"];
assert.equal(report.schemaVersion,1);
assert.deepEqual(Object.keys(report.sources).sort(),fixtures);
for(const f of fixtures)
{
	const bytes=await read(root,f);
	assert.equal(sha256(bytes),report.sources[f]);
	if(!expected)
	{
		// A new receipt must describe the clients in the checkout. A historical
		// receipt instead authenticates its own retained clients by digest.
		const corpus=["Observe.xs","build-observer.pl","verify.py"].includes(f)?"perl-sync-io":"perl-retained-tasks";
		assert.deepEqual(bytes,await readFile(new URL("../tests/fixtures/"+corpus+"/"+f,import.meta.url)));
	}
}
assert.deepEqual(report.packages.map(p=>p.route),["ordinary","reviewed","peer"]);
const routes=new Map(), packages=[];
for(const p of report.packages)
{
	const base=join(root,p.route,"handoff");
	const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(base,"package-set-receipt.json")});
	assert.equal(result.receiptSha256,p.receipt);
	assert.deepEqual(receipt.profiles,[p.profile]); assert.equal(p.profile.id,"native-perl-task-v1");
	for(const role of ["component","runtime"])
	{
		const entry=receipt.packages.find(x=>x.role===role);
		assert.deepEqual(entry.artifacts,[p[role]]);
	}
	assert.equal(p.runtime.sha256,report.packages[0].runtime.sha256);
	const proof=await json(base,"host-export-evidence.json");
	assert.equal(proof.selection.perlTaskCallbacks,true);
	const sources=Object.fromEntries(proof.interfaces.map(i=>[i.module,i.sourceSha256]));
	assert.deepEqual(sources,p.modules);
	for(const [module,digest] of Object.entries(sources))
	{
		assert.match(module,/^[A-Za-z]\w*$/u);
		assert.equal(sha256(await read(join(root,p.route,"source"),module+".lean")),digest);
	}
	assert.equal(p.runtimeInspection.bindingRuntime,p.componentInspection.bindingRuntime);
	assert.equal(p.componentInspection.variants.length,4);
	const model=await json(base,"packages/component/lean-bridge-package.json");
	assert.deepEqual(new Map(p.componentInspection.variants),new Map(model.prebuilt.map(x=>[x.abiKey,model.files[x.path]])));
	routes.set(p.route,new Map(model.prebuilt.map(x=>[x.abiKey,{abi: x.abi,sha256: model.files[x.path]}])));
	for(const digest of [proof.compilerSha256,proof.extractorSha256,proof.sourceTreeSha256]) assert.match(digest,hash);
	packages.push({
		route: p.route, receiptSha256: p.receipt, profile: p.profile
		, component: p.component, modules: sources
		, target: receipt.packages.find(x=>x.role==="component").target
		, glibcMinimumVersion: model.glibcMinimumVersion
		, leanVersion: proof.metadata.leanVersion
		, compilerSha256: proof.compilerSha256
		, extractorSha256: proof.extractorSha256
		, sourceTreeSha256: proof.sourceTreeSha256
		, reviewedSourceSha256: proof.reviewedSourceSha256 });
}
assert.equal(packages[0].profile.bindingIrSha256,packages[1].profile.bindingIrSha256);
assert.notEqual(packages[0].profile.bindingIrSha256,packages[2].profile.bindingIrSha256);
const cells=new Set(), rows=[], totals={passed: 0,skipped: 0};
for(const row of report.rows)
{
	assert.ok(["ordinary","reviewed"].includes(row.route));
	assert.ok(["5.36.3","5.38.2"].includes(row.version) && [0,1].includes(row.threaded));
	const cell=[row.route,row.version,row.threaded].join(":");
	assert.ok(!cells.has(cell)); cells.add(cell);
	assert.match(row.key,hash);
	const variant=routes.get(row.route).get(row.key);
	assert.equal(variant.sha256,row.installedXsSha256);
	assert.equal(row.version.split(".").slice(0,2).join("."),variant.abi.api_revision+"."+variant.abi.api_version);
	assert.equal(Boolean(row.threaded),variant.abi.useithreads==="define");
	assert.deepEqual(Object.keys(row.observations).sort(),labels);
	for(const [label,observation] of Object.entries(row.observations))
	{
		const bytes=await read(root,row.route+"-"+row.key+"-"+label+".tap");
		assert.equal(sha256(bytes),observation.tapSha256);
		const tap=bytes.toString("utf8").trimEnd().split("\n");
		assert.equal(tap.at(-1),"1.."+observation.tests);
		assert.ok(!tap.some(line=>/^(?:not ok|Bail out!)/u.test(line)));
		const assertions=tap.filter(line=>/^ok \d+\b/u.test(line));
		assert.equal(assertions.length,observation.tests); assert.ok(assertions.length>0);
		for(const [i,line] of assertions.entries()) assert.equal(Number(/^ok (\d+)\b/u.exec(line)[1]),i+1);
		const skipped=assertions.filter(line=>/#\s*SKIP\b/iu.test(line)).length;
		assert.equal(skipped,label==="registration"&&!row.threaded?4:0);
		totals.skipped+=skipped; totals.passed+=assertions.length-skipped;
	}
	rows.push(row);
}
assert.equal(cells.size,8);
assert.match(rebuilt.cliArchiveSha256,hash);
const original=await json(join(root,"ordinary/handoff"),"package-set-receipt.json");
const copy=await readVerifiedPackageSetReceipt({receiptPath: join(repro,"handoff/package-set-receipt.json")});
assert.deepEqual(copy.receipt,original); assert.equal(copy.result.receiptSha256,packages[0].receiptSha256);
assert.equal(rebuilt.receiptSha256,copy.result.receiptSha256);
assert.deepEqual(rebuilt.artifacts,original.packages.flatMap(p=>p.artifacts));
const result={
	schemaVersion: 1, kind: "installed-cpan-lean-worker-callbacks"
	, planNodes: [1221,1222,1223], acceptanceSha256: sha256(acceptance)
	, reproductionSha256: sha256(replay), sharedRuntime: report.packages[0].runtime
	, sources: report.sources, packages, rows, prebuiltTAP: totals
	, offlineCLI: rebuilt };
if(expected)
{
	assert.deepEqual(result,JSON.parse(await readFile(expected,"utf8")));
	process.stdout.write("Verified eight installed worker-callback rows and the offline CLI rebuild.\n");
}
else process.stdout.write(JSON.stringify(result,null,2)+"\n");
