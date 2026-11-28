/** @file Build ordinary and independently reviewed PHP-Wasm task releases with an offline-installed author CLI. */
import assert from "node:assert/strict";
import {access,cp,mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {processBuildRunner} from "../../src/build/process-runner.mjs";
import {validateBindingIr} from "../../src/binding-ir/contract.mjs";
import {hashBindingIr} from "../../src/binding-ir/canonical.mjs";
import {buildCliNpmPackage} from "../../src/release/cli-npm-package.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {exercisePhpTaskRelease} from "./php-wasm-task-installed.mjs";

const callbacks=process.env.LEAN_BRIDGE_PHP_WASM_TASK_CALLBACKS==="1";
const leases=process.env.LEAN_BRIDGE_PHP_WASM_TASK_LEASES==="1";
test(leases?"prepared PHP-Wasm packages exchange nominal leases across tasks, typed errors and cursors":callbacks?"prepared PHP-Wasm callback releases use PHP reviews and preserve Zend owner semantics":"prepared PHP-Wasm task releases compile ordinary and reviewed Lean with the packed author CLI",async t=>{
	const sdk=process.env.LEAN_BRIDGE_TEST_TASK_INPUTS,evidence=process.env.LEAN_BRIDGE_PHP_TASK_EVIDENCE;
	assert.ok(sdk && process.env.LEAN_BRIDGE_PHP_WASM_HOST,"Set the verified task SDK and php-wasm host");
	const root=await mkdtemp(join(tmpdir(),"php-task-author-"));t.after(()=>rm(root,{recursive: true,force: true}));
	const retained=evidence && (leases?evidence+"-leases":callbacks?evidence+"-callbacks":evidence);
	if(retained) await mkdir(retained);
	const author=join(root,"author"),pkg=await buildCliNpmPackage({outputRoot: join(root,"feed"),javascriptTaskInputsRoot: sdk});
	const env={...process.env,npm_config_cache: join(root,"cache")};
	for(const k of ["NODE_TEST_CONTEXT","NODE_PATH","LEAN_BRIDGE_JS_TASK_INPUTS","LEAN_BRIDGE_TEST_TASK_INPUTS","LEAN_BRIDGE_JS_THREAD_CORE","LEAN_BRIDGE_JS_THREAD_INIT","LEAN_BRIDGE_RUNTIME_ROOT","LEAN_BRIDGE_JS_TARGET_RUNTIME"]) delete env[k];
	const run=async(cmd,args)=>{try
{return await processBuildRunner.capture({command: cmd,args,cwd: root,env,timeoutMs: 360000});}
		catch(e)
{t.diagnostic((e.details?.stderr || e.details?.stdout || e.message).slice(-3000));throw e;}};
	await run("npm",["install","--prefix",author,"--offline","--ignore-scripts","--no-fund","--no-audit",pkg.archive]);
	const cli=join(author,"node_modules/.bin/lean-bridge"),fixture=resolve("tests/fixtures/"+(leases?"javascript-wasm-resource-tasks":callbacks?"javascript-wasm-retained-tasks":"javascript-wasm-generated-tasks"));
	const componentName=leases?"depot":callbacks?"relay":"jobs",npm="@example/"+componentName+"-php",composer="example/lean-"+componentName;
	let ir,peer;const receipts=[];
	if(callbacks || leases)
{
		const src=join(root,"peer-src");peer=join(root,"peer");
		await cp(leases?fixture:resolve("tests/fixtures/javascript-wasm-generated-tasks"),src,{recursive: true});
		const file=join(src,"lean-bridge.exports.json"),cfg=JSON.parse(await readFile(file));
		if(leases)
		{
			Object.assign(cfg,{modules: ["Peer"],exports: ["Peer.bump"],resources: ["Shared.Ticket"],taskExports: ["Peer.bump"]});
			delete cfg.asyncIterators;
			const lake=join(src,"lakefile.toml");
			await writeFile(lake,(await readFile(lake,"utf8")).replace('"depot"','"peer"').replace('"Depot"','"Peer"'));
		}
		const component=leases?"peer":"jobs";
		cfg.targets={"php-wasm": {npm: {name: "@example/"+component+"-php",version: "1.0.0"},composer: {name: "example/lean-"+component,version: "1.0.0"}}};
		await writeFile(file,JSON.stringify(cfg));
		await run(process.execPath,[cli,"build","--project",src,"--target","php-wasm","--output",peer,"--json","--progress","none"]);
		await rm(src,{recursive: true});if(retained) await cp(peer,join(retained,"peer"),{recursive: true});
}
	for(const route of ["ordinary","reviewed","stale"])
{
		const src=join(root,route+"-src"),out=join(root,route);
		await cp(fixture,src,{recursive: true});
		const cfgPath=join(src,"lean-bridge.exports.json"),cfg=JSON.parse(await readFile(cfgPath,"utf8"));
		if(leases)
		{
			await cp(resolve("tests/fixtures/php-wasm-task-owner/Mutate.lean"),join(src,"Mutate.lean"));
			const lake=join(src,"lakefile.toml");await writeFile(lake,(await readFile(lake,"utf8"))+'\n[[lean_lib]]\nname = "Mutate"\n');
			cfg.modules.push("Mutate");cfg.exports.push("Mutate.usingCallback");cfg.taskExports.push("Mutate.usingCallback");cfg.taskIOErrors=["Mutate.usingCallback"];
		}
		if(callbacks)
{
			await cp(resolve("tests/fixtures/php-wasm-task-owner/Report.lean"),join(src,"Report.lean"));
			const lake=join(src,"lakefile.toml");await writeFile(lake,(await readFile(lake,"utf8"))+'\n[[lean_lib]]\nname = "Report"\n');
			cfg.modules.push("Report");for(const key of ["exports","taskExports","taskIOErrors"]) cfg[key].push("Report.caughtMessage");
}
		cfg.targets={"php-wasm": {npm: {name: npm,version: "1.0.0"},composer: {name: composer,version: "1.0.0"}}};
		if(route!=="ordinary")
{
			delete cfg.exports;ir.documentation.summary="Checked PHP worker delivery";
			if(route==="stale" && callbacks)
{
				const callable=ir.types.find(t=>t.kind==="callback").callable;
				callable.resultMode="promise";callable.effects=["async",...callable.effects];
				validateBindingIr(ir);
}
			if(route==="stale" && leases)
			{
				const ticket=ir.types.find(t=>t.name==="Ticket"),wrong="0".repeat(64);
				ticket.source.extensions["lean-bridge.dev/resource-identity"]=wrong;ticket.resource.kindId="resource:Shared.Ticket/"+wrong;validateBindingIr(ir);
			}
			if(route==="stale" && !callbacks && !leases)
{
				const path=join(src,"Jobs.lean"),before=await readFile(path,"utf8");
				const after=before.replace("exact (value : Int) : Task Int := Task.pure value","exact (_value : Int) : Task Bool := Task.pure true");
				assert.notEqual(after,before);await writeFile(path,after);
}
			await writeFile(join(src,"author.binding-ir.json"),JSON.stringify(ir));
}
		await writeFile(cfgPath,JSON.stringify(cfg));
		const build=()=>run(process.execPath,[cli,"build","--project",src,"--target","php-wasm","--output",out,"--json","--progress","none"]);
		if(route==="stale")
{
			await assert.rejects(build,e=>{
				const report=JSON.parse(e.details.stdout);assert.equal(report.status,"failed");
				assert.ok(report.diagnostics.some(d=>d.code==="host-export-contract-mismatch" && d.message.startsWith("Reviewed API differs")));
				return true;
			});
			await assert.rejects(access(out),{code: "ENOENT"});break;
}
		await build();await run(process.execPath,[cli,"verify","--receipt",join(out,"package-set-receipt.json")]);
		const {receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(out,"package-set-receipt.json")});
		const component=receipt.packages.find(p=>p.role==="component");assert.equal(component.name,npm);
		assert.equal(receipt.packages.find(p=>p.role==="api").name,composer);
		const archive=join(out,component.artifacts[0].path);receipts.push(component.artifacts[0].sha256);
		const published=JSON.parse((await run("tar",["-xOzf",archive,"package/metadata/binding-ir.json"])).stdout);
		assert.equal(hashBindingIr(published),receipt.profiles[0].bindingIrSha256);
		if(route==="ordinary") ir=published;
		else assert.deepEqual(JSON.parse((await run("tar",["-xOzf",archive,"package/metadata/review.binding-ir.json"])).stdout),ir);
		if(callbacks || leases)
{assert.ok(ir.types.some(x=>x.kind==="callback" && x.callable.resultMode==="value"));assert.ok(ir.errors.some(e=>e.id==="error:PhpCallbackException"));assert.ok(!ir.errors.some(e=>e.id==="error:JavaScriptCallbackError"));}
		await rm(src,{recursive: true});if(retained) await cp(out,join(retained,route),{recursive: true});
		await exercisePhpTaskRelease(out,t,peer,leases);
		t.diagnostic(route+" "+JSON.stringify(receipt.packages.map(p=>[p.role,p.artifacts[0].sha256])));
}
	assert.notEqual(receipts[0],receipts[1]);
	if(peer && !leases) await exercisePhpTaskRelease(peer,t);
});
