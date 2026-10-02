/**
 * Verify original callback-result gems after removing all producer inputs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, readFile, rename, rm, symlink } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { ownedRubyEvidence } from "../src/build/owned-ruby-artifacts.mjs";
import { readVerifiedNativeComponent, verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { buildNativeComponent, buildNativeSharedRuntime } from "../src/build/native-component.mjs";
import { projectOwnedRuby } from "../src/build/owned-ruby-projection.mjs";
import { packageOwnedRuby } from "../src/release/owned-rubygems.mjs";
import { writeNativePackageSet } from "../src/release/package-set-assembly.mjs";
import { prepareOwnedReceiverCli } from "./helpers/owned-receiver-cli.mjs";
import { ownedRubyCallbackResultConfiguration, ownedRubyCallbackResultReviewedIr
	, ownedRubyCallbackResultSource, ownedRubyCallbackResultCombinedConfiguration
	, ownedRubyCallbackResultCombinedReviewedIr, ownedRubyCallbackResultCombinedSource } from "./helpers/owned-ruby-callback-result-fixture.mjs";
import { ownedRubyCallbackInstalledProbe } from "./helpers/owned-ruby-callback-result-installed.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
for(const mode of ["ordinary", "reviewed"]) for(const combined of [false, true])
test(`installed Ruby callback-result gem (${mode}, ${combined ? "combined" : "no-host"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_RUBY_CALLBACK_RESULT_TEST !== "1"
	, timeout: 2400000
}, async t => {
	const authored = combined ? ownedRubyCallbackResultCombinedConfiguration : ownedRubyCallbackResultConfiguration;
	const reviewed = combined ? ownedRubyCallbackResultCombinedReviewedIr : ownedRubyCallbackResultReviewedIr;
	const configuration = mode === "ordinary" ? await authored() : { schemaVersion: 1, modules: ["Owned"] };
	configuration.targets = { rubygems: { name: "owned-callback-results", version: "1.2.3" } };
	const context = await prepareOwnedReceiverCli(t, {
		label: `ruby-callback-installed-${mode}-${combined}`, configuration
		, reviewedIr: mode === "reviewed" ? reviewed() : null
		, source: combined ? ownedRubyCallbackResultCombinedSource : ownedRubyCallbackResultSource
		, profiles: ["ruby"]
		, environment: {
			LEAN_BRIDGE_RUBY: resolve(process.env.LEAN_BRIDGE_RUBY ?? ".toolchains/ruby33/bin/ruby")
			, LEAN_BRIDGE_GEM: resolve(process.env.LEAN_BRIDGE_GEM ?? ".toolchains/ruby33/bin/gem")
		}
	});
	const { directory, project, output, handoff, consumer, environment } = context;
	const before = await lakeInputState(project);
	const build = async destination => {
		if(combined) return context.build(destination);
		const runtimeRoot = join(destination, "native/runtime"), nativeRoot = join(destination, "native/component");
		const leanPrefix = environment.LEAN_BRIDGE_LEAN_PREFIX;
		await buildNativeSharedRuntime({ outputRoot: runtimeRoot, leanPrefix });
		const native = await buildNativeComponent({ projectRoot: project
			, outputRoot: nativeRoot, runtimeRoot, leanPrefix, targets: ["rubygems"]
			, ownedGraphs: true, ownedHostCallbacks: false
			, ownedCallbackResultAnchors: true });
		const projection = await projectOwnedRuby({ working: destination
			, nativeRoot, runtimeRoot, leanPrefix
			, settings: configuration.targets.rubygems, environment });
		await writeNativePackageSet({ root: destination, model: native.model
			, runtimeIdentity: native.receipt.runtimeIdentity
			, projections: [projection] });
		context.builds.push({ producerInterface: "native-build-api", projections: [projection] });
		assert.deepEqual(await lakeInputState(project), before);
		return projection;
	};
	const built = await build(output), projection = built.projections?.find(item => item.ecosystem === "rubygems") ?? built;
	assert.equal(projection.backend, "owned-ruby-v5");
	const nativeRoot = join(output, "native/component"), runtimeRoot = join(output, "native/runtime");
	const adapterRoot = join(output, "native/owned-ruby-binding");
	const verified = await ownedRubyEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	const { model, receipt, adapter } = verified;
	assert.equal(model.schemaVersion, 11); assert.equal(receipt.schemaVersion, 7);
	assert.equal(model.ownedGraph.callbackResultAnchors.signatures.length, 4);
	for(const key of ["hostCallbacks", "resultAnchors", "receiverExports", "inputTransfers"])
		assert.equal(Boolean(model.ownedGraph[key]), combined, key);
	if(!combined) await assert.rejects(access(join(nativeRoot, "callbacks.c")), { code: "ENOENT" });
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(adapter.schemaVersion, 5); assert.equal(adapter.ownedValues.schemaVersion, 6);
	assert.equal(adapter.rubyValues.schemaVersion, 5);
	const metadata = await json(join(nativeRoot, "metadata.json"));
	const capabilities = { ownedGraphs: true, ownedHostCallbacks: combined
		, ownedInputTransfers: combined, ownedAnchoredResults: combined
		, ownedReceiverExports: combined, ownedCallbackResultAnchors: true };
	const incapable = ["ownedCallbackResultAnchors", ...combined ? ["ownedHostCallbacks", "ownedInputTransfers", "ownedAnchoredResults", "ownedReceiverExports"] : []];
	for(const key of incapable)
		await assert.rejects(readVerifiedNativeComponent(nativeRoot, verified.evidence.runtimeIdentity, { ...capabilities, [key]: false }));
	const packageOptions = { nativeRoot, runtimeRoot, adapterRoot, environment
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, settings: configuration.targets.rubygems
		, glibcMinimumVersion: projection.glibcMinimumVersion };
	const dynamic = await runCopied("readelf", ["-d", join(adapterRoot, "lib", adapter.library)], directory, environment);
	const needed = [...dynamic.stdout.matchAll(/\(NEEDED\).*?\[([^\]]+)\]/gu)].map(match => match[1]);
	assert.equal(needed[0], "libgmp-lean-bridge.so.10");
	assert.ok(needed.includes(receipt.library)); assert.ok(needed.includes("libleanshared.so"));
	const original = await readFile(join(output, "archives", projection.packages[0].archive));
	const reassembled = join(directory, "reassembled"), rebuilt = await packageOwnedRuby({ ...packageOptions, working: reassembled });
	assert.deepEqual(rebuilt.packages, projection.packages);
	assert.deepEqual(await readFile(join(reassembled, "archives", projection.packages[0].archive)), original);
	await rm(reassembled, { recursive: true });
	const independent = join(directory, "independent"), second = await build(independent);
	const secondProjection = second.projections?.find(item => item.ecosystem === "rubygems") ?? second;
	assert.deepEqual(secondProjection.packages, projection.packages);
	assert.deepEqual(await readFile(join(independent, "archives", projection.packages[0].archive)), original);
	await rm(independent, { recursive: true });
	let rejected = 0;
	for(const mutate of [
		value => { delete value.ownedValues.callbackResultAnchors; }
		, value => { value.ownedValues.callbackResultAnchors.signatures.pop(); }
		, value => { value.ownedValues.callbackResultAnchors.signatures[0].parameter++; }
		, value => { value.ownedValues.callbackResultAnchors.anchor = "closure-owner"; }
		, value => { value.ownedValues.callbackResultAnchors.expiration = "never"; }
		, value => { value.ownedValues.callbackResultAnchors.descendants = "independent"; }
		, value => { value.ownedValues.callbackResultAnchors.hostResultHandoff = "after-frame"; }
		, value => { value.schemaVersion = 4; value.ownedValues.schemaVersion = 5; }
		, value => { delete value.rubyValues.callbackResultAnchors; }
		, value => { value.rubyValues.callbackResultAnchors.signatures.pop(); }
		, value => { value.rubyValues.callbackResultAnchors.signatures[0].parameter++; }
		, value => { value.rubyValues.callbackResultAnchors.anchor = "closure-owner"; }
		, value => { value.rubyValues.callbackResultAnchors.parameterNumbering = "includes-closure"; }
		, value => { value.rubyValues.callbackResultAnchors.hostReply = "unchecked"; }
		, value => { value.rubyValues.callbackResultAnchors.hostResultHandoff = "after-frame"; }
		, value => { value.rubyValues.callbackResultAnchors.descendants = "independent"; }
		, value => { value.rubyValues.callbackResultAnchors.emptyValues = "unowned"; }
		, value => { value.rubyValues.schemaVersion = 4; }
	]) {
		const changed = structuredClone(adapter); mutate(changed);
		await saveLakeFile(adapterRoot, "native-ruby-adapter.json", canonicalJson(changed));
		try
		{ await assert.rejects(packageOwnedRuby({ ...packageOptions, working: join(directory, `forged-${rejected}`) }), /compiler-authenticated/u); }
		finally
		{ await saveLakeFile(adapterRoot, "native-ruby-adapter.json", canonicalJson(adapter)); }
		rejected++;
	}
	for(const path of [`src/${verified.prefix}.c`, `src/${verified.prefix}-ruby.c`, "internal/ruby-abi.h", `lib/${adapter.library}`])
	{
		const source = await readFile(join(adapterRoot, path)), changed = Buffer.concat([source, Buffer.from("\n/* changed callback ownership */\n")]);
		const forged = structuredClone(adapter);
		if(!path.startsWith("lib/")) forged.files[path] = { bytes: changed.length, sha256: sha256(changed) };
		await saveLakeFile(adapterRoot, path, changed);
		await saveLakeFile(adapterRoot, "native-ruby-adapter.json", canonicalJson(forged));
		try
		{ await assert.rejects(packageOwnedRuby({ ...packageOptions, working: join(directory, `forged-${rejected}`) })); }
		finally
		{ await saveLakeFile(adapterRoot, path, source); await saveLakeFile(adapterRoot, "native-ruby-adapter.json", canonicalJson(adapter)); }
		rejected++;
	}
	const handoffReceipt = await copyPackageSetHandoff(output, handoff);
	const verification = await context.removeAuthor();
	const pkg = handoffReceipt.packages.find(item => item.target === "rubygems"), archive = join(handoff, pkg.artifacts[0].path);
	assert.equal(sha256(await readFile(archive)), pkg.artifacts[0].sha256);
	const gemRoot = join(consumer, "gems"), command = environment.LEAN_BRIDGE_RUBY;
	await mkdir(consumer, { recursive: true });
	const env = { ...copiedCleanEnvironment, GEM_HOME: gemRoot, GEM_PATH: gemRoot };
	await runCopied(command, [environment.LEAN_BRIDGE_GEM, "install", "--norc", archive, "--local", "--install-dir", gemRoot, "--no-document"], consumer, env);
	const installed = (await runCopied(command, ["-e", 'print Gem::Specification.find_by_name("owned-callback-results", "1.2.3").full_gem_path'], consumer, env)).stdout;
	assert.ok(installed.startsWith(`${gemRoot}/gems/`));
	const manifest = await json(join(installed, "lean-bridge/package-receipt.json"));
	assert.equal(manifest.schemaVersion, 5); assert.equal(manifest.kind, "lean-bridge-owned-rubygems-package");
	assert.deepEqual(manifest.ownedValues, verified.ruby.contract); await verifyNativeFiles(installed, manifest.files);
	assert.ok(Object.keys(manifest.files).some(path => path.endsWith("sources/gmp-6.3.0.tar.xz")));
	const source = await ownedRubyCallbackInstalledProbe(combined);
	await saveLakeFile(consumer, "consumer.rb", source);
	const executed = await runCopied(command, ["consumer.rb"], consumer, env);
	assert.equal(executed.stderr, ""); const observation = JSON.parse(executed.stdout);
	assert.equal(observation.ordinaryRequire, true); assert.ok(observation.checks > 150);
	assert.equal(observation.scenarios.length, combined ? 7 : 5);
	const loaderSource = await readFile("tests/fixtures/structured-types/owned-ruby-installed-loader.rb", "utf8");
	await saveLakeFile(consumer, "loader.rb", loaderSource);
	const inspected = await runCopied(command, ["loader.rb", verified.ruby.requirePath, verified.ruby.componentName], consumer, env);
	assert.equal(inspected.stderr, ""); const loader = JSON.parse(inspected.stdout);
	assert.deepEqual(loader.consumer, observation); assert.equal(loader.liveIdentities, 0);
	assert.equal(loader.runtimeInitializations, 1); assert.equal(loader.componentInitializations, 1);
	assert.equal(loader.privateGmp, true); assert.equal(loader.forkBeforeLock, true); assert.equal(loader.concurrentRequires, 4);
	const documented = await readFile("tests/fixtures/documentation/consumers/ruby/owned-callback-results.rb", "utf8");
	assert.equal((await readFile("docs/consume/ruby.md", "utf8")).match(/```ruby file=ruby\/owned-callback-results\.rb\n([\s\S]*?)```/u)?.[1], documented);
	await saveLakeFile(consumer, "documentation.rb", documented);
	const example = await runCopied(command, ["documentation.rb"], consumer, env);
	assert.equal(example.stdout, "42\n42\n"); assert.equal(example.stderr, "");
	const entry = ["-e", `require ${JSON.stringify(verified.ruby.requirePath)}`];
	const library = join(installed, "lib", verified.ruby.requirePath, "native/linux-x64", adapter.library);
	const originalLibrary = await readFile(library), corrupt = Buffer.from(originalLibrary); corrupt[0] ^= 1;
	await saveLakeFile(dirname(library), adapter.library, corrupt);
	await assert.rejects(runCopied(command, entry, consumer, env), error => /differs from compiled evidence/u.test(error.details?.stderr));
	await saveLakeFile(dirname(library), adapter.library, originalLibrary);
	await rename(library, `${library}.original`); await symlink(`${library}.original`, library);
	await assert.rejects(runCopied(command, entry, consumer, env), error => /differs from compiled evidence/u.test(error.details?.stderr));
	await rm(library); await rename(`${library}.original`, library);
	await assert.rejects(runCopied(command, entry, consumer, { ...env, RUBY_MN_THREADS: "1" }), error => /1:1 threads/u.test(error.details?.stderr));
	await assert.rejects(runCopied(command, entry, consumer, { ...env, LD_PRELOAD: join(dirname(library), "libleanshared.so") }), error => /Unverified native library/u.test(error.details?.stderr));
	await rm(handoff, { recursive: true }); await rm(join(gemRoot, "cache"), { recursive: true });
	const relocated = join(consumer, "relocated-gems"); await rename(gemRoot, relocated);
	await assert.rejects(access(gemRoot), { code: "ENOENT" }); await assert.rejects(access(handoff), { code: "ENOENT" });
	const moved = await runCopied(command, ["consumer.rb"], consumer, { ...env, GEM_HOME: relocated, GEM_PATH: relocated });
	assert.deepEqual(moved, executed); await verifyNativeFiles(join(relocated, relative(gemRoot, installed)), manifest.files);
	await saveLakeFile("build/owned-ruby-callback-results", `${mode}-${combined ? "combined" : "no-host"}-package.json`, canonicalJson({
		mode, combined, metadata, model, componentReceipt: receipt, adapter
		, runtime: verified.runtime
		, packageSetReceipt: handoffReceipt, packages: projection.packages
		, cli: context.cli, cliInstallation: context.cliInstallation
		, builds: context.builds, verification
		, sourceRemovedBeforeInstall: true, cliRemovedBeforeConsumerInstall: true
		, sourceFreeInstallation: true
		, sourceFreeRelocatedExecution: true
		, handoffRemovedBeforeRelocatedExecution: true, gemCacheRemoved: true
		, deterministicReassembly: true, independentRebuild: true, needed
		, rejected, incapableReadersRejected: incapable.length, observation
		, relocatedObservation: JSON.parse(moved.stdout), manifest, loader
		, loaderRejected: ["changed-library", "symlink-library", "mn-threads", "unverified-runtime"]
		, consumerSha256: sha256(source), loaderProbeSha256: sha256(loaderSource)
		, documentation: { sourceSha256: sha256(documented), stdout: example.stdout }
	}));
	t.diagnostic(`${mode}-${combined ? "combined" : "no-host"}: ${observation.checks}+${observation.checks} installed and relocated callback checks`);
});
