/**
 * Install original receiver gems built by the installed CLI, then relocate them.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdir, readFile, rename, rm, symlink } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { ownedRubyEvidence } from "../src/build/owned-ruby-artifacts.mjs";
import { readVerifiedNativeComponent, verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { packageOwnedRuby } from "../src/release/owned-rubygems.mjs";
import { prepareOwnedReceiverCli } from "./helpers/owned-receiver-cli.mjs";
import { ownedRubyReceiverConfiguration, ownedRubyReceiverReviewedIr, ownedRubyReceiverSource } from "./helpers/owned-ruby-receiver-fixture.mjs";
import { ownedRubyInstalledReceiverProbe } from "./helpers/owned-ruby-receiver-installed.mjs";
import { ownedCppReceiverProbe } from "./helpers/owned-cpp-receiver-fixture.mjs";
import { ownedRustReceiverProbe } from "./helpers/owned-rust-receiver-fixture.mjs";
import { ownedPythonInstalledReceiverProbe } from "./helpers/owned-python-receiver-fixture.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { installPythonWheel } from "./helpers/python-wheel-install.mjs";
import { prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
for(const mode of ["ordinary", "reviewed"]) test(`installed Ruby receiver gem survives source removal (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_RUBY_RECEIVER_TEST !== "1"
	, timeout: mode === "reviewed" ? 4500000 : 2400000
}, async t => {
	const configuration = mode === "ordinary" ? await ownedRubyReceiverConfiguration() : { schemaVersion: 1, modules: ["Owned"] };
	configuration.targets = { rubygems: { name: "owned-receivers", version: "1.2.3" } };
	if(mode === "reviewed") Object.assign(configuration.targets, {
		c: { name: "owned-c-receivers", version: "1.2.3" }
		, cpp: { name: "owned-cpp-receivers", version: "1.2.3" }
		, cargo: { name: "owned-receivers", version: "1.2.3" }
		, pypi: { name: "owned-receivers", version: "1.2.3" }
	});
	const context = await prepareOwnedReceiverCli(t, {
		label: `ruby-receiver-package-${mode}`, configuration
		, reviewedIr: mode === "reviewed" ? ownedRubyReceiverReviewedIr() : null
		, source: ownedRubyReceiverSource
		, profiles: mode === "reviewed" ? ["ruby", "python", "rust"] : ["ruby"]
		// Each reviewed build compiles all five targets, including private GMP.
		, buildTimeoutMs: mode === "reviewed" ? 1800000 : 900000
		, environment: {
			LEAN_BRIDGE_RUBY: resolve(process.env.LEAN_BRIDGE_RUBY ?? ".toolchains/ruby33/bin/ruby")
			, LEAN_BRIDGE_GEM: resolve(process.env.LEAN_BRIDGE_GEM ?? ".toolchains/ruby33/bin/gem")
			, LEAN_BRIDGE_PYTHON: resolve(process.env.LEAN_BRIDGE_PYTHON ?? ".toolchains/python311/bin/python3.11")
			, CARGO_HOME: process.env.CARGO_HOME ?? resolve(".toolchains/cargo-copied") }
	});
	const { directory, output, handoff, consumer, environment } = context;
	const built = await context.build(output), projection = built.projections?.find(item => item.ecosystem === "rubygems") ?? built;
	assert.equal(projection.backend, "owned-ruby-v4");
	assert.deepEqual((built.projections ?? [built]).map(item => item.ecosystem).sort(), Object.keys(configuration.targets).sort());
	const nativeRoot = join(output, "native/component"), runtimeRoot = join(output, "native/runtime"), adapterRoot = join(output, "native/owned-ruby-binding");
	const verified = await ownedRubyEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	const { model, receipt: componentReceipt, adapter } = verified;
	assert.equal(model.schemaVersion, 10); assert.equal(componentReceipt.schemaVersion, 6);
	assert.equal(model.exports.length, 27); assert.equal(model.ownedGraph.receiverExports.exports.length, 16);
	assert.equal(model.ownedGraph.resultAnchors.exports.length, 20); assert.equal(model.ownedGraph.inputTransfers.exports.length, 4);
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(adapter.schemaVersion, 4); assert.equal(adapter.ownedValues.schemaVersion, 5);
	assert.equal(adapter.rubyValues.schemaVersion, 4);
	const metadata = await json(join(nativeRoot, "metadata.json"));
	const capabilities = { ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true, ownedAnchoredResults: true, ownedReceiverExports: true };
	for(const key of ["ownedHostCallbacks", "ownedInputTransfers", "ownedAnchoredResults", "ownedReceiverExports"])
		await assert.rejects(readVerifiedNativeComponent(nativeRoot, verified.evidence.runtimeIdentity, { ...capabilities, [key]: false }));
	const packageOptions = { nativeRoot, runtimeRoot, adapterRoot, environment
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, settings: configuration.targets.rubygems
		, glibcMinimumVersion: projection.glibcMinimumVersion };
	const dynamic = await runCopied("readelf", ["-d", join(adapterRoot, "lib", adapter.library)], directory, environment);
	const needed = [...dynamic.stdout.matchAll(/\(NEEDED\).*?\[([^\]]+)\]/gu)].map(match => match[1]);
	assert.equal(needed[0], "libgmp-lean-bridge.so.10");
	assert.ok(needed.includes(componentReceipt.library)); assert.ok(needed.includes("libleanshared.so"));
	const reassembled = join(directory, "reassembled"), rebuilt = await packageOwnedRuby({ ...packageOptions, working: reassembled });
	assert.deepEqual(rebuilt.packages, projection.packages);
	assert.deepEqual(await readFile(join(reassembled, "archives", projection.packages[0].archive)), await readFile(join(output, "archives", projection.packages[0].archive)));
	await rm(reassembled, { recursive: true });
	const independent = join(directory, "independent"), second = await context.build(independent);
	for(const item of built.projections ?? [built])
	{
		const again = second.projections?.find(value => value.ecosystem === item.ecosystem) ?? second;
		assert.deepEqual(again.packages, item.packages);
		for(const archive of item.packages)
			assert.deepEqual(await readFile(join(output, "archives", archive.archive)), await readFile(join(independent, "archives", archive.archive)));
	}
	await rm(independent, { recursive: true });
	let rejected = 0;
	for(const mutate of [
		value => { delete value.ownedValues.receiverExports; }
		, value => { value.ownedValues.receiverExports.exports.pop(); }
		, value => { value.ownedValues.receiverExports.exports[0].argument = 1; }
		, value => { value.ownedValues.receiverExports.callingConvention = "receiver-last"; }
		, value => { value.ownedValues.receiverExports.exports[0].kind = "function"; }
		, value => { value.ownedValues.receiverExports.exports[0].owner = "lean:Unknown"; }
		, value => { value.ownedValues.resultAnchors.lifetime = "parameter"; }
		, value => { value.ownedValues.resultAnchors.exports.find(item => item.receiver).receiver = false; }
		, value => { value.ownedValues.resultAnchors.exports.find(item => item.bindingId === "lean:Owned.chooseTicket").parameter = 1; }
		, value => { value.schemaVersion = 3; value.ownedValues.schemaVersion = 4; }
		, value => { delete value.rubyValues.receiverExports; }
		, value => { value.rubyValues.receiverExports.values = "unowned"; }
		, value => { value.rubyValues.receiverExports.members = "camelCase"; }
		, value => { value.rubyValues.receiverExports.properties = "mutable-fields"; }
		, value => { value.rubyValues.receiverExports.consumingReceivers = "copied-leaves"; }
		, value => { value.rubyValues.receiverExports.exports[0].member = "wrong"; }
		, value => { value.rubyValues.receiverExports.exports[0].kind = "function"; }
		, value => { value.rubyValues.schemaVersion = 3; }
	]) {
		const changed = structuredClone(adapter); mutate(changed);
		await saveLakeFile(adapterRoot, "native-ruby-adapter.json", canonicalJson(changed));
		await assert.rejects(packageOwnedRuby({ ...packageOptions, working: join(directory, `forged-${rejected}`) }), /compiler-authenticated/u);
		rejected++;
	}
	await saveLakeFile(adapterRoot, "native-ruby-adapter.json", canonicalJson(adapter));
	for(const path of [`src/${verified.prefix}.c`, `src/${verified.prefix}-ruby.c`, "internal/ruby-abi.h", `lib/${adapter.library}`])
	{
		const source = await readFile(join(adapterRoot, path)), changed = Buffer.concat([source, Buffer.from("\n/* changed receiver adapter */\n")]);
		const forged = structuredClone(adapter);
		if(!path.startsWith("lib/")) forged.files[path] = { bytes: changed.length, sha256: sha256(changed) };
		await saveLakeFile(adapterRoot, path, changed); await saveLakeFile(adapterRoot, "native-ruby-adapter.json", canonicalJson(forged));
		await assert.rejects(packageOwnedRuby({ ...packageOptions, working: join(directory, `forged-${rejected}`) }));
		rejected++;
		await saveLakeFile(adapterRoot, path, source); await saveLakeFile(adapterRoot, "native-ruby-adapter.json", canonicalJson(adapter));
	}
	const handoffReceipt = await copyPackageSetHandoff(output, handoff);
	const dependencies = mode === "reviewed" ? await prepareRustCorpusDependencies({ rustRoot: join(output, "native/rust"), directory, handoff, environment }) : null;
	if(dependencies) await cp(join(handoff, dependencies.archive), join(consumer, "dependencies", dependencies.archive), { recursive: true });
	const verification = await context.removeAuthor(), companions = {};
	if(mode === "reviewed")
	{
		for(const [profile, target, probe, success] of [
			["cpp", "cpp", "#define OWNED_BORROW_INSTALLED 1\n" + await ownedCppReceiverProbe(), "owned-cpp-receivers-installed"]
			, ["rust", "cargo", "use owned_receivers::*;\n" + await ownedRustReceiverProbe(), "owned-rust-receivers"]
		]) {
			const observed = await installCopiedConsumer({ profile, consumer, handoff
				, environment, dependencies
				, packages: handoffReceipt.packages.filter(item => item.target === target)
				, fixture: { source: async () => probe, success } });
			assert.ok(observed.checks > 300); companions[profile] = { checks: observed.checks, probeSha256: sha256(probe) };
		}
		const root = join(consumer, "python"), pkg = handoffReceipt.packages.find(item => item.target === "pypi");
		const { command, ...installation } = await installPythonWheel({ root
			, archive: join(handoff, pkg.artifacts[0].path)
			, python: environment.LEAN_BRIDGE_PYTHON, typingVersion: "4.6.0" });
		const probe = await ownedPythonInstalledReceiverProbe();
		await saveLakeFile(root, "consumer.py", probe);
		const executed = await runCopied(command, ["-I", "-B", "consumer.py"], root);
		assert.equal(executed.stderr, ""); const observed = JSON.parse(executed.stdout);
		assert.equal(observed.ordinaryImport, true); assert.ok(observed.checks > 350);
		companions.python = { checks: observed.checks, probeSha256: sha256(probe), installation };
	}
	const pkg = handoffReceipt.packages.find(item => item.target === "rubygems"), archive = join(handoff, pkg.artifacts[0].path);
	assert.equal(sha256(await readFile(archive)), pkg.artifacts[0].sha256);
	const gemRoot = join(consumer, "gems"), command = environment.LEAN_BRIDGE_RUBY;
	await mkdir(consumer, { recursive: true });
	const env = { ...copiedCleanEnvironment, GEM_HOME: gemRoot, GEM_PATH: gemRoot };
	await runCopied(command, [environment.LEAN_BRIDGE_GEM, "install", "--norc", archive, "--local", "--install-dir", gemRoot, "--no-document"], consumer, env);
	const installed = (await runCopied(command, ["-e", 'print Gem::Specification.find_by_name("owned-receivers", "1.2.3").full_gem_path'], consumer, env)).stdout;
	assert.ok(installed.startsWith(`${gemRoot}/gems/`));
	const manifest = await json(join(installed, "lean-bridge/package-receipt.json"));
	assert.equal(manifest.schemaVersion, 4); assert.equal(manifest.kind, "lean-bridge-owned-rubygems-package");
	assert.deepEqual(manifest.ownedValues, verified.ruby.contract); await verifyNativeFiles(installed, manifest.files);
	assert.ok(Object.keys(manifest.files).some(path => path.endsWith("sources/gmp-6.3.0.tar.xz")));
	const source = await ownedRubyInstalledReceiverProbe();
	await saveLakeFile(consumer, "consumer.rb", source);
	const executed = await runCopied(command, ["consumer.rb"], consumer, env);
	assert.equal(executed.stderr, ""); const result = JSON.parse(executed.stdout);
	assert.equal(result.ordinaryRequire, true); assert.ok(result.checks > 100);
	const loaderSource = await readFile("tests/fixtures/structured-types/owned-ruby-installed-loader.rb", "utf8");
	await saveLakeFile(consumer, "loader.rb", loaderSource);
	const inspected = await runCopied(command, ["loader.rb", verified.ruby.requirePath, verified.ruby.componentName], consumer, env);
	assert.equal(inspected.stderr, ""); const loader = JSON.parse(inspected.stdout);
	assert.deepEqual(loader.consumer, result); assert.equal(loader.liveIdentities, 0);
	assert.equal(loader.runtimeInitializations, 1); assert.equal(loader.componentInitializations, 1);
	assert.equal(loader.privateGmp, true); assert.equal(loader.forkBeforeLock, true); assert.equal(loader.concurrentRequires, 4);
	const documented = await readFile("tests/fixtures/documentation/consumers/ruby/owned-receivers.rb", "utf8");
	assert.equal((await readFile("docs/consume/ruby.md", "utf8")).match(/```ruby file=ruby\/owned-receivers\.rb\n([\s\S]*?)```/u)?.[1], documented);
	await saveLakeFile(consumer, "documentation.rb", documented);
	const example = await runCopied(command, ["documentation.rb"], consumer, env);
	assert.equal(example.stdout, "42\n42\n"); assert.equal(example.stderr, "");
	const entry = ["-e", `require ${JSON.stringify(verified.ruby.requirePath)}`];
	const library = join(installed, "lib", verified.ruby.requirePath, "native/linux-x64", adapter.library);
	const original = await readFile(library), corrupt = Buffer.from(original); corrupt[0] ^= 1;
	await saveLakeFile(dirname(library), adapter.library, corrupt);
	await assert.rejects(runCopied(command, entry, consumer, env), error => /differs from compiled evidence/u.test(error.details?.stderr));
	await saveLakeFile(dirname(library), adapter.library, original);
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
	await saveLakeFile("build/owned-ruby-receivers", mode + "-package.json", canonicalJson({
		mode, metadata, model, componentReceipt, adapter, runtime: verified.runtime
		, packageSetReceipt: handoffReceipt, packages: projection.packages
		, cli: context.cli, cliInstallation: context.cliInstallation
		, builds: context.builds, verification
		, sourceRemovedBeforeInstall: true, cliRemovedBeforeConsumerInstall: true
		, sourceFreeInstallation: true, sourceFreeRelocatedExecution: true
		, handoffRemovedBeforeRelocatedExecution: true, gemCacheRemoved: true
		, deterministicReassembly: true, independentRebuild: true, needed
		, rejected, incapableReadersRejected: 4, observation: result
		, relocatedObservation: JSON.parse(moved.stdout), manifest, loader
		, loaderRejected: ["changed-library", "symlink-library", "mn-threads", "unverified-runtime"]
		, consumerSha256: sha256(source), loaderProbeSha256: sha256(loaderSource)
		, documentation: { sourceSha256: sha256(documented), stdout: example.stdout }
		, companions, dependencies
	}));
	t.diagnostic(`${mode}: ${result.checks}+${result.checks} installed and relocated receiver checks`);
});
