/**
 * Tests the standalone CLI archive, source boundary, and repository-free installations.
 *
 * @file
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash, generateKeyPairSync } from "node:crypto";
import { chmod, cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { buildCliNpmPackage } from "../src/release/cli-npm-package.mjs";
import { identifyBuildEngine } from "../src/build/engine-execution-request.mjs";
import { readBuilderManifest } from "../src/build/canonical-build.mjs";

const execute = (...args) => promisify(execFile)(...args).catch(error => {
	error.message += `\nstdout:\n${error.stdout ?? ""}\nstderr:\n${error.stderr ?? ""}`;
	throw error;
});
const fixture = resolve("tests/fixtures/onboarding/small");
const config = JSON.parse(await readFile("config/cli-package.v1.json", "utf8"));
const hash = value => createHash("sha256").update(value).digest("hex");

const entries = async root => {
	const files = [];
	const visit = async path => {
		for(const entry of await readdir(join(root, path), { withFileTypes: true }))
		{
			const child = path ? `${path}/${entry.name}` : entry.name;
			if(entry.isDirectory()) await visit(child);
			else files.push(child);
		}
	};
	await visit("");
	return files.sort();
};

const protect = async (root, readonly) => {
	await chmod(root, readonly ? 0o555 : 0o755);
	for(const entry of await readdir(root, { withFileTypes: true }))
	{
		const path = join(root, entry.name);
		if(entry.isDirectory()) await protect(path, readonly);
		else if(entry.isFile()) await chmod(path, readonly ? 0o555 : 0o644);
	}
};

test("the development package has the same explicit safe source allowlist", async () => {
	const development = JSON.parse(await readFile("package.json", "utf8"));
	assert.equal(development.private, true);
	assert.deepEqual(development.files, config.files);
	assert.deepEqual([...config.files].sort(), config.files);
	assert.equal(new Set(config.files).size, config.files.length);
	assert.ok(!config.files.some(path => /(^|\/)(?:\.env(?:\.|$)|\.npmrc$|node_modules\/)|^(?:demos|site|tests|build)\//.test(path)));
	const { stdout } = await execute("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"]);
	const packed = JSON.parse(stdout)[0].files.map(file => file.path).sort();
	assert.deepEqual(packed, [...config.files, "package.json", "README.md"].sort());
});

test("CLI archives are deterministic, dependency-free, and contain the complete pinned engine", async () => {
	const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-cli-package-"));
	try
	{
		const first = await buildCliNpmPackage({ outputRoot: join(scratch, "one") });
		const second = await buildCliNpmPackage({ outputRoot: join(scratch, "two") });
		assert.deepEqual(await readFile(first.archive), await readFile(second.archive));
		assert.deepEqual(first.report, second.report);
		assert.equal(first.report.runtimeIncluded, false);
		assert.equal(first.report.productionApproved, false);
		assert.equal(first.report.externalRegistryWrites, false);
		const manifest = JSON.parse(await readFile(join(first.directory, "package.json"), "utf8"));
		assert.equal(manifest.name, config.name);
		assert.equal(manifest.version, config.version);
		assert.equal(manifest.dependencies, undefined);
		assert.equal(manifest.devDependencies, undefined);
		assert.equal(manifest.scripts, undefined);
		assert.equal(manifest.publishConfig.tag, "next");
		assert.deepEqual(manifest.bin, { "lean-bridge": "scripts/lean-bridge.mjs", "lean-bridge-signing-policy": "scripts/create-publication-signer-policy.mjs" });
		assert.equal((await lstat(join(first.directory, manifest.bin["lean-bridge"]))).mode & 0o777, 0o755);
		const helper = join(first.directory, manifest.bin["lean-bridge-signing-policy"]);
		assert.equal((await lstat(helper)).mode & 0o777, 0o755);
		const { publicKey } = generateKeyPairSync("ed25519");
		const publicKeyPath = join(scratch, "public.pem");
		const policyPath = join(scratch, "policy.json");
		await writeFile(publicKeyPath, publicKey.export({ type: "spki", format: "pem" }));
		const policyResult = JSON.parse((await execute(helper, ["--identity", "test-author", "--public-key", publicKeyPath, "--output", policyPath])).stdout);
		assert.equal(JSON.parse(await readFile(policyPath, "utf8")).signers[0].keyId, policyResult.keyId);
		await assert.rejects(execute(helper, ["--identity", "test-author", "--public-key", publicKeyPath, "--output", policyPath]), /EEXIST/);
		assert.deepEqual(await entries(first.directory), [...config.files, "README.md", "package.json", "cli-package-inventory.json"].sort());
		for(const file of first.report.files)
		{
			const bytes = await readFile(join(first.directory, file.path));
			assert.equal(bytes.length, file.bytes, file.path);
			assert.equal(hash(bytes), file.sha256, file.path);
		}
		assert.deepEqual(await identifyBuildEngine(first.directory), await identifyBuildEngine(process.cwd()));
		assert.deepEqual((await readBuilderManifest(first.directory)).manifest, (await readBuilderManifest(process.cwd())).manifest);
		const packed = JSON.parse((await execute("npm", ["pack", "--dry-run", "--ignore-scripts", "--json"], { cwd: first.directory })).stdout)[0];
		assert.deepEqual(packed.files.map(file => file.path).sort(), await entries(first.directory));
		await assert.rejects(buildCliNpmPackage({ outputRoot: first.output }), { code: "EEXIST" });
		assert.deepEqual(await readFile(first.archive), await readFile(second.archive));
		await assert.rejects(buildCliNpmPackage({ outputRoot: process.cwd() }), { code: "unsafe-cli-package-output" });
	} finally
	{
		await rm(scratch, { recursive: true, force: true });
	}
});

test("source allowlists reject secrets, traversal, and symlinked inputs before writing an archive", async () => {
	const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-cli-boundary-"));
	try
	{
		const projectRoot = join(scratch, "project");
		await mkdir(join(projectRoot, "config"), { recursive: true });
		for(const path of [".env", ".env.local", ".npmrc", "../credential", "/etc/passwd", "src/../../credential", "src\\credential", "site/app/root.tsx"])
		{
			await writeFile(join(projectRoot, "config/cli-package.v1.json"), JSON.stringify({ ...config, files: [...config.files, path] }));
			await assert.rejects(buildCliNpmPackage({ projectRoot, outputRoot: join(scratch, "candidate") }), { code: "invalid-cli-package-path" });
		}
		const files = ["LICENSE", "scripts/lean-bridge.mjs", "scripts/create-publication-signer-policy.mjs", "flake.nix", "flake.lock", "poc/lean-link-spike/graph-lock.json"];
		await writeFile(join(projectRoot, "config/cli-package.v1.json"), JSON.stringify({ ...config, files }));
		await writeFile(join(scratch, "private-source"), "must not be packaged");
		await symlink(join(scratch, "private-source"), join(projectRoot, "LICENSE"));
		await assert.rejects(buildCliNpmPackage({ projectRoot, outputRoot: join(scratch, "candidate") }), { code: "unsafe-cli-package-source" });
		await rm(join(projectRoot, "LICENSE"));
		await writeFile(join(projectRoot, "LICENSE"), "license");
		await symlink(scratch, join(projectRoot, "scripts"));
		await assert.rejects(buildCliNpmPackage({ projectRoot, outputRoot: join(scratch, "candidate") }), { code: "unsafe-cli-package-source" });
		await assert.rejects(lstat(join(scratch, "candidate")), { code: "ENOENT" });
	} finally
	{
		await rm(scratch, { recursive: true, force: true });
	}
});

test("optional runtime packaging copies only the selected module and records its exact bytes", async () => {
	const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-cli-runtime-"));
	try
	{
		const runtimeRoot = join(scratch, "runtime");
		await mkdir(runtimeRoot);
		await writeFile(join(runtimeRoot, "main.mjs"), "export default () => {};\n");
		await writeFile(join(runtimeRoot, "main.wasm"), Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]));
		await writeFile(join(runtimeRoot, "not-for-release.txt"), "omit");
		const result = await buildCliNpmPackage({ outputRoot: join(scratch, "candidate"), runtimeRoot });
		assert.equal(result.report.runtimeIncluded, true);
		assert.deepEqual((await entries(result.directory)).filter(path => path.startsWith("runtime/")), ["runtime/wasm/main.mjs", "runtime/wasm/main.wasm"]);
		await writeFile(join(runtimeRoot, "main.wasm"), "invalid");
		await assert.rejects(buildCliNpmPackage({ outputRoot: join(scratch, "invalid"), runtimeRoot }), { code: "invalid-cli-runtime" });
		await assert.rejects(lstat(join(scratch, "invalid")), { code: "ENOENT" });
	} finally
	{
		await rm(scratch, { recursive: true, force: true });
	}
});

test("tarball installs work locally, globally, and through npm exec without the checkout or install scripts", async () => {
	const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-cli-install-"));
	let installed = null;
	try
	{
		await chmod(scratch, 0o755);
		const candidate = await buildCliNpmPackage({ outputRoot: join(scratch, "candidate") });
		const consumer = join(scratch, "consumer");
		const project = join(scratch, "plain-project");
		await mkdir(consumer);
		await writeFile(join(consumer, "package.json"), JSON.stringify({ name: "isolated-cli-consumer", version: "1.0.0", private: true }));
		await cp(fixture, project, { recursive: true });
		await writeFile(join(scratch, "npmrc"), "");
		await writeFile(join(scratch, "global-npmrc"), "");
		const environment = {
			PATH: process.env.PATH
			, NPM_CONFIG_CACHE: join(scratch, "cache")
			, NPM_CONFIG_USERCONFIG: join(scratch, "npmrc")
			, NPM_CONFIG_GLOBALCONFIG: join(scratch, "global-npmrc")
			, NPM_CONFIG_OFFLINE: "true"
		};
		const npmOptions = { cwd: consumer, env: environment };
		const installOptions = ["--offline", "--ignore-scripts", "--no-audit", "--no-fund"];
		await execute("npm", ["install", ...installOptions, candidate.archive], npmOptions);
		installed = join(consumer, "node_modules", config.name);
		assert.equal((await lstat(installed)).isSymbolicLink(), false);
		assert.equal((await readdir(join(consumer, "node_modules"))).filter(name => !name.startsWith(".")).length, 1);
		const executable = join(consumer, "node_modules/.bin/lean-bridge");
		assert.equal((await execute(executable, ["--version"], npmOptions)).stdout.trim(), config.version);
		assert.match((await execute(executable, ["--help"], npmOptions)).stdout, /analyze/);
		const globalPrefix = join(scratch, "global");
		await execute("npm", ["install", "--global", "--prefix", globalPrefix, ...installOptions, candidate.archive], npmOptions);
		assert.equal((await execute(join(globalPrefix, "bin/lean-bridge"), ["--version"], npmOptions)).stdout.trim(), config.version);
		const execConsumer = join(scratch, "exec-consumer");
		await mkdir(execConsumer);
		assert.equal((await execute("npm", ["exec", "--offline", "--ignore-scripts", "--yes", "--package", candidate.archive, "--", "lean-bridge", "--version"], { ...npmOptions, cwd: execConsumer })).stdout.trim(), config.version);
		await protect(installed, true);
		await chmod(consumer, 0o777);
		const unprivileged = process.getuid?.() === 0 ? { uid: 65534, gid: 65534 } : {};
		const options = { ...npmOptions, ...unprivileged };
		const analysis = JSON.parse((await execute(executable, ["analyze", "--project", project, "--target", "npm", "--check", "--output", join(consumer, "analysis"), "--json"], options)).stdout);
		assert.equal(analysis.status, "ok");
		assert.equal(analysis.result.project.name, "onboarding-small");
		await assert.rejects(execute(executable, ["--unknown", "--json"], options), error => error.code === 64 && JSON.parse(error.stdout).status === "failed");
		await assert.rejects(execute(executable, ["build", "--project", project, "--target", "npm", "--output", join(consumer, "build"), "--json"], {
			...options
			, env: { ...environment, LEAN_BRIDGE_DOCKER: join(scratch, "absent-docker"), LEAN_BRIDGE_NIX: join(scratch, "absent-nix") }
		}), error => error.code === 2 && JSON.parse(error.stdout).diagnostics.some(item => item.code === "build-tools-unavailable"));
		for(const file of candidate.report.files)
			assert.equal(hash(await readFile(join(installed, file.path))), file.sha256, file.path);
	} finally
	{
		if(installed) await protect(installed, false);
		await rm(scratch, { recursive: true, force: true });
	}
});
