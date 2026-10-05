/**
 * Install, relocate and verify CPAN consumers; keep fault XS separate from packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, readdir, rename, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { readVerifiedCpanPackage } from "../../src/release/cpan-package.mjs";
import { installCpanArchive } from "../../src/release/cpan-install.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Prepare an installed consumer and return execution to run after handoff removal.
 *
 * @param root0 - Verified CPAN archives and pinned ABI selection.
 * @param root0.consumer - Task-owned directory.
 * @param root0.handoff - Verified package-set directory.
 * @param root0.packages - Runtime and component package entries.
 * @param root0.perl - Absolute pinned Perl executable.
 * @param root0.environment - Producer-only environment for building the isolated probe.
 */
export const preparePerlCompounds = async ({ consumer, handoff, packages, perl, environment }) => {
	await mkdir(consumer, { recursive: true });
	const tools = join(consumer, "tools"), original = join(consumer, "installed"), relocated = join(consumer, "relocated");
	await mkdir(tools);
	for(const tool of ["make", "tar", "gzip", "sh", "cp", "mv", "rm", "chmod", "mkdir", "touch", "true"]) await symlink(`/usr/bin/${tool}`, join(tools, tool));
	for(const pkg of [packages.find(item => item.role === "runtime"), packages.find(item => item.role === "component")])
		await installCpanArchive({ archive: join(handoff, pkg.artifacts[0].path), workingRoot: consumer, prefix: original, perl, mode: "prebuilt-only", environment: { ...copiedCleanEnvironment, PATH: tools } });
	const lib = join(original, "lib/perl5");
	const installedFiles = Object.fromEntries(await Promise.all((await nativeArtifactPaths(lib)).map(async path => {
		const bytes = await readFile(join(lib, path)); return [path, { bytes: bytes.length, sha256: sha256(bytes) }];
	})));
	const receipts = Object.keys(installedFiles).filter(path => path.endsWith("install-receipt.json"));
	assert.equal(receipts.length, 2);
	for(const path of receipts) assert.equal(JSON.parse(await readFile(join(lib, path))).operation, "prebuilt-xs");
	await rename(original, relocated);
	const env = { ...copiedCleanEnvironment, PERL5LIB: join(relocated, "lib/perl5") };
	const sources = Object.fromEntries(await Promise.all(["perl.pl", "perl-faults.pl", "perl-probe.h", "perl-probe-build.pl"].map(async name => [name, await readFile(`tests/fixtures/compound-consumers/${name}`, "utf8")])));
	for(const [name, source] of Object.entries(sources)) await saveLakeFile(consumer, name, source);
	// Compile a test-only copy of XS. Never replace a file in the installation.
	const extraction = join(consumer, "probe-source"); await mkdir(extraction);
	const pkg = packages.find(item => item.role === "component");
	await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", join(handoff, pkg.artifacts[0].path), "-C", extraction], consumer);
	const entries = await readdir(extraction); assert.equal(entries.length, 1);
	const prepared = await readVerifiedCpanPackage(join(extraction, entries[0]));
	const xs = prepared.files.get("Component.xs").toString();
	const marker = '#include "component.h"'; assert.equal(xs.split(marker).length, 2);
	const probeXs = xs.replace(marker, `${marker}\n#include "perl-probe.h"`) + `
MODULE = LeanBridge::Compounds    PACKAGE = LeanBridge::Compounds

void
_compound_probe(...)
  PPCODE:
    if (items != 1) croak("probe expects a failure index");
    UV previous = lb_test_count;
    lb_test_count = 0; lb_test_target = SvUV(ST(0));
    ST(0) = Perl_sv_2mortal(aTHX_ newSVuv(previous));
    XSRETURN(1);
`;
	await saveLakeFile(consumer, "Probe.xs", probeXs);
	await saveLakeFile(consumer, "component.h", prepared.files.get("component.h"));
	await rm(extraction, { recursive: true, force: true });
	await runCopied(perl, ["perl-probe-build.pl"], consumer, { ...environment, PERL5LIB: env.PERL5LIB });
	const probeSha256 = sha256(await readFile(join(consumer, "Probe.so")));
	const expectedLibraries = Object.fromEntries(Object.entries(installedFiles).filter(([path]) => path.endsWith(".so")).map(([path, value]) => [path, value.sha256]));
	assert.equal(Object.keys(expectedLibraries).length, 5);
	const apiPaths = Object.keys(installedFiles).filter(path => path.endsWith("/LeanBridge/Compounds.pm"));
	assert.equal(apiPaths.length, 1);
	const execute = async () => {
		const run = await runCopied(perl, ["perl.pl"], consumer, env); assert.equal(run.stderr, "");
		const observation = JSON.parse(run.stdout);
		assert.ok(observation.checks > 20000); assert.equal(observation.primitives.length, 19);
		assert.equal(observation.word_bits, 64);
		assert.equal(observation.api, join(env.PERL5LIB, apiPaths[0]));
		assert.deepEqual(observation.native_libraries, expectedLibraries);
		return observation;
	};
	return async () => {
		const first = await execute();
		const run = await runCopied(perl, ["perl-faults.pl", join(consumer, "Probe.so")], consumer, env);
		assert.equal(run.stderr, "");
		const faults = JSON.parse(run.stdout); assert.ok(faults.checks > 100); assert.equal(faults.partial_inputs, 16);
		assert.deepEqual(await execute(), first);
		await verifyNativeFiles(env.PERL5LIB, installedFiles);
		assert.deepEqual(await nativeArtifactPaths(env.PERL5LIB), Object.keys(installedFiles));
		const result = { checks: first.checks
			, primitives: first.primitives, perl: first.perl, threaded: first.threaded
			, nativeLibraries: first.native_libraries, installedFiles
			, perlSha256: sha256(await readFile(perl))
			, consumerSha256: sha256(sources["perl.pl"]), faults, probeSha256
			, probeSourceSha256: sha256(probeXs)
			, offlineInstall: true, compilerFreeExecution: true
			, relocatedInstallation: true, publicApiOnly: true
			, repeatExecution: true, installedFilesUnchanged: true
			, isolatedCompiledFaultProbe: true };
		await rm(consumer, { recursive: true, force: true });
		return result;
	};
};
