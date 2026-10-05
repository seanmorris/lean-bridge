/**
 * Original C/C++/Cargo/PyPI/npm archives preserve combined callback, receiver and transfer APIs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, chmod, cp, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildJavaScriptWasmCompilerInputs } from "../src/release/javascript-wasm-compiler-inputs.mjs";
import { buildCliNpmPackage } from "../src/release/cli-npm-package.mjs";
import { readVerifiedPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { readVerifiedOwnedJavaScriptWasmComponent } from "../src/build/javascript-wasm-owned-artifacts.mjs";
import { readVerifiedNativeComponent, readVerifiedNativeRuntime, verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { ownedPythonCallbackResultCombinedConfiguration as ownedCallbackResultCombinedConfiguration
	, ownedPythonCallbackResultCombinedReviewedIr as ownedCallbackResultCombinedReviewedIr
	, ownedPythonCallbackResultCombinedSource as ownedCallbackResultCombinedSource } from "./helpers/owned-python-callback-result-fixture.mjs";
import { prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";
import { ownedRustReceiverLinker as linker } from "./helpers/owned-rust-receiver-fixture.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile, lakeInputState } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { checkOwnedJavaScriptBrowsers } from "./helpers/owned-javascript-npm-browser.mjs";
import { ownedJavaScriptReceiverInventory } from "./helpers/owned-javascript-receiver-inventory.mjs";
import { installPythonWheel } from "./helpers/python-wheel-install.mjs";
import { ownedPythonCallbackInstalledProbe } from "./helpers/owned-python-callback-result-installed.mjs";
import { ownedPythonInstalledProbe } from "./helpers/owned-python-installed-probes.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("installed C/C++/Cargo/PyPI/npm archives combine callback lifetimes, receiver methods and transfers", {
	skip: process.env.LEAN_BRIDGE_OWNED_PYTHON_CALLBACK_RESULT_TEST !== "1"
	, timeout: 1800000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-python-callback-combined-installed-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const runtimeRoot = resolve(process.env.LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_ROOT ?? "build/lean-link-spike", "lazy");
	const inputs = await buildJavaScriptWasmCompilerInputs({ outputRoot: join(root, "inputs")
		, leanRuntimeRoot: resolve(process.env.LEAN_BRIDGE_JS_TARGET_RUNTIME ?? "build/lean-runtime/f3b06c705e6c85f5314019d5d3baab0fec5b580c-743765bf566f43ec2f7b4eb84a85686880b3797efe83bf244d6fc7281e4f85a3-browser") });
	const candidate = await buildCliNpmPackage({ outputRoot: join(root, "candidate"), javascriptWasmInputsRoot: inputs.directory, runtimeRoot });
	assert.equal(candidate.report.javascriptWasmInputsIncluded, true);
	const cliArchive = await readFile(candidate.archive);
	await rm(candidate.output, { recursive: true }); await rm(inputs.output, { recursive: true });
	const interpreters = JSON.parse(process.env.LEAN_BRIDGE_COLLECTION_PYTHONS ?? JSON.stringify([resolve(".toolchains/python311/bin/python3.11"), resolve(".toolchains/python312/bin/python3.12")]));
	assert.equal(interpreters.length, 2);
	const environment = { ...nativeFixtureEnvironment(["c", "cpp", "rust", "python"])
		, LEAN_BRIDGE_BUILD_BACKEND: "auto", LEAN_BRIDGE_PYTHON: interpreters[0]
		, CARGO_HOME: process.env.CARGO_HOME ?? resolve(".toolchains/cargo-copied")
		, LEAN_BRIDGE_JS_EMSDK: resolve(process.env.LEAN_BRIDGE_JS_EMSDK ?? ".toolchains/emsdk") };
	for(const key of ["LEAN_BRIDGE_RUNTIME_ROOT", "LEAN_BRIDGE_JS_INPUTS", "LEAN_BRIDGE_JS_TARGET_RUNTIME", "NODE_PATH", "NODE_OPTIONS"]) delete environment[key];
	const run = (command, args, cwd, env = environment, timeoutMs = 900000) => processBuildRunner.capture({ command, args, cwd, env, timeoutMs })
		.catch(error => { t.diagnostic(JSON.stringify(error.details ?? error.message)); throw error; });
	const baseC = await readFile("tests/fixtures/structured-types/owned-installed-callback-results.c", "utf8");
	const combinedC = await readFile("tests/fixtures/structured-types/owned-installed-callback-combinations.c", "utf8");
	const main = "int main(void) {", end = "  clear(&supplied_owner); clear(&first_owner); clear(&second_owner);";
	assert.equal(baseC.split(main).length, 2); assert.equal(baseC.split(end).length, 2);
	const cProbe = baseC.replace(main, combinedC + "\n" + main).replace(end, end + "\n  callback_combinations(session);");
	const cppProbe = "#define CALLBACK_RESULTS_INSTALLED 1\n#define HOST_CALLBACKS 1\n#define COMBINED 1\n"
		+ await readFile("tests/fixtures/structured-types/owned-cpp-callback-results.cpp", "utf8");
	const cppGuide = await readFile("docs/consume/cpp.md", "utf8");
	const cppExample = cppGuide.match(/```cpp file=cpp\/owned-callback-results\.cpp\n([\s\S]*?)```/u)?.[1];
	assert.ok(cppExample);
	const rustProbe = "use owned_callback_results::*;\n" + await readFile("tests/fixtures/structured-types/owned-rust-callback-results.rs", "utf8");
	const rustExample = await readFile("tests/fixtures/documentation/consumers/rust/owned-callback-results.rs", "utf8");
	assert.equal((await readFile("docs/consume/rust.md", "utf8")).match(/```rust file=rust\/owned-callback-results\.rs\n([\s\S]*?)```/u)?.[1], rustExample);
	const pythonProbe = await ownedPythonCallbackInstalledProbe(true);
	const pythonLoaderProbe = ownedPythonInstalledProbe.replaceAll("compatible.serial(ticket)", "compatible.serial(ticket.get())")
		.replaceAll("module.serial(value)", "module.serial(value.get())").replaceAll("api.serial(ticket)", "api.serial(ticket.get())");
	const pythonExample = await readFile("tests/fixtures/documentation/consumers/python/owned-callback-results.py", "utf8");
	assert.equal((await readFile("docs/consume/python.md", "utf8")).match(/```python file=python\/owned-callback-results\.py\n([\s\S]*?)```/u)?.[1], pythonExample);
	const jsProbe = await readFile("tests/fixtures/structured-types/owned-installed-javascript-callback-combinations.mjs", "utf8");
	const guide = await readFile("docs/javascript-typescript.md", "utf8");
	const example = guide.split("### Borrowed callback results\n")[1]?.split("### Methods and properties\n")[0]?.match(/```js\n([\s\S]*?)\n```/u)?.[1];
	assert.ok(example, "The consumer guide must contain its executable callback example");
	for(const mode of ["ordinary", "reviewed"])
	{
		const author = join(root, mode + "-author"), project = join(root, mode + "-source");
		const output = join(root, mode + "-release"), handoff = join(root, mode + "-handoff");
		await saveLakeFile(author, "package.json", canonicalJson({ private: true }));
		await saveLakeFile(author, "cli.tgz", cliArchive);
		await run("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "./cli.tgz"], author);
		const cliRoot = join(author, "node_modules", candidate.report.package.name);
		for(const file of candidate.report.files)
		{
			const bytes = await readFile(join(cliRoot, file.path));
			assert.equal(bytes.length, file.bytes); assert.equal(sha256(bytes), file.sha256);
		}
		await cp("tests/fixtures/onboarding/owned-aggregates", project, { recursive: true });
		await saveLakeFile(project, "Owned.lean", (await readFile(join(project, "Owned.lean"), "utf8")) + ownedCallbackResultCombinedSource);
		const configuration = mode === "ordinary" ? await ownedCallbackResultCombinedConfiguration() : { schemaVersion: 1, modules: ["Owned"] };
		configuration.targets = { c: { name: "owned-callback-combinations", version: "1.2.3" }
			, cpp: { name: "owned-cpp-callback-combinations", version: "1.2.3" }
			, cargo: { name: "owned-callback-results", version: "1.2.3" }
			, pypi: { name: "owned-callback-results", version: "1.2.3" }
			, npm: { name: `@owned/${mode}-callback-combinations`, version: "1.2.3" } };
		await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(configuration));
		if(mode === "reviewed") await saveLakeFile(project, "reviewed.binding-ir.json", canonicalJson(ownedCallbackResultCombinedReviewedIr()));
		const before = await lakeInputState(project);
		t.diagnostic(`${mode}: installed CLI builds one C/C++/Cargo/PyPI/npm release with all four capabilities`);
		const arguments_ = ["build", "--project", project
				, "--target", "c", "--target", "cpp", "--target", "cargo"
				, "--target", "pypi", "--target", "npm"
			, "--output", output, "--json"];
		const built = JSON.parse((await run(join(author, "node_modules/.bin/lean-bridge"), arguments_, author)).stdout);
		assert.equal(built.status, "ok"); assert.deepEqual(await lakeInputState(project), before);
		const checked = await readVerifiedPackageSetReceipt({ receiptPath: join(output, "package-set-receipt.json") });
		const nativeRoot = join(output, "profiles/native/native/component");
		const { identity } = await readVerifiedNativeRuntime(join(output, "profiles/native/native/runtime"));
		const native = await readVerifiedNativeComponent(nativeRoot, identity, {
			ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true
			, ownedAnchoredResults: true, ownedReceiverExports: true
			, ownedCallbackResultAnchors: true
		});
		const wasm = await readVerifiedOwnedJavaScriptWasmComponent(join(output, "profiles/wasm/javascript-wasm/component"));
		const nativeInput = { metadata: await json(join(nativeRoot, "metadata.json"))
			, sourceIdentity: native.model.sourceIdentity
			, component: native.model.component };
		const wasmInput = { metadata: await json(join(output, "profiles/wasm/javascript-wasm/component/metadata.json"))
			, sourceIdentity: wasm.model.sourceIdentity
			, component: wasm.model.component };
		assert.equal(native.model.pointerBits, 64); assert.equal(wasm.model.pointerBits, 32);
		assert.equal(wasm.privateAbi.version, 14);
		for(const capability of ["callbackResultAnchors", "receiverExports", "resultAnchors", "inputTransfers"])
		{
			assert.ok(native.model.ownedGraph[capability], capability);
			assert.deepEqual(native.model.ownedGraph[capability], wasm.model.ownedGraph[capability]);
		}
		assert.equal(wasm.model.ownedGraph.callbackResultAnchors.signatures.length, 4);
		assert.equal(wasm.model.ownedGraph.receiverExports.exports.length, 4);
		assert.equal(wasm.model.ownedGraph.resultAnchors.exports.length, 1);
		assert.equal(wasm.model.ownedGraph.inputTransfers.exports.length, 1);
		const receipt = await copyPackageSetHandoff(output, handoff);
		assert.deepEqual(receipt, checked.receipt);
		assert.deepEqual(receipt.packages.map(item => item.target).sort(), ["c", "cargo", "cpp", "npm", "npm", "pypi"]);
		const dependencies = await prepareRustCorpusDependencies({
			rustRoot: join(output, "profiles/native/native/rust")
			, directory: join(root, mode + "-dependencies"), handoff, environment });
		for(const path of [author, project, output])
		{ await rm(path, { recursive: true }); await assert.rejects(access(path), { code: "ENOENT" }); }
		const cPackages = receipt.packages.filter(item => item.target === "c");
		const cppPackages = receipt.packages.filter(item => item.target === "cpp");
		assert.equal(cppPackages.length, 1);
		const npm = receipt.packages.filter(item => item.target === "npm"), component = npm.find(item => item.role === "component");
		assert.equal(cPackages.length, 1); assert.equal(npm.length, 2);
		const consumer = join(root, mode + "-consumer");
		const installedC = await installCopiedConsumer({
			profile: "c", consumer, handoff, packages: cPackages, environment
			, fixture: { source: () => cProbe, success: "callback-results-installed", expectedChecks: 219 } });
		const cRoot = join(consumer, "c"), packageRoot = join(cRoot, "owned-callback-combinations-1.2.3-c");
		const manifest = await json(join(packageRoot, "lean-bridge-package.json"));
		assert.equal(manifest.schemaVersion, 7);
		assert.deepEqual(manifest.ownedValues.callbackResultAnchors, native.model.ownedGraph.callbackResultAnchors);
		await verifyNativeFiles(packageRoot, manifest.files);
		const relocated = join(root, mode + "-relocated-c"); await rename(packageRoot, relocated);
		await saveLakeFile(cRoot, "CMakeLists.txt", `cmake_minimum_required(VERSION 3.20)
project(CombinedCallbackConsumer C)
find_package(${manifest.cmakePackage} 1.2.3 EXACT CONFIG REQUIRED)
add_executable(consumer consumer.c)
target_link_libraries(consumer PRIVATE ${manifest.cmakeTarget})
target_compile_options(consumer PRIVATE -Wall -Wextra -Werror -UNDEBUG)
`);
		const compileEnvironment = { ...copiedCleanEnvironment, PATH: join(cRoot, "tools") };
		const cmakeArguments = ["-S", cRoot, "-B", "cmake-build"
			, "-G", "Unix Makefiles", "-DCMAKE_C_COMPILER=/usr/bin/cc"
			, "-DCMAKE_MAKE_PROGRAM=/usr/bin/make", `-DCMAKE_PREFIX_PATH=${relocated}`];
		await runCopied("/usr/bin/cmake", cmakeArguments, cRoot, compileEnvironment);
		await runCopied("/usr/bin/cmake", ["--build", "cmake-build"], cRoot, compileEnvironment);
		const cmake = await runCopied(join(cRoot, "cmake-build/consumer"), [], cRoot);
		assert.equal(cmake.stderr, ""); assert.equal(cmake.stdout, "callback-results-installed:219\n");
		const installedCpp = await installCopiedConsumer({
			profile: "cpp", consumer, handoff, packages: cppPackages, environment
			, fixture: { source: () => cppProbe
				, success: "owned-cpp-callback-results-installed", expectedChecks: 76 }
		});
		const cppRoot = join(consumer, "cpp"), cppPackageRoot = join(cppRoot, "owned-cpp-callback-combinations-1.2.3-cpp");
		const cppManifest = await json(join(cppPackageRoot, "lean-bridge-package.json"));
		assert.equal(cppManifest.schemaVersion, 7);
		assert.deepEqual(cppManifest.ownedValues, manifest.ownedValues);
		assert.equal(cppManifest.cppValues.schemaVersion, 5);
		assert.equal(cppManifest.cppValues.callbackResultAnchors.signatures.length, 4);
		await verifyNativeFiles(cppPackageRoot, cppManifest.files);
		const cppRelocated = join(root, mode + "-relocated-cpp"); await rename(cppPackageRoot, cppRelocated);
		await saveLakeFile(cppRoot, "CMakeLists.txt", `cmake_minimum_required(VERSION 3.20)
project(CombinedCallbackCppConsumer CXX)
find_package(${cppManifest.cmakePackage} 1.2.3 EXACT CONFIG REQUIRED)
add_executable(consumer consumer.cpp)
target_link_libraries(consumer PRIVATE ${cppManifest.cmakeTarget})
target_compile_options(consumer PRIVATE -Wall -Wextra -Werror -UNDEBUG)
`);
		const cppEnvironment = { ...copiedCleanEnvironment, PATH: join(cppRoot, "tools") };
		await runCopied("/usr/bin/cmake", ["-S", cppRoot, "-B", "cmake-build"
			, "-G", "Unix Makefiles", "-DCMAKE_CXX_COMPILER=/usr/bin/c++"
			, "-DCMAKE_MAKE_PROGRAM=/usr/bin/make"
			, `-DCMAKE_PREFIX_PATH=${cppRelocated}`], cppRoot, cppEnvironment);
		await runCopied("/usr/bin/cmake", ["--build", "cmake-build"], cppRoot, cppEnvironment);
		const cppCmake = await runCopied(join(cppRoot, "cmake-build/consumer"), [], cppRoot);
		assert.equal(cppCmake.stderr, ""); assert.equal(cppCmake.stdout, "owned-cpp-callback-results-installed:76\n");
		await saveLakeFile(cppRoot, "documented.cpp", cppExample);
		const cppFlags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", cppManifest.pkgConfig], cppRoot,
			{ ...cppEnvironment, PKG_CONFIG_LIBDIR: join(cppRelocated, "lib/pkgconfig"), PKG_CONFIG_PATH: "" })).stdout.trim().split(/\s+/u);
		await runCopied("/usr/bin/c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror"
			, "documented.cpp", ...cppFlags, "-o", "documented"]
		, cppRoot, cppEnvironment);
		const cppDocumented = await runCopied(join(cppRoot, "documented"), [], cppRoot);
		assert.equal(cppDocumented.stderr, ""); assert.equal(cppDocumented.stdout, "42\n");
		const rustPackages = receipt.packages.filter(item => item.target === "cargo");
		assert.equal(rustPackages.length, 1);
		const rustPackage = rustPackages[0], rustRoot = join(consumer, "rust");
		const rustTools = join(rustRoot, "tools"), cargoHome = join(rustRoot, "cargo-home");
		await mkdir(rustTools, { recursive: true }); await mkdir(cargoHome);
		assert.deepEqual(await readdir(cargoHome), []);
		await symlink("/usr/bin/ld", join(rustTools, "ld"));
		await saveLakeFile(rustTools, "link-only", linker); await chmod(join(rustTools, "link-only"), 0o755);
		assert.equal(sha256(await readFile(join(handoff, dependencies.archive))), dependencies.sha256);
		for(const archive of [rustPackage.artifacts[0].path, dependencies.archive])
			await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", join(handoff, archive)], rustRoot);
		const rustInstalled = join(rustRoot, `${rustPackage.name}-${rustPackage.version}`);
		const rustManifest = await json(join(rustInstalled, "lean-bridge/package-receipt.json"));
		assert.equal(rustManifest.schemaVersion, 6); assert.equal(rustManifest.ownedValues.schemaVersion, 5);
		assert.equal(rustManifest.runtimeIdentity, native.receipt.runtimeIdentity);
		assert.equal(rustManifest.ownedValues.callbackResultAnchors.signatures.length, 4);
		assert.equal(sha256(await readFile(join(rustInstalled, "Cargo.lock"))), dependencies.lockSha256);
		await verifyNativeFiles(rustInstalled, rustManifest.files);
		await saveLakeFile(rustRoot, ".cargo/config.toml", '[source.crates-io]\nreplace-with="prepared"\n[source.prepared]\ndirectory="dependencies"\n');
		await saveLakeFile(rustRoot, "Cargo.toml", `[package]\nname="consumer"\nversion="0.0.0"\nedition="2021"\n[dependencies]\n${rustPackage.name}={path="${rustPackage.name}-${rustPackage.version}"}\n[[bin]]\nname="consumer"\npath="consumer.rs"\n[features]\nhost=[]\ncombined=["host"]\n[profile.dev]\ndebug=0\nincremental=false\n`);
		await saveLakeFile(rustRoot, "consumer.rs", rustProbe);
		await saveLakeFile(rustRoot, "src/bin/documentation.rs", rustExample);
		const rustEnvironment = { ...copiedCleanEnvironment, PATH: rustTools
			, RUSTC: environment.LEAN_BRIDGE_RUSTC, RUSTFLAGS: "-Dwarnings"
			, CARGO_HOME: cargoHome, CARGO_NET_OFFLINE: "true", CARGO_INCREMENTAL: "0"
			, CARGO_TARGET_DIR: join(rustRoot, "target")
			, CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER: join(rustTools, "link-only") };
		const cargo = args => runCopied(environment.LEAN_BRIDGE_CARGO, args, rustRoot, rustEnvironment);
		await cargo(["generate-lockfile", "--offline"]);
		await cargo(["build", "--offline", "--locked", "--bins", "--features", "combined"]);
		const rustDocumented = await runCopied(join(rustRoot, "target/debug/documentation"), [], rustRoot);
		assert.equal(rustDocumented.stdout, "42\n"); assert.equal(rustDocumented.stderr, "");
		const rustCommand = join(root, `${mode}-relocated-rust`);
		await rename(join(rustRoot, "target/debug/consumer"), rustCommand);
		await rm(rustRoot, { recursive: true }); await assert.rejects(access(rustRoot), { code: "ENOENT" });

		const pythonPackages = receipt.packages.filter(item => item.target === "pypi");
		assert.equal(pythonPackages.length, 1);
		const pythonArchive = join(handoff, pythonPackages[0].artifacts[0].path);
		assert.equal(sha256(await readFile(pythonArchive)), pythonPackages[0].artifacts[0].sha256);
		const installedPython = [], pythonDeployments = [];
		const checker = resolve(process.env.LEAN_BRIDGE_COLLECTION_MYPY_PYTHON ?? "build/python-collection-typecheck/bin/python");
		for(const [name, python, typingVersion] of [["3.11-minimum", interpreters[0], "4.6.0"], ["3.11-current", interpreters[0], "4.16.0"], ["3.12-standard", interpreters[1], null]])
		{
			const pythonRoot = join(consumer, "python-" + name);
			const { command, ...installation } = await installPythonWheel({ root: pythonRoot, archive: pythonArchive, python, typingVersion });
			await saveLakeFile(pythonRoot, "consumer.py", pythonProbe);
			const executed = await runCopied(command, ["-I", "-B", "consumer.py"], pythonRoot);
			assert.equal(executed.stderr, "");
			const result = JSON.parse(executed.stdout);
			assert.equal(result.ordinaryImport, true); assert.equal(result.scenarios.length, 8);
			assert.ok(result.checks > 300);
			await saveLakeFile(pythonRoot, "loader-probe.py", pythonLoaderProbe);
			const loaded = await runCopied(command, ["-I", "-B", "loader-probe.py"], pythonRoot);
			assert.equal(loaded.stderr, "");
			const loader = JSON.parse(loaded.stdout);
			assert.deepEqual(loader.consumer, result);
			assert.equal(loader.liveIdentities, 0);
			assert.equal(loader.runtimeInitializations, 1); assert.equal(loader.componentInitializations, 1);
			const installed = (await runCopied(command, ["-I", "-c", 'import pathlib, lean_owned_aggregates as api; print(pathlib.Path(api.__file__).parent)'], pythonRoot)).stdout.trim();
			assert.ok(installed.startsWith(pythonRoot + "/venv/"));
			const pythonManifest = await json(join(installed, "lean_bridge/package-receipt.json"));
			assert.equal(pythonManifest.schemaVersion, 6);
			assert.equal(pythonManifest.ownedValues.schemaVersion, 5);
			assert.equal(pythonManifest.runtimeIdentity, native.receipt.runtimeIdentity);
			assert.equal(pythonManifest.ownedValues.callbackResultAnchors.signatures.length, 4);
			await verifyNativeFiles(dirname(installed), pythonManifest.files);
			await saveLakeFile(pythonRoot, "documentation.py", pythonExample);
			const typed = await runCopied(checker, ["-I", "-m", "mypy", "--strict", "--no-incremental", "--cache-dir=/dev/null", "--python-executable", command, "documentation.py"], pythonRoot);
			assert.equal(typed.stderr, ""); assert.match(typed.stdout, /Success: no issues found/u);
			const example = await runCopied(command, ["-I", "-B", "documentation.py"], pythonRoot);
			assert.equal(example.stderr, ""); assert.equal(example.stdout, "42\n42\n");
			installedPython.push({ name, installation, manifest: pythonManifest
				, checks: result.checks, scenarios: result.scenarios, loader
					, consumerSha256: sha256(pythonProbe)
					, loaderProbeSha256: sha256(pythonLoaderProbe)
				, sourceFreeInstallation: true, cliRemovedBeforeConsumerInstall: true
				, documentation: { sourceSha256: sha256(pythonExample), stdout: example.stdout } });
			pythonDeployments.push({ name, root: pythonRoot, result });
		}
		const jsRoot = join(consumer, "npm");
		await saveLakeFile(jsRoot, "package.json", canonicalJson({ name: "installed-callback-combinations", version: "1.0.0", private: true, type: "module" }));
		const consumerEnvironment = { ...environment, PATH: `${dirname(process.execPath)}:/usr/bin:/bin`
			, CC: "/unavailable/compiler", CXX: "/unavailable/compiler"
			, LEAN_BRIDGE_LEAN_PREFIX: "/unavailable/lean"
			, LEAN_BRIDGE_JS_EMSDK: "/unavailable/emsdk"
			, LEAN_BRIDGE_NATIVE_ROOT: "/unavailable/runtime"
			, LEAN_BRIDGE_RUNTIME_ROOT: "/unavailable/runtime" };
		const consume = (command, args) => run(command, args, jsRoot, consumerEnvironment, 180000);
		await consume("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", ...npm.map(item => join(handoff, item.artifacts[0].path))]);
		await rm(handoff, { recursive: true }); await assert.rejects(access(handoff), { code: "ENOENT" });

		for(const deployment of pythonDeployments)
		{
			const movedRoot = join(root, mode + "-relocated-python-" + deployment.name);
			await rename(deployment.root, movedRoot);
			await assert.rejects(access(deployment.root), { code: "ENOENT" });
			const moved = await runCopied(join(movedRoot, "venv/bin/python"), ["-I", "-B", "consumer.py"], movedRoot);
			assert.equal(moved.stderr, ""); assert.deepEqual(JSON.parse(moved.stdout), deployment.result);
			Object.assign(installedPython.find(item => item.name === deployment.name), {
					relocatedChecks: deployment.result.checks
					, sourceFreeRelocatedExecution: true
				, handoffRemovedBeforeRelocatedExecution: true });
			await rm(movedRoot, { recursive: true });
		}
		const rustExecuted = await runCopied(rustCommand, [], root, { ...copiedCleanEnvironment, RUSTC: "/unavailable", CARGO_HOME: "/unavailable" });
		assert.equal(rustExecuted.stderr, ""); assert.equal(rustExecuted.stdout, "owned-rust-callback-results:118\n");
		const rustRepeated = await runCopied(rustCommand, [], root, copiedCleanEnvironment);
		assert.deepEqual(rustRepeated, rustExecuted);
		const installedRust = { checks: 118, relocatedChecks: 118, reruns: 2
			, consumerSha256: sha256(rustProbe), linkerSha256: sha256(linker)
			, offlineInstall: true, emptyCargoHome: true, linkOnly: true
			, sourceFreeRelocatedExecution: true, handoffRemovedBeforeExecution: true
			, dependencies };
		const inventory = await ownedJavaScriptReceiverInventory(join(jsRoot, "node_modules"));
		assert.ok(Object.keys(inventory).length > 50);
		await saveLakeFile(jsRoot, "probe.mjs", jsProbe);
		await saveLakeFile(jsRoot, "call.mjs", `import api from ${JSON.stringify(component.name)};
import {runCallbackCombinations} from "./probe.mjs";
console.log(JSON.stringify(runCallbackCombinations(api)));
if(!api.close() || api.close()) throw new Error("Component close failed");
`);
		const observed = JSON.parse((await consume(process.execPath, ["call.mjs"])).stdout);
		assert.deepEqual(observed, { checks: 40, receiverMethods: true
			, transitiveExpiration: true
			, consumingHandoff: true, borrowedTransferRejected: true });
		await saveLakeFile(jsRoot, "consumer.mts", `import api, {type Bundle, type BundleValue} from ${JSON.stringify(component.name)};
const ticket = api.newTicket(42n, "typed");
const root: BundleValue = api.echoRecord({primary:ticket.get(),spare:{tag:"none"},peers:[],history:[],payload:{count:0n,bytes:new Uint8Array()}});
const shared: BundleValue = root.share();
const closure = root.makeRecord();
const child: BundleValue = closure.get()(false, root);
const nested: BundleValue = child.borrowRecord();
const retained: BundleValue = nested.retain();
const moved: BundleValue = shared.moveRecord(value => value);
// @ts-expect-error Callback anchor arguments require a whole owner.
closure.get()(false, root.get());
// @ts-expect-error A callback's selected owner must have the matching type.
closure.get()(false, ticket);
// @ts-expect-error Receiver-borrowing methods require whole owners.
root.get().borrowRecord();
// @ts-expect-error A consuming receiver must not accept a raw payload.
api.moveRecord(root.get(), value => value);
// @ts-expect-error A borrowed callback result is not an unowned record.
const raw: Bundle = closure.get()(false, root);
// @ts-expect-error Callback reply owners must match their declared payload.
root.moveRecord(() => ticket);
for(const value of [ticket,root,shared,closure,child,nested,retained,moved]) value.dispose();
api.close();
`);
		await consume(process.execPath, [resolve("node_modules/typescript/bin/tsc"), "--strict", "--noEmit", "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--skipLibCheck", "false", "consumer.mts"]);
		await saveLakeFile(jsRoot, "documentation.mjs", `import api from ${JSON.stringify(component.name)};\n${example}\napi.close();\n`);
		const documentation = await consume(process.execPath, ["documentation.mjs"]);
		assert.equal(documentation.stderr, ""); assert.equal(documentation.stdout, "42n\ntrue\n42n\n");
		const browser = await checkOwnedJavaScriptBrowsers({
			root: jsRoot, name: component.name, run: consume
			, probeSource: `import api from ${JSON.stringify(component.name)};\n${jsProbe}\nexport const run = () => runCallbackCombinations(api);\nexport const close = () => api.close();\n`
			, expected: observed });
		await saveLakeFile("build/owned-python-callback-results", `${mode}-combined-release.json`, canonicalJson({
			schemaVersion: 1, mode, cli: candidate.report
			, compilerInputsIdentity: inputs.identity
			, built, receipt, native, wasm, nativeInput, wasmInput
			, manifest, installedC, cmake: true
			, cppManifest, installedCpp, cppCmake: true
			, cppProbeSha256: sha256(cppProbe)
			, cppDocumentation: { sourceSha256: sha256(cppExample), output: cppDocumented.stdout }
			, rustManifest, installedRust, installedPython
			, rustDocumentation: { sourceSha256: sha256(rustExample), output: rustDocumented.stdout }
			, observed, inventory, browser, installedTypeScript: true
			, cliFilesVerified: candidate.report.files.length, sourceUnchanged: true
			, producerAndCliRemovedBeforeInstall: true
			, compilerFreeConsumerEnvironment: true
			, cProbeSha256: sha256(cProbe), jsProbeSha256: sha256(jsProbe)
			, documentation: { sourceSha256: sha256(example), output: documentation.stdout }
		}));
		t.diagnostic(`${mode}: ${installedPython.map(item => item.checks).join("/")} Python, ${installedRust.checks} Rust, ${installedCpp.checks} C++, ${installedC.checks} C, ${observed.checks} JS checks; offline installation, relocation and nine browser contexts`);
		for(const path of [consumer, relocated, cppRelocated]) await rm(path, { recursive: true });
	}
});
