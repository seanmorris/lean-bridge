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
		, transport: "native", moduleKey: "pythonModule"
		, errors: Object.freeze({ type: "TypeError", range: "ValueError" }) })
	, ruby: Object.freeze({ adapter: "prepared-gem-v1", target: "rubygems"
		, transport: "native", moduleKey: "rubyModule"
		, errors: Object.freeze({ type: "TypeError", range: "RangeError" }) })
	, perl: Object.freeze({ adapter: "prepared-cpan-prebuilt-v1", target: "cpan"
		, transport: "native", moduleKey: "perlModule"
		, errors: Object.freeze({ type: "croak", range: "croak" }) })
	, "node-javascript": Object.freeze({ adapter: "prepared-npm-v1", target: "npm"
		, transport: "wasm", moduleKey: "npmModule"
		, errors: Object.freeze({ type: "TypeError", range: "TypeError" }) })
	, "node-typescript": Object.freeze({ adapter: "prepared-npm-ts-v1"
		, target: "npm", transport: "wasm", moduleKey: "npmModule"
		, errors: Object.freeze({ type: "TypeError", range: "TypeError" }) })
	, ...Object.fromEntries(["browser-javascript", "browser-react", "browser-worker"].map(profile => [profile
		, Object.freeze({
			adapter: "prepared-npm-browser-v1", target: "npm", transport: "wasm"
			, moduleKey: "npmModule", browser: true
			, errors: Object.freeze({ type: "TypeError", range: "TypeError" })
		})
	]))
});

/**
 * Require an explicit, unique list of actual browser engines; never skip one.
 *
 * @param value - Optional comma-separated selection, defaulting to all engines.
 */
export const corpusBrowserSelection = (value = "chromium,firefox,webkit") => {
	assert.equal(typeof value, "string");
	const engines = value.split(",").map(engine => engine.trim()).sort();
	assert.ok(engines.every(engine => ["chromium", "firefox", "webkit"].includes(engine)), "Unknown or empty browser engine");
	assert.equal(new Set(engines).size, engines.length, "Duplicate browser engine");
	return engines;
};

/**
 * Select the independently specified corpus API supported by a transport.
 *
 * @param library - Catalog library.
 * @param profile - Host profile, or undefined for the complete native API.
 */
export const corpusProfileSignatures = (library, profile) => corpusSignatures(library).filter(signature =>
	corpusProfiles[profile]?.transport !== "wasm" || [...signature.parameters, signature.result].every(type => typeof type === "string"));

/**
 * A missing source projection is a gap, not a passed host rejection.
 *
 * @param library - Catalog library.
 * @param entry - Shared input case.
 * @param profile - Selected consumer.
 */
export const corpusCaseSupported = (library, entry, profile) => corpusProfileSignatures(library, profile).some(signature => signature.name === `${library.module}.${entry.operation}`);

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
 * @param profile - Optional transport-specific API selection.
 */
export const validateCorpusDeclarations = (library, model, profile) => {
	const declarations = model.exports.map(entry => ({ name: entry.name
		, parameters: entry.parameters.map(parameter => declaredType(parameter.type))
		, result: declaredType(entry.result) }));
	const sorted = items => [...items].sort((a, b) => a.name.localeCompare(b.name));
	assert.deepEqual(sorted(declarations), sorted(corpusProfileSignatures(library, profile)), "Compiler declarations differ from the independent corpus signatures");
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
		for(const profile of Object.values(corpusProfiles)) assert.equal(typeof library[profile.moduleKey], "string");
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
	const wasm = corpusProfiles[actual.profile].transport === "wasm";
	const browser = corpusProfiles[actual.profile].browser;
	assert.equal(actual.module, library[corpusProfiles[actual.profile].moduleKey]);
	assert.match(actual.hostVersion, browser ? /^[0-9]+(?:\.[0-9]+)+$/ : wasm ? /^[0-9]+\.[0-9]+\.[0-9]+$/ : actual.profile === "perl" ? /^5\.[0-9]+\.[0-9]+$/ : actual.profile === "ruby" ? /^3\.3\.[0-9]+$/ : /^3\.[0-9]+\.[0-9]+$/);
	if(wasm && !browser) assert.ok(Number(actual.hostVersion.split(".")[0]) >= 22);
	if(browser) assert.equal(actual.realm, actual.profile === "browser-worker" ? "dedicated-worker" : "window");
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
		if(!corpusCaseSupported(library, entry, actual.profile))
		{
			assert.deepEqual(observed, { id: entry.id, status: "unsupported", export: `${library.module}.${entry.operation}` });
			continue;
		}
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

const validateBrowserEvidence = (run, library, cases) => {
	const evidence = run.browser;
	const variants = run.profile === "browser-react" ? ["production", "strict"] : ["production"];
	assert.deepEqual(evidence.requestedEngines, corpusBrowserSelection(evidence.requestedEngines.join(",")));
	assert.equal(evidence.installedSourcesRemoved, true);
	assert.equal(evidence.externalNetworkBlocked, true);
	assert.equal(evidence.installedAssets.length, 2);
	assert.equal(new Set(evidence.installedAssets.map(asset => asset.path)).size, 2);
	const hashes = evidence.installedAssets.map(asset => asset.sha256).sort();
	assert.equal(new Set(hashes).size, 2);
	for(const asset of evidence.installedAssets)
	{
		assert.match(asset.sha256, /^[a-f0-9]{64}$/);
		assert.ok(Number.isSafeInteger(asset.bytes) && asset.bytes > 0);
	}
	assert.ok(evidence.installedAssets.some(asset => asset.path === "node_modules/@lean-bridge/runtime/internal/main.wasm"));
	assert.ok(evidence.installedAssets.some(asset => asset.path.startsWith(`node_modules/${library.npmModule}/internal/wasm/`) && asset.path.endsWith(".wasm")));
	assert.deepEqual(evidence.framework.map(item => item.name), run.profile === "browser-react" ? ["react", "react-dom", "scheduler"] : []);
	for(const framework of evidence.framework)
	{
		assert.match(framework.version, /^[0-9]+\.[0-9]+\.[0-9]+$/);
		assert.match(framework.sha256, /^[a-f0-9]{64}$/);
		assert.equal(framework.archive, `framework/${framework.name}-${framework.version}.tgz`);
	}
	assert.deepEqual(evidence.deployments.map(deployment => deployment.variant).sort(), variants);
	for(const deployment of evidence.deployments)
	{
		assert.match(deployment.viteVersion, /^[0-9]+\.[0-9]+\.[0-9]+$/);
		assert.equal(deployment.sha256, sha256(canonicalJson(deployment.files)));
		assert.equal(new Set(deployment.files.map(file => file.path)).size, deployment.files.length);
		assert.ok(deployment.files.some(file => file.path === "index.html"));
		for(const file of deployment.files)
		{
			assert.ok(/^[A-Za-z0-9_./-]+$/.test(file.path) && !file.path.startsWith("/") && !file.path.split("/").includes(".."));
			assert.match(file.sha256, /^[a-f0-9]{64}$/);
			assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0);
		}
		assert.deepEqual(deployment.files.filter(file => file.path.endsWith(".wasm")).map(file => file.sha256).sort(), hashes);
		assert.ok(deployment.modulePaths.every(path => path.startsWith("node_modules/") && !path.split("/").includes("..")));
		for(const name of [library.npmModule, "@lean-bridge/runtime"])
			assert.ok(deployment.modulePaths.includes(`node_modules/${name}/index.mjs`));
	}
	assert.deepEqual(evidence.executions.map(execution => `${execution.engine}/${execution.variant}`).sort()
		, evidence.requestedEngines.flatMap(engine => variants.map(variant => `${engine}/${variant}`)).sort());
	assert.deepEqual(run.observation, evidence.executions[0].observation);
	for(const execution of evidence.executions)
	{
		assert.equal(execution.observation.profile, run.profile);
		validateCorpusObservation(library, cases, run.oracle, execution.observation);
		assert.equal(execution.failedAssetRecovery, true);
		assert.deepEqual([...new Set(execution.assets.map(asset => asset.sha256))].sort(), hashes);
		const deployment = evidence.deployments.find(deployment => deployment.variant === execution.variant);
		for(const asset of execution.assets)
		{
			assert.equal(asset.status, 200);
			assert.match(asset.mime, /^application\/wasm(?:;|$)/);
			assert.ok(deployment.files.some(file => asset.path === `/corpus/nested/${file.path}` && asset.sha256 === file.sha256 && asset.bytes === file.bytes));
			assert.ok(evidence.installedAssets.some(file => asset.sha256 === file.sha256 && asset.bytes === file.bytes));
		}
		if(run.profile === "browser-react")
		{
			assert.equal(execution.pendingUnmount, true);
			assert.deepEqual(execution.lifecycle, execution.variant === "strict"
				? { effects: 6, cleanups: 5, ignored: 3, commits: 3 }
				: { effects: 3, cleanups: 2, ignored: 0, commits: 3 });
		}
		else assert.deepEqual(execution.lifecycle, run.profile === "browser-worker"
			? { created: 2, terminated: 2, live: 0 } : { rerun: true });
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
		, "consumers/ruby.rb", "consumers/perl.pl", "consumers/node.mjs"
		, "consumers/javascript.mjs"
		, ...["plain", "react", "worker", "worker-main"].map(name => `consumers/browser/${name}.mjs`)
		, ...catalog.libraries.flatMap(library => [library.oracle, `${library.module.replaceAll(".", "/")}.lean`, `${library.pendingModule.replaceAll(".", "/")}.lean`])]
		.map(path => `tests/fixtures/type-corpus/${path}`);
	paths.push("tests/helpers/type-corpus.mjs", "tests/helpers/type-corpus-native.mjs", "tests/helpers/type-corpus-source.mjs", "tests/helpers/type-corpus-node.mjs", "tests/helpers/lake-workspace.mjs", "tests/type-corpus.test.mjs");
	paths.push("tests/helpers/type-corpus-browser.mjs", "tests/helpers/type-corpus-browser-build.mjs");
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
		assert.deepEqual(sorted(run.declarationEvidence.signatures), sorted(corpusProfileSignatures(library, run.profile)));
		if(corpusProfiles[run.profile].transport === "wasm")
		{
			assert.equal(run.runtimeArchive.target, "npm");
			assert.match(run.runtimeArchive.sha256, /^[a-f0-9]{64}$/);
			assert.notEqual(run.runtimeArchive.sha256, run.archiveSha256);
			const unsupported = corpusSignatures(library).filter(signature => !corpusProfileSignatures(library, run.profile).some(item => item.name === signature.name)).map(signature => signature.name);
			assert.deepEqual(run.rejection.exports, [...unsupported, library.pendingExport]);
			assert.equal(run.rejection.code, "component-adapter-hints-required");
			assert.deepEqual(run.rejection.hints, run.rejection.exports.map(name => `hint:${name}:unsupported-${name === library.pendingExport ? "result" : "parameter"}-type`).sort());
			if(run.profile === "node-typescript")
			{
				assert.equal(run.typescript.strict, true);
				assert.equal(run.typescript.skipLibCheck, false);
				assert.match(run.typescript.version, /^Version [0-9]+\.[0-9]+\.[0-9]+$/);
				for(const key of ["sourceSha256", "declarationsSha256", "compilerSha256"]) assert.match(run.typescript[key], /^[a-f0-9]{64}$/);
			}
		}
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
		if(corpusProfiles[run.profile].browser) validateBrowserEvidence(run, library, cases);
		for(const entry of cases)
		{
			if(!corpusCaseSupported(library, entry, run.profile)) continue;
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
