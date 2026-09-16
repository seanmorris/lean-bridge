/**
 * Validate corpus observations without promoting them to type-support claims.
 *
 * @file
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { corpusCases, corpusLibraries } from "../fixtures/type-corpus/cases.mjs";

export const corpusProfiles = Object.freeze({ python: Object.freeze({
	adapter: "prepared-wheel-v1"
	, errors: Object.freeze({ type: "TypeError", range: "ValueError" })
}) });

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
		assert.equal(library.pythonOperations.length, library.operations.length);
		assert.equal(new Set(library.pythonOperations).size, library.operations.length);
		assert.ok(library.pythonOperations.every(name => /^[a-z][a-z0-9_]*$/.test(name)));
	}
	for(const entry of cases)
	{
		assert.ok(entry.coverage.length);
		assert.ok(/^[A-Za-z][A-Za-z0-9_]*$/.test(entry.operation));
		assert.ok(entry.expectation.kind === "lean-oracle"
			|| entry.expectation.kind === "host-rejection" && ["type", "range"].includes(entry.expectation.category));
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
	assert.equal(actual.profile, "python");
	assert.equal(actual.module, library.pythonModule);
	assert.match(actual.python, /^3\.[0-9]+\.[0-9]+$/);
	assert.deepEqual(Object.keys(oracle).sort(), cases.filter(entry => entry.oracleKey !== null).map(entry => entry.oracleKey).sort());
	assert.equal(actual.results.length, cases.length);
	assert.deepEqual(actual.results.map(entry => entry.id).sort(), cases.map(entry => entry.id).sort());
	for(const entry of cases)
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
			assert.equal(observed.exception, corpusProfiles.python.errors[entry.expectation.category], entry.id);
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
		, ...catalog.libraries.flatMap(library => [library.oracle, `${library.module.replaceAll(".", "/")}.lean`, `${library.pendingModule.replaceAll(".", "/")}.lean`])]
		.map(path => `tests/fixtures/type-corpus/${path}`);
	paths.push("tests/helpers/type-corpus.mjs", "tests/helpers/type-corpus-python.mjs", "tests/helpers/lake-workspace.mjs", "tests/type-corpus.test.mjs");
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
