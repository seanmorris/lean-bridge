/** @file Prepare the same two Lean author contracts for the native downstream clients. */
import {cp, readFile} from "node:fs/promises";
import {join} from "node:path";
import {canonicalJson} from "../../src/capsule/node.mjs";
import {saveLakeFile} from "./lake-workspace.mjs";
import {leasedClosureFieldReviewedIr} from "./owned-aggregate-fixture.mjs";

/**
 * Give the ordinary project explicit exports and give the reviewed project
 * only its module name and independent Binding IR.
 *
 * @param project - Destination for an isolated author project.
 * @param route - Ordinary or reviewed source.
 * @param target - Native package ecosystem.
 */
export const prepareStagedQuoteProject = async (project, route, target) => {
	if(!["ordinary", "reviewed"].includes(route) || !["cpp", "cargo"].includes(target)) throw new Error("Unexpected staged quote configuration");
	await cp(new URL("../fixtures/onboarding/leased-closure-fields/", import.meta.url), project, {recursive: true});
	const cfg = join(project, "lean-bridge.exports.json");
	const config = route === "ordinary" ? JSON.parse(await readFile(cfg)) : {schemaVersion: 1, modules: ["Owned"]};
	config.targets = {[target]: {name: "tariff-quotes", version: "1.0.0"}};
	if(route === "ordinary")
	{
		config.exports.push("Owned.flatQuote", "Owned.stagedQuote");
		const contract = new URL("../fixtures/structured-types/tariff-staged-contract.json", import.meta.url);
		config.contracts = {"Owned.stagedQuote": JSON.parse(await readFile(contract))};
	}
	else await saveLakeFile(project, "api.binding-ir.json", canonicalJson(leasedClosureFieldReviewedIr({staged: true})));
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
};
