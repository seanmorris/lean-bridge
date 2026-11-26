/** @file Build a real Lean package with a closure passed directly into a host callback. */
import assert from "node:assert/strict";
import {cp,readFile,rm} from "node:fs/promises";
import {join,resolve} from "node:path";
import {buildOwnedJavaScriptWasmComponent} from "../../src/build/javascript-wasm-owned-component.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {canonicalizeJsonValue} from "../../src/binding-ir/canonical.mjs";
import {buildOwnedJavaScriptNpmPackages} from "../../src/release/owned-javascript-npm-package.mjs";
import {copyPackageSetHandoff} from "./package-set.mjs";
import {ownedDotnetCallbacksReviewedIr} from "./owned-dotnet-callback-fixture.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {pinnedCompiledLean} from "../../src/build/elaborated-component.mjs";

const leanSource=await readFile(new URL("../fixtures/onboarding/owned-dotnet-callables/Owned.lean",import.meta.url));

/**
 * Seal the ordinary source or the independently selected reviewed IR, then remove the build inputs.
 *
 * @param o - Private work directory, destination and author route.
 */
export const buildIncomingFunctionPackage=async o=>{
	const {work,set,route}=o,env=process.env;assert.ok(["ordinary","reviewed"].includes(route));
	const project=join(work,route+"-project"),compiled=join(work,route+"-compiled"),out=join(work,route+"-release");
	await cp(resolve("tests/fixtures/onboarding/owned-dotnet-callables"),project,{recursive: true});
	if(route==="reviewed")
	{
		await saveLakeFile(project,"lean-bridge.exports.json",canonicalJson({schemaVersion: 1,modules: ["Owned"]}));
		await saveLakeFile(project,"api.binding-ir.json",canonicalJson(ownedDotnetCallbacksReviewedIr()));
	}
	await buildOwnedJavaScriptWasmComponent({
		projectRoot: project
		, outputRoot: compiled
		, leanPrefix: env.LEAN_BRIDGE_LEAN_PREFIX
		, leanRuntimeRoot: env.LEAN_BRIDGE_JS_TARGET_RUNTIME
		, emsdkRoot: env.LEAN_BRIDGE_JS_EMSDK});
	await buildOwnedJavaScriptNpmPackages({componentRoot: compiled,runtimeRoot: env.LEAN_BRIDGE_RUNTIME_ROOT,outputRoot: out});
	await copyPackageSetHandoff(out,set);
	for(const path of [project,compiled,out]) await rm(path,{recursive: true});
};

/**
 * Check the actual nested callable signature and independently retained reviewed input.
 *
 * @param model - Installed component compiler model.
 * @param ir - Installed exported API.
 * @param profile - Verified profile from the external receipt.
 * @param route - Expected author route.
 */
export const verifyIncomingFunction=(model,ir,profile,route)=>{
	assert.ok(["ordinary","reviewed"].includes(route));
	assert.equal(model.sourceIdentity.leanCommit,pinnedCompiledLean);
	const mods=model.sourceIdentity.modules;
	assert.equal(mods.length,1);assert.equal(mods[0].module,"Owned");
	assert.deepEqual(mods[0].source,{path: "Owned.lean",bytes: leanSource.length,sha256: sha256(leanSource)});
	assert.equal(ir.schemaVersion,4);assert.deepEqual(model.bindingIr,ir);const bindingIrSha256=sha256(canonicalizeJsonValue(ir));
	assert.equal(bindingIrSha256,model.bindingIrSha256);assert.equal(bindingIrSha256,profile.bindingIrSha256);
	const d=ir.declarations.find(d=>d.source.declaration==="Owned.withFunction");
	const resolve=t=>{assert.equal(t.kind,"named");return ir.types.find(v=>v.id===t.id);};
	const outer=resolve(d.parameters[1].type),input=outer.callable.parameters[0],inner=resolve(input.type);
	assert.equal(outer.kind,"callback");assert.equal(inner.kind,"callback");
	assert.equal(input.ownership,"borrow");assert.equal(input.lifetime.scope,"call");
	assert.equal(inner.callable.parameters[0].type.id,"lean:Owned.Bundle");assert.equal(inner.callable.result.type.id,"lean:Owned.Bundle");
	const reviewed=model.sourceIdentity.reviewedBindingIr;assert.equal(Boolean(reviewed),route==="reviewed");
	if(reviewed)
	{
		const expected=ownedDotnetCallbacksReviewedIr();assert.deepEqual(JSON.parse(reviewed.source),expected);
		assert.equal(reviewed.path,"api.binding-ir.json");assert.equal(reviewed.sourceSha256,sha256(canonicalJson(expected)));
	}
	return {bindingIrSha256,reviewedSourceSha256: reviewed?.sourceSha256??null};
};

/**
 * Compare two installed routes without attributing differences in runtime or
 * downstream client code to the reviewed author contract.
 *
 * @param ordinary - Ordinary five-consumer installation report.
 * @param reviewed - Reviewed five-consumer installation report.
 */
export const compareIncomingPackages=(ordinary,reviewed)=>{
	assert.equal(ordinary.route,"ordinary");assert.equal(ordinary.reviewedSourceSha256,null);
	assert.equal(reviewed.route,"reviewed");assert.match(reviewed.reviewedSourceSha256,/^[a-f0-9]{64}$/u);
	const runtime=row=>{
		const match=row.archives.filter(a=>a.path.startsWith("lean-bridge-runtime-"));
		assert.equal(row.archives.length,2);assert.equal(match.length,1);return match[0];
	};
	const shared=runtime(ordinary);
	assert.deepEqual(runtime(reviewed),shared,"authoring routes must install the same runtime archive");
	assert.notEqual(ordinary.receiptSha256,reviewed.receiptSha256);
	const component=row=>row.archives.find(a=>a.path==="owned-aggregates-1.0.0.tgz").sha256;
	assert.notEqual(component(ordinary),component(reviewed));
	assert.deepEqual(ordinary.sourceHashes,reviewed.sourceHashes);
	for(const host of ["node","typescript","browser"]) assert.deepEqual(ordinary[host],reviewed[host]);
	return {runtimeArchive: shared,leanSourceSha256: sha256(leanSource)
		, ordinaryReceiptSha256: ordinary.receiptSha256
		, reviewedReceiptSha256: reviewed.receiptSha256};
};
