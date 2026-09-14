/**
 * Binds ordinary component publications to their actual reproducible inventory.
 *
 * @file
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { componentNpmIdentity, parseNpmPackageCoordinate, verifyComponentPackageReceipt } from "./component-package-receipt.mjs";
import { assertExportConfigurationCapabilities, exportConfigurationFile } from "../analyze/export-configuration.mjs";
import { validateComponentReleaseBundleManifest } from "./component-release-bundle.mjs";
import { collectReleaseInventory, hashReleaseInventory } from "./reproducibility.mjs";
import { publicRepositoryIdentity } from "./source-identity.mjs";

const kind = "lean-bridge-component-publish-plan";
const fail = message => { throw Object.assign(new Error(message), { code: "invalid-component-publication" }); };
const equal = (actual, expected, message) => {
	if(canonicalJson(actual) !== canonicalJson(expected)) fail(message);
};
const defaultPublication = Object.freeze({ registry: "https://registry.npmjs.org/", tag: "next", access: "public", authMode: "token", signerPolicySha256: null });

const publicationOptions = options => {
	const value = options ?? defaultPublication;
	equal(Object.keys(value).sort(), Object.keys(defaultPublication).sort(), "Publication options must be closed");
	let url;
	try
	{ url = new URL(value.registry); } catch
	{ fail("Publication registry must be an absolute URL"); }
	if(url.href !== value.registry || url.username || url.password || url.search || url.hash
		|| !["http:", "https:"].includes(url.protocol)
		|| (url.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) fail("Unsafe publication registry");
	if(typeof value.tag !== "string" || !/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(value.tag) || !["public", "restricted"].includes(value.access)
		|| !["token", "oidc"].includes(value.authMode)
		|| (value.authMode === "oidc" && value.registry !== defaultPublication.registry)
		|| (value.signerPolicySha256 !== null && !/^[0-9a-f]{64}$/.test(value.signerPolicySha256))) fail("Invalid publication policy");
	return value;
};

const evidenceFor = async root => {
	const source = await readFile(join(root, "evidence/reproducibility.json"), "utf8");
	const report = JSON.parse(source);
	if(source !== canonicalJson(report) || report.kind !== "lean-bridge-component-reproducibility-report"
		|| report.schemaVersion !== 1 || report.result !== "passed" || report.failure !== null
		|| report.differences.length !== 0 || report.builds.length !== 2
		|| report.builds[0].name !== "A" || report.builds[1].name !== "B") fail("Two matching component builds are required");
	if(typeof report.source.projectPath !== "string" || !/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\).+$/.test(report.source.projectPath)
		|| publicRepositoryIdentity(report.source.repository) !== report.source.repository
		|| !/^[0-9a-f]{40,64}$/.test(report.source.revision) || !/^[0-9a-f]{40,64}$/.test(report.source.tree)) fail("Component source identity is invalid or contains private information");
	const inventory = await collectReleaseInventory(join(root, "release"));
	// Receipt handoffs are produced after publication and cannot enter candidate identity.
	for(const name of ["release-receipt.json", "release-receipt.sha256", "publication-signer-policy.json", "publication-signer-policy.sha256", "verify-release-archive.mjs"])
		inventory.delete(`packages/npm/${name}`);
	const artifacts = [...inventory].map(([path, item]) => ({ path, bytes: item.bytes.length, mode: item.mode, sha256: sha256(item.bytes) }))
		.sort((left, right) => left.path.localeCompare(right.path));
	equal(report.artifacts, artifacts, "Component artifact inventory has changed");
	const inventorySha256 = hashReleaseInventory(artifacts);
	const id = sha256(canonicalJson({ source: report.source, component: report.component, inventorySha256 }));
	equal(report.candidate, { id, inventorySha256 }, "Component candidate identity has changed");
	const receiptPath = "release/packages/npm/component-package-receipt.json";
	const checked = await verifyComponentPackageReceipt({ receiptPath: join(root, receiptPath) });
	const receipt = JSON.parse(await readFile(join(root, receiptPath), "utf8"));
	const bundleSource = inventory.get("bundle/component-release-bundle.json")?.bytes;
	const bundle = JSON.parse(bundleSource);
	validateComponentReleaseBundleManifest(bundle);
	if(bundleSource.toString() !== canonicalJson(bundle) || sha256(bundleSource) !== receipt.componentBundleSha256
		|| bundle.identitySha256 !== receipt.componentIdentitySha256 || bundle.bindingIrSemanticSha256 !== receipt.bindingIrSha256) fail("Bundle identities differ from the package receipt");
	equal(bundle.component, receipt.component, "Bundle and package name different components");
	const configBytes = inventory.get(`bundle/source/${exportConfigurationFile}`)?.bytes;
	const configuration = configBytes ? JSON.parse(configBytes) : { schemaVersion: 1 };
	assertExportConfigurationCapabilities(configuration, { target: "npm", fields: ["modules", "exports", "generators", "specializations", "contracts"], targetFields: ["name", "version"] });
	equal(receipt.package.package, componentNpmIdentity(bundle.component, configuration.targets?.npm).coordinate,
		"npm package coordinate differs from the bundled author configuration");
	equal(bundle.files.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })).sort((left, right) => left.path.localeCompare(right.path)),
		artifacts.filter(item => item.path.startsWith("bundle/") && item.path !== "bundle/component-release-bundle.json")
			.map(({ path, bytes, sha256 }) => ({ path: path.slice("bundle/".length), bytes, sha256 })),
		"Bundle inventory differs from the authorized files");
	for(const [path, expected] of [
		["metadata/provenance.json", receipt.provenanceSha256]
		, ["metadata/runtime-requirement.json", receipt.runtimeRequirementSha256]
		, ["metadata/component-artifact-manifest.json", bundle.componentArtifactManifestSha256]
		, [bundle.files.find(item => item.role === "component").path, receipt.componentArtifactSha256]
	])
		if(sha256(inventory.get(`bundle/${path}`).bytes) !== expected) fail("Package receipt differs from the bundled evidence");
	const buildPlan = JSON.parse(inventory.get("bundle/locks/component-build-plan.json").bytes);
	const sbom = JSON.parse(inventory.get("bundle/metadata/sbom.json").bytes);
	equal(sbom.component, bundle.component, "SBOM names a different component");
	equal(sbom.runtime, JSON.parse(inventory.get("bundle/metadata/runtime-requirement.json").bytes), "SBOM runtime differs from the bundle");
	if(sbom.kind !== "lean-bridge-component-sbom" || sbom.schemaVersion !== 1
		|| sbom.sourceTreeSha256 !== receipt.source.treeSha256 || buildPlan.source.treeSha256 !== receipt.source.treeSha256) fail("Component source evidence differs from the receipt");
	for(const notice of sbom.notices)
		if(!/^source\/(?:LICENSE|NOTICE|COPYING)(?:\.[A-Za-z0-9_-]+)?$/.test(notice.path)
			|| sha256(inventory.get(`bundle/${notice.path}`)?.bytes ?? "") !== notice.sha256) fail("Component notice differs from the SBOM");
	if(sbom.license === "UNLICENSED" || !sbom.license || !sbom.notices.some(item => /\/LICENSE(?:\.|$)/.test(item.path))) fail("Declare the component license in package.json and include its LICENSE file before publishing");
	for(const build of report.builds)
	{
		if(build.receiptSha256 !== checked.receiptSha256 || build.componentIdentitySha256 !== checked.componentIdentitySha256
			|| build.artifacts !== artifacts.length || !/^[0-9a-f]{64}$/.test(build.engineIdentitySha256)) fail("Build evidence does not identify the packaged component");
	}
	if(report.component !== checked.component || report.builds[0].engineIdentitySha256 !== report.builds[1].engineIdentitySha256) fail("Component build identities differ");
	const reportSha256 = sha256(source);
	const attestation = {
		_type: "https://in-toto.io/Statement/v1"
		, subject: artifacts.map(item => ({ name: `release/${item.path}`, digest: { sha256: item.sha256 } }))
		, predicateType: "urn:lean-bridge:component-reproducibility:v2"
		, predicate: { reportSha256, candidateId: id, source: report.source, builds: report.builds }
	};
	const authorization = {
		schemaVersion: 2, kind: "lean-bridge-component-authorization"
		, candidate: { id, sourceRevision: report.source.revision, source: report.source, component: report.component, artifactInventorySha256: inventorySha256 }
		, evidence: { reportPath: "evidence/reproducibility.json", reportSha256, attestationPath: "evidence/reproducibility.intoto.json", attestationSha256: sha256(canonicalJson(attestation)) }
		, authorizedArtifacts: artifacts
	};
	return { authorization, attestation, receipt, receiptPath, createdAt: report.createdAt };
};

const manifestFor = ({ authorization, receipt, receiptPath, createdAt }, options, requestedTargets) => {
	const publication = publicationOptions(options);
	const requested = [...new Set(requestedTargets)].sort();
	if(requested.some(value => !["npm", "javascript"].includes(value))) fail("Ordinary component publication currently targets npm");
	const artifact = path => {
		const item = authorization.authorizedArtifacts.find(entry => `release/${entry.path}` === path);
		if(!item) fail("Package artifact is absent from the authorized inventory");
		return { path, bytes: item.bytes, sha256: item.sha256 };
	};
	const target = {
		order: 1
		, candidateId: authorization.candidate.id
		, ecosystem: "npm"
		, name: parseNpmPackageCoordinate(receipt.package.package).name
		, version: parseNpmPackageCoordinate(receipt.package.package).version
		, target: "javascript"
		, operation: "publish"
		, destination: { kind: "registry", endpoint: publication.registry, tag: publication.tag, access: publication.access, authMode: publication.authMode }
		, coordinate: receipt.package.package, backendPlan: artifact(receiptPath)
		, archives: [{ kind: "tar-gzip", ...artifact(`release/packages/npm/${receipt.package.archive}`) }]
		, dependencies: [{ coordinate: receipt.runtime.package, sha256: receipt.runtime.sha256 }]
		, credentialEnvironment: publication.authMode === "oidc" ? ["ACTIONS_ID_TOKEN_REQUEST_TOKEN", "ACTIONS_ID_TOKEN_REQUEST_URL"] : ["NPM_TOKEN"]
	};
	return {
		schemaVersion: 2, kind, mode: "authorized-no-publish", createdAt
		, authorization: { path: "release-authorization.json", sha256: sha256(canonicalJson(authorization)), candidatePath: "release", candidateId: authorization.candidate.id }
		, selection: { allTargets: requested.length === 0, requested, plannedEcosystems: ["npm"] }
		, publication
		, targets: [{ ...target, idempotencyKey: sha256(canonicalJson(target)) }]
		, policy: { credentialsRead: false, externalRegistryWritesPerformed: false, immutableAuthorizedArtifacts: true, idempotentExecutionRequired: true }
	};
};

/**
 * Writes a component publication plan without reading credentials or private keys.
 *
 * @param root0 - Candidate location and public publication policy.
 * @param root0.gateRoot - Root containing the reproducibility report and release inventory.
 * @param root0.publication - Registry, authentication mode, and public signer-policy identity.
 * @param root0.requestedTargets - User-selected package targets.
 */
export const writeComponentPublication = async ({ gateRoot, publication = null, requestedTargets = [] }) => {
	const evidence = await evidenceFor(gateRoot);
	const manifest = manifestFor(evidence, publication, requestedTargets);
	const source = canonicalJson(manifest);
	await Promise.all([
		writeFile(join(gateRoot, "release-authorization.json"), canonicalJson(evidence.authorization), { flag: "wx" })
		, writeFile(join(gateRoot, "evidence/reproducibility.intoto.json"), canonicalJson(evidence.attestation), { flag: "wx" })
		, writeFile(join(gateRoot, "publish-manifest.json"), source, { flag: "wx" })
		, writeFile(join(gateRoot, "publish-manifest.sha256"), `${sha256(source)}  publish-manifest.json\n`, { flag: "wx" })
	]);
	return { manifest, manifestSha256: sha256(source) };
};

/**
 * Reconstructs a component plan from verified package bytes and build evidence.
 *
 * @param root0 - Manifest verification inputs.
 * @param root0.manifestPath - Canonical publication manifest path.
 * @param root0.manifest - Parsed, hash-checked version-two manifest.
 * @param root0.manifestSha256 - Identity of the canonical manifest bytes.
 * @param root0.requestedTargets - Optional execute-time selection constraint.
 */
export const verifyComponentPublication = async ({ manifestPath, manifest, manifestSha256, requestedTargets = [] }) => {
	if(manifest.kind !== kind || manifest.schemaVersion !== 2) fail("Recreate the component dry run with the current CLI");
	const root = dirname(resolve(manifestPath));
	const evidence = await evidenceFor(root);
	equal(manifest, manifestFor(evidence, manifest.publication, manifest.selection.requested), "Component publication plan differs from its evidence");
	if(requestedTargets.length) equal([...new Set(requestedTargets)].sort(), manifest.selection.requested, "Execute-time targets differ from the dry run");
	for(const [path, document] of [["release-authorization.json", evidence.authorization], ["evidence/reproducibility.intoto.json", evidence.attestation]])
	{
		if(await readFile(join(root, path), "utf8") !== canonicalJson(document)) fail("Component publication evidence has changed");
	}
	return Object.freeze({
		manifest, manifestPath: resolve(manifestPath), manifestSha256
		, authorization: { authorizationSha256: manifest.authorization.sha256, candidate: evidence.authorization.candidate }
		, authorizationDocument: evidence.authorization
		, authorizationRoot: root
		, candidateRoot: join(root, "release")
	});
};
