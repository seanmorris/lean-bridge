/**
 * Install original CPAN variants offline, relocate and execute both public/probe XS.
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
import { perlVariantProbe } from "./perl-variant-probe.mjs";

/**
 * Prepare one selected Perl ABI, then execute after the producer handoff is gone.
 *
 * @param options - Original checked packages and selected Perl ABI.
 * @param options.consumer - Task-owned scratch directory.
 * @param options.handoff - Verified archives and package-set receipt.
 * @param options.packages - Runtime and component package entries.
 * @param options.perl - Absolute interpreter path.
 * @param options.environment - Producer tools for the isolated XS fault probe.
 * @param options.model - Compiler-authenticated model for private probe helpers.
 */
export const preparePerlVariants = async ({ consumer, handoff, packages, perl, environment, model }) => {
	await mkdir(consumer, { recursive: true });
	const tools = join(consumer, "tools"), original = join(consumer, "installed"), relocated = join(consumer, "relocated");
	await mkdir(tools);
	for(const tool of ["make", "tar", "gzip", "sh", "cp", "mv", "rm", "chmod", "mkdir", "touch", "true"]) await symlink(`/usr/bin/${tool}`, join(tools, tool));
	assert.equal(packages.length, 2); assert.ok(packages.every(pkg => pkg.ecosystem === "cpan"));
	for(const pkg of [packages.find(item => item.role === "runtime"), packages.find(item => item.role === "component")])
	{
		const archive = join(handoff, pkg.artifacts[0].path);
		assert.equal(sha256(await readFile(archive)), pkg.artifacts[0].sha256);
		await installCpanArchive({ archive, workingRoot: consumer, prefix: original, perl, mode: "prebuilt-only", environment: { ...copiedCleanEnvironment, PATH: tools } });
	}
	const lib = join(original, "lib/perl5");
	const installedFiles = Object.fromEntries(await Promise.all((await nativeArtifactPaths(lib)).map(async path => {
		const bytes = await readFile(join(lib, path)); return [path, { bytes: bytes.length, sha256: sha256(bytes) }];
	})));
	const receipts = Object.keys(installedFiles).filter(path => path.endsWith("install-receipt.json")); assert.equal(receipts.length, 2);
	for(const path of receipts) assert.equal(JSON.parse(await readFile(join(lib, path))).operation, "prebuilt-xs");
	await rename(original, relocated);
	const env = { ...copiedCleanEnvironment, PERL5LIB: join(relocated, "lib/perl5") };
	const sources = {};
	for(const name of ["perl.pl", "perl-faults.pl"]) sources[name] = await readFile(`tests/fixtures/variant-consumers/${name}`, "utf8");
	sources["perl-probe.h"] = (await readFile("tests/fixtures/list-consumers/perl-probe.h", "utf8")).replaceAll("List conversion", "variant conversion");
	sources["perl-probe-build.pl"] = (await readFile("tests/fixtures/list-consumers/perl-probe-build.pl", "utf8")).replaceAll("LeanBridge::Lists", "LeanBridge::Variants");
	for(const [name, source] of Object.entries(sources)) await saveLakeFile(consumer, name, source);
	const extraction = join(consumer, "probe-source"); await mkdir(extraction);
	const pkg = packages.find(item => item.role === "component");
	await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", join(handoff, pkg.artifacts[0].path), "-C", extraction], consumer);
	const entries = await readdir(extraction); assert.equal(entries.length, 1);
	const prepared = await readVerifiedCpanPackage(join(extraction, entries[0]));
	const apiPaths = Object.keys(installedFiles).filter(path => path.endsWith("/LeanBridge/Variants.pm")); assert.equal(apiPaths.length, 1);
	assert.equal(await readFile(join(env.PERL5LIB, apiPaths[0]), "utf8"), prepared.files.get("lib/LeanBridge/Variants.pm").toString());
	await runCopied(perl, ["-MPod::Checker", "-e", 'exit Pod::Checker::podchecker($ARGV[0], "/dev/null")', join(env.PERL5LIB, apiPaths[0])], consumer, env);
	const { source: probeXs, families } = perlVariantProbe(model, prepared.files.get("Component.xs").toString());
	await saveLakeFile(consumer, "Probe.xs", probeXs);
	await saveLakeFile(consumer, "component.h", prepared.files.get("component.h"));
	await rm(extraction, { recursive: true, force: true });
	await runCopied(perl, ["perl-probe-build.pl"], consumer, { ...environment, PERL5LIB: env.PERL5LIB });
	const probeSha256 = sha256(await readFile(join(consumer, "Probe.so")));
	const expectedLibraries = Object.fromEntries(Object.entries(installedFiles).filter(([path]) => path.endsWith(".so")).map(([path, value]) => [path, value.sha256]));
	assert.equal(Object.keys(expectedLibraries).length, 5);
	const execute = async () => {
		const run = await runCopied(perl, ["perl.pl"], consumer, env); assert.equal(run.stderr, "");
		const observation = JSON.parse(run.stdout);
		assert.ok(observation.checks > 25000 && observation.calls > 4000 && observation.rejected > 80);
		assert.equal(observation.primitives.length, 19); assert.equal(observation.word_bits, 64);
		assert.equal(observation.api, join(env.PERL5LIB, apiPaths[0])); assert.deepEqual(observation.native_libraries, expectedLibraries);
		return observation;
	};
	return async () => {
		const first = await execute();
		const run = await runCopied(perl, ["perl-faults.pl", join(consumer, "Probe.so"), JSON.stringify(families)], consumer, env); assert.equal(run.stderr, "");
		const faults = JSON.parse(run.stdout);
		assert.ok(faults.conversion_checkpoints > 200 && faults.active_accessor_checks > 500);
		assert.equal(faults.partial_inputs, 64); assert.equal(faults.host_exceptions, 4); assert.equal(faults.malformed_tags, 7);
		assert.equal(faults.reentrant_fields, 3); assert.equal(faults.wrong_accessors, 0);
		assert.equal(faults.constructor_probes.length, 18); assert.equal(new Set(faults.constructor_probes).size, 18);
		assert.deepEqual(await execute(), first);
		await verifyNativeFiles(env.PERL5LIB, installedFiles);
		assert.deepEqual(await nativeArtifactPaths(env.PERL5LIB), Object.keys(installedFiles));
		const result = { checks: first.checks, calls: first.calls
			, rejected: first.rejected, primitives: first.primitives
			, perl: first.perl, threaded: first.threaded, families
			, nativeLibraries: first.native_libraries, installedFiles
			, perlSha256: sha256(await readFile(perl))
			, consumerSha256: sha256(sources["perl.pl"])
			, faults, probeSha256, probeSourceSha256: sha256(probeXs)
			, offlineInstall: true, compilerFreeExecution: true
			, relocatedInstallation: true
			, publicApiOnly: true, repeatExecution: true, installedFilesUnchanged: true
			, installedPodChecked: true, isolatedCompiledFaultProbe: true };
		await rm(consumer, { recursive: true, force: true }); return result;
	};
};
