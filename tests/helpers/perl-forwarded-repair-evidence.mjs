/** @file Compare the failed CPAN release to the repaired release and its relocated installations. */
import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";
import test from "node:test";
import {generateOwnedPerlPackage} from "../../src/backends/perl/owned-package.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {readClosedPackageTarGz} from "./closed-package-tar.mjs";

const root="LeanBridge-TariffQuotes-0.001",json=async p=>JSON.parse(await readFile(p));
const history="docs/evidence/perl-forwarded-errors-20261127/original-cpan-outcomes.json";
const artifact=async(dir,pin)=>{
	const set=join(dir,"handoff"),{receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(set,"package-set-receipt.json")});
	assert.equal(result.receiptSha256,pin);assert.deepEqual(receipt.packages.map(p=>p.role).sort(),["component","runtime"]);
	const pkg=receipt.packages.find(p=>p.role==="component"),runtime=receipt.packages.find(p=>p.role==="runtime");
	assert.equal(pkg.target,"cpan");assert.equal(pkg.name,"LeanBridge-TariffQuotes");assert.equal(runtime.name,"LeanBridge-Runtime");
	assert.equal(pkg.artifacts.length,1);const [archive]=pkg.artifacts;assert.equal(archive.path,"archives/"+root+".tar.gz");
	const files=readClosedPackageTarGz(await readFile(join(set,archive.path)),{root,maxInput: 8<<20,maxBytes: 64<<20});
	const get=n=>JSON.parse(files.get(n)),manifest=get("lean-bridge-package.json");
	assert.deepEqual([...files.keys()].sort(),["lean-bridge-package.json",...Object.keys(manifest.files)].sort());
	for(const [file,hash] of Object.entries(manifest.files))assert.equal(sha256(files.get(file)),hash,file);
	assert.equal(manifest.xs,"Component.xs");assert.equal(manifest.module,"LeanBridge::TariffQuotes");
	const model=get("model.json"),native=get("native-component.json"),componentSha256=native.nativeLibrary.sha256;
	const assets="lib/LeanBridge/TariffQuotes/native/";
	assert.equal(manifest.files[assets+native.library],componentSha256);
	assert.equal(model.sourceIdentity.sourceTreeSha256,receipt.source.treeSha256);
	const receiptWithRuntime={...native,runtimeIdentity: pkg.runtimeIdentity};
	const gmpSha256=manifest.files[assets+"libgmp-lean-bridge.so.10"];
	const generated=generateOwnedPerlPackage({model,receipt: receiptWithRuntime
		, metadata: get("metadata.json"),moduleName: manifest.module,gmpSha256});
	const xs=manifest.files[manifest.xs],currentXs=sha256(generated.files[manifest.xs]);
	return {receipt,pkg,runtime,archive,manifest,componentSha256,xs,currentXs};
};

test("the CPAN fix changes the XS, not the compiled Lean program or the shared runtime",async t=>{
	const env=process.env,oldDir=env.LEAN_BRIDGE_PERL_REPAIR_ORIGINAL,newDir=env.LEAN_BRIDGE_PERL_REPAIR_CORRECTED;
	const pin=env.LEAN_BRIDGE_PERL_REPAIR_SHA256,level=env.LEAN_BRIDGE_PERL_REPAIR_LEVEL??"installed";
	assert.ok(oldDir&&newDir&&pin);assert.ok(["payload","cell","installed"].includes(level));
	const cell=env.LEAN_BRIDGE_PERL_REPAIR_CELL;assert.equal(Boolean(cell),level==="cell");
	const original=await json(history),a=await artifact(oldDir,original.receiptSha256),b=await artifact(newDir,pin);
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
		const reports=cell?[await json(join(newDir,"results",cell+".json"))]:await json(join(newDir,"..","ordinary.json")),outcomes=[];
		assert.deepEqual(reports.map(r=>r.abi+"."+r.mode).sort(),cell?[cell]:keys);
		for(const r of reports)
		{
			const bytes=await readFile(join(newDir,"results",r.abi+"."+r.mode+".json"));assert.deepEqual(JSON.parse(bytes),r);
			assert.equal(r.route,"ordinary");assert.equal(r.receiptSha256,pin);assert.deepEqual(r.archive,b.archive);assert.deepEqual(r.runtimeArchive,verdict.runtime);
			assert.equal(r.componentSha256,b.componentSha256);const o=r.observation;assert.equal(o.version+"-"+o.threads,r.abi);
			assert.equal(o.installXs.mode,r.mode);assert.equal(o.shutdown,0);
			if(r.mode==="prebuilt-only")assert.equal(o.installXs.outputSha256,images[r.abi].after);
			else
			{
				assert.equal(o.installXs.sourceSha256,b.xs);assert.match(o.installXs.generatedCSha256,/^[a-f0-9]{64}$/u);
			}
			for(const file of ["tariff-application.pl","tariff-incoming-observer.pl"])assert.equal(o.application.sources[file],sha256(await readFile(join("tests/fixtures/structured-types",file))));
			const {held,...checkpoints}=Object.fromEntries(o.application.samples);assert.ok(held>1);
			assert.deepEqual(checkpoints,{baseline: 1,expired: 1,forward: 1,nested: 1,ticket42: 1,ticket71: 1,fresh: 1,afterShutdown: 0});
			outcomes.push({abi: r.abi,mode: r.mode,reportSha256: sha256(bytes),xsSha256: o.installXs.outputSha256});
		}
		verdict.outcomes=outcomes;
	}
	if(env.LEAN_BRIDGE_PERL_REPAIR_REPORT)await writeFile(env.LEAN_BRIDGE_PERL_REPAIR_REPORT,canonicalJson(verdict),{flag: "wx"});
	t.diagnostic(level+": "+pin);
});
