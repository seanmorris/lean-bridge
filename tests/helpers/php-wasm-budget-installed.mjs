/** @file Run per-registration callback budgets in installed PHP guests on both source routes. */
import assert from "node:assert/strict";
import {mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {buildBudgetSet,inspectBudgetSet} from "./php-wasm-budget-handoff.mjs";
import {exercisePhpTaskRelease} from "./php-wasm-task-installed.mjs";

test("PHP-Wasm task callback budgets are per registration in installed Node and Chromium guests",{timeout: 7200000},async t=>{
	const work=await mkdtemp(join(tmpdir(),"php-budget-"));t.after(()=>rm(work,{recursive: true,force: true}));
	const env=process.env,keep=env.LEAN_BRIDGE_PHP_BUDGET_KEEP,replay=env.LEAN_BRIDGE_PHP_BUDGET_REPLAY;
	assert.ok(!(keep && replay));
	const sets=replay?resolve(replay):await mkdtemp(join(keep??work,"handoffs-"));
	const output=resolve(env.LEAN_BRIDGE_PHP_BUDGET_OUTPUT??"build/php-wasm-budget");
	await mkdir(output,{recursive: true});t.diagnostic("Handoffs: "+sets);
	const digests=new Set();let ordinary,runtimeSha256;
	for(const route of ["ordinary","reviewed"])
	{
		if(!replay) await buildBudgetSet(work,sets,route,ordinary);
		const handoff=join(sets,route),{api,receipt,result,compiler}=await inspectBudgetSet(handoff,route);
		const runtime=receipt.packages.find(p=>p.role==="runtime").artifacts[0].sha256;
		if(route==="ordinary")
		{
			ordinary=api;runtimeSha256=runtime;
		}
		else assert.equal(runtime,runtimeSha256,"The review must not change the installed PHP worker runtime");
		assert.ok(!digests.has(result.receiptSha256));digests.add(result.receiptSha256);
		const executions=await exercisePhpTaskRelease(handoff,t,undefined,false,false,false,false,false,{budget: true});
		assert.deepEqual(Object.keys(executions).sort(),["chromium","composer","embedded"]);
		for(const line of Object.values(executions)) assert.match(line,/distinct slots 2, fresh task 42; zero live owners$/u);
		const {sourceTreeSha256,reviewedSourceSha256}=compiler;
		const {bindingIrSha256}=receipt.profiles[0],{receiptSha256}=result;
		const archives=receipt.packages.map(p=>({name: p.name,...p.artifacts[0]}));
		const clientSha256=sha256(await readFile("tests/fixtures/php-wasm-task-owner/budget.php"));
		const report={route,receiptSha256,sourceTreeSha256,reviewedSourceSha256
			, bindingIrSha256,archives,clientSha256,executions};
		await writeFile(join(output,route+".json"),canonicalJson(report));
	}
});
