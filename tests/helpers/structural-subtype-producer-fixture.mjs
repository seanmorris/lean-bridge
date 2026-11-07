/**
 * Load structural Subtype expectations from the revision that produced an archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { moduleAtProducerWithSourceReads } from "./producer-module.mjs";

const profiles = Object.freeze([
	"common", "python", "rust", "ruby", "dotnet", "jvm", "php", "wit", "perl"
	, "php-wasm"
]);
const cache = new Map();

/**
 * Keep immutable archive readers on their producer's fixture contract.
 *
 * @param {string} producerCommit - Exact archive producer revision.
 * @param {string} profile - Host-specific structural fixture name.
 */
export const structuralSubtypeFixtureAtProducer = (producerCommit, profile) => {
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	assert.ok(profiles.includes(profile));
	const key = `${producerCommit}:${profile}`;
	if(!cache.has(key)) cache.set(key, Promise.all([
		"tests/helpers/structural-subtype-installed-fixture.mjs"
		, ...(profile === "common" ? []
			: [`tests/helpers/structural-subtype-${profile}-fixture.mjs`])
		, "src/binding-ir/canonical.mjs"
		, "src/analyze/reviewed-source.mjs"
		, "src/analyze/export-configuration.mjs"
	].map(path => moduleAtProducerWithSourceReads(producerCommit, path))).then(modules => {
		const exportConfiguration = modules.pop();
		const reviewedSource = modules.pop();
		const bindingIr = modules.pop();
		return Object.assign({}, ...modules, {
			producerContracts: {
				hashBindingIr: bindingIr.hashBindingIr
				, reviewedContractDifference: reviewedSource.reviewedContractDifference
				, reviewedSourceSelection: reviewedSource.reviewedSourceSelection
				, compilerExportSelection: exportConfiguration.compilerExportSelection
			}
		});
	}));
	return cache.get(key);
};
