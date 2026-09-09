#!/usr/bin/env node
/**
 * Runs the author and consumer workflow using an installed CLI tarball and its bundled runtime.
 *
 * @file
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash, generateKeyPairSync } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { createNpmCliRegistryClient } from "../src/release/npm-registry-adapter.mjs";
import { verifyPublishManifest } from "../src/release/publish-manifest.mjs";

const execute = promisify(execFile);
const options = new Map();
for(let index = 2; index < process.argv.length; index += 2)
{
	const key = process.argv[index];
	const value = process.argv[index + 1];
	if(!["--archive", "--candidate", "--output", "--backend", "--registry"].includes(key) || options.has(key) || !value || value.startsWith("--"))
		throw new Error("Usage: check-cli-package.mjs (--archive CLI_TARBALL | --candidate PACKAGE_DIRECTORY) --output NEW_DIRECTORY [--backend docker|nix]");
	options.set(key, value);
}
assert.ok(options.has("--archive") !== options.has("--candidate") && options.has("--output"), "Choose one --archive or --candidate, and supply --output");
const candidate = options.has("--candidate") ? resolve(options.get("--candidate")) : null;
const record = candidate === null ? null : JSON.parse(await readFile(join(candidate, "cli-package-report.json"), "utf8"));
if(record !== null)
{
	assert.equal(record.kind, "lean-bridge-cli-package");
	assert.equal(record.runtimeIncluded, true, "Author acceptance requires the prepared runtime");
	assert.equal(basename(record.archive.path), record.archive.path);
	assert.match(record.archive.path, /^[a-zA-Z0-9._-]+\.tgz$/);
}
const archive = candidate === null ? resolve(options.get("--archive")) : join(candidate, record.archive.path);
const output = resolve(options.get("--output"));
const backend = options.get("--backend") ?? "docker";
const registry = options.get("--registry");
if(registry) assert.ok(new URL(registry).protocol === "http:" && ["localhost", "127.0.0.1"].includes(new URL(registry).hostname), "Rehearsal registry must be loopback HTTP");
assert.ok(["docker", "nix"].includes(backend), "--backend must be docker or nix");
const archiveSha256 = createHash("sha256").update(await readFile(archive)).digest("hex");
if(record !== null) assert.equal(archiveSha256, record.archive.sha256, "CLI archive differs from its packaging report");
await mkdir(dirname(output), { recursive: true });
await mkdir(output);
const scratch = await mkdtemp(join(dirname(output), ".lean-bridge-installed-cli-"));
const project = join(scratch, "project");
const author = join(scratch, "author");
const consumer = join(scratch, "consumer");
const logs = [];
let passed = false;
const environment = {
	PATH: process.env.PATH
	, LANG: "C.UTF-8"
	, LEAN_BRIDGE_BUILD_BACKEND: backend
	, NPM_CONFIG_CACHE: join(scratch, "npm-cache")
	, NPM_CONFIG_USERCONFIG: join(scratch, "npmrc")
	, NPM_CONFIG_GLOBALCONFIG: join(scratch, "global-npmrc")
};
// Transport settings select the already-installed builder, never a checkout or runtime override.
for(const name of ["DOCKER_HOST", "DOCKER_CONTEXT", "DOCKER_CONFIG", "DOCKER_TLS_VERIFY", "DOCKER_CERT_PATH", "NIX_REMOTE", "SSL_CERT_FILE"])
	if(process.env[name]) environment[name] = process.env[name];

const run = async (name, command, args, cwd) => {
	process.stdout.write(`${name}\n`);
	try
	{
		const result = await execute(command, args, { cwd, env: environment, timeout: 30 * 60 * 1000, maxBuffer: 16 * 1024 * 1024 });
		logs.push({ name, stdout: result.stdout, stderr: result.stderr });
		return result;
	} catch(error)
	{
		logs.push({ name, stdout: error.stdout ?? "", stderr: error.stderr ?? "", exitCode: error.code });
		throw error;
	}
};

try
{
	await cp(resolve(import.meta.dirname, "../tests/fixtures/documentation/lean-author"), project, { recursive: true });
	await cp(resolve(import.meta.dirname, "../LICENSE"), join(project, "LICENSE"));
	await writeFile(join(project, "package.json"), JSON.stringify({ license: "MIT" }));
	await mkdir(author);
	await mkdir(consumer);
	await writeFile(join(scratch, "npmrc"), "");
	await writeFile(join(scratch, "global-npmrc"), "");
	for(const directory of [author, consumer])
		await writeFile(join(directory, "package.json"), JSON.stringify({ name: "cli-release-acceptance", version: "1.0.0", private: true }));
	let cliCoordinate = archive;
	if(registry)
	{
		const client = createNpmCliRegistryClient();
		const token = process.env.LEAN_BRIDGE_REHEARSAL_TOKEN;
		assert.ok(token, "Local registry token is required");
		cliCoordinate = `${record.package.name}@${record.package.version}`;
		await client.publish({ archivePath: archive, registry, token, coordinate: cliCoordinate, tag: "next", access: "public" });
		const { privateKey, publicKey } = generateKeyPairSync("ed25519");
		await writeFile(join(scratch, "public.pem"), publicKey.export({ type: "spki", format: "pem" }));
		await writeFile(join(project, "lean-bridge.cli.json"), JSON.stringify({
			schemaVersion: 2
			, publish: {
				npm: { registry, tag: "next", access: "public", authMode: "token" }
				, signing: { policyFile: "publication-signer-policy.json", keyFileEnvironment: "COMPONENT_SIGNING_KEY_FILE" }
			}
		}));
		const keyPath = join(scratch, "signer.pem");
		await writeFile(keyPath, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
		environment.NPM_TOKEN = token;
		environment.COMPONENT_SIGNING_KEY_FILE = keyPath;
	}
	await run("Install the CLI without lifecycle scripts", "npm", ["install", ...(registry ? ["--registry", registry] : ["--offline"]), "--ignore-scripts", "--no-audit", "--no-fund", cliCoordinate], author);
	const executable = join(author, "node_modules/.bin/lean-bridge");
	if(registry) await run("Create public signer policy through the installed helper", join(author, "node_modules/.bin/lean-bridge-signing-policy"), ["--identity", "https://example.invalid/component-author", "--public-key", join(scratch, "public.pem"), "--output", join(project, "publication-signer-policy.json")], project);
	const version = (await run("Check the installed CLI version", executable, ["--version"], author)).stdout.trim();
	const cli = (name, args) => run(name, executable, [...args, "--json", "--progress", "json"], project);
	await run("Initialize independent author source", "git", ["init", "--quiet"], project);
	await run("Stage the tutorial inputs", "git", ["add", "."], project);
	await run("Commit the exact source candidate", "git", ["-c", "user.name=CLI package acceptance", "-c", "user.email=cli-acceptance@example.invalid", "commit", "--quiet", "-m", "Add standalone author fixture"], project);
	await run("Set a credential-bearing test remote", "git", ["remote", "add", "origin", "https://author:FAKE_REMOTE_SECRET@example.invalid/component.git?token=FAKE_QUERY_SECRET"], project);
	const analyzed = JSON.parse((await cli("Analyze through the installed CLI", ["analyze", "--project", ".", "--target", "npm", "--check", "--output", "build/analysis"])).stdout);
	assert.equal(analyzed.status, "ok");
	await cli("Compile through the installed pinned engine", ["build", "--project", ".", "--target", "npm", "--output", "build/component"]);
	assert.equal((await run("Check author source remains clean", "git", ["status", "--porcelain=v1", "--untracked-files=all"], project)).stdout, "");
	const gate = join(output, "gate");
	const result = JSON.parse((await cli("Reproduce packages without a runtime path override", ["publish", "--project", ".", "--target", "npm", "--dry-run", "--output", gate])).stdout);
	assert.equal(result.status, "ok");
	const packages = join(gate, "release/packages/npm");
	const receiptPath = join(packages, "component-package-receipt.json");
	const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
	assert.doesNotMatch(await readFile(join(gate, "evidence/reproducibility.json"), "utf8"), /FAKE_REMOTE_SECRET|FAKE_QUERY_SECRET/);
	await run("Verify the generated handoff with its copied verifier", process.execPath, [join(packages, "verify-component-package-receipt.mjs"), "--receipt", receiptPath], consumer);
	if(registry)
	{
		await verifyPublishManifest({ manifestPath: join(gate, "publish-manifest.json") });
		await writeFile(join(project, ".npmrc"), "@lean-bridge:registry=http://127.0.0.1:1/\nregistry=http://127.0.0.1:1/\ntag=hostile\naccess=restricted\n");
		environment.npm_config_registry = "http://127.0.0.1:1/";
		try
		{
			await cli("Reject publication before the central runtime exists", ["publish", "--manifest", join(gate, "publish-manifest.json")]);
			assert.fail("Missing runtime must block publication");
		} catch(error)
		{
			assert.equal(JSON.parse(error.stdout).diagnostics[0].code, "registry-dependency-unavailable");
		}
		await createNpmCliRegistryClient().publish({ archivePath: join(packages, receipt.runtime.archive), registry, token: process.env.LEAN_BRIDGE_REHEARSAL_TOKEN, coordinate: receipt.runtime.package, tag: "next", access: "public" });
		const published = JSON.parse((await cli("Publish the signed component with hostile npm configuration", ["publish", "--manifest", join(gate, "publish-manifest.json")])).stdout);
		assert.equal(published.status, "ok");
		assert.equal(published.result.transaction.status, "complete");
		const resumed = JSON.parse((await cli("Resume without republishing the completed coordinate", ["publish", "--manifest", join(gate, "publish-manifest.json")])).stdout);
		assert.equal(resumed.status, "ok");
		await writeFile(join(output, "publication.json"), JSON.stringify(published.result, null, 2));
		delete environment.npm_config_registry;
	}
	await run("Install only the component in a separate consumer", "npm", ["install", ...(registry ? ["--registry", registry, receipt.package.package] : ["--offline", join(packages, receipt.runtime.archive), join(packages, receipt.package.archive)]), "--ignore-scripts", "--no-audit", "--no-fund"], consumer);
	const invocation = [
		'import { add, isEmpty } from "onboarding-small";'
		, 'console.log(JSON.stringify({ add: String(add(100n, 23n)), empty: isEmpty(""), nonempty: isEmpty("browser") }));'
	].join("\n");
	const calls = JSON.parse((await run("Call the generated public API", process.execPath, ["--input-type=module", "-e", invocation], consumer)).stdout);
	assert.deepEqual(calls, { add: "123", empty: true, nonempty: false });
	await writeFile(join(output, "acceptance.json"), `${JSON.stringify({
		schemaVersion: 1
		, kind: "lean-bridge-installed-cli-acceptance"
		, status: "passed"
		, archiveSha256, version, backend, calls
		, checkoutInstalled: false
		, runtimeOverride: false
		, installationScripts: false
		, registryRehearsal: Boolean(registry)
		, runtimeResolvedAutomatically: Boolean(registry)
		, externalRegistryWrites: false
	}, null, 2)}\n`);
	passed = true;
} finally
{
	await rm(join(scratch, "signer.pem"), { force: true });
	await writeFile(join(output, "commands.json"), `${JSON.stringify(logs, null, 2)}\n`);
	if(passed) await rm(scratch, { recursive: true, force: true });
	else process.stderr.write(`Preserved failed CLI acceptance inputs at ${scratch}\n`);
}
