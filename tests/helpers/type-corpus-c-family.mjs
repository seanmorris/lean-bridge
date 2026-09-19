/**
 * Prepared C/C++ installations through pkg-config and CMake, then source-free runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, readdir, realpath, rename, rm, symlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { corpusCases, corpusHostCase } from "../fixtures/type-corpus/cases.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { captureCorpusCompiler } from "./type-corpus-compiler.mjs";
import { corpusCFamilyRejection, corpusCFamilySignatures, corpusCFamilySource, validateCFamilyDiagnostic } from "./type-corpus-c-source.mjs";

const repository = resolve(import.meta.dirname, "../..");
const run = (command, args, cwd, env) => processBuildRunner.capture({ command, args, cwd, env, timeoutMs: 180_000 });
const digest = async path => sha256(await readFile(path));

/**
 * Compile only consumers of prepared public headers and relocate their binaries.
 *
 * @param options - Verified package-set entry and an isolated consumer root.
 * @param options.library - Independent catalog library.
 * @param options.profile - C or C++ consumer profile.
 * @param options.consumer - Temporary consumer directory.
 * @param options.handoff - Relocated prepared package-set handoff.
 * @param options.pkg - Verified package receipt entry.
 * @param options.clean - Execution environment without compilers/runtime overrides.
 */
export const installedCFamilyCorpus = async ({ library, profile, consumer, handoff, pkg, clean }) => {
	const root = join(consumer, profile), project = join(root, "project"), tools = join(project, "tools");
	const deployment = join(root, "relocated"), cpp = profile === "cpp", extension = cpp ? "cpp" : "c";
	await mkdir(tools, { recursive: true });
	for(const name of ["as", "ld"]) await symlink(`/usr/bin/${name}`, join(tools, name));
	const compiler = await realpath(cpp ? "/usr/bin/c++" : "/usr/bin/cc");
	const compile = { ...clean, PATH: tools, LC_ALL: "C" };
	const compilerVersion = (await run(compiler, ["-dumpfullversion"], project, compile)).stdout.trim();
	assert.match(compilerVersion, /^\d+\.\d+(?:\.\d+)?$/);
	assert.ok(Number(compilerVersion.split(".")[0]) >= 12);
	const macros = (await run(compiler, ["-dM", "-E", "-x", cpp ? "c++" : "c", "/dev/null"], project, compile)).stdout;
	assert.match(macros, /#define __GNUC__ /);
	assert.doesNotMatch(macros, /__clang__/);
	const prefix = join(project, "package"); await mkdir(prefix);
	await run("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", join(handoff, pkg.artifacts[0].path), "-C", prefix], project, clean);
	assert.deepEqual(await readdir(prefix), [`${pkg.name}-${pkg.version}-${profile}`]);
	const installed = join(prefix, `${pkg.name}-${pkg.version}-${profile}`), receiptPath = join(installed, "lean-bridge-package.json");
	const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
	assert.equal(receipt.kind, "lean-bridge-native-c-package");
	assert.equal(receipt.ecosystem, profile);
	assert.equal(receipt.name, pkg.name); assert.equal(receipt.version, pkg.version);
	assert.equal(receipt.component.name, library.cModule);
	assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity);
	await verifyNativeFiles(installed, receipt.files);
	const source = corpusCFamilySource(library, profile), sourceFile = `src/main.${extension}`;
	await saveLakeFile(project, sourceFile, source);
	await saveLakeFile(project, "src/c-family.h", await readFile(join(repository, "tests/fixtures/type-corpus/consumers/c-family.h")));
	const config = { ...compile, PKG_CONFIG_LIBDIR: join(installed, "lib/pkgconfig"), PKG_CONFIG_PATH: "" };
	const flags = (await run("/usr/bin/pkg-config", ["--cflags", "--libs", receipt.pkgConfig], project, config)).stdout.trim().split(/\s+/);
	assert.equal(flags.length, cpp ? 5 : 4);
	if(cpp) assert.ok(flags.includes("-DBOOST_MP_STANDALONE"));
	const integration = flags.filter(flag => flag !== "-DBOOST_MP_STANDALONE");
	assert.equal(resolve(integration[0].slice(2)), join(installed, "include"));
	assert.ok(integration[0].startsWith("-I")); assert.ok(integration[1].startsWith("-L"));
	assert.equal(resolve(integration[1].slice(2)), join(installed, "lib"));
	assert.equal(integration[2], `-Wl,-rpath,${integration[1].slice(2)}`);
	assert.equal(integration[3], `-l${library.cModule}`);
	const standard = cpp ? "c++20" : "c11", options = [`-std=${standard}`, "-Wall", "-Wextra", "-Werror", "-UNDEBUG"];
	await run(compiler, [...options, sourceFile, ...flags.filter(flag => !flag.startsWith("-Wl,-rpath,")), "-Wl,-rpath,$ORIGIN/lib", "-o", "consumer-pkg-config"], project, compile);
	const negatives = corpusCases(library).map(entry => corpusHostCase(entry, profile)).filter(entry => entry.expectation.kind === "compile-rejection");
	const negativeCompilerOptions = [...options, ...cpp ? [] : ["-Wconversion", "-Wsign-conversion"], "-fsyntax-only", "-fdiagnostics-format=json"];
	const rejected = [];
	for(const entry of negatives)
	{
		const source = corpusCFamilyRejection(library, entry, profile), file = `src/reject-${entry.id.split("/")[1]}.${extension}`;
		await saveLakeFile(project, file, source);
		const failure = await captureCorpusCompiler(compiler, [...negativeCompilerOptions, ...flags.filter(flag => flag.startsWith("-I") || flag.startsWith("-D")), file], project, compile);
		assert.equal(failure.code, 1, `${entry.id}: expected compiler rejection: ${failure.stderr}`);
		const messages = JSON.parse(failure.stderr).filter(message => message.kind === "error");
		assert.ok(messages.length > 0);
		const diagnostics = messages.map(message => {
			const location = message.locations[0]?.caret;
			assert.equal(location?.file, file, `Unrelated compiler failure: ${message.message}`);
			const diagnostic = { code: entry.expectation.diagnostic, file, line: location.line, column: location.column, option: message.option ?? null, message: message.message };
			validateCFamilyDiagnostic(diagnostic, profile, entry.expectation.diagnostic);
			return diagnostic;
		});
		rejected.push({ id: entry.id, status: "rejected-at-compile-time", sourceSha256: sha256(source), diagnostics });
	}
	const language = cpp ? "CXX" : "C";
	const cmakeSource = `cmake_minimum_required(VERSION 3.20)\nproject(corpus LANGUAGES ${language})\nfind_package(${receipt.cmakePackage} ${pkg.version} EXACT CONFIG REQUIRED)\nadd_executable(consumer ${sourceFile})\ntarget_link_libraries(consumer PRIVATE ${receipt.cmakeTarget})\ntarget_compile_options(consumer PRIVATE -Wall -Wextra -Werror -UNDEBUG)\nset_target_properties(consumer PROPERTIES ${language}_STANDARD ${cpp ? "20" : "11"} ${language}_EXTENSIONS OFF BUILD_WITH_INSTALL_RPATH ON INSTALL_RPATH "$ORIGIN/lib")\n`;
	await saveLakeFile(project, "CMakeLists.txt", cmakeSource);
	await run("/usr/bin/cmake", ["-S", ".", "-B", "cmake-build", "-G", "Unix Makefiles", `-DCMAKE_${language}_COMPILER=${compiler}`, "-DCMAKE_MAKE_PROGRAM=/usr/bin/make", `-DCMAKE_PREFIX_PATH=${installed}`], project, compile);
	await run("/usr/bin/cmake", ["--build", "cmake-build"], project, compile);
	const cFamily = { compilerVersion, compilerSha256: await digest(compiler)
		, compilerMacrosSha256: sha256(macros)
		, standard, gccDiagnostics: true
		, negativeCompilerOptions
		, consumerSourceSha256: sha256(source)
		, signaturesSha256: sha256(corpusCFamilySignatures(library, profile))
		, declarationsSha256: await digest(join(installed, `include/${library.cModule}.${cpp ? "hpp" : "h"}`))
		, packageReceiptSha256: await digest(receiptPath)
		, bindingIrSha256: receipt.bindingIrSha256
		, pkgConfig: { version: (await run("/usr/bin/pkg-config", ["--version"], project, compile)).stdout.trim(), flags, manifestSha256: await digest(join(installed, `lib/pkgconfig/${receipt.pkgConfig}.pc`)) }
		, cmake: { version: (await run("/usr/bin/cmake", ["--version"], project, compile)).stdout.trim().split("\n")[0], consumerSourceSha256: sha256(cmakeSource), manifestSha256: await digest(join(installed, `lib/cmake/${receipt.cmakePackage}/${receipt.cmakePackage}Config.cmake`)) }
		, installedSourcesRemoved: true, offline: true, runtimeOverridesDisabled: true
		, publicHeadersOnly: true, compilerFreeExecution: true };
	await mkdir(join(deployment, "lib"), { recursive: true });
	const libraries = Object.entries(receipt.files).filter(([path]) => /^lib\/[^/]+\.so(?:\.[0-9]+)*$/.test(path));
	assert.ok(libraries.some(([path]) => path === `lib/lib${library.cModule}.so`));
	assert.ok(libraries.some(([path]) => path === "lib/libleanshared.so"));
	for(const [path] of libraries)
	{ await mkdir(dirname(join(deployment, path)), { recursive: true }); await copyFile(join(installed, path), join(deployment, path)); }
	cFamily.libraries = Object.fromEntries(libraries);
	const executables = {};
	for(const [name, path] of [["pkg-config", "consumer-pkg-config"], ["cmake", "cmake-build/consumer"]])
	{
		await rename(join(project, path), join(deployment, `consumer-${name}`));
		executables[name] = await digest(join(deployment, `consumer-${name}`));
	}
	cFamily.executables = executables;
	await rm(project, { recursive: true, force: true });
	assert.deepEqual(await readdir(root), ["relocated"]);
	const observations = [];
	for(const name of Object.keys(executables))
	{
		const executable = join(deployment, `consumer-${name}`);
		const links = (await run("/usr/bin/ldd", [executable], deployment, { PATH: "/usr/bin:/bin" })).stdout;
		for(const [path] of libraries) assert.ok(links.includes(join(deployment, path)), `Packaged library was not loaded locally: ${path}`);
		for(let attempt = 0; attempt < 2; attempt++) observations.push(JSON.parse((await run(executable, [], deployment, clean)).stdout));
	}
	for(const observation of observations) assert.deepEqual(observation, observations[0]);
	await verifyNativeFiles(deployment, cFamily.libraries);
	cFamily.repeatExecution = true;
	cFamily.localLibraries = true;
	cFamily.integrationExecutions = { "pkg-config": 2, cmake: 2 };
	const observation = observations[0];
	observation.hostVersion = compilerVersion;
	observation.results.push(...rejected);
	return { observation, cFamily };
};
