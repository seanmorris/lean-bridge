/** @file Rebuild a WIT IO archive using a fresh offline installation of the release CLI. */
import assert from "node:assert/strict";
import test from "node:test";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { buildCliNpmPackage } from "../../src/release/cli-npm-package.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";

const original = process.env.LEAN_BRIDGE_WIT_IO_ORDINARY;
test("offline-installed release CLI reproduces the WIT IO component archive and receipt", {skip: !original}, async t=>{
	const root = await mkdtemp(join(tmpdir(),"wit-cli-reproduction-")); t.after(()=>rm(root,{recursive: true,force: true}));
	const packed = await buildCliNpmPackage({outputRoot: join(root,"cli-feed")});
	const src = join(root,"project"), output = join(root,"rebuilt"), installed = join(root,"installed");
	const run = async (command,args)=>{
		const env = {...process.env}; delete env.NODE_TEST_CONTEXT;
		try
		{ return await processBuildRunner.capture({command,args,cwd: root,env}); }
		catch(error)
		{ t.diagnostic(error.details?.stderr ?? error.message); throw error; }
	};
	await run("npm",["install","--prefix",installed,"--offline","--ignore-scripts","--no-audit","--no-fund","--cache",join(root,"cache"),packed.archive]);
	const cli = join(installed,"node_modules/.bin/lean-bridge"), file = "package-set-receipt.json";
	await cp(resolve("tests/fixtures/native-sync-io"),src,{recursive: true});
	await run(process.execPath,[cli,"build","--project",src,"--target","wit-wasi","--output",output]);
	await run(process.execPath,[cli,"verify","--receipt",join(output,file)]);
	const a = await readVerifiedPackageSetReceipt({receiptPath: join(original,file)});
	const b = await readVerifiedPackageSetReceipt({receiptPath: join(output,file)});
	assert.equal(b.result.receiptSha256,a.result.receiptSha256); assert.deepEqual(b.receipt,a.receipt);
	t.diagnostic("Identical receipt "+b.result.receiptSha256+"; archive "+b.receipt.packages[0].artifacts[0].sha256);
});
