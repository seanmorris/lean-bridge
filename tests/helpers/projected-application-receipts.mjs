/** @file Bind installed Python and Ruby forwarding/Ticket results to the component in the original C release. */
import assert from "node:assert/strict";
import {mkdir,mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {checkApplicationFunctionPositions,checkStagedQuoteIdentities,checkTicketExchangePositions} from "./staged-quote-project.mjs";

const fixture=resolve("tests/fixtures"),json=async p=>JSON.parse(await readFile(p));
const receipt=root=>readVerifiedPackageSetReceipt({receiptPath: join(root,"package-set-receipt.json")});
const names=["model.json","binding-ir.json","native-component.json"];
test("the source release, installed archive and observed programs agree on both author routes",async t=>{
	const env=process.env,target=env.LEAN_BRIDGE_PROJECTED_APP_TARGET,only=env.LEAN_BRIDGE_PROJECTED_APP_ROUTE;
	const donors=env.LEAN_BRIDGE_PROJECTED_APP_DONORS,output=env.LEAN_BRIDGE_PROJECTED_APP_OUTPUT;
	assert.ok(["pypi","rubygems"].includes(target)&&donors&&output);if(only)assert.ok(["ordinary","reviewed"].includes(only));
	const ruby=target==="rubygems",ext=ruby?"rb":"py",pair=[];
	const source=await Promise.all(["onboarding/leased-closure-fields/Owned.lean","structured-types/pass-application-quote.lean","structured-types/exchange-ticket.lean"].map(p=>readFile(join(fixture,p),"utf8")));
	for(const route of only?[only]:["ordinary","reviewed"])
	{
		const src=resolve(donors,route),dst=resolve(output,route,"handoff"),row=await json(resolve(output,route+".json"));
		const a=await receipt(src),b=await receipt(dst);
		const p=a.receipt.packages.find(p=>p.target==="c");assert.equal(b.receipt.packages.length,1);
		const [q]=b.receipt.packages;assert.equal(q.target,target);assert.equal(p.name,"tariff-quotes");assert.equal(q.name,p.name);assert.equal(q.version,"1.0.0");
		assert.equal(row.route,route);assert.equal(row.cReceiptSha256,a.result.receiptSha256);assert.equal(row.receiptSha256,b.result.receiptSha256);
		assert.deepEqual(p.artifacts,[row.cArchive]);assert.deepEqual(q.artifacts,[row.archive]);assert.equal(p.runtimeIdentity,row.runtimeIdentity);assert.equal(q.runtimeIdentity,p.runtimeIdentity);
		assert.equal(a.receipt.source.treeSha256,b.receipt.source.treeSha256);
		const work=await mkdtemp(join(tmpdir(),"projected-receipt-"));
		try
		{
			const top="tariff-quotes-1.0.0-c",cmeta=top+"/share/lean-bridge/component",cfile=join(src,row.cArchive.path);
			await run("tar",["-xzf",cfile,"--no-same-owner","--no-same-permissions","--wildcards","--no-wildcards-match-slash","--",...names.map(n=>cmeta+"/"+n),top+"/lib/libcomponent_*.so"],work,env);
			const [model,ir,native]=await Promise.all(names.map(n=>json(join(work,cmeta,n))));
			assert.match(native.library,/^libcomponent_[a-f0-9]{20}\.so$/u);
			assert.equal(sha256(await readFile(join(work,top,"lib",native.library))),row.componentSha256);assert.equal(row.componentSha256,native.nativeLibrary.sha256);
			const profile=b.receipt.profiles.find(p=>p.id===q.profile);
			const pins=checkStagedQuoteIdentities(model,ir,profile,route,{hostFunctions: true,ticketExchange: true});
			checkApplicationFunctionPositions(ir);checkTicketExchangePositions(ir);
			assert.equal(pins.bindingIrSha256,row.bindingIrSha256);assert.equal(pins.reviewedSourceSha256,row.reviewedSourceSha256);
			assert.equal(row.sourceSha256,sha256(source.join("\n")));assert.equal(model.sourceIdentity.modules.find(m=>m.module==="Owned").source.sha256,row.sourceSha256);
			assert.equal(model.sourceIdentity.sourceTreeSha256,b.receipt.source.treeSha256);
			const archive=join(dst,row.archive.path),root=join(work,"downstream");await mkdir(root);
			const meta=ruby?"lean-bridge/component":"lean_tariff_quotes/lean_bridge/component";
			const lib=(ruby?"lib/lean_bridge/tariff_quotes":"lean_tariff_quotes")+"/native/linux-x64/"+native.library;
			const members=[...names.map(n=>meta+"/"+n),lib];
			if(ruby)await run("bash",["-o","pipefail","-c",'tar -xOf "$1" data.tar.gz | tar -xzf - --no-same-owner --no-same-permissions -- "${@:2}"',"_",archive,...members],root,env);
			else await run("unzip",["-q",archive,...members],root,env);
			for(const n of names)assert.deepEqual(await json(join(root,meta,n)),await json(join(work,cmeta,n)));
			assert.equal(sha256(await readFile(join(root,lib))),row.componentSha256);
			for(const [id,name] of [["clientSha256","tariff-application-function"],["observerSha256","tariff-incoming-observer"],["ticketClientSha256","tariff-ticket-application"]])
				assert.equal(row[id],sha256(await readFile(join(fixture,"structured-types",name+"."+ext))));
			assert.deepEqual(row.observed,[1,1,1,1,1,1,0]);assert.deepEqual(row.ticketObserved,row.observed);
			pair.push(row);t.diagnostic(route+"/"+target+": "+row.archive.sha256);
		}
		finally
		{
			await rm(work,{recursive: true,force: true});
		}
	}
	if(pair.length===2)
	{
		const [a,b]=pair;assert.notEqual(a.cReceiptSha256,b.cReceiptSha256);assert.notEqual(a.receiptSha256,b.receiptSha256);assert.notEqual(a.archive.sha256,b.archive.sha256);
		for(const k of ["runtimeIdentity","sourceSha256","clientSha256","observerSha256","ticketClientSha256","observed","ticketObserved"])assert.deepEqual(a[k],b[k],k);
	}
});
