/**
 * Isolated fault probes compiled from original archived XS and installed headers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { generateCallablePerlGraphXs } from "../../src/backends/perl/callable-graph-xs.mjs";
import { hooks, probeXs, poisonDeclarations } from "./perl-recursive-callable-probes.mjs";
import { ownershipProbe, releaseRepliesEarly } from "./perl-recursive-callable-ownership.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";

/**
 * Require every conversion checkpoint across all shapes, seeds and call paths.
 *
 * @param result - Allocation and exception observations from the installed probe.
 */
export const assertPerlRecursiveFaults = result => {
	assert.equal(result.checks, 156396); assert.equal(result.failures, 39045);
	const shapes = ["array", "list", "option", "result", "tuple", "record", "variant", "alias", "recursive"];
	const paths = ["callback", "repeated", "create", "create-call", "held-call"];
	assert.deepEqual(result.observations.map(run => `${run.shape}/${run.seed}/${run.path}`)
		, shapes.flatMap(shape => [0, 1, 2, 3].flatMap(seed => paths.map(path => `${shape}/${seed}/${path}`))));
	let failures = 0;
	for(const run of result.observations)
	{
		assert.equal(run.baseline.length, 6);
		assert.ok(run.baseline.every(value => Number.isSafeInteger(value) && value >= 0));
		assert.equal(run.baseline[0], 1); assert.equal(run.baseline[1], 0); assert.equal(run.baseline[5], 1);
		const counts = Object.fromEntries([[1, run.baseline[2]], [2, 2 * run.baseline[4]], [3, run.baseline[4]], [4, run.baseline[3]]].filter(([, count]) => count > 0));
		assert.deepEqual(run.counts, counts);
		failures += Object.values(counts).reduce((sum, count) => sum + count, 0);
	}
	assert.equal(failures, result.failures);
};

/**
 * Preserve installed bytes while compiling independently loaded test libraries.
 *
 * @param options - Original archive, authentic model and relocated installation.
 * @param options.consumer - Test-owned consumer directory.
 * @param options.perl - Absolute selected interpreter executable.
 * @param options.prepared - Verified original component archive contents.
 * @param options.model - Compiler-authenticated native component model.
 * @param options.lib - Relocated Perl library directory.
 * @param options.environment - Producer tools used only during probe compilation.
 */
export const preparePerlRecursiveFaults = async ({ consumer, perl, prepared, model, lib, environment }) => {
	assert.equal(model.moduleName, "LeanBridge::Recursive");
	const original = prepared.files.get("Component.xs").toString();
	const generated = generateCallablePerlGraphXs(model.bindingIr, model.moduleName);
	const owned = ownershipProbe(generated);
	const marker = "\nMODULE = LeanBridge::Recursive PACKAGE = LeanBridge::Recursive\n";
	const retire = "static void lpg_retire(void) { lean_bridge_native_runtime_retire(); }";
	for(const source of [generated.source, generated.xs, marker, retire])
		assert.equal(original.split(source).length, 2);
	const headers = [...prepared.files.keys()].filter(path => path === "component.h"
		|| path.startsWith(`${generated.layout.prefix}-`) && path.endsWith(".h"));
	assert.equal(headers.length, 4);
	for(const name of headers) await saveLakeFile(consumer, name, prepared.files.get(name));
	const builder = (await readFile("tests/fixtures/list-consumers/perl-probe-build.pl", "utf8"))
		.replaceAll("LeanBridge::Lists", "LeanBridge::Recursive");
	await saveLakeFile(consumer, "build-probes.pl", builder);
	const libraries = [];
	for(const mode of ["baseline", "reply-scope", "retirement"])
	{
		let source = original;
		if(mode === "reply-scope") source = source.replace(generated.xs, releaseRepliesEarly(generated));
		source = source.replace(retire, `static void lpg_retire(void) { ++probe_retired; ${mode === "retirement" ? "" : "lean_bridge_native_runtime_retire();"} }`);
		const clears = source.match(/static void lpc_clear\d+\(void \*value\) \{/g);
		assert.equal(clears.length, generated.types.filter(node => node.aggregate).length);
		source = source.replace(/(static void lpc_clear\d+\(void \*value\) \{)/g, "$1 ++probe_clears;");
		const xs = `#include "runtime.h"\n${hooks}\n`
			+ source.replace(marker, `\n${poisonDeclarations(generated)}\n${owned.source}\n${marker}`)
			+ probeXs + owned.xs;
		await saveLakeFile(consumer, "Probe.xs", xs);
		await runCopied(perl, ["build-probes.pl"], consumer, { ...environment, PERL5LIB: lib });
		const filename = `probe-${mode}.so`;
		await rename(join(consumer, "Probe.so"), join(consumer, filename));
		libraries.push({ mode, filename, xsSha256: sha256(xs)
			, sha256: sha256(await readFile(join(consumer, filename))) });
	}
	for(const name of [...headers, "Probe.xs", "Probe.c", "Probe.o", "build-probes.pl"])
		await rm(join(consumer, name));
	const sources = {};
	for(const name of ["faults", "ownership", "poison"])
	{
		const source = await readFile(`tests/fixtures/structured-callable-consumers/perl-recursive-${name}.pl`, "utf8");
		sources[name] = sha256(source);
		await saveLakeFile(consumer, `probe-${name}.pl`, source);
	}
	const values = (await readFile("tests/fixtures/structured-callable-consumers/perl-values.pl", "utf8"))
		.replaceAll("LeanBridge::Structured", "LeanBridge::Recursive") + "\n1;\n";
	sources.values = sha256(values);
	await saveLakeFile(consumer, "values.pl", values);
	const driver = `use strict; use warnings; use DynaLoader; use LeanBridge::Recursive;
my ($mode, $fixture) = @ARGV;
die "unknown probe mode" unless $mode =~ /\\A(?:baseline|reply-scope|retirement)\\z/;
die "unknown probe fixture" unless $fixture =~ /\\A(?:faults|ownership|poison)\\z/;
my $handle = DynaLoader::dl_load_file("./probe-$mode.so", 0) or die DynaLoader::dl_error();
my $symbol = DynaLoader::dl_find_symbol($handle, 'boot_LeanBridge__Recursive') or die DynaLoader::dl_error();
my $boot = DynaLoader::dl_install_xsub('RecursiveInstalledProbe::bootstrap', $symbol);
{ no warnings 'redefine'; $boot->('LeanBridge::Recursive', $LeanBridge::Recursive::VERSION); }
my $loaded = eval { require "./probe-$fixture.pl"; 1 };
if (!$loaded) {
  my $failure = $@;
  # Perl die otherwise inherits errno or a child status from native calls.
  # A normal exception must remain distinguishable from a fatal signal.
  $! = 0; $? = 0; die $failure;
}
`;
	await saveLakeFile(consumer, "probe-driver.pl", driver);
	return async () => {
		const env = { ...copiedCleanEnvironment, PERL5LIB: lib }, results = {};
		for(const name of ["faults", "ownership", "poison"])
		{
			const run = await runCopied(perl, ["probe-driver.pl", "baseline", name], consumer, env);
			assert.equal(run.stderr, ""); results[name] = JSON.parse(run.stdout);
		}
		assertPerlRecursiveFaults(results.faults);
		assert.deepEqual(results.ownership, { ownershipChecks: 9, checkedBeforeDecode: true });
		assert.deepEqual(results.poison, { malformedOutputRejected: true, clears: 1, retired: 1, remainingOwners: 0 });
		const counterfactuals = [];
		for(const [mode, fixture, marker] of [
			["reply-scope", "ownership", "8 Callback owners released before native copying: array,list,result,tuple,record,variant,alias,recursive"]
			, ["retirement", "poison", "Retired runtime reentered"]
		]) {
			let stderr;
			await assert.rejects(runCopied(perl, ["probe-driver.pl", mode, fixture], consumer, env), error => {
				assert.equal(error.code, "build-command-failed");
				assert.ok(error.message.startsWith(`${perl} exited with status 255`), error.message);
				assert.equal(error.details.stdout, "");
				assert.ok(error.details.stderr.includes(marker)); stderr = error.details.stderr; return true;
			});
			counterfactuals.push({ mode, rejected: true, marker, exitCode: 255, stderr });
		}
		return { ...results, counterfactuals, libraries, sources
			, originalXsSha256: sha256(original), driverSha256: sha256(driver)
			, isolatedXsCopy: true, installedRuntime: true
			, compilerFreeExecution: true };
	};
};
