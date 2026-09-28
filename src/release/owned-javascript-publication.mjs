/**
 * Verify owned npm release bytes before reproducibility or signed publication.
 *
 * @file
 */
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { validateEngineExecutionRequest } from "../build/engine-execution-request.mjs";
import { nativeArtifactPaths } from "../build/native-artifacts.mjs";
import { javascriptWasmOwnedProfile as profile } from "../build/javascript-wasm-owned-model.mjs";
import { compiledPackageMetadata } from "../analyze/package-metadata.mjs";
import { assembleOwnedJavaScriptNpmPackages } from "./owned-javascript-npm-package.mjs";
import { readVerifiedPackageSetReceipt } from "./package-set-receipt.mjs";
import { isSourceLicense, readVerifiedSourceNotices } from "./source-notices.mjs";
import { collectReleaseInventory } from "./reproducibility.mjs";
import { ownedJavaScriptReleaseEvidence } from "./owned-javascript-release-evidence.mjs";

const fail = message => { throw Object.assign(new Error(message), { code: "invalid-component-publication" }); };
const equal = (actual, expected, message) => {
	if(canonicalJson(actual) !== canonicalJson(expected)) fail(message);
};
const hash = value => typeof value === "string" && /^[0-9a-f]{64}$(?![\s\S])/.test(value);
const handoffs = ["release-receipt.json", "release-receipt.sha256", "publication-signer-policy.json", "publication-signer-policy.sha256", "verify-release-archive.mjs"];

/**
 * Reconstruct generated packages and archives from compiler-authenticated data.
 * Package-set receipts alone establish consistency, not author authorization.
 *
 * @param options - Root containing the owned canonical build output.
 * @param options.root - Release directory, including component evidence and npm archives.
 * @param options.inventory - Optional already captured inventory, excluding signed handoffs.
 * @param options.signal - Optional cancellation signal.
 */
export const readVerifiedOwnedJavaScriptRelease = async ({ root, inventory = null, signal }) => {
	const actual = inventory ?? await collectReleaseInventory(root);
	const expected = new Map();
	const json = path => {
		const bytes = actual.get(path)?.bytes;
		if(!bytes) fail(`Missing owned release evidence: ${path}`);
		const document = JSON.parse(bytes);
		if(!bytes.equals(Buffer.from(canonicalJson(document)))) fail(`Noncanonical owned release evidence: ${path}`);
		return document;
	};
	const componentRoot = join(root, "javascript-wasm/component");
	const assembled = await assembleOwnedJavaScriptNpmPackages({ componentRoot
		, runtimeRoot: join(root, "packages/npm/runtime/package/internal"), signal });
	const { verified, runtime, files, packages } = assembled;
	const { model, receipt: compiler } = verified, source = compiler.sourceIdentity;
	const sourceRecord = { treeSha256: source.sourceTreeSha256 };
	const profiles = [{ id: profile, bindingIrSha256: model.bindingIrSha256, runtimeIdentity: runtime.runtimeIdentity }];
	const localReceipt = await readVerifiedPackageSetReceipt({ receiptPath: join(root, "packages/npm/package-set-receipt.json"), signal });
	const sortedPackages = [...packages].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
	const packageSet = { schemaVersion: 1, kind: "lean-bridge-package-set-receipt"
		, component: model.component, source: sourceRecord
		, profiles, packages: sortedPackages };
	equal(localReceipt.receipt, packageSet, "Owned npm package receipt differs from the compiled package bytes");
	const combined = await readVerifiedPackageSetReceipt({ receiptPath: join(root, "package-set-receipt.json"), signal });
	equal(combined.receipt, { ...packageSet, packages: sortedPackages.map(pkg => ({ ...pkg
		, artifacts: pkg.artifacts.map(item => ({ ...item, path: `packages/npm/${item.path}` })) })) }, "Owned root receipt differs from its npm package set");
	const manifest = json("javascript-wasm-release.json");
	if(!["pinned-author-sdk", "native-nix", "docker-nix"].includes(manifest.backend) || !hash(manifest.engineIdentitySha256))
		fail("Owned release must identify its compiler backend and engine");
	const isolated = manifest.backend !== "pinned-author-sdk";
	equal(manifest, { schemaVersion: 1, profile, backend: manifest.backend
		, engineIdentitySha256: manifest.engineIdentitySha256
		, component: model.component, bindingIrSha256: model.bindingIrSha256
		, runtimeIdentity: runtime.runtimeIdentity
		, configurationSha256: source.exportConfigurationSha256
		, source: { ...sourceRecord, lakeSnapshotSha256: source.lakeDependencies.snapshotSha256, toolchain: `leanprover/lean4:v${source.leanVersion}` }
		, ...(source.reviewedBindingIr ? { reviewedBindingIrSha256: source.reviewedBindingIr.semanticSha256 } : {})
		, ...(isolated ? { engineRequest: "javascript-wasm/engine-execution-request.json", engineReport: "javascript-wasm/engine-execution-report.json" } : {})
		, packageSet: "packages/npm/package-set-receipt.json"
		, packages: sortedPackages
	}, "Owned release manifest differs from its compiled source or packages");
	if(isolated)
	{
		const request = json(manifest.engineRequest);
		validateEngineExecutionRequest(request);
		if(request.schemaVersion !== 4 || request.engine.identitySha256 !== manifest.engineIdentitySha256
			|| request.component.id !== model.component.id || request.component.sourceTreeSha256 !== source.sourceTreeSha256)
			fail("Owned publication engine request differs from the compiled source");
		equal([...request.output.authorizedFiles].sort(), await nativeArtifactPaths(componentRoot), "Owned publication output differs from engine authorization");
		equal(json(manifest.engineReport), { schemaVersion: 1
			, kind: "lean-bridge-owned-javascript-execution"
			, backend: manifest.backend, component: model.component.id
			, requestSha256: sha256(canonicalJson(request))
			, engineIdentitySha256: manifest.engineIdentitySha256
			, inputClosureSha256: request.component.inputClosureSha256
			, componentReceiptSha256: verified.identity
			, bindingIrSha256: model.bindingIrSha256
			, sourceReadOnly: true, authorizedOutputsOnly: true
			, runtimeBinaryIncluded: false
		}, "Owned publication execution report differs from its request");
		for(const path of [manifest.engineRequest, manifest.engineReport]) expected.set(path, actual.get(path).bytes);
	}
	const metadata = compiledPackageMetadata(source);
	const notices = await readVerifiedSourceNotices(componentRoot, source);
	for(const [path, bytes] of ownedJavaScriptReleaseEvidence({ manifest, component: verified, notices }))
		expected.set(path, Buffer.from(bytes));
	if(!metadata.license || metadata.license === "UNLICENSED" || !notices.document.packages[0].notices.some(notice =>
		isSourceLicense(notice.path, metadata) && notices.files.get(notice.payload).toString("utf8").trim()))
		fail("Declare package.license and include nonempty source license terms before publishing owned npm packages");
	for(const path of await nativeArtifactPaths(componentRoot)) expected.set(`javascript-wasm/component/${path}`, actual.get(`javascript-wasm/component/${path}`).bytes);
	for(const [path, bytes] of files) expected.set(`packages/npm/component/package/${path}`, Buffer.from(bytes));
	for(const [path, bytes] of runtime.files) expected.set(`packages/npm/runtime/package/${path}`, Buffer.from(bytes));
	expected.set(`packages/npm/${assembled.componentName}`, assembled.componentArchive);
	expected.set(`packages/npm/${assembled.runtimeName}`, assembled.runtimeArchive);
	for(const path of ["javascript-wasm-release.json", "package-set-receipt.json"
		, "package-set-receipt.json.sha256", "packages/npm/package-set-receipt.json"
		, "packages/npm/package-set-receipt.json.sha256"])
		expected.set(path, actual.get(path).bytes);
	const paths = [...actual.keys()].filter(path => !handoffs.some(name => path === `packages/npm/${name}`)).sort();
	equal(paths, [...expected.keys()].sort(), "Owned release contains missing or unauthorized files");
	for(const [path, bytes] of expected)
	{
		const { mode } = actual.get(path);
		const linkedBinary = path === "javascript-wasm/component/lib/component.so.wasm";
		if(!actual.get(path).bytes.equals(bytes) || (mode !== 0o644 && !(linkedBinary && mode === 0o755)))
			fail(`Owned release differs from reconstructed package bytes: ${path}`);
	}
	const item = role => {
		const pkg = packages.find(pkg => pkg.role === role), artifact = pkg.artifacts[0];
		return { package: `${pkg.name}@${pkg.version}`, archive: artifact.path, sha256: artifact.sha256 };
	};
	const receipt = { component: model.component
		, componentIdentitySha256: verified.identity
		, source: sourceRecord, bindingIrSha256: model.bindingIrSha256
		, package: item("component"), runtime: item("runtime") };
	signal?.throwIfAborted();
	return { manifest, receipt
		, receiptPath: "packages/npm/package-set-receipt.json"
		, checked: { ...localReceipt.result, componentIdentitySha256: verified.identity }
		, inventory: new Map(paths.map(path => [path, actual.get(path)])) };
};
