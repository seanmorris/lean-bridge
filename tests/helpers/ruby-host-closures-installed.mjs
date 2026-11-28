/** @file Verify returned Lean functions against installed source, reviewed and worker MRI gems. */
import assert from "node:assert/strict";
import {access,appendFile,copyFile,cp,mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename,join,resolve} from "node:path";
import test from "node:test";
import {canonicalJson} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {installOfflineAuthor} from "./offline-author-cli.mjs";

test("relocated MRI gems return binding-owned Lean closures over the original Ruby instance",{timeout: 1800000},async t=>{
	const root=await mkdtemp(join(tmpdir(),"ruby-host-closures-"));t.after(()=>rm(root,{recursive: true,force: true}));
	const src=join(root,"source"),fixture=resolve("tests/fixtures/ruby-host-closures"),file=join(src,"lean-bridge.exports.json");
	const ruby=process.env.LEAN_BRIDGE_RUBY??"ruby",cli=await installOfflineAuthor(root);
	await cp("tests/fixtures/ruby-host-meter",src,{recursive: true,filter: p=>!p.endsWith(".rb")});
	await copyFile(join(fixture,"Closures.lean"),join(src,"Closures.lean"));await copyFile("LICENSE",join(src,"LICENSE"));
	await appendFile(join(src,"lakefile.toml"),'\n[[lean_lib]]\nname = "Closures"\n');
	const cfg=JSON.parse(await readFile(file));cfg.modules.push("Closures");cfg.exports.push("Closures.remember","Closures.reader");
	const build=out=>run(process.execPath,[cli,"build","--project",src,"--target","rubygems","--output",out,"--json","--progress","none"],root,process.env);
	await writeFile(file,canonicalJson({...cfg,exports: [...cfg.exports,"Closures.fileReader"]}));
	await assert.rejects(build(join(root,"denied")),e=>e.message.includes("Closures.fileReader requires nativeEffects") && e.message.includes("filesystem"));
	await assert.rejects(access(join(root,"denied")),{code: "ENOENT"});
	let first;
	for(const route of ["ordinary","reviewed","worker"])
	{
		const out=join(root,route),review=join(src,"public.binding-ir.json");
		if(route==="reviewed")
		{
			delete cfg.exports;await writeFile(file,canonicalJson(cfg));
			const stale=structuredClone(first);
			stale.types.find(r=>r.source?.declaration==="Closures.remember").source.extensions["lean-bridge.dev/closure-owner"]="python-host-binding";
			await writeFile(review,canonicalJson(stale));
			const rejected=join(root,"stale-owner");await assert.rejects(build(rejected),e=>e.message.includes("Reviewed API differs from compiled host exports"));
			await assert.rejects(access(rejected),{code: "ENOENT"});
			await writeFile(review,canonicalJson(first));
		}
		if(route==="worker")
		{
			await rm(review);cfg.exports=["Workshop.read","Closures.remember","Closures.reader","Closures.fileReader","Closures.echoBox"];
			cfg.taskExports=["Closures.echoBox"];cfg.nativeEffects=["filesystem"];
		}
		await writeFile(file,canonicalJson(cfg));await build(out);
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(out,"package-set-receipt.json")});
		const [pkg]=receipt.packages;assert.equal(pkg.profile,"native-ruby-host-v1");assert.equal(pkg.name,"workshop");
		const api=JSON.parse(await readFile(join(out,"binding-ir.json"))),row=api.declarations.find(d=>d.source.declaration==="Closures.remember");
		const fn=api.types.find(d=>d.id===row.result.type.id);
		assert.equal(row.result.ownership,"lease");assert.equal(fn.source.extensions["lean-bridge.dev/closure-owner"],"ruby-host-binding");
		assert.equal(fn.callable.selfDisposal,"defer");assert.equal(fn.callable.invocation,"many");
		assert.deepEqual([fn.callable.parameters[0].type.id,fn.callable.result.type.id],["host:meter.Box","host:meter.Box"]);
		assert.ok(fn.callable.failure.errors.includes("error:RubyHostException"));
		if(route==="reviewed")assert.deepEqual(api,first);else if(!first)first=api;
		const gem=join(root,basename(pkg.artifacts[0].path)),gems=join(root,"gems"),app=join(root,"app"),moved=join(app,"installed");
		await rename(join(out,pkg.artifacts[0].path),gem);await rm(out,{recursive: true});await mkdir(gems);
		await run(ruby,["-S","gem","install","--local","--no-document","--ignore-dependencies","--install-dir",gems,gem],root,{...process.env,GEM_PATH: gems,GEM_HOME: gems});
		await rm(gem);await rm(join(gems,"cache",basename(gem)),{force: true});await mkdir(app);await rename(gems,moved);
		await copyFile(join(fixture,"consumer.rb"),join(app,"consumer.rb"));
		const msg=await run(ruby,["consumer.rb"],app,{PATH: "/no-tools",GEM_PATH: moved,GEM_HOME: moved,LEAN_NUM_THREADS: "1"});
		assert.match(msg,/foreign fiber\/thread, GC and rebind; live=0/u);t.diagnostic(route+" "+result.receiptSha256+" "+msg);
		await rm(app,{recursive: true});
	}
});
