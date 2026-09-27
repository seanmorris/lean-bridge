/**
 * Prepared C++ owned-value packages installed without producer sources or Lean.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCppPackage } from "../src/backends/cpp/owned-package.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { readVerifiedNativeComponent, readVerifiedNativeRuntime, verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { packageOwnedNativeC } from "../src/release/owned-c-package.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const enabled = process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST === "1";

test("owned C++ package sources are deterministic, named and pinned", () => {
	const ir = ownedCppCompositionReviewedIr(), before = structuredClone(ir);
	const package0 = generateOwnedCppPackage(ir); assert.deepEqual(ir, before);
	const reversed = structuredClone(ir); reversed.types.reverse();
	const package1 = generateOwnedCppPackage(reversed);
	assert.deepEqual(package0.files, package1.files); assert.deepEqual(package0.contract, package1.contract);
	assert.equal(package0.c.functions.length, 31);
	assert.equal(package0.contract.boost.version, "1.90.0");
	assert.equal(package0.contract.headerSha256, sha256(package0.files["include/owned_aggregates.hpp"]));
	assert.match(package0.valuesHeader, /std::optional<Box<Chain>>/u);
	assert.ok(Object.hasOwn(package0.files, "share/lean-bridge/licenses/Boost-LICENSE"));
});

test("independent installed C++ consumer compiles against generated public headers", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-owned-cpp-consumer-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const generated = generateOwnedCppPackage(ownedCppCompositionReviewedIr());
	for(const [path, source] of Object.entries({ ...generated.files, "include/owned_aggregates.h": generated.c.header }))
		await saveLakeFile(directory, path, source);
	await saveLakeFile(directory, "consumer.cpp", await readFile("tests/fixtures/structured-types/owned-installed-cpp.cpp", "utf8"));
	await runCopied("/usr/bin/c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror"
		, "-pthread", "-I", "include", "-fsyntax-only", "consumer.cpp"]
	, directory, { PATH: "/usr/bin:/bin" });
});

test("CI executes installed C++ ownership packages and retains both reports", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	for(const suite of ["owned-cpp-runtime", "owned-cpp-callables", "owned-cpp-packaging"])
	{
		const command = `LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/${suite}.test.mjs`;
		assert.ok(workflow.includes("          " + command + "\n"));
		assert.ok(workflow.includes('consumer_command="$consumer_command && ' + command + '"'));
	}
	for(const mode of ["ordinary", "reviewed"])
	{
		assert.ok(workflow.includes(`test -s build/owned-cpp-packaging/${mode}.json`));
		assert.ok(workflow.includes(`            build/owned-cpp-packaging/${mode}.json\n`));
	}
});

for(const mode of ["ordinary", "reviewed"]) test(`installed C++ owned compositions preserve semantics (${mode})`, { skip: !enabled, timeout: 1_200_000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-owned-cpp-package-${mode}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const project = join(directory, "source"), output = join(directory, "producer");
	const handoff = join(directory, "handoff"), consumer = join(directory, "consumer");
	await cp(resolve("tests/fixtures/onboarding/owned-cpp-composition"), project, { recursive: true });
	const config = mode === "ordinary" ? await json(join(project, "lean-bridge.exports.json")) : { schemaVersion: 1, modules: ["Owned"] };
	config.targets = { c: { name: "owned-c-values", version: "1.2.3" }, cpp: { name: "owned-cpp-values", version: "1.2.3" } };
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(mode === "reviewed") await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ownedCppCompositionReviewedIr()));
	const before = await lakeInputState(project), environment = nativeFixtureEnvironment(["c", "cpp"]);
	let built;
	try
	{
		built = await buildCanonicalProject({ projectRoot: project
			, outputRoot: output, targets: ["c", "cpp"], environment
			, onProgress: event => t.diagnostic(`${mode}: ${event.message}`) });
	} catch(error)
	{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
	assert.deepEqual(await lakeInputState(project), before);
	const projection = built.projections.find(item => item.ecosystem === "cpp");
	assert.equal(projection.backend, "native-cpp-owned-v2");
	const runtimeRoot = join(output, "native/runtime"), nativeRoot = join(output, "native/component");
	const { identity } = await readVerifiedNativeRuntime(runtimeRoot);
	const { model, receipt: componentReceipt } = await readVerifiedNativeComponent(nativeRoot, identity, { ownedGraphs: true, ownedHostCallbacks: true });
	assert.equal(model.exports.length, 31); assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	const metadata = await json(join(nativeRoot, "metadata.json")), adapterRoot = join(output, "native/owned-c-binding");
	const adapter = await json(join(adapterRoot, "native-c-adapter.json"));
	const generated = generateOwnedCppPackage(model.bindingIr);
	assert.deepEqual(adapter.cppValues, generated.contract);
	const options = { adapterRoot, nativeRoot, runtimeRoot
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, target: "cpp", settings: config.targets.cpp
		, glibcMinimumVersion: projection.glibcMinimumVersion };
	// Recompute the attacker-controlled file and header hashes. The independently
	// regenerated contract and pinned dependencies must still reject the forgery.
	for(const mutation of ["lifetime", "header", "boost"])
	{
		const forged = structuredClone(adapter);
		let path, original;
		if(mutation === "lifetime") forged.cppValues.callbackLifetime = "retained";
		else
		{
			path = mutation === "header" ? "include/owned_aggregates.hpp" : Object.keys(generated.files).find(path => path.startsWith("include/boost/"));
			original = await readFile(join(adapterRoot, path));
			const changed = Buffer.concat([original, Buffer.from("\n/* forged adapter */\n")]);
			await saveLakeFile(adapterRoot, path, changed);
			forged.files[path] = { bytes: changed.length, sha256: sha256(changed) };
			if(mutation === "header") forged.cppValues.headerSha256 = sha256(changed);
		}
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(forged));
		await assert.rejects(packageOwnedNativeC({ ...options, working: join(directory, `forged-${mutation}`) }), /compiler-authenticated|generated source differs/u);
		if(path) await saveLakeFile(adapterRoot, path, original);
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(adapter));
	}
	const reassembled = join(directory, "reassembled");
	const rebuilt = await packageOwnedNativeC({ ...options, working: reassembled });
	assert.deepEqual(rebuilt.packages, projection.packages);
	assert.deepEqual(await readFile(join(reassembled, "archives", rebuilt.packages[0].archive)), await readFile(join(output, "archives", projection.packages[0].archive)));
	await rm(reassembled, { recursive: true, force: true });
	const receipt = await copyPackageSetHandoff(output, handoff);
	await rm(project, { recursive: true, force: true }); await rm(output, { recursive: true, force: true });
	await assert.rejects(access(project), { code: "ENOENT" }); await assert.rejects(access(output), { code: "ENOENT" });
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const observed = await installCopiedConsumer({ profile: "cpp", consumer
		, handoff, environment
		, packages: receipt.packages.filter(item => item.target === "cpp")
		, fixture: { source: () => readFile("tests/fixtures/structured-types/owned-installed-cpp.cpp", "utf8"), success: "owned-installed-cpp" } });
	assert.ok(observed.checks > 500);
	const cObserved = await installCopiedConsumer({ profile: "c", consumer, handoff
		, packages: receipt.packages.filter(item => item.target === "c"), environment
		, fixture: { source: () => readFile("tests/fixtures/structured-types/owned-installed-host-callbacks.c", "utf8"), success: "owned-installed-callbacks" } });
	assert.ok(cObserved.checks >= 600);
	const cppRoot = join(consumer, "cpp"), installed = join(cppRoot, "owned-cpp-values-1.2.3-cpp");
	const manifest = await json(join(installed, "lean-bridge-package.json"));
	assert.deepEqual(manifest.cppValues, generated.contract); assert.equal(manifest.ecosystem, "cpp");
	await verifyNativeFiles(installed, manifest.files);
	await rm(handoff, { recursive: true, force: true }); await assert.rejects(access(handoff), { code: "ENOENT" });
	const relocated = join(directory, "relocated-package"); await rename(installed, relocated);
	await saveLakeFile(cppRoot, "CMakeLists.txt", `cmake_minimum_required(VERSION 3.20)
project(OwnedCppConsumer CXX)
find_package(${manifest.cmakePackage} 1.2.3 EXACT CONFIG REQUIRED)
add_executable(consumer consumer.cpp)
target_link_libraries(consumer PRIVATE ${manifest.cmakeTarget})
target_compile_options(consumer PRIVATE -Wall -Wextra -Werror -UNDEBUG)
`);
	const compileEnv = { ...copiedCleanEnvironment, PATH: join(cppRoot, "tools") };
	await runCopied("/usr/bin/cmake", ["-S", cppRoot, "-B", "cmake-build"
		, "-G", "Unix Makefiles"
		, "-DCMAKE_CXX_COMPILER=/usr/bin/c++", "-DCMAKE_MAKE_PROGRAM=/usr/bin/make"
		, `-DCMAKE_PREFIX_PATH=${relocated}`], cppRoot, compileEnv);
	await runCopied("/usr/bin/cmake", ["--build", "cmake-build"], cppRoot, compileEnv);
	const cmake = await runCopied(join(cppRoot, "cmake-build/consumer"), [], cppRoot);
	assert.equal(cmake.stderr, ""); assert.equal(cmake.stdout, `owned-installed-cpp:${observed.checks}\n`);
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", manifest.pkgConfig], cppRoot
		, { ...compileEnv, PKG_CONFIG_LIBDIR: join(relocated, "lib/pkgconfig"), PKG_CONFIG_PATH: "" })).stdout.trim().split(/\s+/u);
	await runCopied("/usr/bin/c++", ["-std=c++20", "-O1", "-g", "-Wall"
		, "-Wextra", "-Werror"
		, "-fsanitize=address,undefined", "-fno-omit-frame-pointer", "-no-pie"
		, "consumer.cpp", ...flags, "-o", "consumer-sanitized"], cppRoot, compileEnv);
	const runSanitized = extra => runCopied("/bin/sh", ["-c", 'ulimit -c 0\nexec "$@"', "owned-installed-cpp", join(cppRoot, "consumer-sanitized")], cppRoot
		, { ...copiedCleanEnvironment, ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1", UBSAN_OPTIONS: "halt_on_error=1:print_stacktrace=1", LSAN_OPTIONS: "exitcode=0", ...extra });
	const cold = await runSanitized({ LEAN_BRIDGE_OWNED_COLD_ONLY: "1" }), sanitized = await runSanitized({});
	assert.equal(cold.stdout, "cold\n"); assert.equal(sanitized.stdout, cmake.stdout);
	const normalize = value => value.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS");
	assert.doesNotMatch(sanitized.stderr, /ERROR: AddressSanitizer|runtime error:/u);
	assert.equal(normalize(sanitized.stderr), normalize(cold.stderr));
	await saveLakeFile(resolve("build/owned-cpp-packaging"), `${mode}.json`, canonicalJson({
		schemaVersion: 1, planNode: 1219, mode, compiledLean: true
		, installedPackage: true, sourceUnchanged: true
		, sourceFreeInstallation: true, compilerFreeExecution: true
		, handoffRemovedBeforeRelocatedExecution: true, deterministicReassembly: true
		, forgedLifetimeRejected: true, forgedHeaderRejected: true
		, forgedBoostRejected: true, sharedCAdapter: true, boxedRecursion: true
		, nestedOptions: true, higherOrderCallbacks: true
		, input: { component: model.component, sourceIdentity: model.sourceIdentity, metadata }
		, componentReceipt, adapterReceipt: adapter
		, packageSetReceipt: receipt, manifest
		, consumerSha256: observed.consumerSha256
		, checks: { pkgConfig: observed.checks, cmake: observed.checks, sanitized: observed.checks, c: cObserved.checks }
		, startupLeakBaseline: normalize(cold.stderr).replaceAll(directory, "<probe>")
	}));
	t.diagnostic(`${mode}: ${observed.checks} C++ installed checks with pkg-config, relocated CMake and sanitizers; ${cObserved.checks} shared C checks`);
});
