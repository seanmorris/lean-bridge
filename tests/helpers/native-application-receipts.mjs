/** @file Independently reconcile installed client reports with retained ordinary/reviewed package sets. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {readFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import test from "node:test";
import {promisify} from "node:util";
import {sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {checkApplicationFunctionPositions,checkStagedQuoteIdentities} from "./staged-quote-project.mjs";

const exec=promisify(execFile),json=async file=>JSON.parse(await readFile(file)),targets=["pypi","rubygems","cargo"];
const fixture=resolve("tests/fixtures"),ext={pypi: "py",rubygems: "rb",cargo: "rs"};
test("join native forwarding results to the actual release, Lean component and downstream application",async t=>{
	const env=process.env,sets=env.LEAN_BRIDGE_NATIVE_APP_QUOTE_REPLAY,out=env.LEAN_BRIDGE_NATIVE_APP_QUOTE_OUTPUT;
	assert.ok(sets&&out,"supply the retained package sets and separate installed results");
	const route=env.LEAN_BRIDGE_NATIVE_APP_AUDIT_ROUTE,target=env.LEAN_BRIDGE_NATIVE_APP_AUDIT_TARGET;
	if(route)assert.ok(["ordinary","reviewed"].includes(route));
	if(target)assert.ok(targets.includes(target));
	const sourceSha256=sha256(Buffer.concat([await readFile(join(fixture,"onboarding/leased-closure-fields/Owned.lean")),Buffer.from("\n"),await readFile(join(fixture,"structured-types/pass-application-quote.lean"))]));
	const previous=new Map();
	for(const author of route?[route]:["ordinary","reviewed"])
	{
		const set=resolve(sets,author,"package"),path=join(set,"package-set-receipt.json");
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: path});assert.equal(result.receiptSha256,sha256(await readFile(path)));
		assert.deepEqual(receipt.packages.map(p=>p.target).sort(),targets.toSorted());
		const wheel=receipt.packages.find(p=>p.target==="pypi");
		const member=async name=>(await exec("unzip",["-p",join(set,wheel.artifacts[0].path),"lean_tariff_quotes/"+name],{encoding: "buffer",maxBuffer: 16<<20})).stdout;
		const meta=async n=>JSON.parse(await member("lean_bridge/component/"+n+".json"));
		const model=await meta("model"),ir=await meta("binding-ir"),native=await meta("native-component");
		const libHash=sha256(await member("native/linux-x64/"+native.library));assert.equal(libHash,native.nativeLibrary.sha256);
		assert.equal(model.sourceIdentity.modules.find(m=>m.module==="Owned").source.sha256,sourceSha256);
		checkApplicationFunctionPositions(ir);
		for(const lang of target?[target]:targets)
		{
			const row=await json(join(out,author+"."+lang+".json")),pkg=receipt.packages.find(p=>p.target===lang);
			const pins=checkStagedQuoteIdentities(model,ir,receipt.profiles.find(p=>p.id===pkg.profile),author,{hostFunctions: true});
			assert.equal(row.route,author);assert.equal(row.sourceSha256,sourceSha256);assert.equal(row.receiptSha256,result.receiptSha256);
			assert.equal(row.bindingIrSha256,pins.bindingIrSha256);assert.equal(row.reviewedSourceSha256,pins.reviewedSourceSha256);
			assert.deepEqual(row.archive,pkg.artifacts[0]);assert.equal(row.componentSha256,libHash);assert.equal(row.runtimeIdentity,pkg.runtimeIdentity);
			for(const [name,digest] of [["tariff-application-function",row.clientSha256],["tariff-incoming-observer",row.observerSha256]])
				assert.equal(sha256(await readFile(join(fixture,"structured-types",name+"."+ext[lang]))),digest);
			assert.ok(row.members>0);if(lang==="cargo")assert.ok(row.held>0);
			assert.deepEqual(row.observed,lang==="cargo"?[0,0,0,0,0,0,0]:[1,1,1,1,1,1,0]);
			if(previous.has(lang))
			{
				const other=previous.get(lang);assert.notEqual(row.receiptSha256,other.receiptSha256);assert.notEqual(row.archive.sha256,other.archive.sha256);
				for(const k of ["runtimeIdentity","sourceSha256","clientSha256","observerSha256","observed"])assert.deepEqual(row[k],other[k]);
			}
			previous.set(lang,row);t.diagnostic(author+"/"+lang+" "+row.archive.sha256);
		}
	}
});
