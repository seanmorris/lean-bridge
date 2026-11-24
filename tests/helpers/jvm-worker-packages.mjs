/** @file Build via an offline-installed CLI, then exercise the published Java and Kotlin worker contracts. */
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { buildCliNpmPackage } from "../../src/release/cli-npm-package.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";
import { prepareJvmWorkerProject } from "./jvm-worker-project.mjs";
import { qualifyJvmWorkers } from "./jvm-worker-release.mjs";

test("ordinary and reviewed Maven workers deliver real Java classes to installed Java and Kotlin callers",{timeout: 3600000},async t=>{
	const root=await mkdtemp(join(tmpdir(),"jvm-worker-publish-"));
	t.after(()=>rm(root,{recursive: true,force: true}));
	const keep=process.env.LEAN_BRIDGE_JVM_WORKER_HANDOFFS;
	const releases=keep?await mkdtemp(join(keep,"jvm-worker-releases-")):root;
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
		if(route==="peer" || route==="reviewed") t.diagnostic(JSON.stringify(await qualifyJvmWorkers(releases,route==="peer"?"ordinary":route)));
	}
});
