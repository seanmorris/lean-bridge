/** @file Build ordinary and reviewed CPAN releases and call them from real installed Perl interpreters. */
import assert from "node:assert/strict";
import {access,copyFile,mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename,join,resolve} from "node:path";
import test from "node:test";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {installCpanArchive} from "../../src/release/cpan-install.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {prepareNativeHostFixture} from "./native-host-import-check.mjs";
import {installOfflineAuthor} from "./offline-author-cli.mjs";

const json=async p=>JSON.parse(await readFile(p,"utf8"));
test("installed CPAN records preserve the caller's meters through lexical unbind",{timeout: 7200000},async t=>{
	const root=await mkdtemp(join(tmpdir(),"cpan-host-record-"));t.after(()=>rm(root,{recursive: true,force: true}));
	const cli=await installOfflineAuthor(root),env=process.env,perls=JSON.parse(env.LEAN_BRIDGE_PERLS??'["perl"]');
	const output=resolve(env.LEAN_BRIDGE_PERL_HOST_RECORD_OUTPUT??"build/perl-host-record");
	const store=join(root,"archives");await mkdir(store);await mkdir(output,{recursive: true});
	const fx=resolve("tests/fixtures/perl-host-record");
	const source=await readFile(join(fx,"installed.pl")),failures=await readFile(join(fx,"failures.pl"));
	const sourceSha256=sha256(source),failureClientSha256=sha256(failures);
	const prepare=async(route,review)=>{
		const peer=route==="peer",module=peer?"Inspector":"Gauge",source=join(root,route),out=join(root,route+"-release");
		await prepareNativeHostFixture(source,"perl");await copyFile("LICENSE",join(source,"LICENSE"));
		const config=join(source,"lean-bridge.exports.json"),cfg=await json(config);
		const lean=await readFile(resolve("tests/fixtures",peer?"rust-host-record/Inspector.lean":"dotnet-host-record/Workshop.lean"),"utf8");
		await rm(join(source,"Workshop.lean"));await writeFile(join(source,module+".lean"),lean.replaceAll(peer?"LeanBridge.Host.Rust":"LeanBridge.Host.Dotnet","LeanBridge.Host.Perl"));
		await writeFile(join(source,"lakefile.toml"),'name="'+module.toLowerCase()+'"\nversion="1.0.0"\n[[lean_lib]]\nname="'+module+'"\n');
		cfg.targets.cpan.module="LeanBridge::"+module;cfg.modules=[module];
		if(review)
{delete cfg.exports;await writeFile(join(source,"public.binding-ir.json"),review);}
		else cfg.exports=peer?["Inspector.increment"]:["Gauge.createPair","Gauge.flip","Gauge.sumRead","Gauge.choose","Gauge.duplicateSample"];
		await writeFile(config,canonicalJson(cfg));
		const build=dest=>run(process.execPath,[cli,"build","--target","cpan","--project",source,"--output",dest,"--json","--progress","none"],root,env,1800000);
		await build(out);
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(out,"package-set-receipt.json")});
		assert.deepEqual(result.profiles,["native-perl-host-v1"]);
		const api=await json(join(out,"binding-ir.json"));assert.equal(api.schemaVersion,peer?3:4);
		if(review)
{
			assert.deepEqual(api,JSON.parse(review));const bad=structuredClone(api);
			const fields=bad.types.find(v=>v.id==="lean:Gauge.Pair").fields;[fields[0],fields[3]]=[fields[3],fields[0]];
			await writeFile(join(source,"public.binding-ir.json"),canonicalJson(bad));
			const refused=join(root,"wrong-field-order");await assert.rejects(build(refused),/Reviewed API differs/u);await assert.rejects(access(refused),{code: "ENOENT"});
}
		const packs={};for(const p of receipt.packages)
{
			const [a]=p.artifacts,archive=join(out,a.path),dest=join(store,route+"-"+basename(a.path));
			assert.equal(sha256(await readFile(archive)),a.sha256);await rename(archive,dest);
			packs[p.role]={path: dest,hash: a.sha256};
}
		await rm(source,{recursive: true});await rm(out,{recursive: true});
		await writeFile(join(output,route+".package-set.json"),canonicalJson(receipt));
		return {packs,api,digest: result.receiptSha256};
	};
	const peer=await prepare("peer"),ordinary=await prepare("ordinary"),edited=structuredClone(ordinary.api);
	edited.types.find(v=>v.id==="lean:Gauge.Pair").fields[0].documentation.summary="The application's original meter.";
	const reviewed=await prepare("reviewed",canonicalJson(edited));
	for(const r of [ordinary,reviewed]) assert.equal(r.packs.runtime.hash,peer.packs.runtime.hash);
	const results={ordinary: [],reviewed: []};
	const install=async(pack,mode,module,perl,arch,dir,libs=[])=>{
		const prefix=join(dir,"prefix"),dest=join(dir,"deployed");
		await mkdir(dir);
		await installCpanArchive({archive: pack.path,workingRoot: dir,prefix,perl,mode
			, environment: {...env,PERL5LIB: libs.join(":")}});
		await rename(prefix,dest);
		const lib=join(dest,"lib/perl5"),platform=join(lib,arch);
		const receipt=await json(join(platform,"LeanBridge",module,"install-receipt.json"));
		assert.equal(receipt.operation,mode==="build-xs"?"generated-xs-only":"prebuilt-xs");
		const hash=sha256(await readFile(join(platform,"auto/LeanBridge",module,module+".so")));
		assert.equal(hash,receipt.outputSha256);return {lib,hash};
	};
	for(const [i,interp] of perls.entries())
	{
		const abi=join(root,"abi-"+i);await mkdir(abi);
		const perl=await run(interp,["-e","print $^X"],abi,env);
		const [arch,version]=JSON.parse(await run(perl,["-MConfig","-MJSON::PP","-e","print encode_json([$Config{archname},$Config{version}])"],abi,env));
		const runtime=await install(ordinary.packs.runtime,"prebuilt-only","Runtime",perl,arch,join(abi,"runtime"));
		for(const mode of ["prebuilt-only","build-xs"])
		{
			const set=join(abi,mode);await mkdir(set);
			const inspector=await install(peer.packs.component,mode,"Inspector",perl,arch,join(set,"peer"),[runtime.lib]);
			for(const [route,r] of [["ordinary",ordinary],["reviewed",reviewed]])
			{
				const dir=join(set,route),gauge=await install(r.packs.component,mode,"Gauge",perl,arch,dir,[runtime.lib]);
				const app=await mkdtemp(join(dir,"consumer-"));
				await writeFile(join(app,"app.pl"),source);await writeFile(join(app,"failures.pl"),failures);
				const isolated={PATH: "/no-author-tools",LD_BIND_NOW: "1",LEAN_NUM_THREADS: "1",PERL5LIB: [gauge.lib,inspector.lib,runtime.lib].join(":")};
				const stdout=await run(perl,["app.pl"],app,isolated);assert.match(stdout,/cross-package last owner passed/u);
				const recovered=await run(perl,["failures.pl"],app,isolated);assert.match(recovered,/foreign owner refused and binding remained usable/u);
				results[route].push({version,arch,mode,xs: {Gauge: gauge.hash,Inspector: inspector.hash,Runtime: runtime.hash},stdout,recovered});
				await rm(dir,{recursive: true});
			}
			await rm(set,{recursive: true});
		}
		await rm(abi,{recursive: true});
	}
	for(const [route,r] of [["ordinary",ordinary],["reviewed",reviewed]])
	{
		const clients=results[route];
		await writeFile(join(output,route+".execution.json"),canonicalJson({route,sourceSha256,failureClientSha256,packageSetSha256: r.digest,peerReceiptSha256: peer.digest,clients}));
		t.diagnostic(route+" "+r.digest+" "+clients.length+" installed clients");
	}
});
