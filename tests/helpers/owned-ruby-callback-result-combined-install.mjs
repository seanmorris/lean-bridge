/**
 * Consume an original Ruby gem alongside the other combined-release archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, readFile, rename, rm } from "node:fs/promises";
import { join, relative } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { ownedRubyCallbackInstalledProbe } from "./owned-ruby-callback-result-installed.mjs";

/**
 * Install offline after producer removal and defer relocation until handoff removal.
 *
 * @param options - Original package set, isolated consumer and native identity.
 * @param options.handoff - Verified original archives awaiting removal.
 * @param options.receipt - Authenticated package-set receipt.
 * @param options.consumer - Source-free downstream workspace.
 * @param options.environment - Absolute producer toolchain paths.
 * @param options.native - Verified native component model and receipt.
 */
export const installOwnedRubyCallbackCombined = async ({ handoff, receipt, consumer, environment, native }) => {
	const packages = receipt.packages.filter(item => item.target === "rubygems");
	assert.equal(packages.length, 1);
	const pkg = packages[0], archive = join(handoff, pkg.artifacts[0].path);
	assert.equal(sha256(await readFile(archive)), pkg.artifacts[0].sha256);
	const root = join(consumer, "ruby"), gems = join(root, "gems");
	await mkdir(root, { recursive: true });
	const ruby = environment.LEAN_BRIDGE_RUBY;
	const env = { ...copiedCleanEnvironment, GEM_HOME: gems, GEM_PATH: gems };
	await runCopied(ruby, [environment.LEAN_BRIDGE_GEM, "install", "--norc"
		, archive
		, "--local", "--install-dir", gems, "--no-document"], root, env);
	const installed = (await runCopied(ruby, ["-e", 'print Gem::Specification.find_by_name("owned-callback-results", "1.2.3").full_gem_path'], root, env)).stdout;
	assert.ok(installed.startsWith(gems + "/gems/"));
	const manifest = JSON.parse(await readFile(join(installed, "lean-bridge/package-receipt.json"), "utf8"));
	assert.equal(manifest.schemaVersion, 5); assert.equal(manifest.ownedValues.schemaVersion, 5);
	assert.equal(manifest.runtimeIdentity, native.receipt.runtimeIdentity);
	assert.equal(manifest.ownedValues.callbackResultAnchors.signatures.length, 4);
	for(const key of ["resultAnchors", "inputTransfers", "receiverExports"])
		assert.ok(manifest.ownedValues[key], key);
	await verifyNativeFiles(installed, manifest.files);
	const source = await ownedRubyCallbackInstalledProbe(true);
	await saveLakeFile(root, "consumer.rb", source);
	const executed = await runCopied(ruby, ["consumer.rb"], root, env);
	assert.equal(executed.stderr, "");
	const observation = JSON.parse(executed.stdout);
	assert.deepEqual(observation, { checks: 206, ordinaryRequire: true
		, scenarios: ["original_owners", "independent_closures", "native_passback"
			, "recursive_owners", "affinity", "host_replies", "combined_transfers"] });
	const loaderSource = await readFile("tests/fixtures/structured-types/owned-ruby-installed-loader.rb", "utf8");
	await saveLakeFile(root, "loader.rb", loaderSource);
	const inspected = await runCopied(ruby, ["loader.rb", "lean_bridge/owned_aggregates", "OwnedAggregates"], root, env);
	assert.equal(inspected.stderr, "");
	const loader = JSON.parse(inspected.stdout);
	assert.deepEqual(loader.consumer, observation); assert.equal(loader.liveIdentities, 0);
	assert.equal(loader.runtimeInitializations, 1); assert.equal(loader.componentInitializations, 1);
	assert.equal(loader.privateGmp, true); assert.equal(loader.forkBeforeLock, true);
	assert.equal(loader.concurrentRequires, 4);
	const example = await readFile("tests/fixtures/documentation/consumers/ruby/owned-callback-results.rb", "utf8");
	assert.equal((await readFile("docs/consume/ruby.md", "utf8")).match(/```ruby file=ruby\/owned-callback-results\.rb\n([\s\S]*?)```/u)?.[1], example);
	await saveLakeFile(root, "documentation.rb", example);
	const documented = await runCopied(ruby, ["documentation.rb"], root, env);
	assert.equal(documented.stderr, ""); assert.equal(documented.stdout, "42\n42\n");
	const report = { manifest, observation, loader, checks: observation.checks
		, consumerSha256: sha256(source), loaderProbeSha256: sha256(loaderSource)
		, sourceFreeInstallation: true, cliRemovedBeforeConsumerInstall: true
		, offlineInstall: true
		, documentation: { sourceSha256: sha256(example), stdout: documented.stdout } };
	const relocate = async () => {
		await assert.rejects(access(handoff), { code: "ENOENT" });
		await rm(join(gems, "cache"), { recursive: true });
		const relocated = join(root, "relocated-gems");
		await rename(gems, relocated); await assert.rejects(access(gems), { code: "ENOENT" });
		const moved = await runCopied(ruby, ["consumer.rb"], root
			, { ...env, GEM_HOME: relocated, GEM_PATH: relocated });
		assert.deepEqual(moved, executed);
		await verifyNativeFiles(join(relocated, relative(gems, installed)), manifest.files);
		Object.assign(report, { relocatedChecks: observation.checks
			, sourceFreeRelocatedExecution: true
			, handoffRemovedBeforeRelocatedExecution: true
			, gemCacheRemoved: true });
	};
	return { report, relocate };
};
