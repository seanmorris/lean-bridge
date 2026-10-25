/**
 * Shared byte and browser identity checks for retained owned npm packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { canonicalizeJsonValue } from "../../src/binding-ir/canonical.mjs";
import { validateOwnedAggregateBindingIr } from "../../src/binding-ir/contract.mjs";
import { readClosedPackageTarGz } from "./closed-package-tar.mjs";

const digest = /^[0-9a-f]{64}$/u;
const engines = Object.freeze(["chromium", "firefox", "webkit"]);
const browserProfiles = Object.freeze(["page", "react", "worker"]);

/**
 * Require each browser/profile/variant once and bind the installed Wasm assets.
 *
 * @param browser - Original browser observations.
 * @param options - Exact acceptance contract, never inferred from the report.
 * @param options.checks - Required consumer assertion count.
 * @param options.assets - Retained component and runtime Wasm digests.
 * @param options.version - Historical nine-cell or complete twelve-cell contract.
 */
export const verifyOwnedJavaScriptBrowserEvidence = (browser, { checks, assets, version }) => {
	assert.ok([1, 2].includes(version));
	assert.ok(Number.isSafeInteger(checks) && checks > 0);
	assert.deepEqual(Object.keys(browser).toSorted()
		, ["executions", "externalNetworkBlocked", "installedSourcesRemoved"]);
	assert.equal(browser.externalNetworkBlocked, true);
	assert.equal(browser.installedSourcesRemoved, true);
	const expectedCells = engines.flatMap(engine => version === 1
		? browserProfiles.map(profile => `${engine}/${profile}`)
		: [...browserProfiles.map(profile => `${engine}/${profile}/production`)
			, `${engine}/react/strict`]);
	assert.equal(browser.executions.length, expectedCells.length);
	const cells = [];
	for(const execution of browser.executions)
	{
		assert.deepEqual(Object.keys(execution).toSorted()
			, ["assets", "checks", "engine", "profile", "reruns"
				, ...version === 2 ? ["variant"] : [], "version"]);
		assert.ok(engines.includes(execution.engine), execution.engine);
		assert.ok(browserProfiles.includes(execution.profile), execution.profile);
		assert.equal(typeof execution.version, "string");
		assert.ok(execution.version.length > 0);
		assert.equal(execution.reruns, 2);
		assert.equal(execution.checks, checks);
		assert.ok(Array.isArray(execution.assets) && execution.assets.length === 2);
		for(const asset of execution.assets) assert.match(asset, digest);
		assert.deepEqual(execution.assets.toSorted(), assets.toSorted()
			, "Browser assets must be the retained component and runtime Wasm");
		cells.push(`${execution.engine}/${execution.profile}`
			+ (version === 2 ? `/${execution.variant}` : ""));
	}
	assert.deepEqual(cells.toSorted(), expectedCells.toSorted()
		, "Browser cells must include every required profile and React variant");
	return cells.length;
};


/**
 * Bind the installed npm archives to their compiled model, source and Wasm.
 *
 * @param entry - Report identities and ordinary/reviewed author route.
 * @param receipt - Independently verified package-set receipt.
 * @param root - Exact retained handoff directory.
 */
export const verifyOwnedJavaScriptPackageIdentity = async (entry, receipt, root) => {
	const component = receipt.packages.find(pkg => pkg.role === "component");
	const runtime = receipt.packages.find(pkg => pkg.role === "runtime");
	const archive = async pkg => {
		const artifact = pkg.artifacts[0];
		const bytes = await readFile(join(root, artifact.path));
		assert.equal(bytes.length, artifact.bytes, "Retained archive size");
		assert.equal(sha256(bytes), artifact.sha256, "Retained archive identity");
		return readClosedPackageTarGz(bytes, { root: "package"
			, maxInput: 64 * 1024 ** 2, maxBytes: 64 * 1024 ** 2 });
	};
	const files = await archive(component), runtimeFiles = await archive(runtime);
	const member = (members, path) => {
		const bytes = members.get(path);
		assert.ok(Buffer.isBuffer(bytes), "Missing retained package member: " + path);
		return bytes;
	};
	const json = (members, path) => {
		const bytes = member(members, path), value = JSON.parse(bytes);
		assert.equal(bytes.toString("utf8"), canonicalJson(value)
			, "Retained metadata must be canonical: " + path);
		return value;
	};
	const compilerPath = "metadata/compiler/javascript-wasm-component.json";
	const compiler = json(files, compilerPath);
	assert.equal(sha256(member(files, compilerPath)), entry.componentIdentity
		, "Compiled component identity");
	assert.equal(compiler.schemaVersion, 1);
	assert.equal(compiler.profile, "javascript-wasm-owned-v1");
	assert.equal(compiler.pointerBits, 32);
	assert.deepEqual(entry.sourceIdentity, compiler.sourceIdentity
		, "Report source identity must match retained compiler metadata");
	assert.match(entry.sourceIdentity.sourceTreeSha256, digest);
	assert.equal(receipt.source.treeSha256, entry.sourceIdentity.sourceTreeSha256
		, "Package-set source tree");
	assert.equal(Boolean(entry.sourceIdentity.reviewedBindingIr)
		, entry.authorRoute === "reviewed", "Compiled author route");
	assert.equal(compiler.bindingIrSha256, entry.bindingIrSha256
		, "Compiled binding IR identity");
	const model = json(files, "metadata/compiler/model.json");
	assert.equal(sha256(member(files, "metadata/compiler/model.json"))
		, compiler.modelSha256, "Compiled model identity");
	assert.deepEqual(model.component, receipt.component, "Compiled component coordinate");
	assert.deepEqual(model.sourceIdentity, entry.sourceIdentity, "Compiled model source");
	assert.equal(model.bindingIrSha256, entry.bindingIrSha256);
	const bindingIr = json(files, "metadata/compiler/binding-ir.json");
	validateOwnedAggregateBindingIr(bindingIr);
	assert.deepEqual(model.bindingIr, bindingIr, "Compiled model binding IR");
	assert.equal(sha256(canonicalizeJsonValue(bindingIr))
		, entry.bindingIrSha256, "Retained binding IR identity");
	assert.deepEqual(receipt.profiles, [{ id: "javascript-wasm-owned-v1"
		, bindingIrSha256: entry.bindingIrSha256
		, runtimeIdentity: runtime.runtimeIdentity }], "Installed package profile");
	const metadata = json(files, "package.json");
	assert.equal(metadata.name, component.name);
	assert.equal(metadata.version, component.version);
	assert.deepEqual(metadata.leanBridge, {
		component: receipt.component.id, profile: "javascript-wasm-owned-v1"
		, bindingIrSha256: entry.bindingIrSha256
		, componentIdentitySha256: entry.componentIdentity
		, runtimeIdentity: runtime.runtimeIdentity, sharedRuntime: true
	}, "Installed component metadata");
	const runtimeMetadata = json(runtimeFiles, "package.json");
	assert.equal(runtimeMetadata.name, runtime.name);
	assert.equal(runtimeMetadata.version, runtime.version);
	assert.equal(runtimeMetadata.leanBridge.runtimeIdentity, runtime.runtimeIdentity);
	assert.equal(runtimeMetadata.leanBridge.sharedRuntime, true);
	assert.equal(runtimeMetadata.leanBridge.profile, "side-lazy");
	assert.equal(compiler.library, "lib/component.so.wasm");
	const side = member(files, "internal/component.so.wasm");
	assert.deepEqual(side, member(files, "metadata/compiler/lib/component.so.wasm")
		, "Installed Wasm must be the retained compiled binary");
	assert.deepEqual(compiler.wasmLibrary, entry.wasm, "Compiled Wasm identity");
	assert.deepEqual(entry.wasm, { bytes: side.length, sha256: sha256(side) }
		, "Installed Wasm identity");
	return { assets: [entry.wasm.sha256, sha256(member(runtimeFiles, "internal/main.wasm"))]
		, bindingIr };
};
