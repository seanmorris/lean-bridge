/** @file Check Zend-owned object delivery against both compiled Lean author routes. */
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {processBuildRunner} from "../../src/build/process-runner.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";

test("PHP-Wasm retains Zend objects while compiled Lean workers call back",async t=>{
	const {LEAN_BRIDGE_PHP_WASM_HOST: host,LEAN_BRIDGE_JS_THREADED_HOST_EVIDENCE: matrix}=process.env;
	assert.ok(host && matrix,"Set the PHP-Wasm host and the retained JavaScript threaded-host callback matrix");
	const root=await mkdtemp(join(tmpdir(),"zend-worker-")),env={...process.env};
	t.after(()=>rm(root,{recursive: true,force: true}));delete env.NODE_PATH;delete env.NODE_TEST_CONTEXT;
	const archives=new Set();
	const peer=resolve(matrix,"peer-release"),peerDir=join(peer,"packages/npm");
	const {receipt: peerReceipt}=await readVerifiedPackageSetReceipt({receiptPath: join(peerDir,"package-set-receipt.json")});
	const peerPkg=peerReceipt.packages.find(p=>p.role==="component"),rt=ps=>ps.find(p=>p.role==="runtime").artifacts[0].sha256;
	assert.equal(peerPkg.name,"@example/threaded-host-peer");assert.equal(peerPkg.profile,"javascript-wasm-threaded-task-v1");
	for(const route of ["ordinary","reviewed"])
	{
		const release=resolve(matrix,route),prefix=join(release,"packages/npm"),cwd=join(root,route);
		const {receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(prefix,"package-set-receipt.json")});
		const pkg=receipt.packages.find(p=>p.role==="component");
		assert.equal(pkg.name,"@lean-bridge/workshop-host-example");assert.equal(pkg.profile,"javascript-wasm-threaded-task-v1");
		assert.ok(!archives.has(pkg.artifacts[0].sha256));archives.add(pkg.artifacts[0].sha256);
		const files=receipt.packages.flatMap(p=>p.artifacts.map(a=>join(prefix,a.path)));
		assert.equal(rt(receipt.packages),rt(peerReceipt.packages));files.push(join(peerDir,peerPkg.artifacts[0].path));
		await processBuildRunner.capture({command: "npm",args: ["install","--prefix",cwd,"--cache",join(root,"cache"),"--offline","--ignore-scripts","--no-fund","--no-audit",...files],cwd: root,env,timeoutMs: 90000});
		try
		{
			const {stdout,stderr}=await processBuildRunner.capture({command: process.execPath,args: [resolve("tests/fixtures/php-wasm-task-owner/zend-objects.mjs"),cwd,resolve(host),release,peer],cwd,env,timeoutMs: 180000});
			assert.equal(stderr,"");
			for(const line of stdout.trim().split("\n")) t.diagnostic(JSON.stringify({route,archive: pkg.artifacts[0].sha256,peerArchive: peerPkg.artifacts[0].sha256,...JSON.parse(line)}));
		} catch(e)
{t.diagnostic([e.message,e.details?.stderr,e.details?.stdout].join("\n").slice(-4500));throw e;}
	}
});
