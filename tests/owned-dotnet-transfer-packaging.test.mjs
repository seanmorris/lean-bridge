/**
 * Source-free NuGet consumers preserve compiler-authenticated ownership moves.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCValues } from "../src/backends/c/owned-values.mjs";
import { generateOwnedDotnetPackage } from "../src/backends/dotnet/owned-package.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { ownedDotnetEvidence } from "../src/build/owned-dotnet-artifacts.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { packageOwnedNuget } from "../src/release/owned-nuget.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { ownedRustTransferReviewedIr, ownedRustTransferConfiguration, ownedRustTransferSource } from "./helpers/owned-rust-transfer-fixture.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";
import { ownedDotnetRuntimeOnly } from "./helpers/owned-dotnet-installed.mjs";
import { checkOwnedDotnetTransferDocumentation, ownedDotnetTransferProject, rejectOwnedDotnetTransferConsumers } from "./helpers/owned-dotnet-transfer-installed.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { installPythonWheel } from "./helpers/python-wheel-install.mjs";
import { prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("NuGet contracts bind consuming inputs without changing borrow-only packages", () => {
	const ir = ownedRustTransferReviewedIr();
	const generated = generateOwnedDotnetPackage(ir, null, { transferredInputs: true });
	assert.equal(generated.contract.schemaVersion, 2);
	assert.equal(generated.contract.inputTransfers.arguments, "ordinary-values");
	assert.equal(JSON.parse(generated.files["binding-manifest.json"]).backend, "owned-dotnet-v2");
	assert.throws(() => generateOwnedDotnetPackage(ir), /call-scoped input borrows/u);
	for(const fixture of [ownedCppCompositionReviewedIr, ownedPythonScalarsReviewedIr])
	{
		const borrowed = fixture(), unchanged = generateOwnedDotnetPackage(borrowed);
		const enabled = generateOwnedDotnetPackage(borrowed, null, { transferredInputs: true });
		assert.deepEqual(enabled.files, unchanged.files);
		assert.deepEqual(enabled.contract, unchanged.contract);
		assert.equal(enabled.c.header, unchanged.c.header);
	}
});

for(const mode of ["ordinary", "reviewed"]) test(`installed NuGet inputs preserve transfer decisions (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_DOTNET_TRANSFER_TEST !== "1"
	, timeout: 1200000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-dotnet-transfers-${mode}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const project = join(directory, "source"), output = join(directory, "producer");
	const handoff = join(directory, "handoff"), consumer = join(directory, "consumer");
	await cp(resolve("tests/fixtures/onboarding/owned-aggregates"), project, { recursive: true });
	await saveLakeFile(project, "Owned.lean", await readFile(join(project, "Owned.lean"), "utf8") + ownedRustTransferSource);
	const config = mode === "ordinary" ? await ownedRustTransferConfiguration() : { schemaVersion: 1, modules: ["Owned"] };
	config.targets = { nuget: { name: "Owned.Transfers", version: "1.2.3" } };
	const combined = mode === "reviewed";
	if(combined) Object.assign(config.targets, {
		c: { name: "owned-c-transfers", version: "1.2.3" }
		, cpp: { name: "owned-cpp-transfers", version: "1.2.3" }
		, cargo: { name: "owned-transfers", version: "1.2.3" }
		, pypi: { name: "owned-transfers", version: "1.2.3" }
		, rubygems: { name: "owned-transfers", version: "1.2.3" } });
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(combined) await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ownedRustTransferReviewedIr()));
	const before = await lakeInputState(project);
	const environment = { ...nativeFixtureEnvironment(combined ? ["dotnet", "ruby", "python", "rust"] : ["dotnet"])
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
	const projection = built.projections?.find(item => item.ecosystem === "nuget") ?? built;
	assert.equal(projection.backend, "owned-dotnet-v2");
	assert.deepEqual((built.projections ?? [built]).map(item => item.ecosystem).sort(), Object.keys(config.targets).sort());
	const nativeRoot = join(output, "native/component"), runtimeRoot = join(output, "native/runtime");
	const adapterRoot = join(output, "native/owned-dotnet-binding"), dotnetRoot = join(output, "native/dotnet");
	const verified = await ownedDotnetEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	assert.equal(verified.model.exports.length, 26);
	assert.equal(Boolean(verified.model.sourceIdentity.reviewedBindingIr), combined);
	assert.equal(verified.adapter.schemaVersion, 2);
	assert.equal(verified.adapter.ownedValues.schemaVersion, 3);
	assert.equal(verified.adapter.dotnetValues.schemaVersion, 2);
	assert.equal(verified.projection.c.functions.filter(fn => fn.transfers?.length).length, 20);
	const compiled = await json(join(dotnetRoot, "native-dotnet.json"));
	assert.equal(compiled.schemaVersion, 2);
	const input = { metadata: await json(join(nativeRoot, "metadata.json")), sourceIdentity: verified.model.sourceIdentity, component: verified.model.component };
	const options = { nativeRoot, runtimeRoot, adapterRoot, dotnetRoot
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, settings: config.targets.nuget
		, glibcMinimumVersion: projection.glibcMinimumVersion };
	const dynamic = await runCopied("readelf", ["-d", join(adapterRoot, "lib", verified.adapter.library)], directory, environment);
	const needed = [...dynamic.stdout.matchAll(/\(NEEDED\).*?\[([^\]]+)\]/gu)].map(match => match[1]);
	assert.equal(needed[0], "libgmp-lean-bridge.so.10");
	assert.ok(needed.includes(verified.receipt.library)); assert.ok(needed.includes("libleanshared.so"));
	const mutations = ["adapter-version", "contract-version", "consumption"
		, "aliases"
		, "native-transfers", "lifetime", "source", "guard", "gmp-receipt"
		, "gmp-source", "library", "unrecorded"];
	for(const mutation of mutations)
	{
		const forged = structuredClone(verified.adapter); let path, original;
		if(mutation === "adapter-version") forged.schemaVersion = 1;
		else if(mutation === "contract-version") forged.dotnetValues.schemaVersion = 1;
		else if(mutation === "consumption") forged.dotnetValues.inputTransfers.consumption = "after-lean-call";
		else if(mutation === "aliases") forged.dotnetValues.inputTransfers.aliases = "wrapper-only";
		else if(mutation === "native-transfers") delete forged.ownedValues.inputTransfers;
		else if(mutation === "lifetime") forged.dotnetValues.guardSha256 = "0".repeat(64);
		else
		{
			path = ({ source: `src/${verified.prefix}-dotnet.c`
				, guard: `src/${verified.prefix}-dotnet-thread-exit.cpp`
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
		await saveLakeFile(adapterRoot, "native-dotnet-adapter.json", canonicalJson(forged));
		await assert.rejects(packageOwnedNuget({ ...options, working: join(directory, `forged-${mutation}`) }));
		if(path)
		{
			if(original) await saveLakeFile(adapterRoot, path, original);
			else await rm(join(adapterRoot, path));
		}
		await saveLakeFile(adapterRoot, "native-dotnet-adapter.json", canonicalJson(verified.adapter));
	}
	const apiPath = `src/${verified.projection.assembly}/Api.cs`;
	const originalApi = await readFile(join(dotnetRoot, apiPath));
	const changedApi = Buffer.concat([originalApi, Buffer.from("\n// changed ownership API\n")]);
	const forgedManaged = structuredClone(compiled);
	forgedManaged.files[apiPath] = { bytes: changedApi.length, sha256: sha256(changedApi) };
	await saveLakeFile(dotnetRoot, apiPath, changedApi);
	await saveLakeFile(dotnetRoot, "native-dotnet.json", canonicalJson(forgedManaged));
	await assert.rejects(packageOwnedNuget({ ...options, working: join(directory, "forged-managed") }), /Generated owned C# source differs/u);
	await saveLakeFile(dotnetRoot, apiPath, originalApi);
	await saveLakeFile(dotnetRoot, "native-dotnet.json", canonicalJson({ ...compiled, schemaVersion: 1 }));
	await assert.rejects(packageOwnedNuget({ ...options, working: join(directory, "forged-managed-version") }), /Compiled owned C# projection differs/u);
	await saveLakeFile(dotnetRoot, "native-dotnet.json", canonicalJson(compiled));
	const reassembled = join(directory, "reassembled"), rebuilt = await packageOwnedNuget({ ...options, working: reassembled });
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
		const rubyRoot = join(consumer, "ruby"), gem = receipt.packages.find(item => item.target === "rubygems");
		const gemRoot = join(rubyRoot, "gems"), ruby = environment.LEAN_BRIDGE_RUBY;
		await mkdir(rubyRoot, { recursive: true });
		const env = { ...copiedCleanEnvironment, GEM_HOME: gemRoot, GEM_PATH: gemRoot };
		await runCopied(ruby, [environment.LEAN_BRIDGE_GEM, "install", "--norc", join(handoff, gem.artifacts[0].path), "--local", "--install-dir", gemRoot, "--no-document"], rubyRoot, env);
		await saveLakeFile(rubyRoot, "consumer.rb", await readFile("tests/fixtures/structured-types/owned-installed-ruby-transfers.rb", "utf8"));
		const called = await runCopied(ruby, ["consumer.rb"], rubyRoot, env);
		assert.equal(called.stderr, ""); const rubyResult = JSON.parse(called.stdout);
		assert.equal(rubyResult.ordinaryRequire, true); assert.equal(rubyResult.checks, 101);
		companions.ruby = rubyResult.checks;
	}
	const pkg = receipt.packages.find(item => item.target === "nuget");
	await cp(join(handoff, pkg.artifacts[0].path), join(consumer, "feed", `${pkg.name}.${pkg.version}.nupkg`), { recursive: true });
	const source = await readFile("tests/fixtures/structured-types/owned-installed-dotnet-transfers.cs", "utf8");
	assert.doesNotMatch(source, /\bunsafe\b|\bNativeLibrary\b|OwnedLoader|\.Interop;|\bIGraphValue\b|\bIOwnedValue\b/u);
	await saveLakeFile(consumer, "Program.cs", source);
	await saveLakeFile(consumer, "Consumer.csproj", ownedDotnetTransferProject(pkg, "Program.cs"));
	await saveLakeFile(consumer, "NuGet.Config", '<configuration><packageSources><clear/><add key="prepared" value="feed"/></packageSources><fallbackPackageFolders><clear/></fallbackPackageFolders></configuration>');
	const command = environment.LEAN_BRIDGE_DOTNET;
	const env = { ...copiedCleanEnvironment, DOTNET_ROOT: dirname(command)
		, DOTNET_CLI_HOME: join(consumer, "home")
		, NUGET_PACKAGES: join(consumer, "packages")
		, DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1" };
	await runCopied(command, ["restore", "Consumer.csproj", "--configfile", "NuGet.Config"], consumer, env);
	await runCopied(command, ["build", "Consumer.csproj", "--no-restore", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], consumer, env);
	const installed = join(consumer, "packages", pkg.name.toLowerCase(), pkg.version);
	const manifest = await json(join(installed, "lean-bridge/package-receipt.json"));
	assert.equal(manifest.schemaVersion, 2); assert.equal(manifest.kind, "lean-bridge-owned-nuget-package");
	assert.deepEqual(manifest.ownedValues, verified.projection.contract);
	// The handoff checks OPC archive bytes; NuGet normalizes these envelopes.
	const installedFiles = Object.fromEntries(Object.entries(manifest.files)
		.filter(([path]) => !["[Content_Types].xml", "_rels/.rels", `${pkg.name}.nuspec`].includes(path)));
	await verifyNativeFiles(installed, installedFiles);
	assert.ok(Object.keys(manifest.files).some(path => path.endsWith("sources/gmp-6.3.0.tar.xz")));
	const result = await runCopied(command, ["out/Consumer.dll"], consumer, env);
	assert.equal(result.stderr, ""); const observation = JSON.parse(result.stdout);
	t.diagnostic(JSON.stringify(observation));
	assert.equal(observation.safePublicApi, true); assert.ok(observation.checks >= 100);
	const rejectedConsumers = await rejectOwnedDotnetTransferConsumers({ consumer, pkg, namespace: verified.projection.namespace, command, env });
	const documentation = await checkOwnedDotnetTransferDocumentation({ consumer, pkg, command, env });
	const library = join(consumer, "out/runtimes/linux-x64/native", verified.adapter.library);
	const original = await readFile(library), corrupt = Buffer.from(original); corrupt[0] ^= 1;
	await saveLakeFile(dirname(library), verified.adapter.library, corrupt);
	await assert.rejects(runCopied(command, ["out/Consumer.dll"], consumer, env), error => /differs from the compiled package/u.test(error.details?.stderr));
	await saveLakeFile(dirname(library), verified.adapter.library, original);
	await rename(library, `${library}.original`); await symlink(`${library}.original`, library);
	await assert.rejects(runCopied(command, ["out/Consumer.dll"], consumer, env), error => /must be a regular file/u.test(error.details?.stderr));
	await rm(library); await rename(`${library}.original`, library);
	await rm(handoff, { recursive: true, force: true });
	await rm(join(consumer, "feed"), { recursive: true, force: true });
	await rm(join(consumer, "packages"), { recursive: true, force: true });
	await rename(join(consumer, "out"), join(consumer, "relocated"));
	await assert.rejects(access(handoff), { code: "ENOENT" });
	const runtime = await ownedDotnetRuntimeOnly(join(directory, "runtime-only"), command);
	await rm(join(consumer, "obj"), { recursive: true, force: true });
	for(const name of ["Program.cs", "Consumer.csproj", "Invalid.cs", "Invalid.csproj", "Example.cs", "Example.csproj", "NuGet.Config"])
		await rm(join(consumer, name));
	const moved = await runCopied(runtime.executable, ["relocated/Consumer.dll"], consumer, runtime.env);
	assert.deepEqual(moved, result);
	assert.deepEqual(await runCopied(runtime.executable, ["example/Example.dll"], consumer, runtime.env),
		{ code: 0, stdout: documentation.stdout, stderr: documentation.stderr });
	await saveLakeFile(resolve("build/owned-dotnet-transfer-packaging"), `${mode}.json`, canonicalJson({
		schemaVersion: 1, planNode: 1219, mode, compiledLean: true
		, installedPackage: true, installedNuget: true, sourceUnchanged: true
		, sourceFreeInstallation: true, sourceFreeRelocatedExecution: true
		, handoffRemoved: true, packageCacheRemoved: true, sdkFreeExecution: true
		, consumerSourceRemoved: true, deterministicReassembly: true
		, safePublicApi: true, needed
		, tamperRejected: [...mutations, "managed-source", "managed-version"]
		, loaderRejected: ["changed-library", "symlink-library"]
		, consumerSha256: sha256(source), rejectedConsumers, documentation
		, companions, dependencies, observation
		, relocatedObservation: JSON.parse(moved.stdout)
		, manifest, input, componentReceipt: verified.receipt
		, adapterReceipt: verified.adapter, compiledProjection: compiled
		, runtimeReceipt: verified.runtime, packageSetReceipt: receipt
	}));
	t.diagnostic(`${mode}: ${observation.checks}+${observation.checks} installed and relocated checks`);
});
