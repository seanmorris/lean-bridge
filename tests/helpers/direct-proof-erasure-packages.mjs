/**
 * Shared author inputs and bundle controls for the direct proof-erasure package matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import {
	assertDirectProofErasureIr
	, directProofErasureExport
	, directProofErasureFixture
	, directProofErasureModule
	, directProofErasureProofs
	, directProofErasureReview
	, directProofErasureTargets
} from "./direct-proof-erasure-fixture.mjs";

/**
 * Collapse consumer profiles that share one package target without allowing
 * their package coordinates to disagree.
 *
 * @param profiles - Consumer profiles selected for one canonical build.
 */
export const directProofErasureTargetConfiguration = profiles => {
	if(!Array.isArray(profiles) || !profiles.length
		|| profiles.some(profile => typeof profile !== "string"))
		throw new TypeError("Direct proof-erasure profiles must be a non-empty string array");
	if(new Set(profiles).size !== profiles.length)
		throw new TypeError("Direct proof-erasure profiles must be unique");
	const targets = {};
	for(const profile of profiles)
	{
		const selected = directProofErasureTargets[profile];
		if(!selected) throw new TypeError(`Unknown direct proof-erasure profile: ${profile}`);
		const [target, coordinate] = selected;
		if(Object.hasOwn(targets, target)
			&& canonicalJson(targets[target]) !== canonicalJson(coordinate))
			throw new TypeError(`Conflicting direct proof-erasure ${target} coordinates`);
		targets[target] = structuredClone(coordinate);
	}
	return targets;
};

/**
 * Copy the immutable fixture and materialize one ordinary or reviewed author root.
 *
 * @param t - Node test context that owns cleanup.
 * @param root0 - Route and selected consumer profiles.
 * @param root0.route - Ordinary source analysis or independent reviewed Binding IR.
 * @param root0.profiles - Consumer profiles whose package targets are prepared.
 */
export const prepareDirectProofErasureProject = async (t, { route, profiles }) => {
	if(!["ordinary", "reviewed"].includes(route))
		throw new TypeError(`Unknown direct proof-erasure route: ${route}`);
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-direct-proof-erasure-"));
	t?.after(() => rm(directory, { recursive: true, force: true }));
	const projectRoot = join(directory, "project");
	await cp(directProofErasureFixture, projectRoot, { recursive: true });
	const configuration = {
		schemaVersion: 1
		, modules: [directProofErasureModule]
		, ...route === "ordinary" ? { exports: [directProofErasureExport] } : {}
		, targets: directProofErasureTargetConfiguration(profiles)
	};
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
	const review = route === "reviewed" ? directProofErasureReview() : null;
	if(review) await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(review));
	return { directory, projectRoot, configuration, review, route, profiles: [...profiles] };
};

/**
 * Prove a canonical bundle retained two source proofs while exposing exactly
 * one UInt32 runtime parameter and reconstructing both witnesses in Lean.
 *
 * @param bundleRoot - Canonical bundle directory.
 */
export const assertDirectProofErasureBundle = async bundleRoot => {
	const irBytes = await readFile(join(bundleRoot, "binding/binding-ir.json"));
	const ir = JSON.parse(irBytes);
	assertDirectProofErasureIr(ir);
	const adapterBytes = await readFile(join(bundleRoot, "locks/compiler-adapters.json"));
	const adapters = JSON.parse(adapterBytes);
	assert.equal(adapters.exports.length, 1);
	const item = adapters.exports[0];
	assert.equal(item.bindingId, `lean:${directProofErasureExport}`);
	assert.equal(item.sourceDeclaration, directProofErasureExport);
	assert.deepEqual(item.parameters, [{ name: "value", leanType: "_root_.UInt32" }]);
	assert.equal(item.leanResultType, "_root_.UInt32");
	assert.deepEqual(item.erasedProofs, directProofErasureProofs);
	assert.equal(adapters.privateAbi.exports.length, 1);
	assert.equal(adapters.privateAbi.exports[0].parameters.length, 1);
	const leanBytes = await readFile(join(bundleRoot, "generated/LeanBridgeGenerated.lean"));
	const lean = leanBytes.toString("utf8");
	const escapedWrapper = item.wrapper.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
	assert.match(lean, new RegExp(`def ${escapedWrapper} \\(value : _root_\\.UInt32\\) : _root_\\.UInt32 :=`, "u"));
	assert.match(lean, /_root_\.DirectProofErasure\.keep _root_\.True\.intro value _root_\.True\.intro/u);
	assert.doesNotMatch(lean, /(?:sorry|unsafeCast|\baxiom\b)/u);
	return {
		bindingIrSha256: hashBindingIr(ir)
		, bindingIrFileSha256: sha256(irBytes)
		, compilerAdaptersSha256: sha256(adapterBytes)
		, generatedLeanSha256: sha256(leanBytes)
		, runtimeParameters: item.parameters.length
		, erasedProofs: item.erasedProofs.length
	};
};
