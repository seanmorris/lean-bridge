/**
 * Installed owned peers and copied Ruby packages share one verified runtime.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

test("owned and copied gems share loading, callbacks and retirement in both orders", {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 1200000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-owned-peers-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = { ...nativeFixtureEnvironment(["ruby"])
		, LEAN_BRIDGE_RUBY: resolve(process.env.LEAN_BRIDGE_RUBY ?? ".toolchains/ruby33/bin/ruby")
		, LEAN_BRIDGE_GEM: resolve(process.env.LEAN_BRIDGE_GEM ?? ".toolchains/ruby33/bin/gem") };
	const releases = [], author = join(root, "author");
	for(const name of ["owned-aggregates", "owned-peer", "copied-peer"])
	{
		const source = join(author, name), output = join(author, `${name}-release`), handoff = join(root, `${name}-handoff`);
		if(name === "copied-peer")
		{
			await saveLakeFile(source, "Peer.lean", `namespace Peer
inductive Tree where
  | tip (value : Nat)
  | branch (children : Array Tree)
def echo (value : Tree) := value
def apply (value : Tree) (callback : Tree → Tree) := callback value
def answer : Nat := 2 ^ 200 + 31
end Peer
`);
			await saveLakeFile(source, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
			await saveLakeFile(source, "lakefile.toml", 'name = "copied-peer"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Peer"\n');
			await saveLakeFile(source, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
				, modules: ["Peer"]
				, exports: ["Peer.echo", "Peer.apply", "Peer.answer"]
				, targets: { rubygems: { name, version: "1.0.0" } } }));
		}
		else
		{
			await cp(resolve("tests/fixtures/onboarding/owned-cpp-composition"), source, { recursive: true });
			await saveLakeFile(source, "lakefile.toml", `name = "${name}"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Owned"\n`);
			const config = JSON.parse(await readFile(join(source, "lean-bridge.exports.json"), "utf8"));
			config.targets = { rubygems: { name, version: "1.0.0" } };
			await saveLakeFile(source, "lean-bridge.exports.json", canonicalJson(config));
		}
		const before = await lakeInputState(source);
		const built = await buildCanonicalProject({ projectRoot: source, outputRoot: output, targets: ["rubygems"], environment })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		assert.deepEqual(await lakeInputState(source), before);
		assert.equal(built.backend, name === "copied-peer" ? "ordinary-ruby-v1" : "owned-ruby-v1");
		const receipt = await copyPackageSetHandoff(output, handoff);
		releases.push({ handoff, receipt });
	}
	assert.ok(releases.every(item => item.receipt.profiles[0].runtimeIdentity === releases[0].receipt.profiles[0].runtimeIdentity));
	await rm(author, { recursive: true, force: true });
	await assert.rejects(access(author), { code: "ENOENT" });
	const consumer = join(root, "consumer"), gems = join(consumer, "gems");
	await mkdir(consumer);
	const command = environment.LEAN_BRIDGE_RUBY, env = { ...copiedCleanEnvironment, GEM_HOME: gems, GEM_PATH: gems };
	for(const { handoff, receipt } of releases)
	{
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		await runCopied(command, [environment.LEAN_BRIDGE_GEM, "install", "--norc", join(handoff, receipt.packages[0].artifacts[0].path), "--local", "--install-dir", gems, "--no-document"], consumer, env);
		await rm(handoff, { recursive: true, force: true });
	}
	await rm(join(gems, "cache"), { recursive: true, force: true });
	const relocated = join(consumer, "relocated"); await rename(gems, relocated);
	const source = await readFile("tests/fixtures/structured-types/owned-ruby-coexistence.rb", "utf8");
	await saveLakeFile(consumer, "consumer.rb", source);
	const observations = [];
	for(const order of ["copied-first", "owned-first"]) for(const retiredBy of ["copied", "owned"])
	{
		const executed = await runCopied(command, ["consumer.rb", order, retiredBy], consumer, { ...env, GEM_HOME: relocated, GEM_PATH: relocated });
		assert.equal(executed.stderr, ""); const result = JSON.parse(executed.stdout);
		assert.deepEqual(result, { order, retiredBy, rejectedCalls: 3
			, liveIdentities: 0, components: 3, runtimeInitializations: 1
			, libraries: 9, threadedCalls: 64 });
		observations.push(result);
	}
	await saveLakeFile(resolve("build/owned-ruby-packaging"), "coexistence.json", canonicalJson({ schemaVersion: 1
		, planNode: 1219
		, installedPackage: true, authorRemoved: true, handoffsRemoved: true
		, gemCachesRemoved: true, relocated: true, consumerSha256: sha256(source)
		, observations, packageSetReceipts: releases.map(item => item.receipt) }));
});
