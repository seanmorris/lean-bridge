/** @file Read an actual forwarded-coderef CPAN release and its separate ABI/mode observations. */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {generateOwnedPerlPackage} from "../../src/backends/perl/owned-package.mjs";
import {sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {readClosedPackageTarGz} from "./closed-package-tar.mjs";

const root="LeanBridge-TariffQuotes-0.001",json=async p=>JSON.parse(await readFile(p));
/**
 * Check the receipt, every archive member, and code generated from its own compiler model.
 *
 * @param dir - Route directory containing the retained handoff.
 * @param pin - Independently known package-set receipt digest.
 */
export const readForwardedPerlArchive=async(dir,pin)=>{
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
	return {receipt,pkg,runtime,archive,manifest,componentSha256,xs,currentXs,model,ir: get("binding-ir.json")};
};

/**
 * Compare the report for each real install with its prebuilt image or its locally compiled XS.
 *
 * @param options - Route, verified archive, original receipt pin, ABI images, cell keys and optional single cell.
 */
export const readForwardedPerlInstalls=async options=>{
	const {newDir,b,route,pin,images,keys,cell}=options;
	const reports=cell?[await json(join(newDir,"results",cell+".json"))]:await json(join(newDir,"..",route+".json")),outcomes=[];
	assert.deepEqual(reports.map(r=>r.abi+"."+r.mode).sort(),cell?[cell]:keys);
	for(const r of reports)
	{
		const bytes=await readFile(join(newDir,"results",r.abi+"."+r.mode+".json"));assert.deepEqual(JSON.parse(bytes),r);
		assert.equal(r.route,route);assert.equal(r.receiptSha256,pin);assert.deepEqual(r.archive,b.archive);assert.deepEqual(r.runtimeArchive,b.runtime.artifacts[0]);
		assert.equal(r.componentSha256,b.componentSha256);const o=r.observation;assert.equal(o.version+"-"+o.threads,r.abi);
		assert.equal(r.runtimeIdentity,b.pkg.runtimeIdentity);assert.equal(r.bindingIrSha256,b.model.bindingIrSha256);
		assert.equal(o.installXs.mode,r.mode);assert.equal(o.shutdown,0);
		assert.equal(o.installXs.operation,r.mode==="prebuilt-only"?"prebuilt-xs":"generated-xs-only");
		assert.match(o.installXs.outputSha256,/^[a-f0-9]{64}$/u);
		if(r.mode==="prebuilt-only")assert.equal(o.installXs.outputSha256,images[r.abi]);
		else
		{
			assert.equal(o.installXs.sourceSha256,b.xs);assert.match(o.installXs.generatedCSha256,/^[a-f0-9]{64}$/u);
		}
		for(const file of ["tariff-application.pl","tariff-incoming-observer.pl"])assert.equal(o.application.sources[file],sha256(await readFile(join("tests/fixtures/structured-types",file))));
		const {held,...checkpoints}=Object.fromEntries(o.application.samples);assert.ok(held>1);
		assert.deepEqual(checkpoints,{baseline: 1,expired: 1,forward: 1,nested: 1,ticket42: 1,ticket71: 1,fresh: 1,afterShutdown: 0});
		outcomes.push({abi: r.abi,mode: r.mode,reportSha256: sha256(bytes),xsSha256: o.installXs.outputSha256});
	}
	return outcomes;
};
