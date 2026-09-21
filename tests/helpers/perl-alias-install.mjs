/**
 * Verify prepared alias contracts and relocated CPAN installations on each ABI.
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
import { nativeAliasReviewedIr } from "./native-alias-fixture.mjs";
import { perlAliasValueTypes } from "./perl-alias-fixture.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Compare package metadata and POD with an independently specified contract.
 *
 * @param files - Verified prepared-package files.
 */
export const checkPerlAliasFiles = files => {
	const ir = nativeAliasReviewedIr(), manifest = JSON.parse(files["binding-manifest.json"]);
	const expected = ir.types.filter(type => type.kind === "alias").map(({ id, name, target }) => ({ id, name, target, perlType: perlAliasValueTypes[name] }));
	assert.equal(expected.length, 27);
	assert.deepEqual([...manifest.aliases].sort((a, b) => a.id.localeCompare(b.id)), expected);
	const pm = files["lib/LeanBridge/Aliases.pm"], pod = pm.slice(pm.indexOf("__END__"));
	const render = ref => ref.kind === "primitive" ? ref.name : ref.kind === "named" ? ref.id.slice("lean:Aliases.".length)
		: `${ref.constructor}<${ref.arguments.map(render).join(", ")}>`;
	// Decode POD escapes once, preserving original type delimiters for comparison.
	const plain = pod.replace(/E<(lt|gt|amp)>/g, (_, entity) => ({ lt: "<", gt: ">", amp: "&" }[entity]));
	for(const alias of expected)
	{
		assert.ok(plain.includes(`=item C<${alias.name}>\n\nContract: C<${render(alias.target)}>. Perl value: C<${alias.perlType}>.`), alias.name);
		assert.ok(!pm.includes(`package LeanBridge::Aliases::${alias.name};`), alias.name);
	}
	for(const declaration of ir.declarations)
	{
		const section = plain.split(`=head2 ${declaration.name}\n\n`)[1]?.split(/\n=head[12] /)[0];
		assert.ok(section, declaration.name);
		assert.ok(section.includes(`Returns C<${render(declaration.result.type)}>.`), declaration.name);
		const parameters = [...section.matchAll(/Parameter C<[^>]+>: C<([^]*?)>\./g)].map(match => match[1]);
		assert.deepEqual(parameters, declaration.parameters.map(parameter => render(parameter.type)), declaration.name);
	}
	for(const record of ir.types.filter(type => type.kind === "record")) for(const field of record.fields)
		assert.ok(plain.includes(`=item C<${record.name}.${field.name}>\n\nContract: C<${render(field.type)}>.`));
	return { aliases: expected, transparentTargetValues: true, installedSourceDocumentation: true, originalAliasChains: true };
};

/**
 * Install offline, then defer compiler-free execution until the handoff is removed.
 *
 * @param root0 - Checked packages and pinned Perl ABI.
 * @param root0.consumer - Task-owned scratch root.
 * @param root0.handoff - Verified package-set directory.
 * @param root0.packages - Runtime and component archives.
 * @param root0.perl - Absolute pinned interpreter path.
 * @param root0.environment - Producer-only tools for isolated fault XS.
 */
export const preparePerlAliases = async ({ consumer, handoff, packages, perl, environment }) => {
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
	const sources = {};
	for(const name of ["perl.pl", "perl-faults.pl"]) sources[name] = await readFile(`tests/fixtures/alias-consumers/${name}`, "utf8");
	sources["perl-probe.h"] = (await readFile("tests/fixtures/list-consumers/perl-probe.h", "utf8")).replaceAll("List conversion", "alias conversion");
	sources["perl-probe-build.pl"] = (await readFile("tests/fixtures/list-consumers/perl-probe-build.pl", "utf8")).replaceAll("LeanBridge::Lists", "LeanBridge::Aliases");
	for(const [name, source] of Object.entries(sources)) await saveLakeFile(consumer, name, source);
	const extraction = join(consumer, "probe-source"); await mkdir(extraction);
	const pkg = packages.find(item => item.role === "component");
	await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", join(handoff, pkg.artifacts[0].path), "-C", extraction], consumer);
	const entries = await readdir(extraction); assert.equal(entries.length, 1);
	const prepared = await readVerifiedCpanPackage(join(extraction, entries[0]));
	const catalog = checkPerlAliasFiles(Object.fromEntries(["binding-manifest.json", "lib/LeanBridge/Aliases.pm"].map(name => [name, prepared.files.get(name).toString()])));
	const apiPaths = Object.keys(installedFiles).filter(path => path.endsWith("/LeanBridge/Aliases.pm")); assert.equal(apiPaths.length, 1);
	assert.equal(await readFile(join(env.PERL5LIB, apiPaths[0]), "utf8"), prepared.files.get("lib/LeanBridge/Aliases.pm").toString());
	await runCopied(perl, ["-MPod::Checker", "-e", 'exit Pod::Checker::podchecker($ARGV[0], "/dev/null")', join(env.PERL5LIB, apiPaths[0])], consumer, env);
	const xs = prepared.files.get("Component.xs").toString(), marker = '#include "component.h"'; assert.equal(xs.split(marker).length, 2);
	const probeXs = xs.replace(marker, `${marker}\n#include "perl-probe.h"`) + `
MODULE = LeanBridge::Aliases    PACKAGE = LeanBridge::Aliases

void
_alias_probe(...)
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
	const execute = async () => {
		const run = await runCopied(perl, ["perl.pl"], consumer, env); assert.equal(run.stderr, "");
		const observation = JSON.parse(run.stdout);
		assert.ok(observation.checks > 5000); assert.equal(observation.primitives.length, 19); assert.equal(observation.word_bits, 64);
		assert.equal(observation.api, join(env.PERL5LIB, apiPaths[0])); assert.deepEqual(observation.native_libraries, expectedLibraries);
		return observation;
	};
	return async () => {
		const first = await execute();
		const run = await runCopied(perl, ["perl-faults.pl", join(consumer, "Probe.so")], consumer, env); assert.equal(run.stderr, "");
		const faults = JSON.parse(run.stdout); assert.ok(faults.conversion_checkpoints > 100); assert.equal(faults.partial_inputs, 64); assert.equal(faults.host_exceptions, 4);
		assert.deepEqual(await execute(), first);
		await verifyNativeFiles(env.PERL5LIB, installedFiles);
		assert.deepEqual(await nativeArtifactPaths(env.PERL5LIB), Object.keys(installedFiles));
		const result = { checks: first.checks, primitives: first.primitives
			, perl: first.perl, threaded: first.threaded
			, nativeLibraries: first.native_libraries, installedFiles, catalog
			, perlSha256: sha256(await readFile(perl))
			, consumerSha256: sha256(sources["perl.pl"])
			, faults, probeSha256, probeSourceSha256: sha256(probeXs)
			, offlineInstall: true, compilerFreeExecution: true
			, relocatedInstallation: true, publicApiOnly: true
			, repeatExecution: true, installedFilesUnchanged: true
			, isolatedCompiledFaultProbe: true };
		await rm(consumer, { recursive: true, force: true });
		return result;
	};
};
