/** @file Exercise a native PHP worker's real file effects through a relocated offline Composer install. */
import assert from "node:assert/strict";
import {copyFile,mkdir,mkdtemp,rm} from "node:fs/promises";
import {join,resolve} from "node:path";
import test from "node:test";
import {prepareNativeHostFixture} from "./native-host-import-check.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {installPhpIOComponents} from "./php-io-install.mjs";
import {schedulerRepositories} from "./php-task-feed.mjs";
import {checkHostWorkerEffects} from "./host-worker-effect-handoffs.mjs";

test("installed native PHP workers honor effect grants through initialization, pull and close",{timeout: 2400000},async t=>{
	const scheduler=await schedulerRepositories(process.env.LEAN_BRIDGE_PHP_SCHEDULER_CACHE);
	const phps=(process.env.LEAN_BRIDGE_PHP_HOST_INTERPRETERS??"/usr/bin/php").split(",").map(p=>resolve(p));
	const consume=async(root,dir)=>{
		const stage=await mkdtemp(join(root,"composer-client-")),local=join(stage,"project"),dest=join(stage,"relocated");
		try
		{
			await mkdir(local);await copyFile("tests/fixtures/php-host-tasks/effects.php",join(local,"client.php"));
			const {components}=await installPhpIOComponents(stage,local,dest,[dir],scheduler);
			assert.equal(components[0].pkg.profile,"native-php-host-task-v1");
			const env={PATH: "/no-tools",LD_BIND_NOW: "1",LEAN_NUM_THREADS: "1",LEAN_BRIDGE_EFFECT_BOOT: "from-app"};
			for(const php of phps)
			{
				const ffi=await run(php,["-n","-r","echo (int)extension_loaded('ffi');"],dest,env);
				const opts=ffi==="1"?["-n"]:["-n","-d","extension=ffi"];
				assert.match(await run(php,[...opts,"-d","ffi.enable=1","client.php"],dest,env,90000),/early-break close passed/u);
			}
			return phps.length;
		}
		finally
		{await rm(stage,{recursive: true,force: true});}
	};
	await checkHostWorkerEffects(t,{target: "php-native",profile: "native-php-host-task-v1",blockingOwner: "native PHP",prepare: src=>prepareNativeHostFixture(src,"php"),consume});
});
