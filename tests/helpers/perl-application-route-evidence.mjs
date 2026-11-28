/** @file Trace all installed CPAN forwarding reports on an author route to their original compiled C input. */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {join} from "node:path";
import test from "node:test";
import {sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {readClosedPackageTarGz} from "./closed-package-tar.mjs";
import {readForwardedPerlArchive,readForwardedPerlInstalls} from "./perl-forwarding-qualification.mjs";
import {checkApplicationFunctionPositions,checkStagedQuoteIdentities,checkTicketExchangePositions} from "./staged-quote-project.mjs";

const json=async p=>JSON.parse(await readFile(p));
test("each CPAN forwarding install used its author route's compiled component and corrected XS",async t=>{
	const env=process.env,root=env.LEAN_BRIDGE_PERL_APP_OUTPUT,donors=env.LEAN_BRIDGE_PERL_APP_DONORS;
	const only=env.LEAN_BRIDGE_PERL_APP_AUDIT_ROUTE,pair=[];
	assert.ok(root&&donors);if(only)assert.ok(["ordinary","reviewed"].includes(only));
	for(const route of only?[only]:["ordinary","reviewed"])
	{
		const newDir=join(root,route),rows=await json(join(root,route+".json")),pin=rows[0].receiptSha256;
		const b=await readForwardedPerlArchive(newDir,pin);assert.equal(b.currentXs,b.xs);
		const dir=join(donors,route),original=await json("docs/evidence/c-wit-application-functions-20261127/"+route+".c.json");
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(dir,"package-set-receipt.json")});
		assert.equal(result.receiptSha256,original.receiptSha256);
		const pkg=receipt.packages.find(p=>p.target==="c");assert.deepEqual(pkg.artifacts,[original.archive]);
		const files=readClosedPackageTarGz(await readFile(join(dir,original.archive.path)),{root: "tariff-quotes-1.0.0-c",maxInput: 64<<20,maxBytes: 220<<20});
		const meta=name=>JSON.parse(files.get("share/lean-bridge/component/"+name+".json"));
		assert.deepEqual(b.model,meta("model"));assert.deepEqual(b.ir,meta("binding-ir"));
		assert.equal(b.componentSha256,sha256(files.get("lib/"+meta("native-component").library)));
		assert.equal(b.pkg.runtimeIdentity,pkg.runtimeIdentity);
		const profile=b.receipt.profiles.find(p=>p.id===b.pkg.profile);
		const ids=checkStagedQuoteIdentities(b.model,b.ir,profile,route,{hostFunctions: true,ticketExchange: true});
		checkApplicationFunctionPositions(b.ir);checkTicketExchangePositions(b.ir);
		for(const r of rows)
		{
			assert.equal(r.cReceiptSha256,original.receiptSha256);assert.deepEqual(r.cArchive,original.archive);
			assert.equal(r.sourceSha256,original.leanSourceSha256);assert.equal(r.reviewedSourceSha256,ids.reviewedSourceSha256);
		}
		const images={};for(const {abi,path} of b.manifest.prebuilt)
		{
			const version={36: "5.36.3",38: "5.38.2"}[abi.api_version];assert.ok(version);
			const id=version+"-"+(abi.useithreads==="define"?"threaded":"unthreaded");
			assert.ok(!Object.hasOwn(images,id));images[id]=b.manifest.files[path];
		}
		assert.equal(Object.keys(images).length,4);
		const keys=Object.keys(images).flatMap(id=>["prebuilt-only","build-xs"].map(mode=>id+"."+mode)).sort();
		await readForwardedPerlInstalls({newDir,b,route,pin,images,keys});
		pair.push({pin,runtime: b.runtime.artifacts[0]});t.diagnostic(route+": all eight installs at "+pin);
	}
	if(!only)
	{
		assert.notEqual(pair[0].pin,pair[1].pin);assert.deepEqual(pair[0].runtime,pair[1].runtime);
	}
});
