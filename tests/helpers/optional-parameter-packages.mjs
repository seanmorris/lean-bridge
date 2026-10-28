/**
 * Shared author inputs and bundle controls for the optional-parameter matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	assertOptionalParameterIr
	, optionalParameterExports
	, optionalParameterFixture
	, optionalParameterModule
	, optionalParameterReview
	, optionalParameterTargets
} from "./optional-parameter-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Collapse profiles sharing one package target while rejecting coordinate
 * drift between aliases such as Node/browser and Java/Kotlin.
 *
 * @param profiles - Consumer profiles selected for one canonical build.
 */
export const optionalParameterTargetConfiguration = profiles => {
	if(!Array.isArray(profiles) || !profiles.length
		|| profiles.some(profile => typeof profile !== "string"))
		throw new TypeError("Optional-parameter profiles must be a non-empty string array");
	if(new Set(profiles).size !== profiles.length)
		throw new TypeError("Optional-parameter profiles must be unique");
	const targets = {};
	for(const profile of profiles)
	{
		const selected = optionalParameterTargets[profile];
		if(!selected) throw new TypeError(`Unknown optional-parameter profile: ${profile}`);
		const [target, coordinate] = selected;
		if(Object.hasOwn(targets, target)
			&& canonicalJson(targets[target]) !== canonicalJson(coordinate))
			throw new TypeError(`Conflicting optional-parameter ${target} coordinates`);
		targets[target] = structuredClone(coordinate);
	}
	return targets;
};

/**
 * Copy the immutable Lean fixture and materialize one ordinary or independently
 * reviewed author root.
 *
 * @param t - Node test context that owns cleanup.
 * @param root0 - Route and selected consumer profiles.
 * @param root0.route - Ordinary source analysis or independent reviewed IR.
 * @param root0.profiles - Consumer profiles whose targets are prepared.
 */
export const prepareOptionalParameterProject = async (t, { route, profiles }) => {
	if(!["ordinary", "reviewed"].includes(route))
		throw new TypeError(`Unknown optional-parameter route: ${route}`);
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-optional-parameters-"));
	t?.after(() => rm(directory, { recursive: true, force: true }));
	const projectRoot = join(directory, "project");
	await cp(optionalParameterFixture, projectRoot, { recursive: true });
	const configuration = {
		schemaVersion: 1
		, modules: [optionalParameterModule]
		, ...route === "ordinary" ? { exports: [...optionalParameterExports] } : {}
		, targets: optionalParameterTargetConfiguration(profiles)
	};
	await saveLakeFile(projectRoot, "lean-bridge.exports.json"
		, canonicalJson(configuration));
	const review = route === "reviewed" ? optionalParameterReview() : null;
	if(review) await saveLakeFile(projectRoot, "api.binding-ir.json"
		, canonicalJson(review));
	return {
		directory, projectRoot, configuration, review, route
		, profiles: [...profiles]
	};
};

/**
 * Prove that a canonical bundle retained all seven authenticated defaults while
 * keeping the compiler ABI full arity.
 *
 * @param bundleRoot - Canonical bundle directory.
 */
export const assertOptionalParameterBundle = async bundleRoot => {
	const irBytes = await readFile(join(bundleRoot, "binding/binding-ir.json"));
	const ir = JSON.parse(irBytes);
	const declarations = assertOptionalParameterIr(ir);
	const adapterBytes = await readFile(join(bundleRoot, "locks/compiler-adapters.json"));
	const adapters = JSON.parse(adapterBytes);
	assert.equal(adapters.exports.length, declarations.length);
	assert.equal(adapters.privateAbi.exports.length, declarations.length);
	for(const declaration of declarations)
	{
		const item = adapters.exports.find(entry =>
			entry.bindingId === declaration.id);
		assert.ok(item, declaration.id);
		assert.equal(item.parameters.length, 1);
		assert.equal(item.parameters[0].name, "value0");
		const privateExport = adapters.privateAbi.exports.find(entry =>
			entry.bindingId === declaration.id);
		assert.ok(privateExport, declaration.id);
		assert.equal(privateExport.parameters.length, 1);
	}
	const leanBytes = await readFile(
		join(bundleRoot, "generated/LeanBridgeGenerated.lean"));
	const lean = leanBytes.toString("utf8");
	assert.equal((lean.match(/@\[export lean_bridge_[a-f0-9]+_lean\]/gu)
		?? []).length, declarations.length);
	assert.doesNotMatch(lean, /(?:sorry|unsafeCast|\baxiom\b)/u);
	return {
		bindingIrSha256: hashBindingIr(ir)
		, bindingIrFileSha256: sha256(irBytes)
		, compilerAdaptersSha256: sha256(adapterBytes)
		, generatedLeanSha256: sha256(leanBytes)
		, declarations: declarations.length
		, authenticatedDefaults: declarations.filter(declaration =>
			declaration.parameters[0].optional).length
	};
};
