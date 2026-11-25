/** @file Exercise bound PHP functions through verified, offline Composer releases. */
import assert from "node:assert/strict";
import {appendFile,copyFile,mkdir,mkdtemp,readFile,rm} from "node:fs/promises";
import {join,resolve} from "node:path";
import test from "node:test";
import {reconcileHostExports,taskWorkerInterface} from "../../src/analyze/host-export-model.mjs";
import {checkHostFunctionReleases} from "./host-function-releases.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {installPhpIOComponents} from "./php-io-install.mjs";
import {schedulerRepositories} from "./php-task-feed.mjs";

test("installed native PHP packages return invokable functions over application objects",{timeout: 3600000},async t=>{
	const env=process.env,interpreters=(env.LEAN_BRIDGE_PHP_HOST_INTERPRETERS??"/usr/bin/php").split(",").map(p=>resolve(p));
	assert.ok(env.LEAN_BRIDGE_PHP_SCHEDULER_CACHE,"Set LEAN_BRIDGE_PHP_SCHEDULER_CACHE to the offline Amp and Revolt cache");
	const scheduler=await schedulerRepositories(resolve(env.LEAN_BRIDGE_PHP_SCHEDULER_CACHE));
	const addWorkers=async(src,cfg)=>{
		await appendFile(join(src,"Closures.lean"),'\nnamespace Closures\nopen LeanBridge.Host.Php\ndef relay (x : Box) (f : Box → IO Box) : BaseIO (Task (Except IO.Error Box)) := IO.asTask (f x)\nend Closures\n');
		cfg.exports.push("Closures.relay");cfg.taskExports.push("Closures.relay");cfg.taskIOErrors=["Closures.relay"];
	};
	const consume=async({root,out,src,worker,route})=>{
		const info=JSON.parse(await readFile(join(out,"host-export-evidence.json")));
		const ir=JSON.parse(await readFile(join(src,"lean-bridge.hosts.json"))),api=JSON.parse(await readFile(join(out,"binding-ir.json")));
		const replay=selection=>reconcileHostExports({ir,component: api.component,metadata: info.metadata,selection});
		assert.equal(info.selection.phpNativeFunctions,true);
		assert.throws(()=>taskWorkerInterface(api,info),/Native PHP .*cannot use the JavaScript worker interface/u);
		assert.throws(()=>replay({...info.selection,phpWasmTaskObjects: true}),/native PHP returned-function owner/u);
		const unauth={...info.selection};delete unauth.phpNativeFunctions;
		assert.throws(()=>replay(unauth),/Returned IO closures require/u);
		const stage=await mkdtemp(join(root,"composer-")),local=join(stage,"client"),dest=join(stage,"deployed");
		await mkdir(local);await copyFile("tests/fixtures/php-host-closures/installed.php",join(local,"client.php"));
		if(worker)await copyFile("tests/fixtures/php-host-closures/worker.php",join(local,"worker.php"));
		const {vendor,components}=await installPhpIOComponents(stage,local,dest,[out],worker?scheduler:[]);
		assert.match(await readFile(join(vendor,components[0].pkg.name,"README.md"),"utf8"),/close its binding to revoke all its functions/u);
		await rm(out,{recursive: true});
		for(const php of interpreters)
		{
			const isolated={PATH: "/no-tools",LEAN_NUM_THREADS: "1",LANG: "C.UTF-8",TMPDIR: dest};
			const flags=(await run(php,["-n","-r","echo (int)extension_loaded('ffi');"],dest,isolated))==="1"?["-n"]:["-n","-d","extension=ffi"];
			const execute=(file,mode)=>run(php,[...flags,"-d","ffi.enable=1",file,join(vendor,"autoload.php"),mode],dest,isolated,120000);
			assert.match(await execute("client.php","normal"),/original exception, self-close and teardown passed/u);
			assert.match(await execute("client.php","retire"),/retired function captures released independently/u);
			if(worker)assert.match(await execute("worker.php","normal"),/file reads and cancellation stayed binding-local/u);
			t.diagnostic(route+" / PHP "+await run(php,["-n","-r","echo PHP_VERSION;"],dest,isolated));
		}
		await rm(stage,{recursive: true});
	};
	await checkHostFunctionReleases(t,{backend: "php",module: "Php"
		, target: "php-native"
		, error: "error:PhpHostException"
		, profiles: ["native-php-host-v1","native-php-host-task-v1"]
		, archives: 1,addWorkers,consume});
});
