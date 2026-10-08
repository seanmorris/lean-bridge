/**
 * Promote the archived Rust/.NET structural and WIT field selections without borrowing coverage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { finNativeBatchEnvironment, finNativeBatchPromotionReferences } from "../tests/helpers/fin-native-batch-promotion-references.mjs";

const path = "docs/type-surface.v1.json", inventory = JSON.parse(await readFile(path, "utf8"));
const references = await finNativeBatchPromotionReferences();
const common = ["tests/fin-python-ruby-evidence.test.mjs"
	, "tests/helpers/fin-native-batch-promotion-references.mjs"
	, "tests/helpers/fin-native-batch-promotion-tests.mjs"];
for(const reference of references)
{
	assert.ok(!inventory.evidence.some(item => item.id === reference.id), `Already promoted: ${reference.id}`);
	const validator = { rust: "fin-rust-evidence", dotnet: "fin-dotnet-hosted-evidence", "wit-wasi": "fin-wit-record-evidence" }[reference.profile];
	const files = [...common, `tests/helpers/${validator}.mjs`
		, `tests/helpers/${validator}-tests.mjs`, reference.receiptPath
		, reference.report.path, ...reference.executionFiles.map(item => item.path)];
	inventory.evidence.push({ id: reference.id, kind: "installed"
		, revision: reference.revision, command: reference.command
		, scope: `${reference.sourcePath} ${reference.profile} ${reference.family} Fin: ${reference.checks} checks. Two-root reproducible packages, deleted author/build roots and offline installation. ${reference.environment} Dispatch is unmeasured in these reports. Source pins are selected identities, not a complete dependency closure. No other host, source path, callback, Subtype or recursive/generic/indexed/inherited field coverage is inferred.`
		, files: await Promise.all(files.map(async path => ({ path, sha256: sha256(await readFile(path)) })))
		, artifacts: reference.artifacts.map(item => ({ ...item, path: `${reference.id}/${item.path}` })) });
}
const conversion = {
	rust: "Use BigUint values with exact closed bounds. Arrays and Lists borrow slices and return owned vectors; products use binary tuples, Option uses None/Some, and Except uses Result. Named record and active variant fields retain their bounds. Empty, absent and inactive Fin 0 payloads are valid; every present Fin 0 value is rejected."
	, dotnet: "Use BigInteger values with exact closed bounds. Arrays and Lists use typed arrays, products use binary tuples, Option uses generated None/Some, and Except uses generated Result. Named record and active variant fields retain their bounds. Empty, absent and inactive Fin 0 payloads are valid; every present Fin 0 value is rejected."
	, "wit-wasi": "A Fin field uses the Nat carrier, a list<u32> of little-endian limbs. Generated records and the active variant payload keep each field's closed bound through Array/List/Option/Prod/Except compositions. Empty, absent and inactive Fin 0 payloads are valid; every present Fin 0 value is rejected. WIT's carrier text does not encode the bound."
};
const fieldTypes = { rust: "BigUint checked against the field's closed bound", dotnet: "System.Numerics.BigInteger checked against the field's closed bound", "wit-wasi": "list<u32> little-endian limbs checked against the field's closed bound" };
const notes = profile => ({
	analysis: "Fresh Lean preserves each closed Fin bound. Independently reviewed constraints reconcile with the exact compiler-owned trees."
	, generation: "The native model retains bounds beside the Nat carriers through Array/List/Option/Prod/Except and supported record or active variant fields."
	, compilation: "Generated Lean checks incoming leaves before constructing Fin. The new structural/field reports do not measure dispatch."
	, packaging: `Two author roots reproduce the ${profile === "rust" ? "crate" : profile === "dotnet" ? "NuGet package" : "WIT component package"}; author/build roots are deleted before offline installation. ${finNativeBatchEnvironment[profile]}`
	, installedExecution: `Installed ${profile} consumers execute valid, invalid and recovery cases with exact caller, source, review, model and archive identities. Dispatch is unmeasured in these new reports.`
});
for(const profile of ["rust", "dotnet", "wit-wasi"])
	for(const sourcePath of ["ordinary-source", "reviewed-ir"])
	{
		const selected = references.filter(item => item.profile === profile && item.sourcePath === sourcePath);
		const fields = selected.filter(item => item.family === "record"); assert.equal(fields.length, 1);
		const stageNotes = notes(profile);
		if(profile !== "wit-wasi")
		{
			const id = sourcePath === "ordinary-source" ? `native-fin-${profile}-ordinary-source` : `reviewed-fin-${profile}-scalar-containers`;
			const existing = inventory.observations.find(item => item.id === id); assert.ok(existing);
			const structural = selected.filter(item => item.family !== "record"); assert.equal(structural.length, 2);
			existing.scope = `${sourcePath} ${profile} Fin parameters and results retain closed bounds through Array/List/Option/Prod/Except compositions and transparent aliases. Installed consumers reject invalid active leaves and recover; nominal fields are recorded separately.`;
			for(const [name, stage] of Object.entries(existing.stages))
			{
				stage.evidence.push(...structural.map(item => item.id));
				// Keep the earlier scalar/container execution observations, including Rust dispatch.
				stage.note = name === "installedExecution" ? `${stage.note} ${stageNotes[name]}` : stageNotes[name];
			}
			existing.limitations = ["Only the named host, source path and parameter/result positions; nominal fields are recorded separately. No callback or Subtype coverage is added."
				, "The new product and Array-of-product reports have no dispatch observations. Earlier scalar/container dispatch remains scoped to its original reports."
				, finNativeBatchEnvironment[profile]];
			if(profile === "dotnet" && sourcePath === "ordinary-source") existing.limitations.push("Earlier ordinary scalar/container .NET evidence compares the privately loaded libraries with the C archive from the same build; it does not count dispatch in the .NET process.");
			existing.conversionNotes.fin = conversion[profile];
		}
		inventory.observations.push({ id: `native-nominal-fin-${profile}-${sourcePath}`
			, profiles: [profile], shapes: ["fin"], positions: ["field"]
			, path: sourcePath
			, scope: `${sourcePath} ${profile} nonrecursive, nongeneric record and active variant fields retain closed Fin bounds through Array/List/Option/Prod/Except compositions. The installed route executes ${fields[0].checks} checks across all 13 fixture exports.`
			, hostTypes: { fin: { field: fieldTypes[profile] } }
			, stages: Object.fromEntries(inventory.stages.map(name => [name, { state: "passed", evidence: fields.map(item => item.id), note: stageNotes[name] }]))
			, limitations: ["Only the named host and source path. No recursive, generic, indexed or inherited refined record coverage."
				, "No callback, Subtype, browser, PHP-Wasm or other host acceptance is inferred. Dispatch is unmeasured."
				, finNativeBatchEnvironment[profile]]
			, conversionNotes: { fin: conversion[profile] } });
	}
await writeFile(path, JSON.stringify(inventory, null, 2) + "\n");
process.stdout.write("Promoted 14 original reports, six field cells and eight supplemental structural cells.\n");
