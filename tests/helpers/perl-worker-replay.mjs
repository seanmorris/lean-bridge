/** @file Recheck the original worker handoffs without rebuilding or installing the publishing CLI. */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { qualifyInstalledPerlWorkers } from "./perl-worker-release.mjs";
import { canonicalJson } from "../../src/capsule/node.mjs";

test("retained CPAN worker archives pass relocated consumers without republishing",{timeout: 7_200_000},async t=>{
	const releases=process.env.LEAN_BRIDGE_PERL_WORKER_REPLAY, workerDeps=process.env.LEAN_BRIDGE_PERL_TASK_DEPS;
	assert.ok(releases && workerDeps,"Set LEAN_BRIDGE_PERL_WORKER_REPLAY and LEAN_BRIDGE_PERL_TASK_DEPS");
	const perls=JSON.parse(process.env.LEAN_BRIDGE_PERLS??'["perl"]');
	assert.ok(Array.isArray(perls) && perls.length,"Select at least one Perl interpreter");
	const scratch=await mkdtemp(join(tmpdir(),"perl-worker-consumers-"));
	t.after(()=>rm(scratch,{recursive: true,force: true}));
	const output=process.env.LEAN_BRIDGE_PERL_WORKER_POLICY_OUTPUT;
	const record=async (route,result)=>{
		if(!output) return;
		await mkdir(output,{recursive: true});
		await writeFile(join(output,route+".json"),canonicalJson(result));
	};
	await qualifyInstalledPerlWorkers({releases,scratch,perls,workerDeps,record,report: msg=>t.diagnostic(msg)});
});
