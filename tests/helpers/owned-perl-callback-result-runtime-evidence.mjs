/**
 * Bind direct Perl callback observations to authored Lean and generated sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createCompiledNativeModel } from "../../src/build/native-graph-model.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedPerlXs } from "../../src/backends/perl/owned-xs.mjs";
import { ownedPerlBorrowInstrumentedSources } from "./owned-perl-borrow-evidence.mjs";
import { assertOwnedPerlReceiverMatrix, ownedPerlReceiverVariant } from "./owned-perl-receiver-evidence.mjs";
import { ownedDotnetCallbackResultConfiguration, ownedDotnetCallbackResultReviewedIr
	, ownedDotnetCallbackResultSource, ownedDotnetCallbackResultCombinedConfiguration
	, ownedDotnetCallbackResultCombinedReviewedIr, ownedDotnetCallbackResultCombinedSource } from "./owned-dotnet-callback-result-fixture.mjs";

const hash = value => sha256(canonicalJson(value));
const keys = (value, expected) => assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
export const ownedPerlCallbackRuntimeReports = Object.freeze(["ordinary", "reviewed"]
	.flatMap(mode => ["no-host", "host", "combined"].map(variant => `${mode}-${variant}.json`)));

// Observed compiler output identities, independently pinned from the original
// executions. Source reconstruction below does not claim to rerun the compiler.
const metadataHashes = {
	ordinary: ["920079df0971ebdb4d68beffb9741e01c33c27ca224d9b384d55955b8a7b751d", "5d2d9563230b2e0ac3a9b7c21ecdd55c0032041103cfd3af77e4f5f4d1428821"]
	, reviewed: ["df4862e16d7c77318be1928c3634adea5f5214f43126626ddfa0590321f9f8d7", "444534c11087d9a5c1b0b85ffdfa19861ba285eb0a256c1aa61b513ece6c5ac3"]
};
const identityHashes = {
	ordinary: ["bcbe1b731415c26f0d4e6a1580cd88140de90f2b70b9c165115f69458d4bb978", "12132fe4c4adc825ad52ad4ac9ac0e8f975ede18581bb2ec9fea486cb6eadd75"]
	, reviewed: ["0401bc748535ff5512f3b94c4b7277409a6da9a716337664456105bb11a62fd9", "86626697eefbc6044987086a060a7ac70557fdfb917013d162f50a626e722239"]
};

/**
 * Reconstruct one exact source/capability configuration without execution claims.
 *
 * @param mode - Independently required author source path.
 * @param variant - Independently required capability combination.
 * @param item - Original inputs, options and generated-source hashes.
 */
export const assertOwnedPerlCallbackSources = async (mode, variant, item) => {
	assert.ok(["ordinary", "reviewed"].includes(mode));
	assert.ok(["no-host", "host", "combined"].includes(variant));
	const combined = variant === "combined", hostCallbacks = variant !== "no-host";
	const options = { hostCallbacks, callbackResultAnchors: true
		, transferredInputs: combined
		, anchoredResults: combined
		, receiverExports: combined };
	assert.deepEqual(item.options, options);
	const { metadata, sourceIdentity: identity, component, ...extra } = item.input;
	assert.deepEqual(extra, {});
	assert.deepEqual(component, { id: "owned-aggregates@1.0.0", name: "owned-aggregates", version: "1.0.0" });
	assert.equal(hash(metadata), metadataHashes[mode][Number(combined)]);
	assert.equal(hash(identity), identityHashes[mode][Number(combined)]);
	assert.equal(identity.leanVersion, "4.32.2");
	assert.equal(identity.leanCommit, "f3b06c705e6c85f5314019d5d3baab0fec5b580c");
	assert.equal(identity.leanCompilerSha256, "e8baaa71855a616dc351028f3ad2200051b0671f423a1696a100e809302d5550");
	assert.equal(identity.extractorSha256, sha256(await readFile("src/analyze/NativeExports.lean")));
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8")
		+ (combined ? ownedDotnetCallbackResultCombinedSource : ownedDotnetCallbackResultSource);
	assert.equal(identity.sourceTreeSha256, sha256(lean));
	assert.equal(identity.modules.length, 1); assert.equal(identity.modules[0].module, "Owned");
	assert.deepEqual(identity.modules[0].source, { path: "Owned.lean", sha256: sha256(lean) });
	const configuration = mode === "ordinary"
		? await (combined ? ownedDotnetCallbackResultCombinedConfiguration : ownedDotnetCallbackResultConfiguration)()
		: { schemaVersion: 1, modules: ["Owned"] };
	assert.equal(identity.exportConfigurationSource, canonicalJson(configuration));
	assert.equal(identity.exportConfigurationSha256, hash(configuration));
	assert.equal(Boolean(identity.reviewedBindingIr), mode === "reviewed");
	if(mode === "reviewed")
	{
		const reviewed = (combined ? ownedDotnetCallbackResultCombinedReviewedIr : ownedDotnetCallbackResultReviewedIr)();
		assert.equal(identity.reviewedBindingIr.source, canonicalJson(reviewed));
		assert.equal(identity.reviewedBindingIr.sourceSha256, hash(reviewed));
	}
	const model = createCompiledNativeModel(item.input, { ownedGraphs: true
		, ownedHostCallbacks: hostCallbacks, ownedCallbackResultAnchors: true
		, ownedInputTransfers: combined
		, ownedAnchoredResults: combined
		, ownedReceiverExports: combined });
	assert.equal(model.schemaVersion, 11); assert.equal(model.ownedGraph.schemaVersion, 6);
	const c = generateOwnedCPackage({ ...item.input, ...options, valueCopies: true });
	const xs = generateOwnedPerlXs(model.bindingIr, "LeanBridge::OwnedProbe", options);
	assert.equal(xs.c.callbacks.filter(callback => callback.anchor !== undefined).length, 4);
	assert.equal(xs.functions.filter(fn => fn.receiver === 0).length, combined ? 5 : 0);
	assert.equal(xs.functions.filter(fn => fn.transfers?.length).length, combined ? 2 : 0);
	const sources = await ownedPerlBorrowInstrumentedSources(c, xs, combined);
	assert.equal(item.nativeSourceSha256, sha256(sources.native));
	assert.equal(item.declarationsSha256, sha256(xs.declarations));
	assert.equal(item.valuesSha256, sha256(xs.valuesSource));
	assert.equal(item.xsSha256, sha256(sources.xs));
	return { model, c, xs, sources };
};

/**
 * Check one direct-runtime report against its sources and original process output.
 *
 * @param name - Required report basename, independent of its supplied labels.
 * @param item - Original unmodified direct-runtime report.
 */
export const assertOwnedPerlCallbackRuntime = async (name, item) => {
	assert.ok(ownedPerlCallbackRuntimeReports.includes(name), name);
	const fields = [
		"schemaVersion", "kind", "mode", "variant", "actualLean", "installedPackage"
		, "options", "input", "nativeSourceSha256", "declarationsSha256"
		, "valuesSha256", "xsSha256", "probe", "probeSha256", "observations"
	];
	keys(item, fields);
	const [, mode, variant] = /^(ordinary|reviewed)-(no-host|host|combined)\.json$/u.exec(name);
	const combined = variant === "combined", hostCallbacks = variant !== "no-host";
	assert.equal(item.schemaVersion, 1);
	assert.equal(item.kind, "owned-perl-callback-results-runtime");
	assert.equal(item.mode, mode); assert.equal(item.variant, variant);
	assert.equal(item.actualLean, true); assert.equal(item.installedPackage, false);
	await assertOwnedPerlCallbackSources(mode, variant, item);
	const probe = await readFile("tests/fixtures/structured-types/owned-perl-callback-results.pl", "utf8");
	assert.equal(item.probe, probe); assert.equal(item.probeSha256, sha256(probe));
	assertOwnedPerlReceiverMatrix(item.observations);
	const phases = { native: 37, ...hostCallbacks ? { host: 21 } : {}, ...combined ? { combined: 32 } : {} };
	for(const observation of item.observations)
	{
		keys(observation, ["perl", "execution", "observed"]);
		const { perl, execution, observed } = observation;
		const abi = ownedPerlReceiverVariant(perl);
		assert.deepEqual(execution, { code: 0, stderr: "", stdout: JSON.stringify(JSON.parse(canonicalJson(observed))) + "\n" });
		assert.deepEqual(JSON.parse(execution.stdout), observed);
		const expected = {
			actualLean: true, installedPackage: false, variant
			, checks: Object.values(phases).reduce((sum, count) => sum + count, 2)
			, phases, managedLive: 0, nativeLive: 0, identities: 0
			, owners: 0, active: 0, cleanupStatus: 0
			, perlVersion: "v" + abi.split("-")[0]
			, threaded: Number(!abi.endsWith("unthreaded"))
		};
		assert.deepEqual(observed, expected);
	}
};

/**
 * Require all six direct reports, with each pinned interpreter present once.
 *
 * @param reports - Entries keyed by independently required report basenames.
 */
export const assertOwnedPerlCallbackRuntimeMatrix = async reports => {
	assert.deepEqual(Object.keys(reports).sort(), [...ownedPerlCallbackRuntimeReports].sort());
	for(const name of ownedPerlCallbackRuntimeReports) await assertOwnedPerlCallbackRuntime(name, reports[name]);
};
