/** @file Link an ordinary C application to two independently compiled Lean components. */
import assert from "node:assert/strict";
import {copyFile,link,mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {inspectLeanProject} from "../../src/analyze/lean-project.mjs";
import {elaboratedComponent} from "../../src/analyze/semantic-model.mjs";
import {compileCHostComponent} from "../../src/build/c-host-component.mjs";
import {openHostProjectSource} from "../../src/build/host-project-source.mjs";
import {processBuildRunner} from "../../src/build/process-runner.mjs";
import {canonicalJson} from "../../src/capsule/node.mjs";
import {prepareNativeHostFixture} from "./native-host-import-check.mjs";

test("public C consumers exchange real application objects across independent Lean components",async t=>{
	const root=await mkdtemp(join(tmpdir(),"c-host-components-"));
	t.after(()=>rm(root,{recursive: true,force: true}));
	const leanPrefix=resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX), runtimeRoot=resolve(process.env.LEAN_BRIDGE_C_HOST_SDK);
	const prefix=join(root,"client"), producer=join(root,"producer");
	await mkdir(prefix); await mkdir(producer);
	const builds=[];
	for(const name of ["workshop","peer"])
	{
		const project=join(producer,name),app=join(producer,name+"-build");
		await prepareNativeHostFixture(project,"c"); await copyFile("LICENSE",join(project,"LICENSE")); await mkdir(app);
		if(name==="peer")
		{
			const lake=join(project,"lakefile.toml"),cfg=join(project,"lean-bridge.exports.json");
			await writeFile(lake,(await readFile(lake,"utf8")).replace('"workshop"','"peer"'));
			const config=JSON.parse(await readFile(cfg,"utf8")); config.targets.c.name=name; await writeFile(cfg,canonicalJson(config));
		}
		const inventory=await inspectLeanProject(project),component=elaboratedComponent(inventory.project);
		const source=await openHostProjectSource({project,inventory,component,leanPrefix,targets: ["c"]});
		try
		{
			const b=await compileCHostComponent({...source,ir: source.projectContract.ir,app,runtimeRoot,leanPrefix,environment: process.env,name,version: "1.0.0"});
			await source.verify();
			if(builds.length) assert.equal(b.binaries[b.domain],builds[0].binaries[builds[0].domain]);
			else await copyFile(join(app,b.domain),join(prefix,b.domain));
			await copyFile(join(app,b.component),join(prefix,b.component));
			await writeFile(join(prefix,name+".h"),b.publicHeader);
			builds.push(b);
		} catch(e)
{throw new Error([e.message,e.details?.stderr,e.details?.stdout].filter(Boolean).join("\n"),{cause: e});}
		finally
{await source.dispose();}
	}
	assert.notEqual(builds[0].component,builds[1].component);
	await rm(producer,{recursive: true});
	for(const lib of ["liblean_bridge_native.so","libleanshared.so"])
		await link(join(runtimeRoot,"lib",lib),join(prefix,lib)).catch(e=>{if(e.code!=="EXDEV") throw e;return copyFile(join(runtimeRoot,"lib",lib),join(prefix,lib));});
	const run=(command,args)=>processBuildRunner.capture({command,args,cwd: prefix,env: {...process.env,LD_LIBRARY_PATH: ""}});
	const fixture=resolve("tests/fixtures/c-host-members/consumer.c");
	for(const b of builds)
	{
		const names=(await run("nm",["-D","--defined-only",b.component])).stdout.trim().split("\n").map(row=>row.trim().split(/\s+/u).at(-1)).sort();
		assert.deepEqual(names,[...b.symbols].sort());
	}
	for(const order of [builds,[...builds].reverse()])
	{
		await run(process.env.CC??"cc",["-std=c11","-Wall","-Wextra","-Werror","-I.",fixture,"-L.","-Wl,-rpath,$ORIGIN","-Wl,-rpath-link,.",...order.map(b=>"-l:"+b.component),"-o","client"]);
		const output=await run("./client",[]); assert.match(output.stdout,/public C owners: exactly one destruction/u);
	}
	t.diagnostic("Both link orders: "+builds.map(b=>b.binaries[b.component]).join(", ")+"; shared domain "+builds[0].binaries[builds[0].domain]);
});
