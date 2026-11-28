/** @file Exercise original, receipt-verified Ruby gems without rebuilding them. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {copyFile,mkdir,mkdtemp,rename,rm} from "node:fs/promises";
import {basename,join} from "node:path";
import {promisify} from "node:util";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
const run=promisify(execFile);
const archive=async (dir,name)=>{
	const {receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(dir,"package-set-receipt.json")});
	assert.equal(receipt.packages.length,1);
	const [pkg]=receipt.packages;
	assert.equal(pkg.name,name); assert.equal(pkg.target,"rubygems"); assert.equal(pkg.profile,"native-ruby-host-v1");
	assert.equal(pkg.artifacts.length,1); return join(dir,pkg.artifacts[0].path);
};

/**
 * Install and move a primary/peer pair, then run only the supplied applications.
 *
 * @param options - Verified handoffs, scratch parent, interpreter and test fixture basenames.
 */
export const exerciseRubyWorkerGems=async options=>{
	const {root,primary,peer,ruby,inspectInstalled,scripts=["consumer.rb","private-tokens.rb"]}=options;
	const gems=[await archive(primary,"workshop"),await archive(peer,"workshop-peer")];
	const scratch=await mkdtemp(join(root,"consumer-")),install=join(scratch,"install"),moved=join(scratch,"relocated");
	try
	{
		await mkdir(install);
		for(const gem of gems)
		{
			await run(ruby,["-S","gem","install","--local","--no-document","--ignore-dependencies","--install-dir",install,gem],{env: {...process.env,GEM_HOME: install,GEM_PATH: install}});
			await rm(join(install,"cache",basename(gem)),{force: true});
		}
		await rename(install,moved);
		if(inspectInstalled) await inspectInstalled(moved);
		const observations=[];
		for(const script of scripts)
		{
			assert.ok(["consumer.rb","private-tokens.rb","error-policy.rb","identity-positions.rb"].includes(script));
			await copyFile(new URL("../fixtures/ruby-host-workers/"+script,import.meta.url),join(scratch,script));
			const modes=["forward","reverse"].flatMap(order=>["catch","propagate"].map(mode=>[order,mode]));
			for(const args of script==="error-policy.rb"?modes:[[]])
			{
				const env={PATH: "/no-producer-tools",GEM_HOME: moved,GEM_PATH: moved,LEAN_NUM_THREADS: "1"};
				const {stdout,stderr}=await run(ruby,[script,...args],{cwd: scratch,env,timeout: 60000});
				assert.equal(stderr,"");
				if(script==="error-policy.rb") assert.equal(stdout.trim(),"Ruby worker: "+args.join(" ") + ", sole owner 23->42 then collected, nested fatal, dispatch 1/1, live=0");
				else if(script==="identity-positions.rb") assert.equal(stdout.trim(),"Ruby worker: export argument/result, callback argument/distinct result, peer mutation, invalid reply, zero host roots");
				else assert.match(stdout,/Ruby worker:/u);
				observations.push(stdout.trim());
			}
		}
		return observations;
	} finally
	{ await rm(scratch,{recursive: true,force: true}); }
};
