/** @file Join native C and Wasmtime client results to their exact archives, Lean source and public applications. */
import assert from "node:assert/strict";
import {mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {checkApplicationFunctionPositions,checkStagedQuoteIdentities,checkTicketExchangePositions} from "./staged-quote-project.mjs";

const json=async path=>JSON.parse(await readFile(path)),fixtures=resolve("tests/fixtures/structured-types");
const labels=["expired:1","forward:1","reply:1","nested:1","failure:1","control:1","exchange:42:43","ticket42:1","exchange:71:72","ticket71:1","afterShutdown:0"];
const names=["tariff-application-function.c","tariff-application-observer.c","tariff-ticket-exchange.c"];
test("audit installed native C and Wasmtime forwarding and Ticket runs against the retained releases",async t=>{
	const env=process.env,sets=env.LEAN_BRIDGE_C_WIT_APP_REPLAY,out=env.LEAN_BRIDGE_C_WIT_APP_OUTPUT,only=env.LEAN_BRIDGE_C_WIT_APP_AUDIT_ROUTE;
	assert.ok(sets&&out);if(only)assert.ok(["ordinary","reviewed"].includes(only));
	const sources=Object.fromEntries(await Promise.all(names.map(async n=>[n,sha256(await readFile(join(fixtures,n)))])));
	const lean=await Promise.all([resolve("tests/fixtures/onboarding/leased-closure-fields/Owned.lean"),join(fixtures,"pass-application-quote.lean"),join(fixtures,"exchange-ticket.lean")].map(f=>readFile(f,"utf8")));
	const author=sha256(lean.join("\n"));
	const previous=new Map();
	for(const route of only?[only]:["ordinary","reviewed"])
	{
		const handoff=resolve(sets,route),{receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(handoff,"package-set-receipt.json")});
		for(const target of ["c","wit-wasi"])
		{
			const pkg=receipt.packages.find(p=>p.target===target);assert.ok(pkg);assert.equal(pkg.artifacts.length,1);
			const row=await json(join(out,route+"."+target+".json"));assert.equal(row.target,target);assert.equal(row.route,route);
			assert.equal(row.receiptSha256,result.receiptSha256);assert.deepEqual(row.archive,pkg.artifacts[0]);assert.equal(row.runtimeIdentity,pkg.runtimeIdentity);
			assert.deepEqual(row.sources,sources);assert.deepEqual(row.output.split("\n"),labels);assert.match(row.clientSha256,/^[0-9a-f]{64}$/u);
			const top="tariff-quotes-1.0.0-"+target,arc=join(handoff,row.archive.path),work=await mkdtemp(join(tmpdir(),"ticket-receipt-"));
			try
			{
				const dir="share/lean-bridge/component/",files=["model","binding-ir","native-component"].map(n=>dir+n+".json");
				const wit=target==="wit-wasi";if(wit)files.push("component/tariff-quotes.wasm","wit/tariff-quotes.wit");
				files.push("lean-bridge-package.json");await run("tar",["-xzf",arc,"--no-same-owner","--no-same-permissions","--",...files.map(n=>top+"/"+n)],work,env);
				const base=join(work,top),model=await json(join(base,files[0])),ir=await json(join(base,files[1])),native=await json(join(base,files[2]));
				const manifest=await json(join(base,"lean-bridge-package.json")),profile=receipt.profiles.find(p=>p.id===pkg.profile);
				const pins=checkStagedQuoteIdentities(model,ir,profile,route,{hostFunctions: true,ticketExchange: true});
				checkApplicationFunctionPositions(ir);checkTicketExchangePositions(ir);
				assert.equal(manifest.runtimeIdentity,row.runtimeIdentity);assert.equal(manifest.bindingIrSha256,pins.bindingIrSha256);
				assert.equal(row.bindingIrSha256,pins.bindingIrSha256);assert.equal(row.reviewedSourceSha256,pins.reviewedSourceSha256);
				assert.equal(model.sourceIdentity.sourceTreeSha256,receipt.source.treeSha256);
				assert.equal(model.sourceIdentity.modules.find(m=>m.module==="Owned").source.sha256,author);assert.equal(row.leanSourceSha256,author);
				if(wit)
				{
					const wasm=join(base,files[3]),world=join(base,files[4]);assert.equal(sha256(await readFile(wasm)),row.componentSha256);
					assert.equal(manifest.componentSha256,row.componentSha256);await run(env.LEAN_BRIDGE_WASM_TOOLS??"wasm-tools",["component","targets",world,wasm],work,env);
				}
				else
				{
					assert.match(native.library,/^libcomponent_[a-f0-9]+\.so$/u);
					const member="lib/"+native.library;await run("tar",["-xzf",arc,"--",top+"/"+member],work,env);
					assert.equal(sha256(await readFile(join(base,member))),native.nativeLibrary.sha256);
				}
				if(previous.has(target))
				{
					const first=previous.get(target);assert.notEqual(first.receiptSha256,row.receiptSha256);
					assert.notEqual(first.archive.sha256,row.archive.sha256);assert.equal(first.runtimeIdentity,row.runtimeIdentity);
				}
				previous.set(target,row);t.diagnostic(route+"/"+target+": "+row.archive.sha256);
			}
			finally
			{
				await rm(work,{recursive: true,force: true});
			}
		}
	}
});
