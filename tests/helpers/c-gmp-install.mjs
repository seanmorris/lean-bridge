/**
 * Verify installed GMP identities, then run without headers, archives or compilers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { gmpIdentity } from "../../src/backends/c/gmp.mjs";
import { verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { captureCorpusCompiler } from "./type-corpus-compiler.mjs";

/**
 * Check the supplied dependency and compile only against the public C headers.
 *
 * @param options - Installed package and executable.
 * @param options.consumer - Task-owned consumer directory.
 * @param options.packages - Verified package entries.
 * @param options.command - Compiled public C executable.
 */
export const checkGmpInstallation = async ({ consumer, packages, command }) => {
	const root = join(consumer, "c"), pkg = packages.find(item => item.role === "component");
	const installed = join(root, `${pkg.name}-${pkg.version}-c`);
	const dependency = JSON.parse(await readFile(join(installed, "share/lean-bridge/gmp.json")));
	for(const [key, value] of Object.entries(gmpIdentity)) assert.equal(dependency[key], value);
	assert.equal(dependency.checked, true);
	await verifyNativeFiles(installed, dependency.files);
	assert.equal(sha256(await readFile(join(installed, "share/lean-bridge/sources/gmp-6.3.0.tar.xz"))), gmpIdentity.sha256);
	const env = { ...copiedCleanEnvironment, PATH: join(root, "tools"), PKG_CONFIG_LIBDIR: join(installed, "lib/pkgconfig"), PKG_CONFIG_PATH: "" };
	const flags = (await runCopied("/usr/bin/pkg-config", ["--cflags", "--libs", pkg.name], root, env)).stdout.trim().split(/\s+/);
	const rejected = [];
	for(const [name, statement] of [["argument", "callables_make_nat(7, NULL, NULL);"]
		, ["private-limbs", "callables_nat value = {.data = NULL, .length = 0}; (void)value;"]]){
		const source = `#include "callables.h"\nint main(void) { ${statement} }\n`;
		await saveLakeFile(root, `${name}.c`, source);
		const failure = await captureCorpusCompiler("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "-fdiagnostics-format=json", ...flags.filter(flag => flag.startsWith("-I")), `${name}.c`], root, env);
		assert.equal(failure.code, 1, failure.stderr);
		const diagnostics = JSON.parse(failure.stderr).filter(item => item.kind === "error");
		assert.ok(diagnostics.length && diagnostics.every(item => item.locations.some(location => location.caret.file === `${name}.c`)), failure.stderr);
		rejected.push({ name, sourceSha256: sha256(source), diagnostics: diagnostics.length });
		}
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-UNDEBUG", "consumer.c", ...flags.filter(flag => !flag.startsWith("-Wl,-rpath,")), "-Wl,-rpath,$ORIGIN/lib", "-o", command], root, env);
	const deployment = join(consumer, "relocated"), executable = join(deployment, "consumer");
	await cp(join(installed, "lib"), join(deployment, "lib"), { recursive: true });
	await cp(command, executable);
	await rm(root, { recursive: true, force: true });
	await rm(join(consumer, "handoff"), { recursive: true, force: true });
	const links = (await runCopied("/usr/bin/ldd", [executable], deployment, { PATH: "/usr/bin:/bin" })).stdout;
	assert.ok(links.includes(join(deployment, "lib/libgmp.so.10")), links);
	const executed = await runCopied(executable, [], deployment);
	assert.equal(executed.stderr, ""); assert.match(executed.stdout, /^callable-c-ok:\d+\n$/);
	return { rejected, dependency, localGmp: true, sourceFree: true
		, executableSha256: sha256(await readFile(executable))
		, sourceFreeChecks: Number(executed.stdout.trim().split(":")[1]) };
};
