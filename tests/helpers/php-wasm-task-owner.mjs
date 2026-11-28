/** @file Exercise the PHP-Wasm owner against receipt-verified ordinary and reviewed Lean pthread packages. */
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {processBuildRunner} from "../../src/build/process-runner.mjs";
import {packageSetReceiptName,readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";

test("unthreaded PHP-Wasm can park on an independently installed Lean worker",async t => {
	const {LEAN_BRIDGE_PHP_WASM_HOST: host,LEAN_BRIDGE_JS_TASK_CALLBACK_EVIDENCE: evidence}=process.env;
	assert.ok(host && evidence,"Set LEAN_BRIDGE_PHP_WASM_HOST and LEAN_BRIDGE_JS_TASK_CALLBACK_EVIDENCE");
	const root=await mkdtemp(join(tmpdir(),"php-wasm-task-owner-"));
	t.after(() => rm(root,{recursive: true,force: true}));
	const env={...process.env};delete env.NODE_TEST_CONTEXT;delete env.NODE_PATH;
	const seen=new Set();
	for(const route of ["ordinary","reviewed"])
{
		const dir=resolve(evidence,route,"packages/npm"),cwd=join(root,route);
		const {receipt}=await readVerifiedPackageSetReceipt({receiptPath: join(dir,packageSetReceiptName)});
		const component=receipt.packages.find(p => p.name==="@example/lean-relay" && p.role==="component");
		assert.ok(component);assert.equal(component.profile,"javascript-wasm-threaded-task-v1");
		const digest=component.artifacts[0].sha256;assert.ok(!seen.has(digest));seen.add(digest);
		const archives=receipt.packages.flatMap(p => p.artifacts.map(a => join(dir,a.path)));
		await processBuildRunner.capture({command: "npm",args: ["install","--prefix",cwd,"--cache",join(root,"cache"),"--offline","--ignore-scripts","--no-audit","--no-fund",...archives],cwd: root,env,timeoutMs: 30000});
		const result=await processBuildRunner.capture({command: process.execPath,args: [resolve("tests/fixtures/php-wasm-task-owner/probe.mjs"),cwd,resolve(host)],cwd,env,timeoutMs: 30000});
		assert.equal(result.stderr,"");
		assert.match(result.stdout,/caught cancellation, and ran another task; zero live owners/u);
		t.diagnostic(route+" "+digest+" "+result.stdout.trim());
}
});
