/** @file Build two unrelated task packages with an offline-installed author CLI and no raw Lean target. */
import assert from "node:assert/strict";
import {access,copyFile,cp,mkdir,mkdtemp,readFile,rm,symlink,unlink,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {processBuildRunner} from "../../src/build/process-runner.mjs";
import {readTaskInputs} from "../../src/release/javascript-wasm-task-inputs.mjs";
import {readVerifiedPackageSetReceipt,packageSetReceiptName} from "../../src/release/package-set-receipt.mjs";
import {checkInstalledTaskHandoff} from "./javascript-wasm-public-task-consumer.mjs";
import {runInstalledChromium} from "./javascript-wasm-installed-browser.mjs";

const configName="lean-bridge.exports.json";
test("installed CLI builds reproducible task releases sharing one package-independent runtime",{
	skip: process.env.LEAN_BRIDGE_JS_TASK_CLI_TEST!=="1",timeout: 900000
},async t => {
	const root=await mkdtemp(join(tmpdir(),"task-cli-")); t.after(() => rm(root,{recursive: true,force: true}));
	const kit=process.env.LEAN_BRIDGE_TEST_TASK_INPUTS, {identity}=await readTaskInputs(kit);
	const environment={...process.env,LEAN_BRIDGE_JS_TASK_INPUTS_SHA256: identity};
	for(const key of ["NODE_TEST_CONTEXT","NODE_PATH","LEAN_BRIDGE_TEST_TASK_INPUTS","LEAN_BRIDGE_JS_TASK_INPUTS","LEAN_BRIDGE_RUNTIME_ROOT","LEAN_BRIDGE_JS_INPUTS","LEAN_BRIDGE_JS_TARGET_RUNTIME","LEAN_BRIDGE_JS_THREAD_CORE","LEAN_BRIDGE_JS_THREAD_INIT"]) delete environment[key];
	const command=(cmd,args,cwd=root,extra={}) => processBuildRunner.capture({command: cmd,args,cwd,env: {...environment,...extra}});
	const fixtures=resolve("tests/fixtures/javascript-wasm-task-runtime"), src=join(root,"first"), relocated=join(root,"second"), peer=join(root,"totals");
	const feed=join(root,"feed"), author=join(root,"author"), cli=join(author,"node_modules/.bin/lean-bridge");
	const install=(prefix,archives) => command("npm",["install","--prefix",prefix,"--offline","--ignore-scripts","--no-audit","--no-fund","--cache",prefix+"-cache",...archives]);
	const build=(project,out,extra) => command(process.execPath,[cli,"build","--project",project,"--target","npm","--output",out,"--json","--progress","none"],root,extra);
	const release=async (project,label) => {
		const out=join(root,label);
		await build(project,out);
		await command(process.execPath,[cli,"verify","--receipt",join(out,packageSetReceiptName)]);
		const handoff=join(out,"packages/npm"), {receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(handoff,packageSetReceiptName)});
		const manifest=JSON.parse(await readFile(join(out,"javascript-wasm-task-release.json")));
		assert.equal(manifest.taskInputsSha256,identity);
		const artifact=role => join(handoff,receipt.packages.find(p => p.role===role).artifacts[0].path);
		return {handoff,receipt,manifest,artifact};
	};
	const refuses=async (label,extra,rx,project=src) => {
		const out=join(root,"refused-"+label);
		await assert.rejects(build(project,out,extra),error => {
			assert.match(JSON.parse(error.details.stdout).diagnostics.map(d => d.message).join("\n"),rx); return true;
		});
		await assert.rejects(access(out),{code: "ENOENT"});
	};
	try
{
		const altered=join(root,"altered"); await cp(kit,altered,{recursive: true});
		const header=join(altered,"lean.h"), bytes=await readFile(header);
		await writeFile(header,Buffer.alloc(bytes.length));
		await assert.rejects(readTaskInputs(altered,{expectedIdentity: identity}),/file drift/u);
		await unlink(header); await symlink(join(kit,"lean.h"),header);
		await assert.rejects(readTaskInputs(altered),/non-regular/u);
		await unlink(header); await writeFile(header,bytes);
		await writeFile(join(altered,"extra"),"unexpected");
		await assert.rejects(readTaskInputs(altered),/extra pthread SDK file/u);
		const {stdout}=await command(process.execPath,[resolve("scripts/build-cli-npm-package.mjs"),"--output",feed,"--javascript-task-inputs",kit]);
		const pack=JSON.parse(stdout); assert.equal(pack.javascriptTaskInputsIncluded,true);
		await install(author,[join(feed,pack.archive.path)]);
		await cp(resolve("tests/fixtures/javascript-wasm-generated-tasks"),src,{recursive: true});
		await cp(src,relocated,{recursive: true});
		await refuses("missing",{LEAN_BRIDGE_JS_TASK_INPUTS: join(root,"missing")},/threaded npm author SDK is not installed/u);
		await refuses("digest",{LEAN_BRIDGE_JS_TASK_INPUTS_SHA256: "0".repeat(64)},/manifest digest mismatch/u);
		const ordinary=await release(src,"ordinary");
		const again=await release(relocated,"reproduced"); assert.deepEqual(again.receipt,ordinary.receipt);
		const consumer={root,fixtures,command,environment};
		t.diagnostic(JSON.stringify(await checkInstalledTaskHandoff({...consumer,handoff: again.handoff,mode: "ordinary"})));
		const ir=JSON.parse((await command("tar",["-xzOf",ordinary.artifact("component"),"package/metadata/binding-ir.json"])).stdout);
		const cfg=JSON.parse(await readFile(join(src,configName)));
		ir.documentation.summary="Reviewed installed task API.";
		const reviewText=JSON.stringify(ir,null,4)+"\n"; delete cfg.exports;
		await writeFile(join(src,"jobs.binding-ir.json"),reviewText); await writeFile(join(src,configName),JSON.stringify(cfg));
		const reviewed=await release(src,"reviewed");
		assert.notEqual(reviewed.manifest.componentIdentity,ordinary.manifest.componentIdentity);
		assert.equal(reviewed.manifest.runtimeIdentity,ordinary.manifest.runtimeIdentity);
		t.diagnostic(JSON.stringify(await checkInstalledTaskHandoff({...consumer,handoff: reviewed.handoff,mode: "reviewed",reviewText})));
		await mkdir(peer); await copyFile(join(src,"lean-toolchain"),join(peer,"lean-toolchain"));
		await writeFile(join(peer,"lakefile.toml"),'name = "totals"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Totals"\n');
		await writeFile(join(peer,"Totals.lean"),"prelude\nimport Init.System.Promise\nnamespace Totals\ndef sum (a b : UInt32) : Task UInt32 := Task.pure (a+b)\nend Totals\n");
		await writeFile(join(peer,configName),JSON.stringify({schemaVersion: 1,modules: ["Totals"],exports: ["Totals.sum"],taskExports: ["Totals.sum"],targets: {npm: {name: "@example/lean-totals",version: "1.0.0"}}}));
		const other=await release(peer,"independent");
		assert.notEqual(ordinary.manifest.componentIdentity,other.manifest.componentIdentity);
		assert.deepEqual(await readFile(ordinary.artifact("runtime")),await readFile(other.artifact("runtime")));
		const pair=join(root,"pair"); await mkdir(pair);
		await writeFile(join(pair,"package.json"),'{"type":"module","private":true}');
		await install(pair,[ordinary.artifact("runtime"),ordinary.artifact("component"),other.artifact("component")]);
		await copyFile(join(fixtures,"concurrent-consumer.mjs"),join(pair,"calls.mjs"));
		await writeFile(join(pair,"run.mjs"),'import {exercise} from "./calls.mjs"; console.log(JSON.stringify(await exercise()));\n');
		const node=JSON.parse((await command(process.execPath,["run.mjs"],pair)).stdout);
		assert.deepEqual(node,{during: 1,sum: 29,held: 71,after: 0});
		const chromium=await runInstalledChromium({root,consumer: pair,names: ["@example/lean-jobs","@example/lean-totals"],isolated: true,timeoutMs: 60000,evaluate: async () => (await import("/calls.mjs")).exercise()});
		assert.deepEqual(chromium,node); t.diagnostic(JSON.stringify({twoComponents: node,runtime: other.manifest.runtimeIdentity}));
		await writeFile(join(src,configName),JSON.stringify({...cfg,nativeEffects: ["filesystem"]}));
		await refuses("external-effects",{},/only in-memory/u);
		const lean=join(peer,"Totals.lean");
		await writeFile(lean,(await readFile(lean,"utf8")).replace("Task UInt32 := Task.pure (a+b)","UInt32 := a+b"));
		await refuses("non-task",{},/taskExports requires a real Lean Task result/u,peer);
		if(process.env.LEAN_BRIDGE_JS_TASK_EVIDENCE)
		{
			const archiveRoot=process.env.LEAN_BRIDGE_JS_TASK_EVIDENCE; await mkdir(archiveRoot);
			for(const label of ["ordinary","reviewed","independent"]) await cp(join(root,label),join(archiveRoot,label),{recursive: true});
		}
} catch(error)
{
		t.diagnostic([error.details?.stderr,error.details?.stdout].filter(Boolean).join("\n").slice(-4000)); throw error;
}
});
