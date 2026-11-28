/** @file Install both Python author routes and exercise per-registration callback admission. */
import assert from "node:assert/strict";
import {copyFile,mkdir,mkdtemp,readFile,rename,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {hashBindingIr} from "../../src/binding-ir/canonical.mjs";
import {buildCanonicalProject} from "../../src/build/canonical-build.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
import {copyPackageSetHandoff} from "./package-set.mjs";

const fixture=resolve("tests/fixtures/javascript-once-callback");
const client=resolve("tests/fixtures/python-retained-tasks/budget.py");
const summary="Each asyncio task owns independent callback registrations.";
test("relocated Python wheels enforce callback budgets before entering the caller",{timeout: 7200000},async t=>{
	const env=process.env,python=env.LEAN_BRIDGE_PYTHON??"python3";
	const work=await mkdtemp(join(tmpdir(),"python-budget-"));t.after(()=>rm(work,{recursive: true,force: true}));
	const tag=await run(python,["-I","-c","import sys; print(sys.implementation.cache_tag)"],work,env);
	const keep=env.LEAN_BRIDGE_PY_BUDGET_KEEP,replay=env.LEAN_BRIDGE_PY_BUDGET_REPLAY;
	assert.ok(!(keep && replay));
	const sets=replay?resolve(replay):await mkdtemp(join(keep??work,"handoffs-"+tag+"-"));t.diagnostic("Handoffs: "+sets);
	const output=resolve(env.LEAN_BRIDGE_PY_BUDGET_OUTPUT??"build/python-budget",tag);await mkdir(output,{recursive: true});
	let ordinary,runtimeDigest,ordinaryComponent;
	for(const route of ["ordinary","reviewed"])
	{
		const set=join(sets,route);
		if(!replay)
		{
			const project=join(work,route+"-author"),release=join(work,route+"-release");await mkdir(project);
			for(const f of ["lakefile.toml","lean-toolchain","Budget.lean"]) await copyFile(join(fixture,f),join(project,f));
			const cfg=JSON.parse(await readFile(join(fixture,"lean-bridge.exports.json")));
			cfg.targets={pypi: {name: "lean-budget",version: "1.0.0"}};
			if(route==="ordinary") cfg.exports=cfg.taskExports;
			else
{const review=structuredClone(ordinary);review.documentation.summary=summary;await writeFile(join(project,"public.binding-ir.json"),canonicalJson(review));}
			await writeFile(join(project,"lean-bridge.exports.json"),canonicalJson(cfg));
			try
{await buildCanonicalProject({projectRoot: project,outputRoot: release,targets: ["pypi"],environment: env});}
			catch(e)
{throw new Error(e.message+" "+JSON.stringify(e.details),{cause: e});}
			await copyPackageSetHandoff(release,set);await rm(project,{recursive: true});await rm(release,{recursive: true});
		}
		const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(set,"package-set-receipt.json")});
		assert.equal(receipt.profiles[0].id,"native-python-task-v1");
		const artifact=role=>receipt.packages.find(p=>p.role===role).artifacts[0];
		const component=artifact("component"),runtime=artifact("runtime");
		const probe=join(work,route+"-client"),staging=join(work,route+"-pip"),install=join(probe,"site");
		await mkdir(probe);await copyFile(client,join(probe,"budget.py"));
		const wheels=[join(set,runtime.path),join(set,component.path)];
		const pip=["-I","-m","pip","--isolated","--disable-pip-version-check"
			, "install","--no-index","--no-cache-dir","--no-deps","--target",staging];
		await run(python,[...pip,...wheels],work,env);
		await rename(staging,install);
		const meta=f=>readFile(join(install,"lean_budget",f+".json"),"utf8").then(JSON.parse);
		const api=await meta("binding-ir"),proof=await meta("elaboration");
		assert.equal(receipt.profiles[0].bindingIrSha256,hashBindingIr(api));
		assert.equal(proof.sourceTreeSha256,receipt.source.treeSha256);
		const policies=JSON.parse(await readFile(join(fixture,"lean-bridge.exports.json"))).taskCallbackPolicies;
		assert.deepEqual(proof.selection.taskCallbackPolicies,policies);
		for(const d of api.declarations) for(const p of d.parameters.slice(1))
		{
			const expected=policies.find(row=>row.declaration===d.source.declaration && row.parameter===p.name)?.invocation??"many";
			const cb=api.types.find(type=>type.id===p.type.id).callable;
			assert.equal(cb.invocation,expected);assert.equal(cb.resultMode,"value");
		}
		if(!ordinary)
		{
			ordinary=api;runtimeDigest=runtime.sha256;ordinaryComponent=component.sha256;
			assert.equal(proof.reviewedSourceSha256,null);
		}
		else
		{
			assert.equal(runtime.sha256,runtimeDigest);assert.notEqual(component.sha256,ordinaryComponent);
			assert.equal(api.documentation.summary,summary);assert.equal(proof.reviewedSourceSha256,sha256(canonicalJson(api)));
		}
		const isolated={PATH: "/unavailable",PYTHONPATH: install
			, PYTHONNOUSERSITE: "1",LEAN_NUM_THREADS: "1",PYTHONFAULTHANDLER: "1"};
		const observation=await run(python,["-S","-B","-W","error","budget.py"],probe,isolated);
		assert.match(observation,/two slots; concurrent tasks; zero leases$/u);
		const {sourceTreeSha256,reviewedSourceSha256}=proof;
		const report={tag,route,receiptSha256: result.receiptSha256,component,runtime
			, sourceTreeSha256,reviewedSourceSha256,bindingIrSha256: hashBindingIr(api)
			, clientSha256: sha256(await readFile(client)),observation};
		await writeFile(join(output,route+".json"),canonicalJson(report));
		await rm(install,{recursive: true});
	}
});
