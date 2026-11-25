/** @file Exercise binding-owned Lean functions using relocated, verified Cargo packages. */
import assert from "node:assert/strict";
import {access,appendFile,copyFile,mkdir,mkdtemp,readFile,readdir,rename,rm,writeFile} from "node:fs/promises";
import {homedir,tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {canonicalJson} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {prepareNativeHostFixture} from "./native-host-import-check.mjs";
import {installOfflineAuthor} from "./offline-author-cli.mjs";
import {installVerifiedRustCrate,rustLockPackages} from "./rust-task-install.mjs";

const json=async p=>JSON.parse(await readFile(p,"utf8"));
const exercise=async (root,out,receipt,worker,env)=>{
	const temp=await mkdtemp(join(root,"install-")),vendor=join(temp,"vendor"),src=join(temp,"consumer"),runtime=join(temp,"runtime");
	await mkdir(vendor);await mkdir(join(src,"src"),{recursive: true});await mkdir(join(src,".cargo"));await mkdir(runtime);
	const installed=new Map();
	for(const p of receipt.packages)
	{
		const [a]=p.artifacts;
		const dir=await installVerifiedRustCrate(vendor,p.name,p.version,join(out,a.path),a.sha256,env);
		installed.set(p.name,{dir,hash: a.sha256});
	}
	await rm(out,{recursive: true});
	const cache=join(env.CARGO_HOME??join(homedir(),".cargo"),"registry/cache"),indexes=await readdir(cache);
	const lock=await readFile(join(installed.get("workshop").dir,"Cargo.lock"),"utf8");
	for(const p of rustLockPackages(lock).filter(x=>x.source))
	{
		if(installed.has(p.name))
		{assert.equal(installed.get(p.name).hash,p.checksum);continue;}
		const name=p.name+"-"+p.version+".crate";let path;
		for(const index of indexes) if((await readdir(join(cache,index))).includes(name))
		{path=join(cache,index,name);break;}
		assert.ok(path,"Locked offline dependency missing: "+name);
		await installVerifiedRustCrate(vendor,p.name,p.version,path,p.checksum,env);
	}
	await writeFile(join(src,".cargo/config.toml"),'[source.crates-io]\nreplace-with="verified"\n[source.verified]\ndirectory='+JSON.stringify(vendor)+'\n');
	await writeFile(join(src,"Cargo.toml"),'[package]\nname="closure-consumer"\nversion="1.0.0"\nedition="2021"\n[features]\nworker=[]\n[dependencies]\nworkshop="=1.0.0"\n'+(worker?'async-io="=2.6.0"\n':"")+'[profile.dev]\ndebug=0\nincremental=false\n');
	await copyFile("tests/fixtures/rust-host-closures/consumer.rs",join(src,"src/main.rs"));
	const cargo=env.LEAN_BRIDGE_CARGO??"cargo",target=join(temp,"target");
	const ce={...env,CARGO_HOME: join(temp,"empty-home"),CARGO_NET_OFFLINE: "true",CARGO_TARGET_DIR: target,CARGO_BUILD_JOBS: "1",RUSTC: env.LEAN_BRIDGE_RUSTC??"rustc",RUSTFLAGS: "-Dwarnings -Ccodegen-units=1"};
	await run(cargo,["generate-lockfile","--offline"],src,ce);
	const flags=worker?["--features","worker"]:[];
	await run(cargo,["build","--locked","--offline","-j1",...flags],src,ce);
	const bin=join(runtime,"application");await rename(join(target,"debug/closure-consumer"),bin);
	if(!worker)
	{
		await appendFile(join(src,"src/main.rs"),'\nfn require_send<T:Send>(){}\nfn check(){require_send::<workshop::ReturnedRemember<App>>();}\n');
		await assert.rejects(run(cargo,["check","--locked","--offline","-j1"],src,ce),e=>e.message.includes("cannot be sent between threads safely"));
	}
	for(const path of [src,target,ce.CARGO_HOME,vendor])await rm(path,{recursive: true,force: true});
	const isolated={PATH: "/no-tools",LD_LIBRARY_PATH: "",LEAN_NUM_THREADS: "1",TMPDIR: runtime};
	assert.match(await run(bin,[],runtime,isolated),/original Rc and error, self-close/u);
	assert.match(await run(bin,["poison"],runtime,isolated),/released both captures exactly once/u);
	await rm(temp,{recursive: true});
};

test("ordinary, reviewed and worker Cargo packages return owner-bound Lean IO functions",{timeout: 3600000},async t=>{
	const root=await mkdtemp(join(tmpdir(),"cargo-returned-functions-"));t.after(()=>rm(root,{recursive: true,force: true}));
	const src=join(root,"project"),cfgFile=join(src,"lean-bridge.exports.json"),env=process.env;
	const cli=await installOfflineAuthor(root);await prepareNativeHostFixture(src,"rust");await copyFile("LICENSE",join(src,"LICENSE"));
	const lean=await readFile("tests/fixtures/c-host-closures/Closures.lean","utf8");
	await writeFile(join(src,"Closures.lean"),lean.replaceAll("LeanBridge.Host.C","LeanBridge.Host.Rust"));
	await appendFile(join(src,"lakefile.toml"),'\n[[lean_lib]]\nname = "Closures"\n');
	const cfg=await json(cfgFile);cfg.modules.push("Closures");cfg.exports.push("Closures.reader","Closures.remember","Closures.identityReader");
	const build=out=>run(process.execPath,[cli,"build","--target","cargo","--project",src,"--output",out,"--json","--progress","none"],root,env,900000);
	await writeFile(cfgFile,canonicalJson({...cfg,exports: [...cfg.exports,"Closures.fileReader"]}));
	const denied=join(root,"missing-grant");await assert.rejects(build(denied),e=>e.message.includes("Closures.fileReader requires nativeEffects") && e.message.includes("filesystem"));
	await assert.rejects(access(denied),{code: "ENOENT"});
	let first;
	for(const route of ["ordinary","reviewed","worker"])
	{
		const out=join(root,route),review=join(src,"workshop.binding-ir.json");
		if(route==="reviewed")
		{
			delete cfg.exports;await writeFile(cfgFile,canonicalJson(cfg));
			const bad=structuredClone(first);bad.types.find(k=>k.source.declaration==="Closures.remember").source.extensions["lean-bridge.dev/closure-owner"]="cpp-host-binding";
			await writeFile(review,canonicalJson(bad));const invalid=join(root,"wrong-owner");
			await assert.rejects(build(invalid),e=>e.message.includes("Reviewed API differs from compiled host exports"));await assert.rejects(access(invalid),{code: "ENOENT"});
			await writeFile(review,canonicalJson(first));
		}
		if(route==="worker")
		{
			await rm(review);cfg.exports=["Workshop.make","Closures.reader","Closures.remember","Closures.fileReader","Closures.echoBox"];
			cfg.taskExports=["Closures.echoBox"];cfg.nativeEffects=["filesystem"];
		}
		await writeFile(cfgFile,canonicalJson(cfg));await build(out);
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(out,"package-set-receipt.json")});
		assert.deepEqual(result.profiles,["native-rust-host-v1"]);assert.equal(result.archives,2);
		const api=await json(join(out,"binding-ir.json")),decl=api.declarations.find(d=>d.source.declaration==="Closures.remember");
		const kind=api.types.find(k=>k.id===decl.result.type.id);
		assert.equal(kind.source.extensions["lean-bridge.dev/closure-owner"],"rust-host-binding");assert.equal(decl.result.ownership,"lease");
		assert.equal(kind.callable.selfDisposal,"defer");assert.ok(kind.callable.failure.errors.includes("error:RustHostError"));
		if(route==="reviewed")assert.deepEqual(api,first);else if(!first)first=api;
		await exercise(root,out,receipt,route==="worker",env);
		t.diagnostic(route+" "+result.receiptSha256);
	}
});
