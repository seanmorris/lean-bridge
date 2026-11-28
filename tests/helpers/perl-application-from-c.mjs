/** @file Project authentic C release bytes to CPAN, then run both Perl install modes on four ABIs. */
import assert from "node:assert/strict";
import {mkdir,mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename,join,resolve} from "node:path";
import test from "node:test";
import {projectOwnedPerl} from "../../src/build/owned-perl-projection.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {projectApplicationPackage} from "./application-package-projection.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {installPerlTariff} from "./perl-function-fields-consumer.mjs";
import {checkApplicationFunctionPositions,checkStagedQuoteIdentities,checkTicketExchangePositions} from "./staged-quote-project.mjs";

const abis=["5.36.3-threaded","5.36.3-unthreaded","5.38.2-threaded","5.38.2-unthreaded"];
test("installed CPAN coderefs forward real application functions and exchange distinct Tickets",{timeout: 14_400_000},async t=>{
	const env=process.env,root=env.LEAN_BRIDGE_PERL_APP_OUTPUT,route=env.LEAN_BRIDGE_PERL_APP_ROUTE;
	const handoff=env.LEAN_BRIDGE_PERL_APP_C,pin=env.LEAN_BRIDGE_PERL_APP_C_SHA256,leanPrefix=env.LEAN_BRIDGE_LEAN_PREFIX;
	assert.ok(root&&["ordinary","reviewed"].includes(route)&&handoff&&pin&&leanPrefix);
	// Eight installs may outlive a local edit. Never combine observations
	// from different application or observer revisions into one route.
	const sources={};
	for(const file of ["tariff-application.pl","tariff-incoming-observer.pl"])
		sources[file]=sha256(await readFile(resolve("tests/fixtures/structured-types",file)));
	const perls=JSON.parse(env.LEAN_BRIDGE_PERLS);assert.equal(perls.length,4);
	const versions=new Map();
	for(const perl of perls)
	{
		const abi=await run(perl,["-MConfig","-e",'print "$Config{version}-", (($Config{useithreads} // "") eq "define" ? "threaded" : "unthreaded")'],process.cwd(),env);
		versions.set(abi,perl);
	}
	assert.deepEqual([...versions.keys()].sort(),abis);
	const only=env.LEAN_BRIDGE_PERL_APP_ABI,mode=env.LEAN_BRIDGE_PERL_APP_MODE,replayPin=env.LEAN_BRIDGE_PERL_APP_REPLAY_SHA256;
	if(only)assert.ok(abis.includes(only));if(mode)assert.ok(["prebuilt-only","build-xs"].includes(mode));
	const work=await mkdtemp(join(tmpdir(),"perl-forward-"));t.after(()=>rm(work,{recursive: true,force: true}));
	const project=async o=>[await projectOwnedPerl({...o,settings: {module: "LeanBridge::TariffQuotes",version: "0.001"}})];
	const {set,profile,row,model}=await projectApplicationPackage({work,root,handoff,pin,route,leanPrefix,target: "cpan",project,replayPin,donorTarget: "c"});
	const packages={component: join(set,row.archive.path),runtime: join(set,row.runtimeArchive.path)};
	const top=basename(packages.component,".tar.gz"),nativeName="lib/LeanBridge/TariffQuotes/native/";
	const manifestFiles=["model.json","binding-ir.json","native-component.json","lean-bridge-package.json","lib/LeanBridge/TariffQuotes.pm"];
	const extract=members=>run("tar",["-xzf",packages.component,"--no-same-owner","--no-same-permissions","--",...members.map(p=>top+"/"+p)],work,env);
	await extract(manifestFiles);
	const packageRoot=join(work,top),json=async p=>JSON.parse(await readFile(join(packageRoot,p)));
	assert.deepEqual(await json("model.json"),model);const ir=await json("binding-ir.json"),component=await json("native-component.json");
	const pins=checkStagedQuoteIdentities(model,ir,profile,route,{hostFunctions: true,ticketExchange: true});
	checkApplicationFunctionPositions(ir);checkTicketExchangePositions(ir);assert.match(component.library,/^libcomponent_[a-f0-9]+\.so$/u);
	await extract([nativeName+component.library]);assert.equal(sha256(await readFile(join(packageRoot,nativeName,component.library))),row.componentSha256);
	const records=[],failures=[],modes=mode?[mode]:["prebuilt-only","build-xs"];
	await mkdir(join(root,route,"results"),{recursive: true});
	for(const abi of only?[only]:abis)
	{
		const saved=new Set();
		const onModeError=async(selected,error)=>{
			failures.push(new Error(abi+"/"+selected+": "+error.message,{cause: error}));saved.add(selected);
			await saveLakeFile(root,route+"/results/"+abi+"."+selected+".failure.json",canonicalJson({abi,mode: selected,receiptSha256: row.receiptSha256,error: error.message}));
		};
		const onResult=async(selected,observation)=>{
			assert.equal(observation.version+"-"+observation.threads,abi);assert.equal(observation.installXs.mode,selected);
			assert.deepEqual(observation.application.sources,sources);
			const result={...row,...pins,abi,mode: selected,observation};
			await saveLakeFile(root,route+"/results/"+abi+"."+selected+".json",canonicalJson(result));
			await rm(join(root,route,"results",abi+"."+selected+".failure.json"),{force: true});
			records.push(result);saved.add(selected);t.diagnostic(route+"/"+abi+"/"+selected);
		};
		try
		{
			await installPerlTariff(work,packages,versions.get(abi),env,true,modes,packageRoot,false,{application: true,onModeError,onResult});
		}
		catch(error)
		{
			const missing=modes.filter(selected=>!saved.has(selected));
			if(!missing.length)failures.push(new Error(abi+"/cleanup: "+error.message,{cause: error}));
			for(const selected of missing)await onModeError(selected,error);
		}
	}
	if(failures.length)throw new AggregateError(failures,failures.map(e=>e.message.split("\n")[0]).join("\n"));
	assert.equal(records.length,(only?1:abis.length)*modes.length);
	if(!only&&!mode)
	{
		assert.equal(records.length,8);await saveLakeFile(root,route+".json",canonicalJson(records));
	}
});
