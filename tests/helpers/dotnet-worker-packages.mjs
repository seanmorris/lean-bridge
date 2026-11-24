/** @file Run the installed publishing CLI and consume its independently built CLR worker packages. */
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { buildCliNpmPackage } from "../../src/release/cli-npm-package.mjs";
import { runNativeTool as run } from "./native-effect-consumers.mjs";
import { prepareDotnetWorkerProject } from "./dotnet-worker-project.mjs";
import { qualifyDotnetWorkers } from "./dotnet-worker-release.mjs";

test("published CLR host contracts carry live C# objects through Lean tasks and streams", {timeout: 3600000},async t=>{
	const root=await mkdtemp(join(tmpdir(),"dotnet-worker-packages-"));
	t.after(()=>rm(root,{recursive: true,force: true}));
	const tar=await buildCliNpmPackage({outputRoot: join(root,"cli")}), tools=join(root,"tools"); await mkdir(tools);
	await run("npm",["install","--offline","--prefix",tools,"--ignore-scripts","--no-audit","--no-fund","--cache",join(root,"cache"),tar.archive],root,process.env);
	const cli=join(tools,"node_modules/.bin/lean-bridge");
	for(const route of ["ordinary","peer","reviewed"])
	{
		const project=join(root,"author-"+route), cfg=await prepareDotnetWorkerProject(project,route==="peer");
		if(route==="reviewed")
		{
			const ir=JSON.parse(await readFile(join(root,"ordinary/binding-ir.json")));
			await writeFile(join(project,"public.binding-ir.json"),canonicalJson(ir));
			delete cfg.exports; await writeFile(join(project,"lean-bridge.exports.json"),canonicalJson(cfg));
		}
		await run(process.execPath,[cli,"build","--project",project,"--target","nuget","--output",join(root,route),"--json","--progress","none"],root,process.env);
		await rm(project,{recursive: true});
		if(route!=="ordinary") t.diagnostic(JSON.stringify(await qualifyDotnetWorkers(root,route==="peer"?"ordinary":route)));
	}
	const project=join(root,"refused"), output=join(root,"refused-release");
	const cfg=await prepareDotnetWorkerProject(project);
	delete cfg.exports; await writeFile(join(project,"lean-bridge.exports.json"),canonicalJson(cfg));
	const stale=JSON.parse(await readFile(join(root,"ordinary/binding-ir.json")));
	const decl=stale.declarations.find(d=>d.source.declaration==="Workers.reject");
	delete decl.source.extensions["lean-bridge.dev/error-payload-site"];
	await writeFile(join(project,"public.binding-ir.json"),canonicalJson(stale));
	await assert.rejects(run(process.execPath,[cli,"build","--project",project,"--target","nuget","--output",output,"--json","--progress","none"],root,process.env),/Reviewed API differs from compiled host exports/u);
	await assert.rejects(access(join(output,"package-set-receipt.json")),{code: "ENOENT"});
});
