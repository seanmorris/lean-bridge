/**
 * Keep callback Subtype archives bound to every hosted lane and the
 * exact source closure that produced and verifies it.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import {
	callbackSubtypeEvidenceSources
	, callbackSubtypeHostedLanes
	, callbackSubtypeHostedOriginal
} from "./helpers/callback-subtype-hosted-evidence-sources.mjs";
import {
	assertCallbackSubtypeHostedApiBinding
	, assertCallbackSubtypeHostedOutputSet
	, callbackSubtypeHostedApiRecords
	, reconstructCallbackSubtypeHostedArtifact
} from "./helpers/callback-subtype-hosted-evidence.mjs";

const revision = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();

const expected = Object.freeze({
	browser: ["javascript.mjs", "types.mts"]
	, native: ["c.c", "cpp.cpp"]
	, languages: ["python.py", "ruby.rb", "rust.rs"]
	, perl: ["perl.pl"]
	, dotnet: ["dotnet.cs"]
	, jvm: ["java.java", "kotlin.kt"]
	, "php-native": ["php-native.php"]
	, "wit-wasi": ["wit-wasi.c"]
});
const commonSources = Object.freeze([
	["producer", "src/backends/c/gmp.source.tar.xz"]
	, ["producer", "src/build/ResolveLakeWorkspace.lean"]
	, ["checker", ".github/actions/bounded-apt/action.yml"]
	, ["checker", "scripts/bootstrap-toolchains.sh"]
]);
const laneSources = Object.freeze({
	browser: [
		["checker", "flake.lock"], ["checker", "flake.nix"]
		, ["checker", "scripts/build-lean-link-spike.sh"]
		, ["checker", "scripts/install-playwright-browsers.sh"]
	]
	, native: []
	, languages: [
		["producer", "src/backends/rust/dependencies.lock"]
		, ["checker", "scripts/bootstrap-rust-ci.sh"]
	]
	, perl: [
		...["Build.pm", "BuildCallbackResults.pm", "Runtime.pm", "Runtime.xs"
			, "runtime.h", "OwnedAssets.pm", "Platform.pm"]
			.map(path => ["producer", `src/backends/perl/${path}`])
		, ["checker", "scripts/build-perl-toolchains.mjs"]
	]
	, dotnet: [], jvm: [], "php-native": []
	, "wit-wasi": [["checker", "flake.lock"], ["checker", "flake.nix"]]
});

test("callback Subtype archive lanes retain closed source roles", () => {
	assert.deepEqual([...callbackSubtypeHostedLanes].sort()
		, Object.keys(expected).sort());
	for(const lane of callbackSubtypeHostedLanes)
	{
		const sources = callbackSubtypeEvidenceSources(lane, {
			producer: revision, consumer: revision, checker: revision
			, archiver: revision
		});
		assert.deepEqual([...new Set(sources.map(item => item.role))].sort()
			, ["archiver", "checker", "consumer", "producer"]);
		assert.equal(new Set(sources.map(item =>
			`${item.role}/${item.path}`)).size, sources.length);
		for(const source of sources)
		{
			assert.equal(source.revision, revision);
			assert.ok(callbackSubtypeHostedOriginal(
				source.revision, source.path).length > 0, source.path);
		}
		for(const name of expected[lane])
			assert.ok(sources.some(item => item.role === "consumer"
				&& item.path.endsWith(`/${name}`)), `${lane}/${name}`);
		for(const [role, path] of [...commonSources, ...laneSources[lane]])
			assert.ok(sources.some(item => item.role === role
				&& item.path === path), `${lane}/${role}/${path}`);
		for(const path of [
			"scripts/archive-callback-subtype-evidence.mjs"
			, "tests/helpers/callback-subtype-hosted-archive.mjs"
			, "tests/helpers/callback-subtype-hosted-evidence-sources.mjs"
		]) assert.ok(sources.some(item => item.role === "archiver"
			&& item.path === path), `${lane}/${path}`);
	}
});

test("callback Subtype source selection rejects open lane and revision input", () => {
	assert.throws(() => callbackSubtypeEvidenceSources("other", {
		producer: revision, consumer: revision, checker: revision
		, archiver: revision
	}), assert.AssertionError);
	assert.throws(() => callbackSubtypeEvidenceSources("native", {
		producer: revision, consumer: revision, checker: "HEAD"
		, archiver: revision
	}), assert.AssertionError);
});

test("callback Subtype evidence binds its index to retained API bytes", () => {
	const api = {
		run: { bytes: Buffer.from("run"), sha256: sha256("run") }
		, job: { bytes: Buffer.from("job"), sha256: sha256("job") }
		, artifact: {
			bytes: Buffer.from("artifact"), sha256: sha256("artifact")
		}
	};
	const hostedRun = {
		repository: "seanmorris/lean-bridge", workflow: "workflow.yml"
		, runId: 11, runAttempt: 2, event: "push", url: "https://example/run"
		, createdAt: "created", updatedAt: "updated"
		, job: { id: 12, name: "job", labels: ["ubuntu-24.04"]
			, runnerName: "runner", runnerGroup: "group"
			, startedAt: "started", completedAt: "completed" }
		, artifact: { id: 13, name: "artifact", bytes: 8
			, sha256: sha256("artifact"), apiDigest: `sha256:${sha256("artifact")}`
			, createdAt: "created", expiresAt: "expires" }
	};
	const index = { hostedRun: {
		...hostedRun, apiRecords: callbackSubtypeHostedApiRecords(api)
		, artifact: { ...hostedRun.artifact, members: [], parts: [] }
	} };
	const hosted = { hostedRun, api };
	assert.doesNotThrow(() =>
		assertCallbackSubtypeHostedApiBinding(index, hosted));
	const runTamper = structuredClone(index);
	runTamper.hostedRun.runId++;
	assert.throws(() =>
		assertCallbackSubtypeHostedApiBinding(runTamper, hosted));
	const apiTamper = structuredClone(index);
	apiTamper.hostedRun.apiRecords.run.bytes++;
	assert.throws(() =>
		assertCallbackSubtypeHostedApiBinding(apiTamper, hosted));
});

test("callback Subtype evidence closes the retained output set", () => {
	const index = { files: [
		{ path: "hosted/output/a.txt" }, { path: "hosted/output/b/c.txt" }
		, { path: "hosted/api/run.json" }
	] };
	assert.doesNotThrow(() => assertCallbackSubtypeHostedOutputSet(
		index, ["b/c.txt", "a.txt"]));
	assert.throws(() => assertCallbackSubtypeHostedOutputSet(
		{ files: [...index.files, { path: "hosted/output/extra.txt" }] }
		, ["b/c.txt", "a.txt"]));
});

test("callback Subtype ZIP reconstruction rejects a changed part", async t => {
	const root = await mkdtemp(join(tmpdir(), "callback-subtype-part-test-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const bytes = Buffer.from("authenticated artifact bytes");
	await writeFile(join(root, "0000.part"), bytes);
	const part = {
		path: "0000.part", offset: 0, bytes: bytes.length
		, sha256: sha256(bytes)
	};
	const output = join(root, "valid.zip");
	assert.equal(await reconstructCallbackSubtypeHostedArtifact(
		root, [part], output), bytes.length);
	assert.deepEqual(await readFile(output), bytes);
	await assert.rejects(reconstructCallbackSubtypeHostedArtifact(
		root, [{ ...part, sha256: "0".repeat(64) }], join(root, "bad.zip")));
});
