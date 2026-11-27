/** @file Prepare the same two Lean author contracts for the native downstream clients. */
import assert from "node:assert/strict";
import {cp, readFile} from "node:fs/promises";
import {join} from "node:path";
import {canonicalizeJsonValue} from "../../src/binding-ir/canonical.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {leasedClosureFieldReviewedIr} from "./owned-aggregate-fixture.mjs";

/**
 * Verify the registration, borrow and independent result lease in the compiled signature.
 *
 * @param ir - Complete binding contract, either independently reviewed or emitted by Lean.
 */
export const checkApplicationFunctionPositions=ir=>{
	const find=n=>ir.declarations.find(d=>d.source.declaration==="Owned."+n);
	const pass=find("passApplicationQuote"),visit=find("visitApplicationQuote");
	assert.equal(pass.parameters.length,1);assert.equal(visit.parameters.length,3);
	const id=pass.parameters[0].type.id;
	assert.equal(pass.parameters[0].ownership,"borrow");assert.equal(pass.parameters[0].lifetime.scope,"call");
	assert.equal(pass.result.type.id,id);assert.equal(visit.parameters[0].type.id,id);
	const visitor=ir.types.find(t=>t.id===visit.parameters[1].type.id).callable;
	assert.equal(visitor.parameters[0].type.id,id);assert.equal(visitor.parameters[0].ownership,"borrow");
	assert.equal(visitor.parameters[0].lifetime.scope,"call");
	const choose=ir.types.find(t=>t.id===find("stagedQuote").parameters[0].type.id).callable;
	assert.equal(choose.result.type.id,id);assert.equal(choose.result.ownership,"lease");
	assert.equal(pass.result.ownership,"lease");
};

/**
 * Give the ordinary project explicit exports and give the reviewed project
 * only its module name and independent Binding IR.
 *
 * @param project - Destination for an isolated author project.
 * @param route - Ordinary or reviewed source.
 * @param target - Downstream ecosystem or distinct ecosystems sharing this Lean compilation.
 * @param options - Optional mixed-record contract.
 * @param options.mixed - Include the PriceCard workload on both routes.
 * @param options.incoming - Include a callback borrowing a Lean closure directly.
 * @param options.hostFunctions - Include exports that forward an application-provided callable.
 */
export const prepareStagedQuoteProject = async (project, route, target, {mixed = false, incoming = false, hostFunctions = false} = {}) => {
	const targets=Array.isArray(target)?target:[target], supported=["c","cpp","cargo","nuget","npm","maven","pypi","rubygems","php-native","cpan","wit-wasi","php-wasm"];
	if(!["ordinary","reviewed"].includes(route) || !targets.length || new Set(targets).size!==targets.length || !targets.every(t=>supported.includes(t))) throw new Error("Unexpected staged quote configuration");
	await cp(new URL("../fixtures/onboarding/leased-closure-fields/", import.meta.url), project, {recursive: true});
	const cfg = join(project, "lean-bridge.exports.json");
	const config = route === "ordinary" ? JSON.parse(await readFile(cfg)) : {schemaVersion: 1, modules: ["Owned"]};
	config.targets={};
	for(const t of targets)
	{
		const name = {npm: "@example/tariff-quotes", maven: "org.leanbridge:tariff-quotes", "php-native": "example/tariff-quotes"}[t] ?? "tariff-quotes";
		config.targets[t]=t==="cpan"?{module: "LeanBridge::TariffQuotes",version: "0.001"}:{name,version: "1.0.0"};
		if(t==="php-wasm") config.targets[t]={
			npm: {name: "@example/tariff-quotes", version: "1.0.0"}
			, composer: {name: "example/tariff-quotes", version: "1.0.0"}
		};
	}
	if(route === "ordinary")
	{
		config.exports.push("Owned.flatQuote", "Owned.stagedQuote");
		if(incoming) config.exports.push("Owned.visitQuote");
		if(hostFunctions)
		{
			config.exports.push("Owned.passApplicationQuote","Owned.visitApplicationQuote");
			config.arities["Owned.passApplicationQuote"]=1;
		}
		const contract = new URL("../fixtures/structured-types/tariff-staged-contract.json", import.meta.url);
		config.contracts = {"Owned.stagedQuote": JSON.parse(await readFile(contract))};
		if(mixed)
		{
			config.exports.push("Owned.compareCards");
			config.ownedAggregates.closureFields.push("Owned.PriceCard.quote","Owned.PriceCard.rebate");
		}
	}
	else await saveLakeFile(project, "api.binding-ir.json", canonicalJson(leasedClosureFieldReviewedIr({staged: true,mixed,incoming,hostFunctions})));
	if(mixed)
	{
		const suffix=await readFile(new URL("../fixtures/structured-types/price-card.lean",import.meta.url),"utf8");
		await saveLakeFile(project,"Owned.lean",await readFile(join(project,"Owned.lean"),"utf8")+"\n"+suffix);
	}
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(incoming)
	{
		const suffix=await readFile(new URL("../fixtures/structured-types/visit-quote.lean",import.meta.url),"utf8");
		await saveLakeFile(project,"Owned.lean",await readFile(join(project,"Owned.lean"),"utf8")+"\n"+suffix);
	}
	if(hostFunctions)
	{
		const suffix=await readFile(new URL("../fixtures/structured-types/pass-application-quote.lean",import.meta.url),"utf8");
		await saveLakeFile(project,"Owned.lean",await readFile(join(project,"Owned.lean"),"utf8")+"\n"+suffix);
	}
};

/**
 * Match installed compiler output to the package and independent author input.
 *
 * @param model - Compiled model from the installed archive.
 * @param ir - Binding IR shipped in that archive.
 * @param profile - Verified package-set profile.
 * @param route - Ordinary or reviewed authoring route.
 * @param options - Selected fixture variants.
 * @param options.mixed - Expect the independent PriceCard contract as well.
 * @param options.incoming - Expect the direct incoming closure contract as well.
 * @param options.hostFunctions - Check the caller-provided function contract.
 */
export const checkStagedQuoteIdentities = (model, ir, profile, route, {mixed = false, incoming = false, hostFunctions = false} = {}) => {
	assert.ok(["ordinary","reviewed"].includes(route));
	assert.equal(ir.schemaVersion,4);
	const bindingIrSha256 = sha256(canonicalizeJsonValue(ir));
	assert.deepEqual(model.bindingIr, ir);
	assert.equal(model.bindingIrSha256, bindingIrSha256);
	assert.equal(profile.bindingIrSha256, bindingIrSha256);
	const reviewed = model.sourceIdentity.reviewedBindingIr;
	assert.equal(Boolean(reviewed), route === "reviewed");
	if(reviewed)
	{
		const original = leasedClosureFieldReviewedIr({staged: true,mixed,incoming,hostFunctions});
		assert.equal(reviewed.path, "api.binding-ir.json");
		assert.equal(reviewed.source, canonicalJson(original));
		assert.equal(reviewed.sourceSha256, sha256(canonicalJson(original)));
		assert.equal(reviewed.semanticSha256, sha256(canonicalizeJsonValue(original)));
	}
	return {bindingIrSha256, reviewedSourceSha256: reviewed?.sourceSha256 ?? null};
};
