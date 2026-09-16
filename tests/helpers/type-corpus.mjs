/**
 * Validate corpus observations without promoting them to type-support claims.
 *
 * @file
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { corpusCases, corpusHostCase, corpusLibraries, corpusOracleKeys, corpusSignatures } from "../fixtures/type-corpus/cases.mjs";

export const corpusProfiles = Object.freeze({
	python: Object.freeze({ adapter: "prepared-wheel-v1", target: "pypi"
		, errors: Object.freeze({ type: "TypeError", range: "ValueError" }) })
	, ruby: Object.freeze({ adapter: "prepared-gem-v1", target: "rubygems"
		, errors: Object.freeze({ type: "TypeError", range: "RangeError" }) })
	, perl: Object.freeze({ adapter: "prepared-cpan-prebuilt-v1", target: "cpan"
		, errors: Object.freeze({ type: "croak", range: "croak" }) })
});

const declaredType = type => {
	if(type.kind === "primitive") return type.name;
	if(type.kind === "array") return { array: declaredType(type.element) };
	assert.equal(type.kind, "record");
	return { record: type.name, fields: Object.fromEntries(type.fields.map(field => [field.name, declaredType(field.type)])) };
};

/**
 * Check named types and positions independently of installed transport results.
 *
 * @param library - Expected catalog API.
 * @param model - Fresh compiler-owned native model, not consumer observations.
 */
export const validateCorpusDeclarations = (library, model) => {
	const declarations = model.exports.map(entry => ({ name: entry.name
		, parameters: entry.parameters.map(parameter => declaredType(parameter.type))
		, result: declaredType(entry.result) }));
	const sorted = items => [...items].sort((a, b) => a.name.localeCompare(b.name));
	assert.deepEqual(sorted(declarations), sorted(corpusSignatures(library)), "Compiler declarations differ from the independent corpus signatures");
	return declarations;
};

/**
 * Reject misspelled, empty or duplicate requested adapters instead of skipping them.
 *
 * @param value - Explicit comma-separated profiles; undefined selects fast checks.
 */
export const corpusSelection = value => {
	if(value === undefined) return [];
	assert.equal(typeof value, "string");
	const profiles = value.split(",").map(profile => profile.trim()).sort();
	assert.ok(profiles.every(profile => Object.hasOwn(corpusProfiles, profile)), "Unknown or empty corpus adapter");
	assert.equal(new Set(profiles).size, profiles.length, "Duplicate corpus adapter");
	return profiles;
};

/**
 * Validate case ids and positions against the independently maintained inventory.
 *
 * @param inventory - Parsed type-surface inventory.
 */
export const corpusCatalog = inventory => {
	const cases = corpusLibraries.flatMap(corpusCases);
	assert.equal(new Set(cases.map(entry => entry.id)).size, cases.length);
	assert.deepEqual(corpusLibraries.map(library => library.id), ["shop", "telemetry"]);
	for(const library of corpusLibraries)
	{
		assert.equal(library.snakeOperations.length, library.operations.length);
		assert.equal(new Set(library.snakeOperations).size, library.operations.length);
		assert.ok(library.snakeOperations.every(name => /^[a-z][a-z0-9_]*$/.test(name)));
		for(const profile of Object.keys(corpusProfiles)) assert.equal(typeof library[`${profile}Module`], "string");
		assert.equal(corpusSignatures(library).length, library.operations.length);
		for(const entry of cases.filter(entry => entry.library === library.id))
		{
			assert.ok(library.operations.includes(entry.operation));
			assert.equal(entry.arguments.length, corpusSignatures(library).find(signature => signature.name === `${library.module}.${entry.operation}`).parameters.length);
			for(const argument of entry.arguments.filter(value => value.record))
				assert.deepEqual(Object.keys(argument.fields).sort(), [...library.recordFields[argument.record]].sort());
		}
	}
	for(const entry of cases)
	{
		assert.ok(entry.coverage.length);
		assert.ok(/^[A-Za-z][A-Za-z0-9_]*$/.test(entry.operation));
		assert.ok(["value", "float32", "float64"].includes(entry.resultEncoding));
		assert.ok(entry.expectation.kind === "lean-oracle"
			|| entry.expectation.kind === "host-rejection" && ["type", "range"].includes(entry.expectation.category));
		for(const [profile, policy] of Object.entries(entry.hostExpectations))
		{
			assert.ok(Object.hasOwn(corpusProfiles, profile));
			assert.ok(Object.keys(policy).every(key => ["expectation", "oracleKey", "resultEncoding", "rejectionMessage"].includes(key)));
			const selected = corpusHostCase(entry, profile);
			if(selected.expectation.kind === "lean-oracle") assert.equal(typeof selected.oracleKey, "string");
			else assert.ok(typeof selected.rejectionMessage === "string" && selected.rejectionMessage.length > 0);
		}
		for(const claim of entry.coverage)
		{
			const shape = inventory.shapes.find(shape => shape.id === claim.shape);
			assert.ok(shape, `Unknown corpus shape: ${claim.shape}`);
			assert.ok(claim.positions.length);
			for(const position of claim.positions)
				assert.ok(inventory.families[shape.family].positions.includes(position), `${entry.id}: invalid ${position}`);
		}
	}
	return { schemaVersion: 1, libraries: corpusLibraries, cases };
};

/**
 * Reject missing, duplicated, extra or mismatched installed observations.
 *
 * @param library - Library being consumed.
 * @param cases - Exact host-neutral inputs handed to the consumer.
 * @param oracle - Results produced by a fresh Lean interpreter run.
 * @param actual - JSON emitted by the installed consumer program.
 */
export const validateCorpusObservation = (library, cases, oracle, actual) => {
	assert.equal(actual.schemaVersion, 1);
	assert.ok(Object.hasOwn(corpusProfiles, actual.profile), "Unknown consumer adapter");
	assert.equal(actual.module, library[`${actual.profile}Module`]);
	assert.match(actual.hostVersion, actual.profile === "perl" ? /^5\.[0-9]+\.[0-9]+$/ : actual.profile === "ruby" ? /^3\.3\.[0-9]+$/ : /^3\.[0-9]+\.[0-9]+$/);
	if(actual.profile === "perl")
	{
		assert.ok(Number(actual.hostVersion.split(".")[1]) >= 36);
		assert.equal(actual.abi.ptrsize, "8");
		assert.equal(actual.abi.ivsize, "8");
		assert.equal(actual.abiKey, sha256(JSON.stringify(JSON.parse(canonicalJson(actual.abi)))));
	}
	assert.deepEqual(Object.keys(oracle).sort(), corpusOracleKeys(cases));
	assert.equal(actual.results.length, cases.length);
	assert.deepEqual(actual.results.map(entry => entry.id).sort(), cases.map(entry => entry.id).sort());
	for(const entry of cases.map(entry => corpusHostCase(entry, actual.profile)))
	{
		const observed = actual.results.find(result => result.id === entry.id);
		if(entry.expectation.kind === "lean-oracle")
		{
			assert.equal(observed.status, "matched", entry.id);
			assert.deepEqual(observed.observed, oracle[entry.oracleKey], entry.id);
			assert.equal(observed.independentCopy, entry.checkIndependentCopy, entry.id);
		}
		else
		{
			assert.equal(observed.status, "rejected-as-expected", entry.id);
			assert.equal(observed.exception, corpusProfiles[actual.profile].errors[entry.expectation.category], entry.id);
			if(entry.rejectionMessage) assert.ok(observed.message.startsWith(`${entry.rejectionMessage} at `), entry.id);
			assert.equal(observed.recovered, true, entry.id);
		}
	}
};

/**
 * Hash every checked-in corpus input, including consumer and Lean oracle sources.
 *
 * @param repository - Repository root; consumers never receive this path.
 * @param catalog - Validated catalog whose exact inputs must be identified.
 */
export const corpusIdentity = async (repository, catalog) => {
	const paths = ["cases.mjs", "Corpus/Wire.lean", "consumers/python.py"
		, "consumers/ruby.rb", "consumers/perl.pl"
		, ...catalog.libraries.flatMap(library => [library.oracle, `${library.module.replaceAll(".", "/")}.lean`, `${library.pendingModule.replaceAll(".", "/")}.lean`])]
		.map(path => `tests/fixtures/type-corpus/${path}`);
	paths.push("tests/helpers/type-corpus.mjs", "tests/helpers/type-corpus-native.mjs", "tests/helpers/lake-workspace.mjs", "tests/type-corpus.test.mjs");
	const files = [];
	for(const path of paths)
	{
		const bytes = await readFile(`${repository}/${path}`);
		files.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
	}
	return { sha256: sha256(canonicalJson({ catalog, files })), catalog, files };
};

/**
 * List every inventory cell, preserving absent adapters and missing cases as gaps.
 * An observed case is scoped evidence, not completion of the cell's semantic rules.
 *
 * @param inventory - Type-surface inventory and contracts returned by readTypeSurface.
 * @param catalog - Validated corpus cases.
 * @param runs - Fully validated library observations from installed public APIs.
 */
export const corpusCoverage = (inventory, catalog, runs = []) => {
	const observations = new Map();
	const identities = new Set();
	for(const run of runs)
	{
		const identity = `${run.profile}/${run.path}/${run.library}`;
		assert.ok(!identities.has(identity), `Duplicate corpus run: ${identity}`);
		identities.add(identity);
		assert.equal(run.path, "ordinary-source");
		assert.ok(Object.hasOwn(corpusProfiles, run.profile));
		const library = catalog.libraries.find(library => library.id === run.library);
		assert.ok(library, "Unknown corpus library");
		assert.match(run.archiveSha256, /^[a-f0-9]{64}$/);
		assert.match(run.runtimeIdentity, /^[a-f0-9]{64}$/);
		assert.match(run.bindingIrSha256, /^[a-f0-9]{64}$/);
		assert.equal(run.archive.sha256, run.archiveSha256);
		assert.equal(run.archive.target, corpusProfiles[run.profile].target);
		assert.equal(run.observation.profile, run.profile);
		assert.match(run.declarationEvidence.modelSha256, /^[a-f0-9]{64}$/);
		const sorted = items => [...items].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sorted(run.declarationEvidence.signatures), sorted(corpusSignatures(library)));
		if(run.profile === "perl")
		{
			assert.equal(run.runtimeArchive.target, "cpan");
			assert.match(run.runtimeArchive.sha256, /^[a-f0-9]{64}$/);
			assert.notEqual(run.runtimeArchive.sha256, run.archiveSha256);
			assert.deepEqual(run.observation.abi, run.perlAbi.abi);
			assert.equal(run.observation.abiKey, run.perlAbi.abiKey);
		}
		const cases = catalog.cases.filter(entry => entry.library === run.library);
		validateCorpusObservation(library, cases, run.oracle, run.observation);
		for(const entry of cases)
		{
			for(const claim of entry.coverage)
			{
				for(const position of claim.positions)
				{
					const key = `${run.profile}/${run.path}/${claim.shape}/${position}`;
					if(!observations.has(key)) observations.set(key, new Set());
					observations.get(key).add(entry.id);
				}
			}
		}
	}
	return typeSurfaceCells(inventory.document, inventory).map(cell => {
		const caseIds = [...observations.get(`${cell.profile}/${cell.path}/${cell.shape}/${cell.position}`) ?? []].sort();
		return { profile: cell.profile, path: cell.path, shape: cell.shape
			, position: cell.position
			, status: caseIds.length ? "observed" : "gap", cases: caseIds
			, reason: caseIds.length ? "scoped-cases-only" : !Object.hasOwn(corpusProfiles, cell.profile) ? "adapter-not-implemented"
				: cell.path !== "ordinary-source" ? "source-path-not-implemented" : "case-not-executed"
			, owner: cell.owner };
	});
};
