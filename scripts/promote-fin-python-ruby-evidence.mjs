/**
 * Promote only the Python/Ruby structural Fin positions observed in the archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { finPythonRubyPromotionReferences, finPythonRubyReceiptPath } from "../tests/helpers/fin-python-ruby-promotion-references.mjs";

const path = "docs/type-surface.v1.json", inventory = JSON.parse(await readFile(path, "utf8"));
const references = await finPythonRubyPromotionReferences();
assert.equal(references.length, 18);
const common = [finPythonRubyReceiptPath
	, "tests/fin-python-ruby-evidence.test.mjs"
	, "tests/helpers/fin-python-ruby-evidence.mjs"
	, "tests/helpers/fin-python-ruby-promotion-references.mjs"
	, "tests/helpers/fin-python-ruby-promotion-tests.mjs"];
for(const reference of references)
{
	assert.ok(!inventory.evidence.some(item => item.id === reference.id), `Already promoted: ${reference.id}`);
	const files = [...common, reference.reportPath, ...reference.executionFiles.map(file => file.path)];
	inventory.evidence.push({ id: reference.id, kind: "installed"
		, revision: reference.revision, command: reference.command
		, scope: `${reference.sourcePath} ${reference.profile} ${reference.family} Fin: ${reference.checks} checks with the runner-configured interpreter ${reference.version}. The runner recorded its --version output before the selections and the installer used that executable; the consumer did not print its version. Two-root reproducible archives, source/build deletion and offline compiler-free installation. The declared glibc minimum is 2.36; host glibc and Lean version were not measured. Dispatch is unmeasured. No other runtime, host, callback, Subtype, recursive/generic/indexed field or hosted CI coverage is inferred. Receipt source pins are selected identities, not a complete dependency closure.`
		, files: await Promise.all(files.map(async path => ({ path, sha256: sha256(await readFile(path)) })))
		, artifacts: reference.artifacts.map(item => ({ ...item, path: `${reference.id}/${item.path}` })) });
}

const notes = {
	analysis: "Fresh Lean retains closed bounds at every structural or nominal site; independently reviewed constraints reconcile with those exact trees."
	, generation: "The native model retains each closed bound beside Nat carriers through Array/List/Option/Prod/Except and supported record or active variant fields."
	, compilation: "Generated Lean checks each incoming bound before constructing Fin. New product and field reports do not measure source or adapter dispatch."
	, packaging: "Two independent author roots reproduce the original wheel or gem before source/build deletion and offline compiler-free installation."
	, installedExecution: "Both Python interpreter versions and Ruby have separate terminal execution logs for valid, invalid and recovery checks. Original reports retain exact model, review, caller and archive identities."
};
const conversion = {
	python: "Use exact int values, rejecting bool and numeric coercions. Arrays/Lists accept lists or tuples and return independent tuples; products use pairs, Option uses None/Some, and Except uses Err/Ok. Record and active variant fields retain their declared bounds. Empty, absent and inactive Fin 0 payloads are valid; every present Fin 0 value is rejected."
	, ruby: "Use Integer values with exact closed bounds. Arrays/Lists use Array, products use two-element Arrays, Option uses nil/Some, and Except uses Err/Ok. Record and active variant fields retain their declared bounds. Empty, absent and inactive Fin 0 payloads are valid; every present Fin 0 value is rejected."
};
for(const profile of ["python", "ruby"])
{
	for(const sourcePath of ["ordinary-source", "reviewed-ir"])
	{
		const id = sourcePath === "ordinary-source" ? `native-fin-${profile}-ordinary-source` : `reviewed-fin-${profile}-scalar-containers`;
		const existing = inventory.observations.find(item => item.id === id);
		assert.ok(existing);
		const selected = references.filter(item => item.profile === profile && item.sourcePath === sourcePath);
		const structural = selected.filter(item => item.family !== "record");
		const fields = selected.filter(item => item.family === "record");
		assert.equal(structural.length, profile === "python" ? 4 : 2);
		assert.equal(fields.length, profile === "python" ? 2 : 1);
		existing.scope = `${sourcePath} ${profile} Fin parameters and results retain closed bounds through Array/List/Option/Prod/Except compositions and transparent aliases. Installed consumers reject invalid active leaves and recover; nominal fields are recorded separately.`;
		for(const [name, stage] of Object.entries(existing.stages))
		{
			stage.evidence.push(...structural.map(item => item.id)); stage.note = notes[name];
		}
		existing.limitations = ["Only the named host, source path and parameter/result positions; nominal fields are recorded separately. No callback or Subtype coverage is added."
			, "The new product and Array-of-product reports have no dispatch observations; earlier scalar/container counters remain scoped to their original reports."
			, "The new reports configure a glibc minimum of 2.36 without measuring host glibc or Lean version. They do not establish a release-floor or hosted CI result."];
		existing.conversionNotes.fin = conversion[profile];
		inventory.observations.push({ id: `native-nominal-fin-${profile}-${sourcePath}`
			, profiles: [profile], shapes: ["fin"], positions: ["field"]
			, path: sourcePath
			, scope: `${sourcePath} ${profile} nonrecursive, nongeneric record and active variant fields retain closed Fin bounds through Array/List/Option/Prod/Except compositions. Each run executes 2053 checks across all 13 fixture exports. Both Python versions retain their own execution logs; Ruby is recorded separately.`
			, hostTypes: { fin: { field: profile === "python" ? "Exact int checked against the field's closed bound" : "Integer checked against the field's closed bound" } }
			, stages: Object.fromEntries(inventory.stages.map(name => [name, { state: "passed", evidence: fields.map(item => item.id), note: notes[name] }]))
			, limitations: ["Only the named host and source path; no recursive, generic, indexed or inherited refined record coverage."
				, "No callback, Subtype, browser, PHP-Wasm or other native-host acceptance is inferred."
				, "Dispatch is unmeasured. Interpreter versions come from the configured runner, not consumer output. The declared glibc minimum is 2.36; host glibc and Lean version were not measured."]
			, conversionNotes: { fin: conversion[profile] } });
	}
}
await writeFile(path, JSON.stringify(inventory, null, 2) + "\n");
process.stdout.write("Promoted 18 Python/Ruby reports, four field cells and eight supplemental parameter/result cells.\n");
