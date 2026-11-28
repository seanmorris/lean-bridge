/** @file Run emitted strict TypeScript against ordinary and reviewed receiver-owning npm packages. */
import assert from "node:assert/strict";
import {copyFile,cp,mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {createRequire} from "node:module";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {buildCanonicalProject} from "../../src/build/canonical-build.mjs";
import {canonicalizeJsonValue} from "../../src/binding-ir/canonical.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {ownedRustReceiverConfiguration,ownedRustReceiverReviewedIr,ownedRustReceiverSource} from "./owned-rust-receiver-fixture.mjs";
import {copyPackageSetHandoff,retainPackageSetEvidence} from "./package-set.mjs";

const require=createRequire(import.meta.url), name="@example/receiver-lifetime";
test("emitted strict TypeScript honors receiver and parameter anchors and consuming methods",async t=>{
	const work=await mkdtemp(join(tmpdir(),"ts-receivers-"));t.after(()=>rm(work,{recursive: true,force: true}));
	const env=process.env,output=resolve(env.LEAN_BRIDGE_TS_RECEIVER_OUTPUT??join(work,"results"));
	const replay=env.LEAN_BRIDGE_TS_RECEIVER_REPLAY;
	if(!replay)await mkdir(output,{recursive: true});
	const typings=resolve("tests/fixtures/structured-types/receiver-lifetime.mts");
	const rows=[];
	for(const route of ["ordinary","reviewed"])
	{
		const moved=join(work,"relocated-"+route),install=join(work,"install-"+route),project=join(work,"author"),prod=join(work,"producer");
		const handoff=join(resolve(replay??output),route,"handoff");
		if(!replay)
		{
			await cp(resolve("tests/fixtures/onboarding/owned-aggregates"),project,{recursive: true});
			const src=join(project,"Owned.lean");
			await writeFile(src,await readFile(src,"utf8")+ownedRustReceiverSource);
			const cfg=route==="ordinary"?await ownedRustReceiverConfiguration():{schemaVersion: 1,modules: ["Owned"]};
			cfg.targets={npm: {name,version: "1.0.0"}};
			await writeFile(join(project,"lean-bridge.exports.json"),canonicalJson(cfg));
			if(route==="reviewed")await writeFile(join(project,"reviewed.binding-ir.json"),canonicalJson(ownedRustReceiverReviewedIr()));
			try
			{
				await buildCanonicalProject({projectRoot: project,outputRoot: prod,targets: ["npm"],environment: env});
			}
			catch(error)
			{
				throw new Error(route+": "+error.message+" "+JSON.stringify(error.details),{cause: error});
			}
			await retainPackageSetEvidence(join(prod,"packages/npm"),handoff);
			await rm(project,{recursive: true});await rm(prod,{recursive: true});
		}
		const privateFeed=join(work,"feed");await copyPackageSetHandoff(handoff,privateFeed);
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(privateFeed,"package-set-receipt.json")});
		assert.equal(receipt.profiles.length,1);
		assert.deepEqual(receipt.packages.map(p=>p.role).sort(),["component","runtime"]);
		const pkg=receipt.packages.find(p=>p.role==="component");assert.equal(pkg.name,name);
		const runtime=receipt.packages.find(p=>p.role==="runtime");
		assert.equal(runtime.name,"@lean-bridge/runtime");assert.equal(pkg.requires[0].version,runtime.version);
		await mkdir(install);await writeFile(join(install,"package.json"),'{"private":true,"type":"module"}');
		const archives=receipt.packages.flatMap(p=>p.artifacts);
		await run("npm",["install","--offline","--ignore-scripts","--no-audit","--no-fund","--cache",join(work,"cache-"+route),...archives.map(a=>join(privateFeed,a.path))],install,env);
		await rename(install,moved);await rm(privateFeed,{recursive: true});
		const meta=join(moved,"node_modules",name,"metadata/compiler"),model=JSON.parse(await readFile(join(meta,"model.json")));
		const ir=JSON.parse(await readFile(join(meta,"binding-ir.json")));
		const bindingIrSha256=sha256(canonicalizeJsonValue(ir));assert.equal(receipt.profiles[0].bindingIrSha256,bindingIrSha256);
		assert.equal(model.bindingIrSha256,bindingIrSha256);
		assert.deepEqual(model.bindingIr,ir);
		const decl=n=>ir.declarations.find(d=>d.source.declaration==="Owned."+n);
		assert.equal(decl("serial").kind,"property");assert.equal(decl("transferTicket").receiver.ownership,"transfer");
		const borrow=decl("retainTicket").result,chosen=decl("chooseTicket");
		assert.equal(borrow.ownership,"borrow");assert.deepEqual(borrow.lifetime,{scope: "receiver",anchor: "receiver"});
		assert.equal(chosen.result.ownership,"borrow");
		assert.deepEqual(chosen.result.lifetime,{scope: "parameter",anchor: chosen.parameters[0].name});
		assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr),route==="reviewed");
		const reviewedSourceSha256=model.sourceIdentity.reviewedBindingIr?.sourceSha256??null;
		if(route==="reviewed")
		{
			const expected=canonicalJson(ownedRustReceiverReviewedIr());
			assert.equal(model.sourceIdentity.reviewedBindingIr.source,expected);assert.equal(reviewedSourceSha256,sha256(expected));
		}
		await copyFile(typings,join(moved,"client.mts"));
		for(const ext of ["mjs","d.mts"])
			await copyFile(resolve("tests/fixtures/structured-types/tariff-observer."+ext),join(moved,"observer."+ext));
		const clean={PATH: "/no-author-tools",LANG: "C"};
		await writeFile(join(moved,"tsconfig.json"),JSON.stringify({files: ["client.mts"],compilerOptions: {types: [],strict: true,noEmitOnError: true,module: "NodeNext",target: "ES2022",skipLibCheck: false}}));
		await run(process.execPath,[require.resolve("typescript/bin/tsc"),"-p","tsconfig.json"],moved,clean);
		const observed=JSON.parse(await run(process.execPath,["client.mjs"],moved,clean));
		const {counts,...publicResults}=observed;
		assert.deepEqual(publicResults,{retained: "41",parameter: "73",transferred: "99",expiredViews: 6,closed: true});
		assert.ok(Number.isSafeInteger(counts.baseline)&&counts.baseline>=0&&Number.isSafeInteger(counts.held)&&counts.held>counts.baseline);
		assert.equal(counts.released,counts.baseline);assert.equal(counts.stopped,0);
		const row={
			route, receiptSha256: result.receiptSha256, bindingIrSha256
			, archives, reviewedSourceSha256
			, clientSha256: sha256(await readFile(typings))
			, observerSha256: sha256(await readFile(join(moved,"observer.mjs")))
			, emittedSha256: sha256(await readFile(join(moved,"client.mjs")))
			, typescript: require("typescript/package.json").version, observed
		};
		await mkdir(output,{recursive: true});await writeFile(join(output,route+".json"),canonicalJson(row));rows.push(row);
		await rm(moved,{recursive: true});t.diagnostic(route+": "+row.receiptSha256);
	}
	assert.notEqual(rows[0].receiptSha256,rows[1].receiptSha256);assert.equal(rows[0].emittedSha256,rows[1].emittedSha256);
});
