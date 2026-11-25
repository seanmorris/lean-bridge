/** @file Run a real relocated MRI platform gem with granted worker and finalizer IO. */
import assert from "node:assert/strict";
import {copyFile,mkdir,mkdtemp,rename,rm} from "node:fs/promises";
import {basename,join} from "node:path";
import test from "node:test";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {prepareNativeHostFixture} from "./native-host-import-check.mjs";
import {checkHostWorkerEffects} from "./host-worker-effect-handoffs.mjs";

test("installed Ruby host workers honor effect grants through initialization, pull and close",{timeout: 2400000},async t=>{
	const ruby=await run(process.env.LEAN_BRIDGE_RUBY??"ruby",["-rrbconfig","-e","print RbConfig.ruby"],process.cwd(),process.env);
	const consume=async(root,dir,receipt)=>{
		assert.equal(receipt.packages.length,1);
		const [pkg]=receipt.packages;assert.equal(pkg.name,"workshop");
		const gem=join(dir,pkg.artifacts[0].path),work=await mkdtemp(join(root,"ruby-install-")),dest=join(work,"prefix"),app=join(work,"deployed");
		try
		{
			await mkdir(dest);
			const env={...process.env,GEM_HOME: dest,GEM_PATH: dest};
			await run(ruby,["-S","gem","install","--local","--no-document","--ignore-dependencies","--install-dir",dest,gem],work,env);
			await rm(join(dest,"cache",basename(gem)));await rename(dest,app);
			await copyFile("tests/fixtures/ruby-host-workers/effects.rb",join(work,"client.rb"));
			const isolated={PATH: "/no-tools",GEM_HOME: app,GEM_PATH: app,LEAN_NUM_THREADS: "1",LEAN_BRIDGE_EFFECT_BOOT: "from-app"};
			assert.match(await run(ruby,["client.rb"],work,isolated,90000),/early-break close passed/u);
			return 1;
		}
		finally
		{await rm(work,{recursive: true,force: true});}
	};
	await checkHostWorkerEffects(t,{target: "rubygems",profile: "native-ruby-host-v1",prepare: src=>prepareNativeHostFixture(src,"ruby"),consume});
});
