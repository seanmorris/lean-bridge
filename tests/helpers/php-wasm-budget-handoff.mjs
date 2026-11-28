/** @file Build and authenticate one PHP-Wasm Budget release from a Lean project or a reviewed interface. */
import assert from "node:assert/strict";
import {copyFile,mkdir,readFile,rm,writeFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import {buildCanonicalProject} from "../../src/build/canonical-build.mjs";
import {hashBindingIr} from "../../src/binding-ir/canonical.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {readVerifiedPackageSetReceipt} from "../../src/release/package-set-receipt.mjs";
import {copyPackageSetHandoff} from "./package-set.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";

const fixture=resolve("tests/fixtures/javascript-once-callback");
const summary="Each PHP callback budget belongs to this task registration, independently of the callable object.";
const cfg=JSON.parse(await readFile(join(fixture,"lean-bridge.exports.json")));
/**
 * Verify the installed archive's two public callback policies against the Lean binders.
 *
 * @param dir - Retained package-set handoff.
 * @param route - Ordinary or reviewed author source.
 */
export const inspectBudgetSet=async (dir,route)=>{
	const {receipt,result}=await readVerifiedPackageSetReceipt({receiptPath: join(dir,"package-set-receipt.json")});
	const component=receipt.packages.find(p=>p.role==="component" && p.ecosystem==="npm");
	assert.equal(component.name,"@example/budget-php");
	assert.equal(receipt.packages.find(p=>p.ecosystem==="composer").name,"example/lean-budget");
	const archive=join(dir,component.artifacts[0].path);
	const meta=async file=>JSON.parse(await run("tar",["-xOzf",archive,"package/metadata/"+file],dir,process.env));
	const api=await meta("binding-ir.json"),compiler=await meta("compiler.json");
	assert.equal(receipt.profiles[0].bindingIrSha256,hashBindingIr(api));
	assert.equal(compiler.sourceTreeSha256,receipt.source.treeSha256);
	assert.equal(compiler.selection.phpWasmCallbackBudgets,true);
	assert.deepEqual(compiler.selection.taskCallbackPolicies,cfg.taskCallbackPolicies);
	for(const [name,expected] of [["single",["once"]],["pair",["once","once"]],["retry",["once"]],["probe",["once","many"]]])
	{
		const d=api.declarations.find(f=>f.source.declaration==="Budget."+name);
		const callbacks=d.parameters.slice(1).map(p=>api.types.find(t=>t.id===p.type.id).callable);
		assert.deepEqual(callbacks.map(c=>c.invocation),expected);
		for(const c of callbacks)
		{assert.equal(c.resultMode,"value");assert.deepEqual(c.failure.errors,["error:PhpCallbackException"]);}
	}
	if(route==="reviewed")
	{
		assert.deepEqual(await meta("review.binding-ir.json"),api);
		assert.equal(api.documentation.summary,summary);
		assert.equal(compiler.reviewedSourceSha256,sha256(canonicalJson(api)));
	} else assert.equal(compiler.reviewedSourceSha256,null);
	return {api,receipt,result,compiler};
};

/**
 * Publish a fresh local handoff, removing the author project before installation.
 *
 * @param work - Test-owned directory for compilation.
 * @param sets - Destination for original package archives.
 * @param route - Ordinary or reviewed source.
 * @param ordinary - Inspected ordinary interface used as the review's starting point.
 */
export const buildBudgetSet=async(work,sets,route,ordinary)=>{
	const project=join(work,route+"-project"),output=join(work,route+"-release");
	await mkdir(project);
	for(const f of ["lakefile.toml","lean-toolchain","Budget.lean"]) await copyFile(join(fixture,f),join(project,f));
	const config={...cfg,targets: {"php-wasm": {npm: {name: "@example/budget-php",version: "1.0.0"},composer: {name: "example/lean-budget",version: "1.0.0"}}}};
	if(route==="reviewed")
	{
		const api=structuredClone(ordinary);api.documentation.summary=summary;
		await writeFile(join(project,"public.binding-ir.json"),canonicalJson(api));
	} else config.exports=[...cfg.taskExports];
	await writeFile(join(project,"lean-bridge.exports.json"),canonicalJson(config));
	try
	{await buildCanonicalProject({projectRoot: project,outputRoot: output,targets: ["php-wasm"]});}
	catch(e)
	{throw new Error(route+" PHP budget: "+e.message+" "+JSON.stringify(e.details),{cause: e});}
	await copyPackageSetHandoff(output,join(sets,route));
	await rm(project,{recursive: true});await rm(output,{recursive: true});
};
