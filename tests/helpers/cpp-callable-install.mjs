/**
 * Installed C++ compile-time rejection, dependency verification and source-free use.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { boostSources, boostIdentity } from "../../src/backends/cpp/boost.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { captureCorpusCompiler } from "./type-corpus-compiler.mjs";

/**
 * Check typed installed APIs, then run using only the executable and packaged libraries.
 *
 * @param root0 - Installed consumer and verified package entries.
 * @param root0.consumer - Task-owned consumer directory.
 * @param root0.packages - Prepared package-set entries.
 * @param root0.command - Compiled C++ consumer executable.
 */
export const checkCppCallableInstallation = async ({ consumer, packages, command }) => {
	const root = join(consumer, "cpp"), pkg = packages.find(item => item.role === "component");
	const installed = join(root, `${pkg.name}-${pkg.version}-cpp`);
	for(const [path, bytes] of Object.entries(boostSources())) assert.equal(await readFile(join(installed, path), "utf8"), bytes);
	const env = { ...copiedCleanEnvironment, PATH: join(root, "tools"), PKG_CONFIG_LIBDIR: join(installed, "lib/pkgconfig"), PKG_CONFIG_PATH: "" };
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", pkg.name], root, env)).stdout.trim().split(/\s+/);
	const negatives = [
		["argument", 'api::call_uint32("bad", [](uint32_t n) { return n; });']
		, ["result", 'api::call_uint32(0, [](uint32_t) { return std::string("bad"); });']
		, ["callback-argument", 'api::call_uint32(0, [](std::string) -> uint32_t { return 0; });']
		, ["borrowed-result", 'api::call_string("", [](std::string text) { return std::string_view(text); });']
		, ["closure-argument", 'api::make_uint32(0).call(true, "bad");']
		, ["copy", 'auto original = api::make_uint32(0); auto copied = original; (void)copied;']
		, ["unit-result", 'api::call_unit({}, [](std::monostate) { return std::monostate{}; });']
	];
	const rejected = [];
	for(const [name, statement] of negatives)
	{
		const source = `#include "callables.hpp"\nnamespace api = lean_bridge::callables;\nint main() { ${statement} }\n`;
		await saveLakeFile(root, `${name}.cpp`, source);
		const failure = await captureCorpusCompiler("/usr/bin/c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "-fdiagnostics-format=json", ...flags.filter(flag => flag.startsWith("-I") || flag.startsWith("-D")), `${name}.cpp`], root, env);
		assert.equal(failure.code, 1, failure.stderr);
		const diagnostics = JSON.parse(failure.stderr).filter(item => item.kind === "error");
		assert.ok(diagnostics.length > 0 && diagnostics.every(item => item.locations.some(location => location.caret.file === `${name}.cpp`)), failure.stderr);
		rejected.push({ name, sourceSha256: sha256(source), diagnostics: diagnostics.length });
	}
	await runCopied("/usr/bin/c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror", "-UNDEBUG", "consumer.cpp", ...flags, "-Wl,-rpath,$ORIGIN/lib", "-o", command], root, env);
	const deployment = join(consumer, "relocated"), executable = join(deployment, "consumer");
	await cp(join(installed, "lib"), join(deployment, "lib"), { recursive: true });
	await cp(command, executable);
	await rm(root, { recursive: true, force: true });
	await rm(join(consumer, "handoff"), { recursive: true, force: true });
	const executed = await runCopied(executable, [], deployment);
	assert.equal(executed.stderr, ""); assert.match(executed.stdout, /^callable-cpp-ok:\d+\n$/);
	return {
		rejected
		, boost: boostIdentity
		, boostFiles: Object.keys(boostSources()).length
		, executableSha256: sha256(await readFile(executable))
		, sourceFreeChecks: Number(executed.stdout.trim().split(":")[1]) };
};
