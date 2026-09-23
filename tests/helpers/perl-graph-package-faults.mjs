/**
 * Fault injection into an exact archive XS copy against the installed runtime.
 * Original installed modules, libraries and metadata stay unchanged.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { nativeHooks, nativeProbes, nativeXs } from "./perl-native-graphs.mjs";
import { perlGraphInstrumentation, perlGraphProbeXs } from "./perl-graph-probes.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";

/**
 * Compile only test XS using original archive headers and the relocated runtime.
 *
 * @param options - Installed package and exact authenticated source bytes.
 * @param options.consumer - Test-owned consumer directory.
 * @param options.perl - Selected ABI executable.
 * @param options.prepared - Verified original CPAN component contents.
 * @param options.lib - Relocated Perl library directory.
 * @param options.environment - Producer environment, used only while compiling.
 */
export const preparePerlGraphPackageFaults = async ({ consumer, perl, prepared, lib, environment }) => {
	const original = prepared.files.get("Component.xs").toString();
	const module = "\nMODULE = LeanBridge::Recursive PACKAGE = LeanBridge::Recursive\n";
	const call = "lpg_status(aTHX_ scope, recursive_tree_graph(input0, output));";
	const retire = "static void lpg_retire(void) { lean_bridge_native_runtime_retire(); }";
	for(const marker of [module, call, retire]) assert.equal(original.split(marker).length, 2);
	const hooks = nativeHooks.replaceAll("perl_free", "installed_graph_free");
	const xs = `#include "runtime.h"\n${hooks}\n${perlGraphInstrumentation}\n`
		+ original.replace(module, `${nativeProbes}\n${module}`)
			.replace(call, "lpg_status(aTHX_ scope, perl_native_tree(input0, output));")
			.replace(retire, "static void lpg_retire(void) { ++probe_retired; lean_bridge_native_runtime_retire(); }")
		+ perlGraphProbeXs + nativeXs.split("\nBOOT:\n")[0];
	await saveLakeFile(consumer, "Probe.xs", xs);
	const headers = ["component.h", "recursive-graph.h", "recursive-graph-types.h"];
	for(const header of headers) await saveLakeFile(consumer, header, prepared.files.get(header));
	const builder = (await readFile("tests/fixtures/list-consumers/perl-probe-build.pl", "utf8")).replaceAll("LeanBridge::Lists", "LeanBridge::Recursive");
	await saveLakeFile(consumer, "build-faults.pl", builder);
	await runCopied(perl, ["build-faults.pl"], consumer, { ...environment, PERL5LIB: lib });
	const probeSha256 = sha256(await readFile(join(consumer, "Probe.so")));
	for(const path of [...headers, "Probe.xs", "Probe.c", "Probe.o", "build-faults.pl"]) await rm(join(consumer, path));
	const fixture = await readFile("tests/fixtures/structured-types/recursive-perl-lean.pl", "utf8");
	await saveLakeFile(consumer, "fault-body.pl", fixture);
	await saveLakeFile(consumer, "faults.pl", `use strict; use warnings; use DynaLoader; use LeanBridge::Recursive;
my $handle = DynaLoader::dl_load_file('./Probe.so', 0) or die DynaLoader::dl_error();
my $symbol = DynaLoader::dl_find_symbol($handle, 'boot_LeanBridge__Recursive') or die DynaLoader::dl_error();
my $boot = DynaLoader::dl_install_xsub('InstalledFaultProbe::bootstrap', $symbol);
{ no warnings 'redefine'; $boot->('LeanBridge::Recursive', $LeanBridge::Recursive::VERSION); }
require './fault-body.pl';
`);
	return async () => {
		const scenarios = [];
		for(const mode of ["carrier", "raw", "during", "publication"])
		{
			const run = await runCopied(perl, ["faults.pl", mode], consumer, { ...copiedCleanEnvironment, PERL5LIB: lib });
			assert.equal(run.stderr, ""); const report = JSON.parse(run.stdout);
			assert.ok(report.checks > 6000 && report.nativeCheckpoints > 1 && report.perlCheckpoints > 100);
			scenarios.push({ mode, ...report });
		}
		return { originalXsSha256: sha256(original)
			, instrumentedXsSha256: sha256(xs), probeSha256
			, fixtureSha256: sha256(fixture), scenarios
			, isolatedXsCopy: true, installedRuntime: true
			, compilerFreeExecution: true };
	};
};
