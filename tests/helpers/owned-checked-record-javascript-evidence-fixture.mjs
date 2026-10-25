/**
 * Build inert but structurally faithful npm archives for evidence-verifier tests.
 * These bytes are never executed and never count as hosted acceptance.
 *
 * @file
 */
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { canonicalizeJsonValue } from "../../src/binding-ir/canonical.mjs";
import { ownedCheckedRecordJavaScriptReviewedIr } from "./owned-checked-record-javascript-fixture.mjs";
import { createDeterministicTarGzFromFiles } from "../../src/release/deterministic-archive.mjs";
import {
	packageSetReceiptName, readVerifiedPackageSetReceipt, writePackageSetReceipt
} from "../../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const digest = value => sha256(Buffer.from(value));
const archive = files => createDeterministicTarGzFromFiles({
	sourceDateEpoch: 1
	, files: Object.entries(files).map(([path, bytes]) => ({
		path: "package/" + path, bytes: Buffer.from(bytes), mode: 0o644
	}))
});

/**
 * Retain a synthetic route with object-valued source identity and bound archives.
 *
 * @param root - Synthetic packaging directory.
 * @param route - One ordinary/reviewed full/result-only route.
 * @param options - Optional inert compiler identities for another owned fixture.
 * @param options.bindingIr - Exact synthetic owned Binding IR.
 * @param options.component - Synthetic Lean package coordinate.
 * @param options.componentName - Synthetic npm component name.
 */
export const writeSyntheticOwnedCheckedRecordJavaScriptRoute = async (root, route, options = {}) => {
	const resultOnly = route.endsWith("result-only");
	const reviewed = route.startsWith("reviewed");
	const component = options.component ?? { id: "owned-checked-records@1.0.0"
		, name: "owned-checked-records", version: "1.0.0" };
	const sourceIdentity = { sourceTreeSha256: digest(route + "/source")
		, extractorSha256: digest(route + "/extractor")
		, leanCompilerSha256: digest(route + "/compiler")
		, leanVersion: "4.32.2", leanCommit: "1".repeat(40)
		, modules: [], request: { synthetic: true }
		, exportConfigurationSource: canonicalJson({ schemaVersion: 1 })
		, exportConfigurationSha256: sha256(canonicalJson({ schemaVersion: 1 }))
		, sourceNoticesSha256: digest(route + "/notices")
		, ...(reviewed ? { reviewedBindingIr: { synthetic: true } } : {}) };
	const bindingIr = options.bindingIr ?? ownedCheckedRecordJavaScriptReviewedIr({ resultOnly });
	const profile = { id: "javascript-wasm-owned-v1"
		, bindingIrSha256: sha256(canonicalizeJsonValue(bindingIr))
		, runtimeIdentity: digest(route + "/runtime") };
	const model = { component, bindingIr, bindingIrSha256: profile.bindingIrSha256
		, sourceIdentity };
	const side = Buffer.from("Inert component " + route);
	const main = Buffer.from("Inert runtime " + route);
	const wasm = { bytes: side.length, sha256: sha256(side) };
	const compiler = { schemaVersion: 1, profile: profile.id, pointerBits: 32
		, bindingIrSha256: profile.bindingIrSha256, sourceIdentity
		, modelSha256: sha256(canonicalJson(model))
		, library: "lib/component.so.wasm", wasmLibrary: wasm };
	const componentIdentity = sha256(canonicalJson(compiler));
	const runtimeName = "@lean-bridge/runtime", componentName = options.componentName ?? "@example/owned-records";
	const runtimeBytes = archive({
		"package.json": canonicalJson({ name: runtimeName, version: "1.0.0"
			, leanBridge: { runtimeIdentity: profile.runtimeIdentity
				, sharedRuntime: true, profile: "side-lazy" } })
		, "internal/main.wasm": main
	});
	const componentBytes = archive({
		"package.json": canonicalJson({ name: componentName, version: "1.0.0"
			, leanBridge: { component: component.id, profile: profile.id
				, bindingIrSha256: profile.bindingIrSha256
				, componentIdentitySha256: componentIdentity
				, runtimeIdentity: profile.runtimeIdentity, sharedRuntime: true } })
		, "metadata/compiler/javascript-wasm-component.json": canonicalJson(compiler)
		, "metadata/compiler/model.json": canonicalJson(model)
		, "metadata/compiler/binding-ir.json": canonicalJson(bindingIr)
		, "metadata/compiler/lib/component.so.wasm": side
		, "internal/component.so.wasm": side
	});
	const handoff = join(root, "evidence", route, "handoff");
	const runtimePath = `archives/npm/runtime-${route}.tgz`;
	const componentPath = `archives/npm/component-${route}.tgz`;
	await saveLakeFile(handoff, runtimePath, runtimeBytes);
	await saveLakeFile(handoff, componentPath, componentBytes);
	const pkg = (role, name, path, bytes) => ({
		target: "npm", ecosystem: "npm", name, version: "1.0.0"
		, profile: profile.id, role, runtimeIdentity: profile.runtimeIdentity
		, runtimeDelivery: role === "runtime" ? "provided" : "dependency"
		, requires: role === "runtime" ? [] : [{
			ecosystem: "npm", name: runtimeName, version: "1.0.0"
		}]
		, artifacts: [{ path, bytes: bytes.length, sha256: sha256(bytes) }]
	});
	const receipt = await writePackageSetReceipt({ root: handoff
		, component, source: { treeSha256: sourceIdentity.sourceTreeSha256 }
		, profiles: [profile]
		, packages: [
			pkg("component", componentName, componentPath, componentBytes)
			, pkg("runtime", runtimeName, runtimePath, runtimeBytes)
		]
	});
	const verified = await readVerifiedPackageSetReceipt({
		receiptPath: join(handoff, packageSetReceiptName)
	});
	const artifacts = receipt.packages.flatMap(item => item.artifacts);
	const files = [packageSetReceiptName, packageSetReceiptName + ".sha256"
		, ...artifacts.map(item => item.path)].toSorted();
	const executions = [];
	for(const engine of ["chromium", "firefox", "webkit"])
		for(const browserProfile of ["page", "react", "worker"])
			executions.push({ engine, profile: browserProfile, version: engine + "-1"
				, reruns: 2, checks: resultOnly ? 7 : 30
				, assets: [wasm.sha256, sha256(main)] });
	return { route, authorRoute: reviewed ? "reviewed" : "ordinary"
		, mode: resultOnly ? "result-only" : "full"
		, bindingIrSha256: profile.bindingIrSha256, componentIdentity, sourceIdentity
		, packageSetReceipt: receipt
		, archives: Object.fromEntries(receipt.packages.map(item =>
			[item.role, item.artifacts[0].sha256]))
		, observed: resultOnly ? { checks: 7, produced: true, fullApiOmitted: true
			, retained: true, disposed: true } : {
			checks: 30, claimRejected: true, bookingRejected: true
			, lateRejected: true, retainedRejected: true, transferRejected: true
			, callbackRejected: true, callbackThrown: true, closureRejected: true
			, transferred: true, callbackCalls: 1
			}
		, retainedPackageSet: { path: `evidence/${route}/handoff`
			, receiptSha256: verified.result.receiptSha256
			, archives: verified.result.archives
			, archiveBytes: artifacts.reduce((sum, item) => sum + item.bytes, 0), files }
		, installedNode: true, installedTypeScript: true
		, sourceRemovedBeforeInstall: true, relocatedInstallation: true
		, archiveReproduction: true
		, browser: { externalNetworkBlocked: true, installedSourcesRemoved: true
			, executions }
		, wasm };
};
