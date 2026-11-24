/** @file Exercise class-bearing asyncio APIs from original wheel bytes, without a producer. */
import assert from "node:assert/strict";
import {copyFile,mkdir,rename,rm} from "node:fs/promises";
import {join} from "node:path";
import {processBuildRunner} from "../../src/build/process-runner.mjs";

/**
 * Install each primary wheel alongside an independently built peer, then move
 * the installed tree before executing either Python application.
 *
 * @param options - Scratch directory, interpreter, verified wheel paths and diagnostic sink.
 */
export const exercisePythonWorkerWheels=async options=>{
	const {root,python,runtime,wheels,peer,diagnostic}=options;
	const app=join(root,"consumer"),moved=join(root,"relocated");
	const scripts=["consumer.py","peers.py"];
	await mkdir(app);
	for(const script of scripts) await copyFile(new URL("../fixtures/python-host-tasks/"+script,import.meta.url),join(app,script));
	await rename(app,moved);
	for(const [route,report] of wheels)
	{
		const site=join(root,"packages-"+route),relocated=join(moved,route);
		await processBuildRunner.capture({command: python,args: ["-I","-m","pip","--isolated","install","--disable-pip-version-check","--no-cache-dir","--no-index","--no-compile","--target",site,runtime,report.file,peer],cwd: root});
		await rename(site,relocated);
		for(const script of scripts)
		{
			const result=await processBuildRunner.capture({command: python
				, args: ["-I","-c","import sys,runpy;sys.path.insert(0,sys.argv[1]);runpy.run_path(sys.argv[2],run_name='__main__')",relocated,script]
				, cwd: moved,env: {PATH: "/no-producer-tools"},timeoutMs: 45000});
			assert.equal(result.stderr,"");assert.match(result.stdout,/Python worker: .* passed/u);
			diagnostic(route+" "+report.sha256+" "+result.stdout.trim());
		}
		await rm(relocated,{recursive: true});
	}
};
