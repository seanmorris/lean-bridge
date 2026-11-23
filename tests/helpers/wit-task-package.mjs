/** @file Build, verify, relocate and use the real native Wasmtime task package. */
import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCliNpmPackage } from "../../src/release/cli-npm-package.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";

const active=process.env.LEAN_BRIDGE_WIT_TASK_PACKAGE_TEST==="1";
test("installed CLI ships typed Wasmtime tasks; ordinary and reviewed consumers need no producer tools", {skip: !active},async t=>{
	const env={...process.env}; delete env.NODE_TEST_CONTEXT;
	const root=await mkdtemp(join(tmpdir(),"wit-tasks-install-"));t.after(()=>rm(root,{recursive: true,force: true}));
	env.npm_config_cache=join(root,"npm-cache");
	const evidence=env.LEAN_BRIDGE_WIT_TASK_RELEASE_EVIDENCE;
	const out=evidence??join(root,"handoffs"); await mkdir(out);
	const run=async(command,args,cwd=root,environment=env)=>{
		try
{ return await processBuildRunner.capture({command,args,cwd,env: environment}); }
		catch(e)
{t.diagnostic(e.details?.stderr??e.message);throw e;}
	};
	const author=join(root,"author"),bridge=await buildCliNpmPackage({outputRoot: join(root,"prepared-cli")});
	await run("npm",["install","--offline","--ignore-scripts","--no-audit","--no-fund","--no-package-lock","--prefix",author,bridge.archive]);
	const cli=join(author,"node_modules/.bin/lean-bridge");
	const invoke=(args)=>run(process.execPath,[cli,...args]);
	const install=async (handoff,review)=>{
		const cwd=await mkdtemp(join(root,"install-"));
		try
{
			const receiptPath=join(handoff,"package-set-receipt.json"); await invoke(["verify","--receipt",receiptPath]);
			const {receipt}=await readVerifiedPackageSetReceipt({receiptPath}),[pkg]=receipt.packages;
			assert.equal(receipt.packages.length,1);assert.equal(pkg.profile,"native-wit-task-v1");
			assert.equal(pkg.runtimeDelivery,"embedded");assert.equal(pkg.target,"wit-wasi");
			const name=pkg.name+"-"+pkg.version+"-wit-wasi",archive=join(handoff,pkg.artifacts[0].path);
			const paths=(await run("tar",["-tzf",archive],cwd)).stdout.trim().split("\n");
			assert.ok(paths.every(s=>s.startsWith(name+"/")&&!s.split("/").includes("..")));
			await run("tar",["-xzf",archive],cwd);const dest=join(cwd,"moved release");await rename(join(cwd,name),dest);
			const read=name=>readFile(join(dest,name)),manifest=JSON.parse(await read("lean-bridge-package.json"));
			assert.equal(manifest.kind,"lean-bridge-wit-task-package");assert.deepEqual(manifest.nativeEffects,[]);
			assert.equal(manifest.profile,pkg.profile);assert.equal(manifest.runtimeIdentity,pkg.runtimeIdentity);
			assert.deepEqual(await nativeArtifactPaths(dest),["lean-bridge-package.json",...Object.keys(manifest.files)].sort());
			for(const [file,id] of Object.entries(manifest.files))
{
				const b=await read(file);assert.equal(b.length,id.bytes);assert.equal(sha256(b),id.sha256,file);
}
			const ir=JSON.parse(await read("share/lean-bridge/binding-ir.json"));
			assert.equal(hashBindingIr(ir),receipt.profiles[0].bindingIrSha256);
			assert.equal(manifest.bindingIrSha256,hashBindingIr(ir));
			const proof=JSON.parse(await read("share/lean-bridge/elaboration.json"));
			assert.equal(proof.sourceTreeSha256,receipt.source.treeSha256);assert.equal(proof.reviewedSourceSha256!==null,review);
			if(review) assert.equal(sha256(await read("share/lean-bridge/reviewed.binding-ir.json")),proof.reviewedSourceSha256);
			assert.equal(sha256(await read("component/meter.wasm")),manifest.componentSha256);
			await run(env.LEAN_BRIDGE_WASM_TOOLS,["component","targets",join(dest,"wit/meter.wit"),join(dest,"component/meter.wasm")],cwd);
			const clean={PATH: "/usr/bin:/bin",PKG_CONFIG_LIBDIR: join(dest,"lib/pkgconfig")};
			const flags=(await run("pkg-config",["--cflags","--libs","meter-wit"],cwd,clean)).stdout.trim().match(/(?:\\.|[^\s\\])+/gu).map(s=>s.replace(/\\(.)/gu,"$1"));
			const fixture=resolve("tests/fixtures/wit-task-package/consumer.c");
			await run("cc",["-std=c11","-Wall","-Wextra","-Werror","-DALL_SCALARS",fixture,...flags,"-pthread","-o","consumer"],cwd,clean);
			const r=await run(join(cwd,"consumer"),[],cwd,{PATH: "/no-producer-tools",RAYON_NUM_THREADS: "1"});
			assert.equal(r.stdout.trim(),"installed Wasmtime task consumer: passed");assert.equal(r.stderr,"");
			await run("cc",["-std=c11","-Wall","-Wextra","-Werror",resolve("tests/fixtures/wit-task-package/effects.c"),...flags,"-o","effects"],cwd,clean);
			const effects=await run(join(cwd,"effects"),[],cwd,{PATH: "/no-producer-tools",RAYON_NUM_THREADS: "1"});
			assert.equal(effects.stdout.trim(),"factory failure, returned nested Except and worker failure are distinct");
			assert.equal(effects.stderr,""); t.diagnostic(effects.stdout.trim());
			await run("cc",["-std=c11","-Wall","-Wextra","-Werror",resolve("tests/fixtures/wit-task-package/retire.c"),...flags,"-pthread","-ldl","-o","retire"],cwd,clean);
			const fault=await run(join(cwd,"retire"),[],cwd,{PATH: "/no-producer-tools",RAYON_NUM_THREADS: "1"});
			assert.equal(fault.stdout.trim(),"parked await woke on retirement");assert.equal(fault.stderr,"");
			t.diagnostic(canonicalJson({review,archive: pkg.artifacts[0],component: manifest.componentSha256}).trim());
			return ir;
} finally
{ await rm(cwd,{recursive: true,force: true}); }
	};
	const source=join(root,"source");await cp(resolve("tests/fixtures/wit-tasks"),source,{recursive: true});
	const mod=join(source,"Meter.lean"),config=join(source,"lean-bridge.exports.json"),cfg=JSON.parse(await readFile(config));
	const extra=(await Promise.all(["scalars","effects"].map(f=>readFile(resolve("tests/fixtures/wit-task-package/"+f+".lean"),"utf8")))).join("\n");
	cfg.taskIOErrors=["Meter.phase"];
	await writeFile(mod,(await readFile(mod,"utf8")).replace("prelude\n","prelude\nimport Init.Data.Float32\n")+"\n"+extra);
	for(const m of extra.matchAll(/^def (\w+) /gmu))
{cfg.exports.push("Meter."+m[1]);cfg.taskExports.push("Meter."+m[1]);}
	await writeFile(config,canonicalJson(cfg));
	const build=path=>invoke(["build","--project",source,"--target","wit-wasi","--output",path]);
	const ordinary=join(out,"ordinary"),reviewed=join(out,"reviewed");
	await build(ordinary);const ir=await install(ordinary,false);
	delete cfg.exports;await writeFile(config,canonicalJson(cfg));const pub=join(source,"public.binding-ir.json");
	await writeFile(pub,canonicalJson(ir));await build(reviewed);assert.deepEqual(await install(reviewed,true),ir);
	const refused=join(root,"refused"),reject=async re=>{
		await assert.rejects(build(refused),e=>re.test([e.details?.stderr,e.details?.stdout].join("\n")));
		await assert.rejects(access(refused),{code: "ENOENT"});
	};
	for(const change of [
		x=>{x.declarations.find(d=>d.source.declaration==="Meter.text").result.type.name="bool";}
		, x=>{x.errors.find(e=>e.id==="error:EIO.Meter.checked").payload.name="uint16";}
		, x=>{x.declarations.find(d=>d.source.declaration==="Meter.phase").failure.errors=["error:IO.Error"];}
	]){
		const other=structuredClone(ir);change(other);
		await writeFile(pub,canonicalJson(other));await reject(/Reviewed API differs/u);
	}
	await writeFile(pub,canonicalJson(ir));
	await writeFile(config,canonicalJson({...cfg,nativeEffects: ["filesystem"]}));await reject(/without external capabilities/u);
});
