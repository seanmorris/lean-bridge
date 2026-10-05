/**
 * Derive owned release evidence from verified compiler and package identities.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { compiledPackageMetadata } from "../analyze/package-metadata.mjs";

/**
 * Record source, dependency, compiler and ownership evidence without proof claims.
 * The caller must verify the compilation and retained notices first.
 *
 * @param options - Verified source and package records.
 * @param options.manifest - Canonical owned release manifest.
 * @param options.component - Verified ownership model and compilation receipt.
 * @param options.notices - Verified per-package source notice inventory.
 */
export const ownedJavaScriptReleaseEvidence = ({ manifest, component, notices }) => {
	const { receipt, model } = component, identity = sha256(canonicalJson(receipt));
	const source = receipt.sourceIdentity;
	const common = { schemaVersion: 1, profile: manifest.profile, component: model.component };
	const plan = { ...common, kind: "lean-bridge-owned-javascript-build-plan"
		, source: manifest.source, engineIdentitySha256: manifest.engineIdentitySha256
		, componentIdentitySha256: identity, modelSha256: receipt.modelSha256
		, bindingIrSha256: model.bindingIrSha256
		, runtimeIdentity: manifest.runtimeIdentity
		, configurationSha256: manifest.configurationSha256
		, packages: manifest.packages };
	const sbom = { ...common, kind: "lean-bridge-owned-javascript-sbom"
		, license: compiledPackageMetadata(source).license ?? "UNLICENSED"
		, sourceNoticesSha256: source.sourceNoticesSha256
		, libraries: notices.document.packages.map(pkg => ({ name: pkg.name
			, source: pkg.source, notices: pkg.notices }))
		, runtimeIdentity: manifest.runtimeIdentity, packages: manifest.packages
		, compiler: { leanCommit: receipt.pins.leanCommit
			, patchSetSha256: receipt.pins.patchSetSha256
			, license: "javascript-wasm/component/compiler/notices/lean.txt" } };
	const provenance = { ...common, kind: "lean-bridge-owned-javascript-provenance"
		, backend: manifest.backend
		, engineIdentitySha256: manifest.engineIdentitySha256
		, componentIdentitySha256: identity, source, compiler: receipt.compiler
		, pins: receipt.pins, targetHeaders: receipt.targetHeaders
		, wasmLibrary: receipt.wasmLibrary
		, ...(receipt.nativeCompilation ? { nativeCompilation: receipt.nativeCompilation } : {}) };
	const assurance = { ...common, kind: "lean-bridge-owned-javascript-compiler-assurance"
		, compilerMetadataSha256: receipt.metadataSha256
		, modelSha256: receipt.modelSha256
		, bindingIrSha256: model.bindingIrSha256
		, adaptersSha256: receipt.adaptersSha256, headerSha256: receipt.headerSha256
		, ownedGraph: receipt.ownedGraph
		, buildPlanSha256: sha256(canonicalJson(plan))
		, checks: { compilerOwnedTypes: true, regeneratedAdapters: true
			, sharedRuntimeImports: true, closedArtifacts: true }
		, algorithmProofClaim: false };
	return new Map([
		["javascript-wasm/locks/owned-build-plan.json", canonicalJson(plan)]
		, ["javascript-wasm/sbom.json", canonicalJson(sbom)]
		, ["javascript-wasm/provenance.json", canonicalJson(provenance)]
		, ["javascript-wasm/assurance.json", canonicalJson(assurance)]
	]);
};
