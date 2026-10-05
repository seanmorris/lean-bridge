/**
 * Source-free gems preserve compiler-authenticated input transfer decisions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCValues } from "../src/backends/c/owned-values.mjs";
import { generateOwnedRubyPackage } from "../src/backends/ruby/owned-package.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { ownedRubyEvidence } from "../src/build/owned-ruby-artifacts.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { packageOwnedRuby } from "../src/release/owned-rubygems.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { ownedRustTransferReviewedIr, ownedRustTransferConfiguration, ownedRustTransferSource } from "./helpers/owned-rust-transfer-fixture.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { installPythonWheel } from "./helpers/python-wheel-install.mjs";
import { prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("Ruby gems bind consuming arguments without changing borrow-only packages", () => {
	const ir = ownedRustTransferReviewedIr();
	const generated = generateOwnedRubyPackage(ir, null, { transferredInputs: true });
	assert.equal(generated.contract.schemaVersion, 2);
	assert.equal(generated.contract.inputTransfers.arguments, "ordinary-values");
	assert.equal(JSON.parse(generated.files["binding-manifest.json"]).backend, "owned-ruby-v2");
	assert.throws(() => generateOwnedRubyPackage(ir), /call-scoped input borrows/u);
	for(const fixture of [ownedCppCompositionReviewedIr, ownedPythonScalarsReviewedIr])
	{
		const borrowed = fixture(), unchanged = generateOwnedRubyPackage(borrowed);
		const enabled = generateOwnedRubyPackage(borrowed, null, { transferredInputs: true });
		assert.deepEqual(enabled.files, unchanged.files);
		assert.deepEqual(enabled.contract, unchanged.contract);
		assert.equal(enabled.abiHeader, unchanged.abiHeader);
	}
});

for(const mode of ["ordinary", "reviewed"]) test(`installed Ruby inputs preserve transfer decisions (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_RUBY_TRANSFER_TEST !== "1"
	, timeout: 1200000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-ruby-transfers-${mode}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const project = join(directory, "source"), output = join(directory, "producer");
	const handoff = join(directory, "handoff"), consumer = join(directory, "consumer");
	await cp(resolve("tests/fixtures/onboarding/owned-aggregates"), project, { recursive: true });
	await saveLakeFile(project, "Owned.lean", await readFile(join(project, "Owned.lean"), "utf8") + ownedRustTransferSource);
	const config = mode === "ordinary" ? await ownedRustTransferConfiguration() : { schemaVersion: 1, modules: ["Owned"] };
	config.targets = { rubygems: { name: "owned-transfers", version: "1.2.3" } };
	const combined = mode === "reviewed";
	if(combined) Object.assign(config.targets, {
		c: { name: "owned-c-transfers", version: "1.2.3" }
		, cpp: { name: "owned-cpp-transfers", version: "1.2.3" }
		, cargo: { name: "owned-transfers", version: "1.2.3" }
		, pypi: { name: "owned-transfers", version: "1.2.3" } });
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(combined) await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ownedRustTransferReviewedIr()));
	const before = await lakeInputState(project);
	const environment = { ...nativeFixtureEnvironment(combined ? ["ruby", "python", "rust"] : ["ruby"])
		, LEAN_BRIDGE_RUBY: resolve(process.env.LEAN_BRIDGE_RUBY ?? ".toolchains/ruby33/bin/ruby")
		, LEAN_BRIDGE_GEM: resolve(process.env.LEAN_BRIDGE_GEM ?? ".toolchains/ruby33/bin/gem")
		, LEAN_BRIDGE_PYTHON: resolve(process.env.LEAN_BRIDGE_PYTHON ?? ".toolchains/python311/bin/python3.11")
		, CARGO_HOME: process.env.CARGO_HOME ?? resolve(".toolchains/cargo-copied") };
	let built;
	try
	{ built = await buildCanonicalProject({ projectRoot: project
		, outputRoot: output, targets: Object.keys(config.targets), environment
		, onProgress: event => t.diagnostic(`${mode}: ${event.message}`) }); }
	catch(error)
	{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
	assert.deepEqual(await lakeInputState(project), before);
	const projection = built.projections?.find(item => item.ecosystem === "rubygems") ?? built;
	assert.equal(projection.backend, "owned-ruby-v2");
	assert.deepEqual((built.projections ?? [built]).map(item => item.ecosystem).sort(), Object.keys(config.targets).sort());
	const nativeRoot = join(output, "native/component"), runtimeRoot = join(output, "native/runtime"), adapterRoot = join(output, "native/owned-ruby-binding");
	const verified = await ownedRubyEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	assert.equal(verified.model.exports.length, 26);
	assert.equal(Boolean(verified.model.sourceIdentity.reviewedBindingIr), combined);
	assert.equal(verified.adapter.schemaVersion, 2);
	assert.equal(verified.adapter.ownedValues.schemaVersion, 3);
	assert.equal(verified.adapter.rubyValues.schemaVersion, 2);
	assert.equal(verified.ruby.c.functions.filter(fn => fn.transfers?.length).length, 20);
	const input = { metadata: await json(join(nativeRoot, "metadata.json")), sourceIdentity: verified.model.sourceIdentity, component: verified.model.component };
	const options = { nativeRoot, runtimeRoot, adapterRoot, environment
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, settings: config.targets.rubygems
		, glibcMinimumVersion: projection.glibcMinimumVersion };
	const dynamic = await runCopied("readelf", ["-d", join(adapterRoot, "lib", verified.adapter.library)], directory, environment);
	const needed = [...dynamic.stdout.matchAll(/\(NEEDED\).*?\[([^\]]+)\]/gu)].map(match => match[1]);
	assert.equal(needed[0], "libgmp-lean-bridge.so.10");
	assert.ok(needed.includes(verified.receipt.library)); assert.ok(needed.includes("libleanshared.so"));
	const mutations = ["adapter-version", "contract-version", "consumption"
		, "aliases", "native-transfers", "lifetime", "source", "boundary", "abi"
		, "gmp-receipt", "gmp-source", "library", "unrecorded"];
	for(const mutation of mutations)
	{
		const forged = structuredClone(verified.adapter); let path, original;
		if(mutation === "adapter-version") forged.schemaVersion = 1;
		else if(mutation === "contract-version") forged.rubyValues.schemaVersion = 1;
		else if(mutation === "consumption") forged.rubyValues.inputTransfers.consumption = "after-lean-call";
		else if(mutation === "aliases") forged.rubyValues.inputTransfers.aliases = "wrapper-only";
		else if(mutation === "native-transfers") delete forged.ownedValues.inputTransfers;
		else if(mutation === "lifetime") forged.rubyValues.callbackLifetime = "retained";
		else
		{
			path = ({ source: `src/${verified.prefix}.c`
				, boundary: `src/${verified.prefix}-ruby.c`
				, abi: "internal/ruby-abi.h"
				, "gmp-receipt": "gmp/share/lean-bridge/gmp.json"
				, "gmp-source": "gmp/share/lean-bridge/sources/gmp-6.3.0.tar.xz"
				, library: `lib/${verified.adapter.library}`
				, unrecorded: "unexpected.txt" })[mutation];
			original = mutation === "unrecorded" ? null : await readFile(join(adapterRoot, path));
			const changed = mutation === "gmp-receipt" ? Buffer.from(canonicalJson({ ...JSON.parse(original), binding: "global-symbols" }))
				: Buffer.concat([original ?? Buffer.alloc(0), Buffer.from("\n/* modified transfer projection */\n")]);
			await saveLakeFile(adapterRoot, path, changed);
			if(!["library", "unrecorded"].includes(mutation)) forged.files[path] = { bytes: changed.length, sha256: sha256(changed) };
		}
		await saveLakeFile(adapterRoot, "native-ruby-adapter.json", canonicalJson(forged));
		await assert.rejects(packageOwnedRuby({ ...options, working: join(directory, `forged-${mutation}`) }));
		if(path)
		{
			if(original) await saveLakeFile(adapterRoot, path, original);
			else await rm(join(adapterRoot, path));
		}
		await saveLakeFile(adapterRoot, "native-ruby-adapter.json", canonicalJson(verified.adapter));
	}
	const reassembled = join(directory, "reassembled"), rebuilt = await packageOwnedRuby({ ...options, working: reassembled });
	assert.deepEqual(rebuilt.packages, projection.packages);
	assert.deepEqual(await readFile(join(reassembled, "archives", rebuilt.packages[0].archive)), await readFile(join(output, "archives", projection.packages[0].archive)));
	await rm(reassembled, { recursive: true, force: true });
	const receipt = await copyPackageSetHandoff(output, handoff);
	const dependencies = combined ? await prepareRustCorpusDependencies({ rustRoot: join(output, "native/rust"), directory, handoff, environment }) : null;
	if(dependencies) await cp(join(handoff, dependencies.archive), join(consumer, "dependencies", dependencies.archive), { recursive: true });
	await rm(project, { recursive: true, force: true }); await rm(output, { recursive: true, force: true });
	await assert.rejects(access(project), { code: "ENOENT" }); await assert.rejects(access(output), { code: "ENOENT" });
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const companions = {};
	if(combined)
	{
		const values = generateOwnedCValues(verified.model.bindingIr, { hostCallbacks: true, transferredInputs: true });
		const shapes = [["OPTION", "echoOption"], ["ARRAY", "echoArray"]
			, ["LIST", "echoList"], ["RESULT", "echoResult"]
			, ["TUPLE", "echoTuple"], ["ROW", "echoRow"], ["NESTED", "echoNested"]];
		const macros = shapes.map(([macro, name]) => {
			const type = values.functions.find(item => item.name === name).parameters[0];
			return `#define COPY_${macro} ${values.copies.find(item => item.id === type).cName}`;
		}).join("\n") + "\n#include \"owned_aggregates.h\"\ntypedef owned_aggregates_mixed_product_snd_t owned_aggregates_echo_tuple_argument0_snd_t;\n";
		for(const [profile, target, path, prefix, success, checks] of [
			["c", "c", "owned-installed-transfers.c", macros, "owned-transfers-installed", 446]
			, ["cpp", "cpp", "owned-cpp-transfers.cpp", "#define OWNED_TRANSFER_INSTALLED 1\n", "owned-cpp-transfers-installed", 158]
			, ["rust", "cargo", "owned-rust-transfers.rs", "use owned_transfers::*;\n", "owned-rust-transfers-installed", 222]
		]) {
			const observed = await installCopiedConsumer({ profile, consumer, handoff
				, environment, dependencies
				, packages: receipt.packages.filter(item => item.target === target)
				, fixture: { source: async () => prefix + await readFile(`tests/fixtures/structured-types/${path}`, "utf8"), success } });
			assert.equal(observed.checks, checks); companions[profile] = observed.checks;
		}
		const root = join(consumer, "python"), wheel = receipt.packages.find(item => item.target === "pypi");
		const { command } = await installPythonWheel({ root
			, archive: join(handoff, wheel.artifacts[0].path)
			, python: environment.LEAN_BRIDGE_PYTHON, typingVersion: "4.6.0" });
		await saveLakeFile(root, "consumer.py", await readFile("tests/fixtures/structured-types/owned-installed-python-transfers.py", "utf8"));
		const observed = await runCopied(command, ["-I", "-B", "consumer.py"], root);
		assert.equal(observed.stderr, "");
		const result = JSON.parse(observed.stdout); assert.equal(result.checks, 106); assert.equal(result.ordinaryImport, true);
		companions.python = result.checks;
	}
	const pkg = receipt.packages.find(item => item.target === "rubygems"), archive = join(handoff, pkg.artifacts[0].path);
	const gemRoot = join(consumer, "gems"), command = environment.LEAN_BRIDGE_RUBY;
	await mkdir(consumer, { recursive: true });
	const env = { ...copiedCleanEnvironment, GEM_HOME: gemRoot, GEM_PATH: gemRoot };
	await runCopied(command, [environment.LEAN_BRIDGE_GEM, "install", "--norc", archive, "--local", "--install-dir", gemRoot, "--no-document"], consumer, env);
	const installed = (await runCopied(command, ["-e", 'print Gem::Specification.find_by_name("owned-transfers", "1.2.3").full_gem_path'], consumer, env)).stdout;
	assert.ok(installed.startsWith(`${gemRoot}/gems/`));
	const manifest = await json(join(installed, "lean-bridge/package-receipt.json"));
	assert.equal(manifest.schemaVersion, 2); assert.equal(manifest.kind, "lean-bridge-owned-rubygems-package");
	assert.deepEqual(manifest.ownedValues, verified.ruby.contract);
	await verifyNativeFiles(installed, manifest.files);
	assert.ok(Object.keys(manifest.files).some(path => path.endsWith("sources/gmp-6.3.0.tar.xz")));
	const source = await readFile("tests/fixtures/structured-types/owned-installed-ruby-transfers.rb", "utf8");
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
	assert.equal(loader.privateGmp, true); assert.equal(loader.forkBeforeLock, true);
	const documented = await readFile("tests/fixtures/documentation/consumers/ruby/owned-transfers.rb", "utf8");
	await saveLakeFile(consumer, "documentation.rb", documented);
	const example = await runCopied(command, ["documentation.rb"], consumer, env);
	assert.equal(example.stdout, "transferred\n"); assert.equal(example.stderr, "");
	const entry = ["-e", `require ${JSON.stringify(verified.ruby.requirePath)}`];
	const library = join(installed, "lib", verified.ruby.requirePath, "native/linux-x64", verified.adapter.library);
	const original = await readFile(library), corrupt = Buffer.from(original); corrupt[0] ^= 1;
	await saveLakeFile(dirname(library), verified.adapter.library, corrupt);
	await assert.rejects(runCopied(command, entry, consumer, env), error => /differs from compiled evidence/u.test(error.details?.stderr));
	await saveLakeFile(dirname(library), verified.adapter.library, original);
	await rename(library, `${library}.original`); await symlink(`${library}.original`, library);
	await assert.rejects(runCopied(command, entry, consumer, env), error => /differs from compiled evidence/u.test(error.details?.stderr));
	await rm(library); await rename(`${library}.original`, library);
	await assert.rejects(runCopied(command, entry, consumer, { ...env, RUBY_MN_THREADS: "1" }), error => /1:1 threads/u.test(error.details?.stderr));
	await assert.rejects(runCopied(command, entry, consumer, { ...env, LD_PRELOAD: join(dirname(library), "libleanshared.so") }), error => /Unverified native library/u.test(error.details?.stderr));
	await rm(handoff, { recursive: true, force: true });
	await rm(join(gemRoot, "cache"), { recursive: true, force: true });
	const relocated = join(consumer, "relocated-gems"); await rename(gemRoot, relocated);
	await assert.rejects(access(gemRoot), { code: "ENOENT" });
	await assert.rejects(access(handoff), { code: "ENOENT" });
	const moved = await runCopied(command, ["consumer.rb"], consumer, { ...env, GEM_HOME: relocated, GEM_PATH: relocated });
	assert.deepEqual(moved, executed);
	await verifyNativeFiles(join(relocated, relative(gemRoot, installed)), manifest.files);
	await saveLakeFile(resolve("build/owned-ruby-transfer-packaging"), `${mode}.json`, canonicalJson({
		schemaVersion: 1, planNode: 1219, mode, compiledLean: true
		, installedPackage: true, sourceUnchanged: true
		, sourceFreeInstallation: true
		, sourceFreeRelocatedExecution: true
		, handoffRemovedBeforeRelocatedExecution: true, gemCacheRemoved: true
		, deterministicReassembly: true, ordinaryRequire: true, needed
		, tamperRejected: mutations
		, loaderRejected: ["changed-library", "symlink-library", "mn-threads", "unverified-runtime"]
		, consumerSha256: sha256(source), observation: result
		, loader, loaderProbeSha256: sha256(loaderSource)
		, documentation: { sha256: sha256(documented), stdout: example.stdout }
		, companions, dependencies, relocatedObservation: JSON.parse(moved.stdout)
		, manifest, input
		, componentReceipt: verified.receipt, adapterReceipt: verified.adapter
		, runtimeReceipt: verified.runtime, packageSetReceipt: receipt
	}));
	t.diagnostic(`${mode}: ${result.checks}+${result.checks} installed and relocated checks`);
});
