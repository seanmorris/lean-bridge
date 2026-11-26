/** @file Build via an offline-installed CLI, then exercise the published Java and Kotlin worker contracts. */
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCliNpmPackage } from "../../src/release/cli-npm-package.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";
import { prepareJvmWorkerProject } from "./jvm-worker-project.mjs";
import { qualifyJvmWorkers } from "./jvm-worker-release.mjs";

test("ordinary and reviewed Maven workers deliver real Java classes to installed Java and Kotlin callers",{timeout: 3600000},async t=>{
	const root=await mkdtemp(join(tmpdir(),"jvm-worker-publish-"));
	t.after(()=>rm(root,{recursive: true,force: true}));
	const keep=process.env.LEAN_BRIDGE_JVM_WORKER_HANDOFFS,replay=process.env.LEAN_BRIDGE_JVM_WORKER_REPLAY;
	assert.ok(!(keep && replay),"Choose either original releases to replay or an output directory");
	const releases=replay?resolve(replay):keep?await mkdtemp(join(keep,"jvm-worker-releases-")):root;
	const qualify=async route=>{
		const raw=await readFile(join(releases,route,"binding-ir.json")),ir=JSON.parse(raw);
		const decl=name=>ir.declarations.find(d=>d.name===name);
		const immediate=decl("identity"),relay=decl("relay"),box=immediate.parameters[0].type.id;
		const callback=ir.types.find(type=>type.id===relay.parameters[1].type.id);
		assert.equal(callback.kind,"callback");
		for(const v of [immediate.result,relay.parameters[0],callback.callable.parameters[0],callback.callable.result]) assert.equal(v.type.id,box);
		const report=await qualifyJvmWorkers(releases,route);t.diagnostic(JSON.stringify(report));
		if(process.env.LEAN_BRIDGE_JVM_WORKER_OBJECT_OUTPUT)
		{
			const output=resolve(process.env.LEAN_BRIDGE_JVM_WORKER_OBJECT_OUTPUT),sources={};
			for(const file of ["Installed.java","InstalledKtClient.kt"]) sources[file]=sha256(await readFile(join("tests/fixtures/jvm-host-workers",file)));
			await mkdir(output,{recursive: true});
			const positions=["parameter","result","callback-parameter","callback-result"];
			await writeFile(join(output,route+".json"),canonicalJson({route,sources,publicIr: sha256(raw),positions,...report}));
		}
	};
	if(replay)
	{
		for(const route of ["ordinary","reviewed"]) await qualify(route);
		return;
	}
	if(keep)t.diagnostic("retained handoffs: "+releases);
	const candidate=await buildCliNpmPackage({outputRoot: join(root,"candidate")});
	const tools=join(root,"tools"); await mkdir(tools);
	await run("npm",["install","--offline","--prefix",tools,"--ignore-scripts","--no-audit","--no-fund","--cache",join(root,"cache"),candidate.archive],root,process.env);
	const cli=join(tools,"node_modules/.bin/lean-bridge");
	for(const route of ["ordinary","peer","reviewed","rejected"])
	{
		const project=join(root,"author-"+route), cfg=await prepareJvmWorkerProject(project,route==="peer");
		const output=route==="rejected"?join(root,"refused"):join(releases,route);
		if(route==="reviewed" || route==="rejected")
		{
			const ir=JSON.parse(await readFile(join(releases,"ordinary/binding-ir.json")));
			if(route==="rejected") delete ir.declarations.find(d=>d.source.declaration==="Jobs.refuse").source.extensions["lean-bridge.dev/error-payload-site"];
			await writeFile(join(project,"public.binding-ir.json"),canonicalJson(ir));
			delete cfg.exports; await writeFile(join(project,"lean-bridge.exports.json"),canonicalJson(cfg));
		}
		const publish=()=>run(process.execPath,[cli,"build","--project",project,"--target","maven","--output",output,"--json","--progress","none"],root,process.env);
		if(route==="rejected")
		{
			await assert.rejects(publish(),/Reviewed API differs from compiled host exports/u);
			await assert.rejects(access(join(output,"package-set-receipt.json")),{code: "ENOENT"});
		} else await publish();
		await rm(project,{recursive: true});
		if(route==="peer" || route==="reviewed") await qualify(route==="peer"?"ordinary":route);
	}
});
