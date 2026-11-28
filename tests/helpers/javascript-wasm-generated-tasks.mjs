/** @file Compile a selected application and exercise its generated private task ABI in offline npm installs. */
import assert from "node:assert/strict";
import test from "node:test";
import {copyFile, mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {inspectLeanProject} from "../../src/analyze/lean-project.mjs";
import {elaboratedComponent} from "../../src/analyze/semantic-model.mjs";
import {openHostProjectSource} from "../../src/build/host-project-source.mjs";
import {processBuildRunner} from "../../src/build/process-runner.mjs";
import {compileJavaScriptTaskComponent,threadedTaskPatch} from "../../src/build/javascript-wasm-task-component.mjs";
import {generateOwnedWasmBroker} from "../../src/backends/javascript/owned-wasm-broker.mjs";
import {taskInitIdentity} from "../../src/build/javascript-wasm-task-init-identity.mjs";
import {runInstalledChromium} from "./javascript-wasm-installed-browser.mjs";
import {writeJavaScriptTaskPackages} from "../../src/release/javascript-wasm-task-packages.mjs";
import {checkInstalledTaskHandoff} from "./javascript-wasm-public-task-consumer.mjs";

const checkInstalledPackage=async ({root,fixtures,pkg,src,built,configuration,command,environment,mode}) => {
	const handoff=join(root,mode+"-handoff");
	await mkdir(handoff);
	await writeJavaScriptTaskPackages({...src
		, root: handoff
		, compilation: built
		, configuration
		, mainModule: await readFile(join(pkg,"task.mjs"))
		, mainWasm: await readFile(join(pkg,"task.wasm"))});
	return checkInstalledTaskHandoff({root,fixtures,handoff,command,environment,mode,reviewText: src.projectContract.review?.source});
};

test("compiler-generated task, error and iterator controls execute on an installed pthread runtime", {
	skip: process.env.LEAN_BRIDGE_JS_GENERATED_TASK_TEST !== "1", timeout: 900000
}, async t => {
	const project = resolve("tests/fixtures/javascript-wasm-generated-tasks"), fixtures = resolve("tests/fixtures/javascript-wasm-task-runtime");
	const inventory = await inspectLeanProject(project), component = elaboratedComponent(inventory.project);
	const src = await openHostProjectSource({project,inventory,component}); t.after(src.dispose);
	const root = await mkdtemp(join(tmpdir(),"generated-task-install-")); t.after(() => rm(root,{recursive: true,force: true}));
	const app = join(root,"objects"), pkg = join(root,"runtime"), dso = join(root,"component"), consumer = join(root,"consumer");
	for(const p of [app,pkg,dso,consumer]) await mkdir(p);
	const sdk = resolve(process.env.LEAN_BRIDGE_JS_EMSDK), target = resolve(process.env.LEAN_BRIDGE_JS_THREAD_CORE);
	const environment = {...process.env, EMSDK: sdk, EM_CONFIG: join(sdk,".emscripten"), EMCC_CORES: "1", BINARYEN_CORES: "1"};
	const command = (cmd,args,cwd=root) => processBuildRunner.capture({command: cmd,args,cwd,env: environment,timeoutMs: 600000});
	try
	{
		const {stdout} = await command("bash",["-c",'set -eo pipefail; export LEAN_WASM_PROJECT_ROOT="$PWD" LEAN_WASM_RUNTIME_PROFILE=threaded-task; source scripts/lean-runtime-config.sh && echo "$LEAN_WASM_PATCH_SET_SHA"'],process.cwd());
		assert.equal(stdout.trim(),threadedTaskPatch);
		const built = await compileJavaScriptTaskComponent({...src,app,environment,emsdkRoot: sdk,leanRuntimeRoot: target});
		await src.verify();
		await writeFile(join(dso,"component.wasm"),built.binary);
		const exports = WebAssembly.Module.exports(await WebAssembly.compile(built.binary)).map(e => e.name);
		const generated = exports.filter(e => e.startsWith("lb_js_task_"));
		assert.deepEqual(generated,[built.controlSymbol]);
		assert.ok(!exports.some(e => /(?:_poll|_wait_open|_invoke_\d+|_pull_next_\d+)$/u.test(e)),"private implementation exported");
		const required = new Set(["_malloc","_free","_bridge_owned_runtime_identities"]);
		for(const {module,name,kind} of WebAssembly.Module.imports(await WebAssembly.compile(built.binary)))
			if(!exports.includes(name) && ((module === "env" && kind === "function") || ["GOT.mem","GOT.func"].includes(module))) required.add("_"+name);
		const core = join(target,"cmake"), archive = process.env.LEAN_BRIDGE_JS_THREAD_INIT ?? join(core,"lib/lean/libInit.a");
		if(process.env.LEAN_BRIDGE_JS_THREAD_INIT)
		{
			const receipt = JSON.parse(await readFile(join(dirname(archive),"inputs.json"),"utf8"));
			assert.deepEqual(receipt.identity,await taskInitIdentity(target,archive));
		}
		const broker = generateOwnedWasmBroker();
		await writeFile(join(root,"lean_bridge_native_runtime.h"),broker.header); await writeFile(join(root,"broker.c"),broker.source);
		const backend = resolve("src/backends/javascript");
		await command(join(sdk,"upstream/emscripten/emcc"),["-O2"
			, "-g0"
			, "-flto"
			, "-pthread"
			, "-fwasm-exceptions"
			, "-DLEAN_EMSCRIPTEN"
			, "-DLEAN_MULTI_THREAD"
			, "-I"
			, root
			, "-I"
			, join(core,"include")
			, "-I"
			, backend
			, join(backend,"threaded-task-runtime.c")
			, join(backend,"threaded-host-identity.c")
			, join(backend,"task-notification.c")
			, join(root,"broker.c")
			, join(core,"lib/lean/libleanrt.a")
			, join(core,"libuv/src/libuv/libuv.a")
			, archive
			, "-sDEFAULT_TO_CXX=1"
			, "-sMODULARIZE=1"
			, "-sEXPORT_ES6=1"
			, "-sPTHREAD_POOL_SIZE=3"
			, "-sPTHREAD_POOL_SIZE_STRICT=2"
			, "-sENVIRONMENT=node,web,worker"
			, "-sINITIAL_MEMORY=67108864"
			, "-sMAIN_MODULE=2"
			, "-sEXPORTED_RUNTIME_METHODS=PThread,FS,HEAP8"
			, "-sEXPORTED_FUNCTIONS="+JSON.stringify([...required].sort())
			, "-Wl,--fatal-warnings"
			, "-Wl,--no-entry"
			, "-o"
			, join(pkg,"task.mjs")]);
		assert.ok(!WebAssembly.Module.exports(await WebAssembly.compile(await readFile(join(pkg,"task.wasm")))).some(e => e.name === built.controlSymbol));
		const settings={root,fixtures,pkg,command,environment};
		const ordinary=await checkInstalledPackage({...settings,src,built,configuration: inventory.configurationRecord.configuration,mode: "ordinary"});
		t.diagnostic(JSON.stringify(ordinary));
		const reviewedProject=join(root,"review-project"), reviewedApp=join(root,"review-objects");
		await mkdir(reviewedProject); await mkdir(reviewedApp);
		for(const file of ["Jobs.lean","lakefile.toml","lean-toolchain"]) await copyFile(join(project,file),join(reviewedProject,file));
		const reviewedIR=structuredClone(built.api), configuration=structuredClone(inventory.configurationRecord.configuration);
		reviewedIR.documentation.summary="Reviewed public task and cursor contracts."; delete configuration.exports;
		await writeFile(join(reviewedProject,"jobs.binding-ir.json"),JSON.stringify(reviewedIR,null,4)+"\n");
		await writeFile(join(reviewedProject,"lean-bridge.exports.json"),JSON.stringify(configuration));
		const reviewedInventory=await inspectLeanProject(reviewedProject);
		const reviewedSource=await openHostProjectSource({project: reviewedProject,inventory: reviewedInventory,component});
		try
{
			const reviewedBuilt=await compileJavaScriptTaskComponent({...reviewedSource,app: reviewedApp,environment,emsdkRoot: sdk,leanRuntimeRoot: target});
			await reviewedSource.verify(); assert.notEqual(reviewedBuilt.componentIdentity,built.componentIdentity);
			const reviewed=await checkInstalledPackage({...settings,src: reviewedSource,built: reviewedBuilt,configuration,mode: "reviewed"});
			assert.equal(reviewed.runtime,ordinary.runtime); t.diagnostic(JSON.stringify(reviewed));
} finally
{ await reviewedSource.dispose(); }
		await copyFile(resolve("src/runtime/wasm-task-notifications.mjs"),join(pkg,"wasm-task-notifications.mjs"));
		await copyFile(join(fixtures,"generated-consumer.mjs"),join(pkg,"index.mjs"));
		const entry = await readFile(resolve("tests/fixtures/javascript-wasm-task-components/package-entry.mjs"),"utf8");
		await writeFile(join(dso,"index.mjs"),entry+"\nexport const methods="+JSON.stringify(built.methods)+";\nexport const controlSymbol="+JSON.stringify(built.controlSymbol)+";\n");
		const jobName = inventory.configurationRecord.configuration.targets.npm.name, testName = "@example/lean-task-wire-tests";
		const names = [jobName,testName], archives = [], config = ["--offline","--ignore-scripts","--cache",join(root,"cache")];
		for(const [i,dir] of [dso,pkg].entries())
		{
			await writeFile(join(dir,"package.json"),JSON.stringify({name: names[i],version: "1.0.0",type: "module",exports: "./index.mjs",private: true}));
			const [{filename}] = JSON.parse((await command("npm",["pack","--json",...config],dir)).stdout); archives.push(join(dir,filename));
		}
		await writeFile(join(consumer,"package.json"),'{"private":true,"type":"module"}');
		await command("npm",["install","--no-audit","--no-fund",...config,...archives],consumer);
		// Pthreads inherit Node's execArgv. A real module entry (not --input-type)
		// lets the worker execute Emscripten's own module file unchanged.
		await writeFile(join(consumer,"run.mjs"),'import {exercise} from "'+testName+'"; console.log(JSON.stringify(await exercise()));\n');
		let expected;
		for(let i=0;i<2;++i)
		{
			const result = JSON.parse((await processBuildRunner.capture({command: process.execPath,args: ["run.mjs"],cwd: consumer,env: environment,timeoutMs: 60000})).stdout);
			assert.deepEqual(result,{checks: 79,live: 0});
			if(i) assert.deepEqual(result,expected); else expected=result;
		}
		const browser = await runInstalledChromium({root,consumer,names,isolated: true,timeoutMs: 60000,argument: testName,evaluate: async name => (await import(name)).exercise()});
		assert.deepEqual(browser,expected);
		t.diagnostic(JSON.stringify({declarations: built.methods.map(m => m.declaration),nodeProcesses: 2,node: expected,chromium: browser}));
	}
	catch(error)
	{ if(error.details) t.diagnostic(JSON.stringify(error.details)); throw error; }
});
