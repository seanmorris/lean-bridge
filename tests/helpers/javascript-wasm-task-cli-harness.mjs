/** @file Exercise ordinary and reviewed pthread packages using the installed CLI and fresh offline consumers. */
import assert from "node:assert/strict";
import {access,copyFile,cp,mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {createRequire} from "node:module";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {processBuildRunner} from "../../src/build/process-runner.mjs";
import {readTaskInputs} from "../../src/release/javascript-wasm-task-inputs.mjs";
import {packageSetReceiptName,readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runInstalledChromium} from "./javascript-wasm-installed-browser.mjs";

/**
 * Package the actual authoring CLI, then build and verify each fixture with it.
 *
 * @param t - Test context owning temporary installs.
 * @param fixtures - Published application examples and Lean sources.
 */
export const installedTaskHarness=async (t,fixtures) => {
	const kit=process.env.LEAN_BRIDGE_TEST_TASK_INPUTS,{identity}=await readTaskInputs(kit);
	const root=await mkdtemp(join(tmpdir(),"task-cli-")); t.after(() => rm(root,{recursive: true,force: true}));
	const feed=join(root,"feed");
	const author=join(root,"author"), cli=join(author,"node_modules/.bin/lean-bridge");
	const environment={...process.env,LEAN_BRIDGE_JS_TASK_INPUTS_SHA256: identity};
	for(const k of ["NODE_TEST_CONTEXT","NODE_PATH","LEAN_BRIDGE_TEST_TASK_INPUTS","LEAN_BRIDGE_JS_TASK_INPUTS","LEAN_BRIDGE_RUNTIME_ROOT","LEAN_BRIDGE_JS_INPUTS","LEAN_BRIDGE_JS_TARGET_RUNTIME","LEAN_BRIDGE_JS_THREAD_CORE","LEAN_BRIDGE_JS_THREAD_INIT"]) delete environment[k];
	const run=(command,args,cwd=root,timeoutMs) => processBuildRunner.capture({command,args,cwd,env: environment,timeoutMs});
	const install=(dest,archives) => run("npm",["install","--prefix",dest,"--offline","--ignore-scripts","--no-audit","--no-fund","--cache",dest+"-cache",...archives]);
	const file="lean-bridge.exports.json";
	const build=(dir,out) => run(process.execPath,[cli,"build","--project",dir,"--target","npm","--output",out,"--json","--progress","none"]);
	const release=async (dir,label) => {
		const out=join(root,label); await build(dir,out);
		await run(process.execPath,[cli,"verify","--receipt",join(out,packageSetReceiptName)]);
		const handoff=join(out,"packages/npm"), {receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(handoff,packageSetReceiptName)});
		const manifest=JSON.parse(await readFile(join(out,"javascript-wasm-task-release.json")));
		assert.equal(manifest.taskInputsSha256,identity);
		const artifact=role => join(handoff,receipt.packages.find(p => p.role===role).artifacts[0].path);
		const extract=name => run("tar",["-xzOf",artifact("component"),"package/metadata/"+name]).then(r => r.stdout);
		const ir=JSON.parse(await extract("binding-ir.json"));
		return {out,label,artifact,extract,ir,manifest};
	};
	const pack=JSON.parse((await run(process.execPath,[resolve("scripts/build-cli-npm-package.mjs"),"--output",feed,"--javascript-task-inputs",kit])).stdout);
	assert.equal(pack.javascriptTaskInputsIncluded,true); await install(author,[join(feed,pack.archive.path)]);

	const source=async (module,cfg,base,extra=[]) => {
		const dir=join(root,module); await mkdir(dir);
		for(const name of [...extra,module+".lean","lean-toolchain"]) await copyFile(join(fixtures,name),join(dir,name));
		const lake=await readFile(join(fixtures,"lakefile.toml"),"utf8");
		await writeFile(join(dir,"lakefile.toml"),lake.replace('"'+base+'"','"'+module+'"').replace('"'+base.toLowerCase()+'"','"'+module.toLowerCase()+'"'));
		await writeFile(join(dir,file),JSON.stringify(cfg)); return dir;
	};
	const review=async (dir,cfg,ir,summary) => {
		ir.documentation.summary=summary;
		const reviewText=JSON.stringify(ir,null,4)+"\n", reviewPath=join(dir,"author.binding-ir.json");
		const reviewCfg={...cfg}; delete reviewCfg.exports;
		await writeFile(join(dir,file),JSON.stringify(reviewCfg)); await writeFile(reviewPath,reviewText);
		const reviewed=await release(dir,"reviewed");
		assert.equal(await reviewed.extract("review.binding-ir.json"),reviewText);
		return {reviewed,reviewPath};
	};
	const refuse=async (dir,reviewPath,ir) => {
		await writeFile(reviewPath,JSON.stringify(ir)); const refused=join(root,"wrong-review");
		await assert.rejects(build(dir,refused),error => {
			const report=JSON.parse(error.details.stdout);
			assert.equal(report.status,"failed");
			assert.ok(report.diagnostics.some(d => d.code==="host-export-contract-mismatch" && d.message.startsWith("Reviewed API differs")));
			return true;
		});
		await assert.rejects(access(refused),{code: "ENOENT"});
	};
	const exercise=async (r,other,names,checks) => {
		assert.deepEqual(await readFile(r.artifact("runtime")),await readFile(other.artifact("runtime")));
		const consumer=join(root,r.label+"-consumer"); await mkdir(consumer);
		await writeFile(join(consumer,"package.json"),'{"private":true,"type":"module"}');
		await install(consumer,[r.artifact("runtime"),r.artifact("component"),other.artifact("component")]);
		for(const name of ["calls.mjs","calls.mts","worker.mjs"]) await copyFile(join(fixtures,name),join(consumer,name));
		await writeFile(join(consumer,"tsconfig.json"),JSON.stringify({files: ["calls.mts"],compilerOptions: {strict: true,noEmit: true,module: "NodeNext",target: "ES2022",types: []}}));
		await run(process.execPath,[createRequire(import.meta.url).resolve("typescript/bin/tsc"),"--project","tsconfig.json"],consumer);
		await writeFile(join(consumer,"run.mjs"),'import {exercise} from "./calls.mjs"; console.log(JSON.stringify(await exercise()));\n');
		const node=JSON.parse((await run(process.execPath,["run.mjs"],consumer,60000)).stdout);
		assert.equal(node.checks,checks);
		const worker=JSON.parse((await run(process.execPath,["worker.mjs"],consumer,60000)).stdout);
		assert.deepEqual(worker,node);
		const evaluate=async () => {
			let last="loading packages", timer;
			try
			{
				const deadline=new Promise((_,reject) => { timer=setTimeout(() => reject(new Error("Browser stalled after: "+last)),40000); });
				return await Promise.race([deadline,import("/calls.mjs").then(m => m.exercise(label => { last=label; }))]);
			} finally
			{ clearTimeout(timer); }
		};
		const chromium=await runInstalledChromium({root,consumer,names,isolated: true,timeoutMs: 60000,evaluate});
		assert.deepEqual(chromium,node); t.diagnostic(JSON.stringify({mode: r.label,node,worker,chromium}));
		return {root,consumer,fixtures,names};
	};
	const retain=async (dest,releases) => {
		if(!dest) return;
		await mkdir(dest); for(const r of releases) await cp(r.out,join(dest,r.label),{recursive: true});
	};
	return {file,source,release,review,exercise,refuse,retain};
};
