/** @file Prepare the same two Lean author contracts for the native downstream clients. */
import assert from "node:assert/strict";
import {cp, readFile} from "node:fs/promises";
import {join} from "node:path";
import {canonicalizeJsonValue} from "../../src/binding-ir/canonical.mjs";
import {canonicalJson,sha256} from "../../src/capsule/node.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {leasedClosureFieldReviewedIr} from "./owned-aggregate-fixture.mjs";

/**
 * Give the ordinary project explicit exports and give the reviewed project
 * only its module name and independent Binding IR.
 *
 * @param project - Destination for an isolated author project.
 * @param route - Ordinary or reviewed source.
 * @param target - Downstream package ecosystem.
 */
export const prepareStagedQuoteProject = async (project, route, target) => {
	if(!["ordinary", "reviewed"].includes(route) || !["cpp", "cargo", "nuget", "npm", "maven", "rubygems", "php-native", "cpan", "wit-wasi", "php-wasm"].includes(target)) throw new Error("Unexpected staged quote configuration");
	await cp(new URL("../fixtures/onboarding/leased-closure-fields/", import.meta.url), project, {recursive: true});
	const cfg = join(project, "lean-bridge.exports.json");
	const config = route === "ordinary" ? JSON.parse(await readFile(cfg)) : {schemaVersion: 1, modules: ["Owned"]};
	const name = {npm: "@example/tariff-quotes", maven: "org.leanbridge:tariff-quotes", "php-native": "example/tariff-quotes"}[target] ?? "tariff-quotes";
	config.targets = {[target]: target === "cpan" ? {module: "LeanBridge::TariffQuotes", version: "0.001"} : {name, version: "1.0.0"}};
	if(target === "php-wasm") config.targets[target] = {
		npm: {name: "@example/tariff-quotes", version: "1.0.0"}, composer: {name: "example/tariff-quotes", version: "1.0.0"}
	};
	if(route === "ordinary")
	{
		config.exports.push("Owned.flatQuote", "Owned.stagedQuote");
		const contract = new URL("../fixtures/structured-types/tariff-staged-contract.json", import.meta.url);
		config.contracts = {"Owned.stagedQuote": JSON.parse(await readFile(contract))};
	}
	else await saveLakeFile(project, "api.binding-ir.json", canonicalJson(leasedClosureFieldReviewedIr({staged: true})));
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
};

/** Match the installed v4 compiler output and (on the reviewed route) the independent author input. */
export const checkStagedQuoteIdentities = (model, ir, profile, route) => {
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
		const original = leasedClosureFieldReviewedIr({staged: true});
		assert.equal(reviewed.path, "api.binding-ir.json");
		assert.deepEqual(JSON.parse(reviewed.source), original);
		assert.equal(reviewed.sourceSha256, sha256(canonicalJson(original)));
		assert.equal(reviewed.semanticSha256, sha256(canonicalizeJsonValue(original)));
	}
	return {bindingIrSha256, reviewedSourceSha256: reviewed?.sourceSha256 ?? null};
};
