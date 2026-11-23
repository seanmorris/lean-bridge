/** @file Build, verify, relocate and use the real native Wasmtime task package. */
import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { linuxBrokerHeader } from "../../src/backends/native/runtime-broker.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCliNpmPackage } from "../../src/release/cli-npm-package.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";

const tasks=process.env.LEAN_BRIDGE_WIT_TASK_PACKAGE_TEST==="1", cursors=process.env.LEAN_BRIDGE_WIT_CURSOR_PACKAGE_TEST==="1";
const protocols=[{open: "Meter.feed",next: "Meter.advance",close: "Meter.finish"},{open: "Meter.gauge",next: "Meter.sample",close: "Meter.closeGauge"}];
if(tasks && cursors) protocols.push({open: "Meter.outcome",next: "Meter.sample",close: "Meter.closeGauge"});
test("installed CLI ships typed Wasmtime "+[tasks && "tasks",cursors && "cursors"].filter(Boolean).join(" and ")+" to ordinary and reviewed consumers", {skip: !tasks && !cursors},async t=>{
	const env={...process.env}; delete env.NODE_TEST_CONTEXT;
	const root=await mkdtemp(join(tmpdir(),"wit-tasks-install-"));t.after(()=>rm(root,{recursive: true,force: true}));
	env.npm_config_cache=join(root,"npm-cache");
	const evidence=(cursors && env.LEAN_BRIDGE_WIT_CURSOR_RELEASE_EVIDENCE) || env.LEAN_BRIDGE_WIT_TASK_RELEASE_EVIDENCE;
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
			// Only the retirement fault injector uses the private broker snapshot ABI.
			await writeFile(join(cwd,"lean_bridge_native_runtime.h"),linuxBrokerHeader);
			const flags=(await run("pkg-config",["--cflags","--libs","meter-wit"],cwd,clean)).stdout.trim().match(/(?:\\.|[^\s\\])+/gu).map(s=>s.replace(/\\(.)/gu,"$1"));
			const replay=async (name, message, opts=[])=>{
				const fixture=resolve("tests/fixtures/wit-task-package/"+name+".c");
				await run("cc",["-std=c11","-Wall","-Wextra","-Werror",fixture,...flags,...opts,"-o","probe"],cwd,clean);
				const result=await run(join(cwd,"probe"),[],cwd,{PATH: "/no-producer-tools",RAYON_NUM_THREADS: "1"});
				assert.equal(result.stdout.trim(),message); assert.equal(result.stderr,""); t.diagnostic(message);
			};
			if(tasks)
{
				await replay("consumer","installed Wasmtime task consumer: passed",["-DALL_SCALARS","-pthread"]);
				await replay("effects","factory failure, returned nested Except and worker failure are distinct");
				await replay("retire","parked await woke on retirement",["-DTEST_LEDGER","-I.","-pthread","-ldl"]);
}
			if(cursors)
{
				assert.deepEqual(proof.selection.asyncIterators,protocols);
				if(!tasks)
{
					assert.deepEqual(proof.selection.taskExports,[]);
					assert.deepEqual(proof.selection.exports,protocols.map(p=>p.open));
}
				assert.deepEqual(ir.declarations.filter(d=>d.resultMode==="async-iterator").map(d=>d.source.extensions["lean-bridge.dev/pull-protocol"]),protocols);
				await replay("cursors","installed cursors: eight pulls; seven closes; no prefetch or late delivery",tasks?["-DTEST_MIXED"]:[]);
				await replay("retire","parked await woke on retirement",["-DTEST_CURSOR","-DTEST_LEDGER","-I.","-pthread","-ldl"]);
				const guide=await readFile(resolve("docs/consume/wit-wasi.md"),"utf8");
				const snippet=guide.split("### Pull an asynchronous sequence\n")[1].split("\n```c\n")[1].split("\n```")[0];
				await writeFile(join(cwd,"guide.c"),snippet+`
int main(void) {
    meter_wit_session *s=NULL;
    if (meter_wit_open(&s)!=meter_wit_OK) return 1;
    int valid=!print_feed(s,0,2) && !print_feed(s,2,1) && print_feed(s,1,1) && print_feed(s,255,7);
    return meter_wit_close(&s)==meter_wit_OK && valid ? 0 : 1;
}
`);
				await run("cc",["-std=c11","-Wall","-Wextra","-Werror","guide.c",...flags,"-o","guide"],cwd,clean);
				const example=await run(join(cwd,"guide"),[],cwd,{PATH: "/no-producer-tools",RAYON_NUM_THREADS: "1"});
				assert.equal(example.stdout,"0\n1\n"); assert.equal(example.stderr,"pull: 65535\nopen: 7\n");
}
			t.diagnostic(canonicalJson({review,archive: pkg.artifacts[0],component: manifest.componentSha256}).trim());
			return ir;
} finally
{ await rm(cwd,{recursive: true,force: true}); }
	};
	const source=join(root,"source");await cp(resolve("tests/fixtures/wit-tasks"),source,{recursive: true});
	const mod=join(source,"Meter.lean"),config=join(source,"lean-bridge.exports.json"),cfg=JSON.parse(await readFile(config));
	const fixture=f=>readFile(resolve("tests/fixtures/wit-task-package/"+f+".lean"),"utf8");
	let lean=await readFile(mod,"utf8");
	if(tasks)
{
		const extra=(await Promise.all(["scalars","effects"].map(fixture))).join("\n");
		cfg.taskIOErrors=["Meter.phase"]; lean=lean.replace("prelude\n","prelude\nimport Init.Data.Float32\n")+"\n"+extra;
		for(const m of extra.matchAll(/^def (\w+) /gmu))
{ cfg.exports.push("Meter."+m[1]);cfg.taskExports.push("Meter."+m[1]); }
} else
{ delete cfg.exports; delete cfg.taskExports; }
	if(cursors)
{
		cfg.asyncIterators=protocols; lean+="\n"+await fixture("cursors");
		if(tasks)
{
			lean+="\nnamespace Meter\ndef outcome (wake : Bool) : BaseIO Gauge := gauge wake\nend Meter\n";
			cfg.exports.push(...protocols.map(p=>p.open));
}
}
	await writeFile(mod,lean);
	await writeFile(config,canonicalJson(cfg));
	const build=path=>invoke(["build","--project",source,"--target","wit-wasi","--output",path]);
	const ordinary=join(out,"ordinary"),reviewed=join(out,"reviewed");
	await build(ordinary);const ir=await install(ordinary,false);
	delete cfg.exports;await writeFile(config,canonicalJson(cfg));const pub=join(source,"public.binding-ir.json");
	await writeFile(pub,canonicalJson(ir));await build(reviewed);assert.deepEqual(await install(reviewed,true),ir);
	// Each isolated profile below checks its own rejected reviews and capability grants.
	if(tasks && cursors) return;
	const refused=join(root,"refused"),reject=async re=>{
		await assert.rejects(build(refused),e=>re.test([e.details?.stderr,e.details?.stdout].join("\n")));
		await assert.rejects(access(refused),{code: "ENOENT"});
	};
	const taskDrift=[
		x=>{x.declarations.find(d=>d.source.declaration==="Meter.text").result.type.name="bool";}
		, x=>{x.errors.find(e=>e.id==="error:EIO.Meter.checked").payload.name="uint16";}
		, x=>{x.declarations.find(d=>d.source.declaration==="Meter.phase").failure.errors=["error:IO.Error"];}
	];
	const cursorDrift=[
		x=>{x.declarations.find(d=>d.source.declaration==="Meter.feed").result.type.arguments[0].name="int32";}
		, x=>{x.errors.find(e=>e.id==="error:AsyncStep.Meter.feed").payload.name="uint8";}
	];
	for(const change of [...tasks?taskDrift:[],...cursors?cursorDrift:[]])
{
		const other=structuredClone(ir);change(other);
		await writeFile(pub,canonicalJson(other));await reject(/Reviewed API differs/u);
}
	await writeFile(pub,canonicalJson(ir));
	if(cursors)
{
		const drift=structuredClone(cfg); drift.asyncIterators[0].close="Meter.alternateFinish";
		await writeFile(config,canonicalJson(drift)); await reject(/Reviewed API differs/u);
}
	await writeFile(config,canonicalJson({...cfg,nativeEffects: ["filesystem"]}));await reject(/without external capabilities/u);
});
