/**
 * Tests the fail-closed npm registry adapter behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
	NpmRegistryAdapterError,
	createNpmRegistryAdapter,
} from "../src/release/npm-registry-adapter.mjs";

const sha256 = value => createHash("sha256").update(value).digest("hex");
const credentials = Object.freeze({
	get: name => {
		assert.equal(name, "NPM_TOKEN");
		return "fixture-secret";
	}
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
