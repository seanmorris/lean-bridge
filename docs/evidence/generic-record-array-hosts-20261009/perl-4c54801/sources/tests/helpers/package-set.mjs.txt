/**
 * Receipt-only synthetic fixtures and relocation checks for real release sets.
 *
 * @file
 */
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { packageSetReceiptName, verifyPackageSetReceipt, writePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Create metadata and inert bytes for every ecosystem, without claiming execution.
 *
 * @param t - Test cleanup owner.
 */
export const createPackageSetHandoff = async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-package-set-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const profiles = ["component-scalars-v1", "native-library-v1", "php-wasm-copied-v1"].map((id, index) => ({ id, bindingIrSha256: String(index + 1).repeat(64), runtimeIdentity: String(index + 4).repeat(64) }));
	const packages = [];
	const add = async (target, ecosystem, name, abi, role = "component", requires = [], count = 1) => {
		const artifacts = [];
		for(let index = 0; index < count; index++)
		{
			const path = `archives/${target}/${name.replaceAll(/[^A-Za-z0-9_-]/g, "-")}-${index}.fixture`;
			const bytes = Buffer.from(`Inert receipt-test bytes, not an installable package: ${path}\n`);
			await saveLakeFile(root, path, bytes);
			artifacts.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
		}
		const value = { target, ecosystem, name, version: "1.0.0"
			, profile: abi.id, role, runtimeIdentity: abi.runtimeIdentity
			, runtimeDelivery: role === "runtime" ? "provided" : requires.length ? "dependency" : "embedded"
			, requires, artifacts };
		packages.push(value); return { ecosystem, name, version: value.version };
	};
	const npm = await add("npm", "npm", "@lean-bridge/runtime", profiles[0], "runtime");
	await add("npm", "npm", "@example/willow", profiles[0], "component", [npm]);
	const cpan = await add("cpan", "cpan", "LeanBridge-Runtime", profiles[1], "runtime");
	await add("cpan", "cpan", "LeanBridge-Willow", profiles[1], "component", [cpan]);
	for(const target of ["c", "cpp", "nuget", "maven", "rubygems", "wit-wasi", "pypi", "cargo", "php-native"])
		await add(target, target === "php-native" ? "composer" : target, target === "php-native" ? "example/willow-native" : "willow", profiles[1], "component", [], target === "maven" ? 2 : 1);
	const wasmRuntime = await add("php-wasm", "npm", "@lean-bridge/php-wasm-copied-runtime", profiles[2], "runtime");
	const wasmComponent = await add("php-wasm", "npm", "@example/willow-php-wasm", profiles[2], "component", [wasmRuntime]);
	await add("php-wasm", "composer", "example/willow-php-wasm", profiles[2], "api", [wasmRuntime, wasmComponent]);
	const receipt = await writePackageSetReceipt({ root, component: { id: "willow@2.0.0", name: "willow", version: "2.0.0" }, source: { treeSha256: "9".repeat(64) }, profiles, packages });
	return { root, receipt, receiptPath: join(root, packageSetReceiptName) };
};

/**
 * Copy only the receipt, hash sidecar and named archives into a clean handoff.
 *
 * @param source - Release root containing its package-set receipt.
 * @param destination - New consumer handoff directory.
 */
export const copyPackageSetHandoff = async (source, destination) => {
	const receipt = JSON.parse(await readFile(join(source, packageSetReceiptName), "utf8"));
	for(const path of [packageSetReceiptName, `${packageSetReceiptName}.sha256`, ...receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => artifact.path))])
	{
		await mkdir(dirname(join(destination, path)), { recursive: true });
		await copyFile(join(source, path), join(destination, path));
	}
	return receipt;
};

/**
 * Verify a real prepared release without its staging, unpacked files or sources.
 *
 * @param t - Test cleanup owner.
 * @param source - Real compiled release root.
 * @param executable - Optional installed CLI entry point.
 */
export const assertRelocatedPackageSet = async (t, source, executable = resolve("scripts/lean-bridge.mjs")) => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-verify-relocated-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const expected = await copyPackageSetHandoff(source, directory);
	const receiptPath = join(directory, packageSetReceiptName);
	assert.equal(await readFile(receiptPath, "utf8"), canonicalJson(expected));
	const verified = await verifyPackageSetReceipt({ receiptPath });
	const result = await processBuildRunner.capture({ command: process.execPath, args: [executable, "verify", "--receipt", receiptPath, "--json"], cwd: directory, env: { PATH: "/unavailable", LEAN_BRIDGE_PROJECT: "/unavailable", LEAN_BRIDGE_RUNTIME_ROOT: "/unavailable" } });
	assert.deepEqual(JSON.parse(result.stdout).result, { ...verified, verificationType: "local-package-set", authenticated: false });
	t.diagnostic(`relocated Node-only receipt: ${verified.packages.length} packages, ${verified.archives} archives, ${verified.profiles.length} ABI profiles`);
	return expected;
};
