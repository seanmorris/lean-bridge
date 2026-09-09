/**
 * Tests the fail-closed npm registry adapter behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
	NpmRegistryAdapterError,
	createNpmRegistryAdapter,
	createNpmCliRegistryClient,
} from "../src/release/npm-registry-adapter.mjs";

const sha256 = value => createHash("sha256").update(value).digest("hex");
const credentials = Object.freeze({
	get: name => {
		assert.equal(name, "NPM_TOKEN");
		return "fixture-secret";
	}
});

test("OIDC preflight never reads an npm token or calls whoami and binds the destination", async () => {
	const accessed = [];
	const target = {
		coordinate: "@author/component@1.0.0"
		, archives: [{ path: "component.tgz", sha256: "a".repeat(64) }]
		, destination: { endpoint: "https://registry.npmjs.org/", authMode: "oidc" }
		, dependencies: [{ coordinate: "@lean-bridge/runtime@1.0.0", sha256: "b".repeat(64) }]
	};
	const oidc = { get: name => { assert.notEqual(name, "NPM_TOKEN"); accessed.push(name); return "test-oidc-value"; } };
	const adapter = createNpmRegistryAdapter({ mode: "production"
	, client: {
		permission: async () => assert.fail("OIDC must not call whoami")
		, trustedPublisher: async () => "deferred-to-publish"
		, inspect: async ({ token }) => { assert.equal(token, undefined); return { status: "available" }; }
		, publish: async () => assert.fail("Preflight cannot publish")
	} });
	const result = await adapter.preflight({ target, credentials: oidc });
	assert.equal(result.permission, "deferred-to-publish");
	assert.equal(result.dependencies[0].status, "unavailable");
	assert.deepEqual(accessed, ["ACTIONS_ID_TOKEN_REQUEST_TOKEN", "ACTIONS_ID_TOKEN_REQUEST_URL"]);
	await assert.rejects(adapter.preflight({ target: { ...target, destination: { ...target.destination, endpoint: "https://other.invalid/" } }, credentials: oidc }), { code: "npm-destination-drift" });
});

test("npm executes in private configuration with no ambient token fallback", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-npm-isolation-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const log = join(root, "calls.jsonl");
	await writeFile(join(root, "npm"), `#!${process.execPath}
const fs = require("node:fs");
const args = process.argv.slice(2);
const option = name => args[args.indexOf(name) + 1];
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({ args, cwd: process.cwd(), env: process.env,
  userconfig: fs.readFileSync(option("--userconfig"), "utf8"),
  globalconfig: fs.readFileSync(option("--globalconfig"), "utf8") }) + "\\n");
console.log(args.includes("--version") ? "11.5.1" : "{}");
`, { mode: 0o755 });
	const overrides = { PATH: `${root}:${process.env.PATH}`, NPM_TOKEN: "AMBIENT_FAKE_TOKEN", npm_config_registry: "https://hostile.invalid/", NODE_OPTIONS: "--require=/never-load-hostile.cjs" };
	const previous = Object.fromEntries(Object.keys(overrides).map(name => [name, process.env[name]]));
	Object.assign(process.env, overrides);
	t.after(() => { for(const [name, value] of Object.entries(previous))
{ if(value === undefined) delete process.env[name]; else process.env[name] = value; } });
	const client = createNpmCliRegistryClient();
	assert.equal(await client.trustedPublisher({ registry: "https://registry.npmjs.org/" }), "deferred-to-publish");
	await client.publish({ registry: "https://registry.npmjs.org/", archivePath: join(root, "approved.tgz"), coordinate: "@author/component@1.0.0", tag: "next", access: "public", authMode: "oidc", oidcEnvironment: { ACTIONS_ID_TOKEN_REQUEST_TOKEN: "EXPLICIT_FAKE_OIDC", ACTIONS_ID_TOKEN_REQUEST_URL: "https://example.invalid/token" } });
	const calls = (await readFile(log, "utf8")).trim().split("\n").map(JSON.parse);
	assert.equal(calls.length, 2);
	for(const call of calls)
	{
		assert.notEqual(call.cwd, root);
		assert.equal(call.userconfig, "");
		assert.equal(call.globalconfig, "");
		for(const name of ["NPM_TOKEN", "npm_config_registry", "NODE_OPTIONS"]) assert.equal(call.env[name], undefined);
		await assert.rejects(readFile(join(call.cwd, "npmrc")), { code: "ENOENT" });
	}
	assert.ok(calls[1].args.includes("--@author:registry=https://registry.npmjs.org/"));
	assert.ok(calls[1].args.includes("--ignore-scripts"));
	assert.equal(calls[1].env.ACTIONS_ID_TOKEN_REQUEST_TOKEN, "EXPLICIT_FAKE_OIDC");
	assert.ok(!calls.some(call => call.args.includes("whoami")));
});

const fixture = async () => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-npm-adapter-"));
	const candidateRoot = join(root, "release");
	const archivePath = join(candidateRoot, "packages/npm/alpha.tgz");
	const bytes = Buffer.from("deterministic npm archive");
	await mkdir(join(candidateRoot, "packages/npm"), { recursive: true });
	await writeFile(archivePath, bytes);
	const target = Object.freeze({
		coordinate: "@lean-bridge/alpha@1.0.0"
		, archives: Object.freeze([Object.freeze({
			path: "release/packages/npm/alpha.tgz"
			, sha256: sha256(bytes)
		})])
	});
	return { root, candidateRoot, archivePath, target };
};

test("npm sandbox preflight and publish confirm exact registry tarball bytes", async t => {
	const value = await fixture();
	t.after(() => rm(value.root, { recursive: true, force: true }));
	let remote = null;
	const calls = [];
	const client = {
		permission: async ({ registry, token }) => {
			assert.equal(registry, "http://127.0.0.1:4873/");
			assert.equal(token, "fixture-secret");
			return "granted";
		}
		, inspect: async () => remote ?? { status: "available" }
		, publish: async ({ archivePath, token }) => {
			assert.equal(archivePath, value.archivePath);
			assert.equal(token, "fixture-secret");
			calls.push("publish");
			remote = {
				status: "published"
				, registryReference: "http://127.0.0.1:4873/alpha.tgz"
				, archiveSha256: value.target.archives[0].sha256
			};
		}
	};
	const adapter = createNpmRegistryAdapter({ client });
	assert.deepEqual(await adapter.preflight({ target: value.target, credentials }), {
		permission: "granted"
		, coordinateState: "available"
		, immutable: true
		, registryReference: null
		, artifacts: []
		, dependencies: []
	});
	const result = await adapter.publish({
		target: value.target
		, candidateRoot: value.candidateRoot
		, credentials
	});
	assert.equal(result.status, "published");
	assert.equal(result.externalWrite, true);
	assert.deepEqual(result.artifacts, [{ sha256: value.target.archives[0].sha256 }]);
	assert.deepEqual(calls, ["publish"]);
	assert.equal((await adapter.preflight({ target: value.target, credentials })).coordinateState, "matching");
});

test("npm preflight distinguishes an occupied coordinate with different bytes", async () => {
	const target = { coordinate: "alpha@1.0.0", archives: [{ path: "alpha.tgz", sha256: "a".repeat(64) }] };
	const adapter = createNpmRegistryAdapter({
		client: {
			permission: async () => "granted"
			, inspect: async () => ({
				status: "published"
				, registryReference: "http://127.0.0.1:4873/alpha.tgz"
				, archiveSha256: "b".repeat(64)
			})
			, publish: async () => assert.fail("collision must not publish")
		}
	});
	const preflight = await adapter.preflight({ target, credentials });
	assert.equal(preflight.coordinateState, "collision");
	assert.deepEqual(preflight.artifacts, []);
});

test("npm publication rejects hash drift and production without explicit opt-in", async t => {
	const value = await fixture();
	t.after(() => rm(value.root, { recursive: true, force: true }));
	const client = {
		permission: async () => "granted"
		, inspect: async () => ({ status: "available" })
		, publish: async () => assert.fail("blocked publication must not call the client")
	};
	await writeFile(value.archivePath, "changed");
	await assert.rejects(
		createNpmRegistryAdapter({ client }).publish({ target: value.target, candidateRoot: value.candidateRoot, credentials })
		, error => error instanceof NpmRegistryAdapterError && error.code === "npm-archive-hash-drift",
	);
	const production = createNpmRegistryAdapter({ mode: "production", client });
	await assert.rejects(
		production.publish({ target: value.target, candidateRoot: value.candidateRoot, credentials })
		, error => error instanceof NpmRegistryAdapterError && error.code === "npm-production-opt-in-required",
	);
});
