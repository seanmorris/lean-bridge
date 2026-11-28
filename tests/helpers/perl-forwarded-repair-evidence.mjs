/** @file Compare the failed CPAN release to the repaired release and its relocated installations. */
import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";
import test from "node:test";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readForwardedPerlArchive,readForwardedPerlInstalls} from "./perl-forwarding-qualification.mjs";

const json=async p=>JSON.parse(await readFile(p));
const history="docs/evidence/perl-forwarded-errors-20261127/original-cpan-outcomes.json";

test("the CPAN fix changes the XS, not the compiled Lean program or the shared runtime",async t=>{
	const env=process.env,oldDir=env.LEAN_BRIDGE_PERL_REPAIR_ORIGINAL,newDir=env.LEAN_BRIDGE_PERL_REPAIR_CORRECTED;
	const pin=env.LEAN_BRIDGE_PERL_REPAIR_SHA256,level=env.LEAN_BRIDGE_PERL_REPAIR_LEVEL??"installed";
	assert.ok(oldDir&&newDir&&pin);assert.ok(["payload","cell","installed"].includes(level));
	const cell=env.LEAN_BRIDGE_PERL_REPAIR_CELL;assert.equal(Boolean(cell),level==="cell");
	const original=await json(history),a=await readForwardedPerlArchive(oldDir,original.receiptSha256),b=await readForwardedPerlArchive(newDir,pin);
	assert.deepEqual(a.receipt.source,b.receipt.source);assert.deepEqual(a.runtime,b.runtime);assert.deepEqual(a.receipt.profiles,b.receipt.profiles);
	assert.equal(a.componentSha256,b.componentSha256);assert.notEqual(a.archive.sha256,b.archive.sha256);
	assert.notEqual(a.xs,a.currentXs);assert.equal(b.xs,b.currentXs);assert.equal(a.currentXs,b.currentXs);
	assert.deepEqual(a.manifest.prebuilt,b.manifest.prebuilt);assert.equal(b.manifest.prebuilt.length,4);
	const expectedChanges=new Set(["Component.xs"]),images={};
	for(const {abi,abiKey,path} of b.manifest.prebuilt)
	{
		const version={"36": "5.36.3","38": "5.38.2"}[abi.api_version];assert.ok(version);
		const id=version+"-"+(abi.useithreads==="define"?"threaded":"unthreaded");
		assert.equal(path,"prebuilt/"+abiKey+"/TariffQuotes.so");assert.ok(!Object.hasOwn(images,id));
		const before=a.manifest.files[path],after=b.manifest.files[path];assert.notEqual(before,after);
		images[id]={before,after};expectedChanges.add(path);expectedChanges.add("prebuilt/"+abiKey+"/receipt.json");
	}
	assert.deepEqual(Object.keys(a.manifest.files).sort(),Object.keys(b.manifest.files).sort());
	const changed=Object.keys(b.manifest.files).filter(k=>a.manifest.files[k]!==b.manifest.files[k]);
	assert.deepEqual(changed.sort(),[...expectedChanges].sort());
	const verdict={level,originalReceiptSha256: original.receiptSha256
		, correctedReceiptSha256: pin,componentSha256: b.componentSha256
		, runtime: b.runtime.artifacts[0],originalArchive: a.archive
		, correctedArchive: b.archive,originalXsSha256: a.xs
		, correctedXsSha256: b.xs,images};
	const failures=original.outcomes,keys=Object.keys(images).flatMap(id=>["prebuilt-only","build-xs"].map(mode=>id+"."+mode)).sort();
	assert.deepEqual(failures.map(r=>r.abi+"."+r.mode).sort(),keys);
	for(const r of failures)
	{
		const data=await readFile(join(oldDir,"results",r.abi+"."+r.mode+".failure.json"));
		assert.equal(sha256(data),r.failureSha256);const f=JSON.parse(data);
		assert.equal(f.receiptSha256,original.receiptSha256);assert.equal(f.abi,r.abi);assert.equal(f.mode,r.mode);
		assert.match(f.error,/unexpected public API result at line 43/u);
	}
	if(level!=="payload")
	{
		if(cell)assert.ok(keys.includes(cell),"unknown CPAN ABI or install mode");
		const after=Object.fromEntries(Object.entries(images).map(([id,x])=>[id,x.after]));
		verdict.outcomes=await readForwardedPerlInstalls({newDir,b,route: "ordinary",pin,images: after,keys,cell});
	}
	if(env.LEAN_BRIDGE_PERL_REPAIR_REPORT)await writeFile(env.LEAN_BRIDGE_PERL_REPAIR_REPORT,canonicalJson(verdict),{flag: "wx"});
	t.diagnostic(level+": "+pin);
});
