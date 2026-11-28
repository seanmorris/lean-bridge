/** @file Qualify Rust application-object record inputs and results using installed Cargo archives. */
import assert from "node:assert/strict";
import {access,appendFile,copyFile,mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {prepareNativeHostFixture} from "./native-host-import-check.mjs";
import {installOfflineAuthor} from "./offline-author-cli.mjs";
import {installRustHostApp} from "./rust-host-installed-app.mjs";

const json=async path=>JSON.parse(await readFile(path,"utf8"));
test("installed Cargo records preserve application Rc identity and reclaim incomplete native output",{timeout: 3_600_000},async t=>{
	const root=await mkdtemp(join(tmpdir(),"cargo-host-record-"));
	t.after(()=>rm(root,{recursive: true,force: true}));
	const cli=await installOfflineAuthor(root),env=process.env,source=resolve("tests/fixtures/rust-host-record/consumer.rs");
	const output=resolve(env.LEAN_BRIDGE_RUST_HOST_RECORD_OUTPUT??"build/rust-host-record");
	const lean=(await readFile("tests/fixtures/dotnet-host-record/Workshop.lean","utf8")).replaceAll("LeanBridge.Host.Dotnet","LeanBridge.Host.Rust");
	await mkdir(output,{recursive: true});let review,peer;
	const consumers=[];
	const publish=(src,dest)=>run(process.execPath,[cli,"build","--target","cargo","--project",src,"--output",dest,"--json","--progress","none"],root,env,900_000);
	for(const route of ["ordinary","reviewed"])
	{
		const project=join(root,route),out=join(root,route+"-release");
		await prepareNativeHostFixture(project,"rust");await copyFile("LICENSE",join(project,"LICENSE"));
		await writeFile(join(project,"Workshop.lean"),lean);
		const cfgFile=join(project,"lean-bridge.exports.json"),cfg=await json(cfgFile),file=join(project,"records.binding-ir.json");
		if(route==="ordinary") cfg.exports=["Gauge.createPair","Gauge.flip","Gauge.sumRead","Gauge.choose","Gauge.duplicateSample"];
		else
{delete cfg.exports; await writeFile(file,review);}
		await writeFile(cfgFile,canonicalJson(cfg));
		const build=dest=>publish(project,dest);
		await build(out);
		const api=await json(join(out,"binding-ir.json")),evidence=await json(join(out,"host-export-evidence.json")),pair=api.types.find(v=>v.id==="lean:Gauge.Pair");
		assert.equal(api.schemaVersion,4);assert.deepEqual(pair.fields.map(f=>f.name),["lead","sample","sequence","spare"]);
		if(route==="ordinary")
		{
			assert.equal(evidence.reviewedSourceSha256,null);pair.fields[0].documentation.summary="Original Rust application meter.";review=canonicalJson(api);
		}
		else
		{
			assert.deepEqual(api,JSON.parse(review));assert.equal(evidence.reviewedSourceSha256,sha256(review));
			pair.fields.reverse();await writeFile(file,canonicalJson(api));const bad=join(root,"reordered");
			await assert.rejects(build(bad),/Reviewed API differs/u);await assert.rejects(access(bad),{code: "ENOENT"});
		}
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(out,"package-set-receipt.json")});
		assert.deepEqual(result.profiles,["native-rust-host-v1"]);assert.equal(result.archives,2);
		await rm(project,{recursive: true});
		if(!peer)
		{
			const src=join(root,"peer-source"),release=join(root,"peer-release");
			await prepareNativeHostFixture(src,"rust");await copyFile("LICENSE",join(src,"LICENSE"));
			await rm(join(src,"Workshop.lean"));await copyFile("tests/fixtures/rust-host-record/Inspector.lean",join(src,"Inspector.lean"));
			await writeFile(join(src,"lakefile.toml"),'name="inspector"\nversion="1.0.0"\n[[lean_lib]]\nname="Inspector"\n');
			const c=await json(join(src,"lean-bridge.exports.json"));c.modules=["Inspector"];c.exports=["Inspector.increment"];c.targets.cargo.name="inspector";
			await writeFile(join(src,"lean-bridge.exports.json"),canonicalJson(c));await publish(src,release);await rm(src,{recursive: true});
			const verified=await readVerifiedPackageSetReceipt({receiptPath: join(release,"package-set-receipt.json")});
			assert.equal(verified.receipt.packages.find(p=>p.role==="component").name,"inspector");assert.equal(verified.result.archives,2);
			peer={out: release,receipt: verified.receipt};await writeFile(join(output,"peer.package-set.json"),canonicalJson(peer.receipt));
		}
		const app=await installRustHostApp({root,out,receipt,env,source,peer});
		await appendFile(join(app.src,"src/main.rs"),'\nworkshop::bind_objects!(Other{Box=Meter});\nfn wrong(b:&Binding<App>,p:&Pair<Other>){let _=b.flip(p);}\n');
		await assert.rejects(run(app.cargo,["check","--locked","--offline","-j1"],app.src,app.ce),e=>/mismatched types/u.test(e.message) && /Pair<Other>/u.test(e.message));
		consumers.push({app,isolated: await app.isolate(),route,evidence,result,receipt});
	}
	await rm(peer.out,{recursive: true});
	for(const {app,isolated,route,evidence,result,receipt} of consumers)
	{
		const observations=[];
		for(const order of ["workshop-first","peer-first"])
		{
			const observed=await run(app.bin,[order],app.runtime,isolated);
			assert.equal(observed,order+": original Rc and error, copied fields, partial export rollback, independent peer retains final owner");
			observations.push({order,observed});
		}
		const row={route,observations
			, consumerSha256: sha256(await readFile(source))
			, reviewedSourceSha256: evidence.reviewedSourceSha256
			, packageSetSha256: result.receiptSha256
			, peerReceiptSha256: sha256(canonicalJson(peer.receipt))};
		await writeFile(join(output,route+".execution.json"),canonicalJson(row));await writeFile(join(output,route+".package-set.json"),canonicalJson(receipt));
		await rm(app.temp,{recursive: true});t.diagnostic(route+" "+result.receiptSha256);
	}
});
