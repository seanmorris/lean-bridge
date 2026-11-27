/** @file Qualify the original staged callable and field APIs inside installed wasm32 PHP. */
import assert from "node:assert/strict";
import {copyFile,mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {buildCanonicalProject} from "../../src/build/canonical-build.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {readVerifiedPhpWasmCopiedPackageSet} from "../../src/release/php-wasm-copied-package.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {buildOwnedPhpWasmObserver} from "./owned-php-wasm-observer.mjs";
import {copyPackageSetHandoff} from "./package-set.mjs";
import {bindPhpWasmReceiptArchives,installPhpWasmGraphPackages} from "./php-wasm-graph-packages.mjs";
import {exerciseInstalledIOBrowser} from "./php-wasm-io-installed-browser.mjs";
import {checkPhpWasmLoadMatrix} from "./php-wasm-load-matrix.mjs";
import {verifyDirectQuoteCounts} from "./direct-quote-counts.mjs";
import {prepareStagedQuoteProject,checkStagedQuoteIdentities,checkApplicationFunctionPositions} from "./staged-quote-project.mjs";

const component = "@example/tariff-quotes", routes = ["ordinary","reviewed"];
const digest = async path => sha256(await readFile(path));
const parse = async path => JSON.parse(await readFile(path));
const checkResult = (text,inputs,incoming,application) => {
	if(application)
	{
		const {direct,application: values,bindingShutdown,refreshed,...unexpected}=JSON.parse(text);assert.deepEqual(unexpected,{});
		assert.deepEqual(values,["42","43","47",["0","2","3","7"]]);
		assert.deepEqual(Object.keys(direct),["baseline","expired","held","forward","nested","fresh"]);
		for(const [key,n] of Object.entries(direct))assert.ok(key==="held"?Number.isSafeInteger(n)&&n>0:n===0,key);
		assert.equal(bindingShutdown.length,2);assert.ok(Number.isSafeInteger(bindingShutdown[0])&&bindingShutdown[0]>0);
		assert.equal(bindingShutdown[1],0);assert.deepEqual(refreshed,["42",0]);return;
	}
	if(incoming)
	{
		const {direct,bindingShutdown,refreshed,...unexpected}=JSON.parse(text);
		assert.deepEqual(unexpected,{});assert.equal(bindingShutdown.length,2);
		assert.ok(Number.isSafeInteger(bindingShutdown[0]) && bindingShutdown[0]>direct.baseline);
		verifyDirectQuoteCounts({...direct,afterBindingClose: bindingShutdown[1]},{baseline: 0,closed: "afterBindingClose"});
		assert.deepEqual(refreshed,["42",direct.baseline]);return;
	}
	const {baseline,held,after,refreshed,hostInputs,...values} = JSON.parse(text);
	assert.ok(Number.isInteger(baseline) && baseline >= 0 && Number.isInteger(held) && held > baseline);
	assert.equal(after,baseline); assert.deepEqual(refreshed,["42",baseline]);
	assert.deepEqual(values,{visits: 0,stageCalls: 1,result: "42"});
	if(!inputs)
	{ assert.equal(hostInputs,undefined); return; }
	assert.ok(hostInputs.held > baseline);
	assert.equal(hostInputs.calls,3); assert.equal(hostInputs.inner,1);
	assert.equal(hostInputs.mixed,"78");
	assert.deepEqual(hostInputs.seen,[["9"],["5"],["6"],["2"]]);
	assert.deepEqual(hostInputs.settled,Object.fromEntries(["capture","reentry","expired","error","lease","validation","mixed"].map(point=>[point,baseline])));
};

test("both installed PHP-Wasm packages round-trip callable fields and directly return a leased callable", {timeout: 7_200_000}, async t => {
	const work = await mkdtemp(join(tmpdir(),"zend-tariff-"));
	t.after(()=>rm(work,{recursive: true,force: true}));
	const env = process.env, keep = env.LEAN_BRIDGE_ZEND_TARIFF_KEEP, replay = env.LEAN_BRIDGE_ZEND_TARIFF_REPLAY;
	const incoming=env.LEAN_BRIDGE_ZEND_TARIFF_REQUIRE_INCOMING==="1";
	const application=env.LEAN_BRIDGE_ZEND_TARIFF_APPLICATION==="1";assert.ok(!(incoming&&application));
	assert.ok(!(keep && replay));
	const sets = replay ? resolve(replay) : await mkdtemp(join(keep ?? work,"handoffs-"));
	const kit = resolve(env.LEAN_BRIDGE_PHP_INPUTS), host = resolve(env.LEAN_BRIDGE_PHP_WASM_HOST);
	const observer = await buildOwnedPhpWasmObserver({
		directory: join(work,"observer"), runtimeRoot: join(kit,"runtime")
		, phpSource: join(kit,"php"), emsdkRoot: resolve(env.LEAN_BRIDGE_PHP_EMSDK)
	});
	const only=env.LEAN_BRIDGE_ZEND_TARIFF_ROUTE;if(only)assert.ok((keep||replay)&&routes.includes(only));
	const output=resolve(env.LEAN_BRIDGE_ZEND_TARIFF_OUTPUT??(application?"build/zend-application-functions":"build/zend-function-fields"));
	await mkdir(output,{recursive: true});
	const paired=[];
	for(const route of only?[only]:routes)
	{
		const root = join(work,route+"-install"), release = join(sets,route), source = join(release,"packages/php-wasm");
		if(!replay)
		{
			const project = join(work,route+"-source");
			await prepareStagedQuoteProject(project,route,"php-wasm",{mixed: !incoming&&!application,incoming,hostFunctions: application});
			try
			{ await buildCanonicalProject({projectRoot: project,outputRoot: release,targets: ["php-wasm"]}); }
			catch(error)
			{ throw new Error(route+": "+error.message+" "+JSON.stringify(error.details),{cause: error}); }
			await rm(project,{recursive: true});
		}
		await mkdir(root);
		const verified = await readVerifiedPhpWasmCopiedPackageSet(source);
		const handoff = join(root,"handoff");
		await copyPackageSetHandoff(release,handoff);
		const {receipt,result} = await readVerifiedPackageSetReceipt({receiptPath: join(handoff,"package-set-receipt.json")});
		assert.deepEqual(receipt.profiles.map(p=>p.id),["php-wasm-copied-v1"]);
		assert.equal(verified.report.runtimeIdentity,observer.identity.runtimeIdentity);
		const archiveRoot = await bindPhpWasmReceiptArchives(handoff,verified.report);
		const installed = await installPhpWasmGraphPackages({root, host
			, reserveBytes: Number(env.LEAN_BRIDGE_ZEND_INSTALL_RESERVE_BYTES ?? 0)
			, release: {...verified,output: source,archiveRoot}
			, diagnostic: message=>t.diagnostic(message)
		});
		await rm(handoff,{recursive: true});
		const app = installed.deployment, compiled = join(app,"node_modules",component,"compiled");
		const model=await parse(join(compiled,"model.json")), inputs=model.ownedGraph.hostInputRecords;
		const ir=await parse(join(compiled,"binding-ir.json"));
		const identity = checkStagedQuoteIdentities(model,ir,receipt.profiles[0],route,{mixed: !incoming&&!application&&inputs!==undefined,incoming,hostFunctions: application});
		if(application)
		{
			checkApplicationFunctionPositions(ir);
			assert.equal(model.sourceIdentity.modules.find(m=>m.module==="Owned").source.sha256,"a5b7145185c50be1f7984d06b262556e5ef1ec94d67b8c9bab9dbb301b074415");
		}
		else if(incoming)
		{
			const fn=ir.declarations.find(d=>d.source.declaration==="Owned.visitQuote");
			assert.ok(fn,"the installed release must provide visitQuote");
			const arg=ir.types.find(t=>t.id===fn.parameters[1].type.id).callable.parameters[0];
			assert.equal(arg.ownership,"borrow");assert.equal(arg.lifetime.scope,"call");
			assert.equal(ir.types.find(t=>t.id===arg.type.id).kind,"callback");
			const manifest=await parse(join(compiled,"owned-zend-manifest.json"));
			const native=await parse(join(compiled,"php-wasm-component.json"));
			for(const o of [model.ownedGraph,manifest,native.ownedGraph])
			{
				assert.equal(o.callbackArgumentIdentity,"canonical-while-live");
				assert.equal(o.resultAnchors,undefined);
			}
		} else if(replay && inputs === undefined)
		{
			const original=new URL("../../docs/evidence/php-wasm-function-fields-20261126/"+route+".json",import.meta.url);
			assert.equal(result.receiptSha256,(await parse(original)).receiptSha256);
		} else
		{
			const contract=(name,fields)=>({type: "lean:Owned."+name,input: name+"Input",lifetime: "call",fields});
			const expected=[contract("PriceCard",["quote","rebate"]),contract("Tariff",["quote"])];
			assert.deepEqual([...inputs].sort((a,b)=>a.type.localeCompare(b.type)),expected);
		}
		const files = {
			"installed-node.mjs": "php-wasm-sync-io-probe/installed-node.mjs"
			, "installed.mjs": "structured-types/tariff-zend-host.mjs"
			, "consumer.php": application?"structured-types/tariff-zend-application.php":incoming?"structured-types/tariff-zend-direct.php":"structured-types/tariff-zend.php"
		};
		const sources = {};
		for(const [dest,from] of Object.entries(files))
		{
			await copyFile(join("tests/fixtures",from),join(app,dest)); sources[from]=await digest(join(app,dest));
		}
		await writeFile(join(app,"observer.so"),observer.bytes);
		const observations=[];
		for(const mode of ["embedded","composer"]) for(const loading of ["startup","lazy"])
		{
			const text = await run(process.execPath,["installed-node.mjs",mode,loading],app,{PATH: "/no-author-tools",LANG: "C.UTF-8",TMPDIR: work},120000);
			checkResult(text,inputs,incoming,application); observations.push({host: "Node",mode,loading,result: JSON.parse(text)});
		}
		const browser=await exerciseInstalledIOBrowser({app,host: join(app,"node_modules/php-wasm"),t,component,observer: true,checkResult: text=>checkResult(text,inputs,incoming,application)});
		for(const obs of browser) observations.push({...obs,result: JSON.parse(obs.result)});
		checkPhpWasmLoadMatrix(observations);
		const installedHash=path=>sha256(canonicalJson(installed.installed[path]));
		const row={route
			, receiptSha256: result.receiptSha256
			, ...identity
			, runtime: verified.report.runtimeIdentity, observer: observer.identity
			, archives: installed.archives
			, installed: {component: installedHash("node_modules/"+component)
				, composer: installedHash("vendor/example/tariff-quotes")
				, host: installed.host.archiveSha256}
			, sources,observations};
		await writeFile(join(output,route+".json"),canonicalJson(row));paired.push(row);
		t.diagnostic(route+": "+result.receiptSha256);
		await rm(root,{recursive: true});
	}
	if(application&&!only)
	{
		const [a,b]=paired;assert.notEqual(a.receiptSha256,b.receiptSha256);assert.notDeepEqual(a.archives,b.archives);
		assert.equal(a.reviewedSourceSha256,null);assert.match(b.reviewedSourceSha256,/^[a-f0-9]{64}$/u);
		assert.equal(a.runtime,b.runtime);assert.deepEqual(a.sources,b.sources);
	}
	t.diagnostic("Handoffs: "+sets);
});
