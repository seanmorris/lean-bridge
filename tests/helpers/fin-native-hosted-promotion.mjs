/**
 * Supplement structural Fin evidence and add only the eight missing nominal-field cells.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";

export const finHostedMissingFieldProfiles = ["java", "kotlin", "php-native", "perl"];
const hosts = ["c", "cpp", "python", "rust", "ruby", "dotnet", "java", "kotlin", "php-native", "wit-wasi", "perl"];
const structuralUpdates = [
	"native-fin-jvm-ordinary-source", "native-fin-php-ordinary-source"
	, "native-fin-wit-ordinary-source"
	, "perl-fin-containers-ordinary-source", "reviewed-fin-java-scalar-containers"
	, "reviewed-fin-kotlin-scalar-containers"
	, "reviewed-fin-php-native-scalar-containers"
	, "reviewed-fin-wit-wasi-scalar-containers"
	, "reviewed-fin-perl-scalar-containers"
];
const newFieldTypes = {
	java: "java.math.BigInteger checked against the field's closed bound"
	, kotlin: "java.math.BigInteger checked against the field's closed bound"
	, "php-native": "Brick\\Math\\BigInteger checked against the field's closed bound"
	, perl: "Math::BigInt checked against the field's closed bound"
};
const conversion = profile => {
	const host = { java: "BigInteger", kotlin: "BigInteger", "php-native": "Brick\\Math\\BigInteger", perl: "Math::BigInt", "wit-wasi": "list<u32> Nat limbs" }[profile];
	assert.ok(host, profile);
	return "Use " + host + " with the exact closed bound, including inside Array/List/Option/Prod/Except compositions, plain records and active variant fields. Empty containers, absent options and inactive Fin 0 branches are valid; present Fin 0 values are rejected. Rejections preserve caller values and name the failing path and bound.";
};
const boundary = "The hosted supplement adds no callback, Subtype, recursive, generic, indexed or inherited-field coverage. Earlier observations retain their own scope.";

/**
 * Build the proposed inventory in memory. No historical entry or on-disk file is rewritten.
 *
 * @param original - Current inventory before this promotion.
 * @param references - Authenticated hosted report references.
 */
export const promoteFinHostedCoverage = async (original, references) => {
	assert.equal(references.length, 78);
	assert.equal(references.reduce((sum, item) => sum + item.profiles.length, 0), 90);
	assert.equal(new Set(references.map(item => item.id)).size, references.length);
	const inventory = structuredClone(original);
	const commonPaths = [
		"tests/generic-record-array-ci.test.mjs"
		, "tests/helpers/fin-native-hosted-evidence.mjs"
		, "tests/helpers/fin-native-hosted-evidence-tests.mjs"
		, "tests/helpers/fin-native-hosted-promotion-references.mjs"
		, "tests/helpers/fin-native-hosted-promotion.mjs"
		, "tests/helpers/fin-native-hosted-promotion-tests.mjs"
	];
	const common = await Promise.all(commonPaths.map(async path => ({ path, sha256: sha256(await readFile(path)) })));
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id), "Already promoted: " + reference.id);
		const dispatch = reference.profiles.includes("c")
			? "Only C measures adapter/source dispatch, with its original positive controls; C++ is unmeasured."
			: "Dispatch is unmeasured in this report.";
		inventory.evidence.push({
			id: reference.id, kind: "installed", revision: reference.revision
			, command: reference.command
			, scope: reference.sourcePath + " " + reference.family + " Fin: "
				+ reference.checks.map(([profile, checks]) => profile + " " + checks + " checks").join(", ") + ". "
				+ "Two-root reproducible archives, deleted author/build roots and source-free offline installed public calls. "
				+ reference.environment + " " + dispatch + " "
				+ "Original ZIPs, logs and selected source snapshots are retained; package archive bytes are not retained, only their digests. "
				+ "File pins are selected identities, not a full build dependency closure. " + boundary
			, files: [...common, ...reference.executionFiles]
			, artifacts: reference.artifacts.map(item => ({ ...item, path: reference.id + "/" + item.path }))
		});
	}
	const selected = (observation, field) => references.filter(item =>
		item.sourcePath === observation.path && (item.family === "record") === field
		&& observation.profiles.some(profile => item.profiles.includes(profile)));
	let supplemented = 0;
	for(const observation of inventory.observations)
	{
		if(observation.shapes.length !== 1 || observation.shapes[0] !== "fin"
			|| !observation.profiles.every(profile => hosts.includes(profile))) continue;
		const field = observation.positions.length === 1 && observation.positions[0] === "field";
		if(!field && JSON.stringify(observation.positions) !== JSON.stringify(["parameter", "result"])) continue;
		const matches = selected(observation, field);
		assert.ok(matches.length);
		for(const profile of observation.profiles) for(const family of field ? ["record"] : ["product", "product-array"])
			assert.ok(matches.some(item => item.profiles.includes(profile) && item.family === family));
		for(const stage of Object.values(observation.stages))
		{
			assert.equal(stage.state, "passed");
			stage.evidence.push(...matches.map(item => item.id));
			stage.note += " The hosted Fin supplement retains its own reports, commands and runtime selections. Only its C reports measure adapter/source dispatch.";
		}
		if(structuralUpdates.includes(observation.id))
		{
			observation.scope = observation.path + " " + observation.profiles.join("/")
				+ " Fin parameters and results retain exact closed bounds through Array/List/Option/Prod/Except compositions and transparent aliases. Nominal fields are recorded separately.";
			observation.limitations[0] = "Only the named host, source route and parameter/result positions. Nominal fields are recorded separately. No callback or Subtype claim is added.";
			observation.conversionNotes.fin = conversion(observation.profiles[0]);
		}
		supplemented++;
	}
	assert.equal(supplemented, 31);
	for(const profile of finHostedMissingFieldProfiles) for(const path of ["ordinary-source", "reviewed-ir"])
	{
		assert.ok(!original.observations.some(item => item.profiles.includes(profile) && item.path === path
			&& item.shapes.includes("fin") && item.positions.includes("field")), "Do not overlap an existing field cell");
		const matches = selected({ profiles: [profile], path }, true);
		assert.equal(matches.length, profile === "perl" ? 4 : 1);
		inventory.observations.push({
			id: "native-nominal-fin-" + profile + "-" + path
			, profiles: [profile], shapes: ["fin"], positions: ["field"], path
			, scope: path + " " + profile + " nonrecursive, nongeneric record and active variant fields retain closed Fin bounds through Array/List/Option/Prod/Except compositions. All 13 record-fixture exports execute through source-free installed packages."
			, hostTypes: { fin: { field: newFieldTypes[profile] } }
			, stages: Object.fromEntries(inventory.stages.map(name => [name, {
				state: "passed", evidence: matches.map(item => item.id)
				, note: "Compiler-owned nominal bounds reconcile with independent reviews; checked construction preserves active field paths. Installed ordinary and reviewed packages retain separate observations. "
					+ matches.map(item => item.environment).join(" ") + " Dispatch is unmeasured for this host."
			}]))
			, limitations: [boundary, "Only this host and source route. No browser or PHP-Wasm acceptance is inferred. Dispatch is unmeasured."]
			, conversionNotes: { fin: conversion(profile) }
		});
	}
	return inventory;
};
