/** @file Build source and reviewed wheels; call returned Lean functions through a relocated offline install. */
import assert from "node:assert/strict";
import {access,appendFile,copyFile,cp,mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {canonicalJson} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";

test("returned Python host closures keep application identity and revoke at binding shutdown", {timeout: 1800000},async t=>{
	const root=await mkdtemp(join(tmpdir(),"python-host-closures-"));
	t.after(()=>rm(root,{recursive: true,force: true}));
	const python=await run(process.env.LEAN_BRIDGE_PYTHON??"python3",["-I","-c","import sys; print(sys.executable)"],root,process.env);
	const author=join(root,"author"),file=join(author,"lean-bridge.exports.json"),seed="tests/fixtures/python-host-closures";
	await cp("tests/fixtures/python-host-meter",author,{recursive: true});await copyFile(join(seed,"Closures.lean"),join(author,"Closures.lean"));
	await appendFile(join(author,"lakefile.toml"),'\n[[lean_lib]]\nname = "Closures"\n');
	const cfg=JSON.parse(await readFile(file));cfg.modules.push("Closures");cfg.exports.push("Closures.remember","Closures.reader");
	const build=out=>run(process.execPath,[resolve("scripts/lean-bridge.mjs"),"build","--project",author,"--target","pypi","--output",out,"--json","--progress","none"],root,{...process.env,LEAN_BRIDGE_PYTHON: python},600000);
	const denied=join(root,"denied");
	await writeFile(file,canonicalJson({...cfg,exports: [...cfg.exports,"Closures.fileReader"]}));
	await assert.rejects(build(denied),e=>e.message.includes("Closures.fileReader requires nativeEffects") && e.message.includes("filesystem"));
	await assert.rejects(access(denied),{code: "ENOENT"});
	let first;
	for(const route of ["ordinary","reviewed","mixed-worker","nominal-worker"])
	{
		const out=join(root,route),site=join(root,"site"),client=join(root,"client"),moved=join(client,"packages");
		const review=join(author,"public.binding-ir.json");
		if(route==="reviewed")
{delete cfg.exports;await writeFile(review,canonicalJson(first));}
		if(route==="mixed-worker")
		{
			await rm(review);cfg.exports=["Workshop.readLevel","Closures.remember","Closures.reader","Closures.job","Closures.fileReader"];
			cfg.taskExports=["Closures.job"];cfg.nativeEffects=["filesystem"];
		}
		if(route==="nominal-worker")
		{
			cfg.taskExports.push("Closures.echoBox");cfg.exports.push("Closures.echoBox");
		}
		await writeFile(file,canonicalJson(cfg));await build(out);
		const {result,receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(out,"package-set-receipt.json")});
		assert.deepEqual(result.profiles,[cfg.taskExports?"native-python-task-v1":"native-python-host-v1"]);
		const ev=JSON.parse(await readFile(join(out,"host-export-evidence.json")));
		assert.equal(ev.selection.pythonTaskObjects,route==="nominal-worker"?true:undefined);
		const api=JSON.parse(await readFile(join(out,"binding-ir.json")));
		const row=api.declarations.find(d=>d.source.declaration==="Closures.remember"),fn=api.types.find(d=>d.id===row.result.type.id);
		assert.equal(row.result.ownership,"lease");assert.equal(fn.callable.invocation,"many");assert.equal(fn.callable.selfDisposal,"defer");
		assert.equal(fn.callable.parameters[0].type.id,"host:meter.Box");assert.equal(fn.callable.result.type.id,"host:meter.Box");
		assert.ok(fn.callable.failure.errors.includes("error:PythonHostException"));
		if(route==="mixed-worker")
		{
			const factory=api.declarations.find(d=>d.source.declaration==="Closures.fileReader");
			assert.deepEqual(factory.capabilities.filter(c=>c.startsWith("capability:native.")),["capability:native.filesystem"]);
			assert.deepEqual(api.types.find(d=>d.id===factory.result.type.id).source.extensions["lean-bridge.dev/required-capabilities"],factory.capabilities);
		}
		if(route==="reviewed") assert.deepEqual(api,first);else if(!first) first=api;
		const wheels=receipt.packages.map(p=>join(out,p.artifacts[0].path));
		const pip=["-I","-m","pip","--isolated","install","--disable-pip-version-check","--no-cache-dir","--no-index","--no-compile","--target",site,...wheels];
		await run(python,pip,root,process.env);
		await mkdir(client);await rename(site,moved);await copyFile(join(seed,"consumer.py"),join(client,"consumer.py"));
		const msg=await run(python,["-I","-c","import runpy,sys;sys.path.insert(0,'packages');runpy.run_path('consumer.py',run_name='__main__')"],client,{PATH: "/no-tools",LEAN_NUM_THREADS: "1"});
		assert.match(msg,/foreign thread, and rebind passed/u);t.diagnostic(route+" "+result.receiptSha256+" "+msg);
		await rm(client,{recursive: true});await rm(out,{recursive: true});
	}
});
