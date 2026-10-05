/**
 * Make small unsigned handoffs for verification tests without compiling Lean.
 *
 * @file
 */

import { createHash } from "node:crypto";
import { copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson } from "../../src/capsule/node.mjs";

const sha256 = value => createHash("sha256").update(value).digest("hex");

/**
 * A receipt verifies exact archive bytes without extracting or executing them.
 *
 * @param context - Node test context that owns the generated handoff.
 */
export const createLocalHandoff = async context => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-local-receipt-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const runtime = Buffer.from("runtime archive bytes\n");
	const component = Buffer.from("component archive bytes\n");
	const identity = "a".repeat(64);
	const receipt = {
		schemaVersion: 1, kind: "lean-bridge-component-package-receipt"
		, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" }
		, source: { treeSha256: identity }
		, bindingIrSha256: identity, provenanceSha256: identity
		, componentBundleSha256: identity, componentIdentitySha256: identity
		, componentArtifactSha256: identity, runtimeRequirementSha256: identity
		, runtime: { package: "@lean-bridge/runtime@1.0.0", archive: "runtime.tgz", sha256: sha256(runtime) }
		, package: { package: "sample@1.0.0", archive: "sample.tgz", sha256: sha256(component) }
		, policies: { componentCompiledOnce: true, runtimeShared: true, runtimeBinaryInComponent: false, nativeCallablesOnly: true }
		, verificationCommand: "node verify-component-package-receipt.mjs --receipt component-package-receipt.json"
	};
	const receiptPath = join(directory, "component-package-receipt.json");
	const runtimePath = join(directory, receipt.runtime.archive);
	const archivePath = join(directory, receipt.package.archive);
	const verifierPath = join(directory, "verify-component-package-receipt.mjs");
	await Promise.all([
		writeFile(receiptPath, canonicalJson(receipt))
		, writeFile(runtimePath, runtime), writeFile(archivePath, component)
		, copyFile(new URL("../../src/release/component-package-receipt.mjs", import.meta.url), verifierPath)
	]);
	return { directory, receipt, receiptPath, runtimePath, archivePath, verifierPath };
};
