/**
 * Source-free graph/acyclic CPAN composition and installed shared-runtime guards.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, rename, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { installCpanArchive } from "../../src/release/cpan-install.mjs";
import { compileCopiedCGraphLayout } from "../../src/backends/c/copied-graph-layout.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { perlGraphCommands } from "./perl-graph-probes.mjs";

/**
 * Distinct coordinates deliberately normalize to identical private C root names.
 *
 * @param directory - Test-owned temporary workspace.
 * @param diagnostic - Progress callback.
 */
export const checkPerlGraphComposition = async (directory, diagnostic = () => {}) => {
	const perls = perlGraphCommands();
	const environment = { ...nativeFixtureEnvironment(["perl"]), LEAN_BRIDGE_PERLS: JSON.stringify(perls), LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR: "2.36" };
	const releases = [];
	for(const [name, module, increment] of [["graph-mixed", "GraphAlpha", 11], ["graph_mixed", "GraphBeta", 29], ["graph_peer", "Peer", 0]])
	{
		diagnostic(`building ${module} for ${perls.length} Perl ABIs`);
		const author = join(directory, `author-${module}`), project = join(author, "project"), output = join(author, "output");
		const source = module === "Peer" ? `namespace Peer
def answer : UInt32 := 42
def makeAdder (base : UInt32) : UInt32 → UInt32 := fun value => base + value
end Peer
` : `namespace ${module}
inductive Tree where
  | leaf (value : Nat)
  | next (child : Tree)
def tree (value : Tree) : Tree := .next value
def stamp (value : UInt32) : UInt32 := value + ${increment}
end ${module}
`;
		await saveLakeFile(project, `${module}.lean`, source);
		await saveLakeFile(project, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
		await saveLakeFile(project, "lakefile.toml", `name = "${name}"\nversion = "1.0.0"\n[[lean_lib]]\nname = "${module}"\n`);
		await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson({
			schemaVersion: 1, modules: [module]
			, exports: module === "Peer" ? ["Peer.answer", "Peer.makeAdder"] : [`${module}.tree`, `${module}.stamp`]
			, ...module === "Peer" ? { arities: { "Peer.makeAdder": 1 } } : {}
			, targets: { cpan: { module: `LeanBridge::${module}` } } }));
		const built = await buildCanonicalProject({ projectRoot: project, outputRoot: output, targets: ["cpan"], environment })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const handoff = join(directory, `handoff-${module}`), packages = await copyPackageSetHandoff(output, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const model = JSON.parse(await readFile(join(output, "native/component/model.json")));
		const privateRoots = module === "Peer" ? [] : compileCopiedCGraphLayout(model.bindingIr).roots.map(item => item.name);
		if(releases.length) assert.deepEqual(packages.packages.find(item => item.role === "runtime"), releases[0].packages.packages.find(item => item.role === "runtime"));
		releases.push({ handoff, module, packages, privateRoots
			, sourceSha256: sha256(source), bindingIrSha256: built.bindingIrSha256 });
		await rm(author, { recursive: true, force: true });
	}
	assert.deepEqual(releases[0].privateRoots, releases[1].privateRoots);
	const observations = [], pending = [];
	for(const [index, perl] of perls.entries())
	{
		diagnostic(`installing and checking composition: ${perl}`);
		const consumer = join(directory, `consumer-${index}`), prefix = join(consumer, "installed"), tools = join(consumer, "tools");
		await mkdir(tools, { recursive: true });
		for(const command of ["make", "tar", "gzip", "sh", "cp", "mv", "rm", "chmod", "mkdir", "touch", "true"])
			await symlink(`/usr/bin/${command}`, join(tools, command));
		for(const [releaseIndex, release] of releases.entries())
		{
			const selected = [release.packages.packages.find(item => item.role === "runtime"), release.packages.packages.find(item => item.role === "component")];
			for(const pkg of selected.filter(item => releaseIndex === 0 || item.role === "component"))
				await installCpanArchive({ archive: join(release.handoff, pkg.artifacts[0].path)
					, workingRoot: consumer, prefix, perl, mode: "prebuilt-only"
					, environment: { ...copiedCleanEnvironment, PATH: tools } });
		}
		const relocated = join(consumer, "relocated"); await rename(prefix, relocated);
		const lib = join(relocated, "lib/perl5"), env = { ...copiedCleanEnvironment, PERL5LIB: lib };
		const files = Object.fromEntries(await Promise.all((await nativeArtifactPaths(lib)).map(async path => {
			const bytes = await readFile(join(lib, path)); return [path, { bytes: bytes.length, sha256: sha256(bytes) }];
		})));
		assert.equal(Object.keys(files).filter(path => path.endsWith("install-receipt.json")).length, 4);
		for(const extension of ["c", "pl"])
			await saveLakeFile(consumer, `composition.${extension}`, await readFile(`tests/fixtures/structured-types/recursive-perl-composition.${extension}`));
		await saveLakeFile(consumer, "build.pl", `use strict; use warnings; use ExtUtils::CBuilder; use LeanBridge::Runtime;
my $root = $INC{'LeanBridge/Runtime.pm'}; $root =~ s/\\.pm\\z//;
my $builder = ExtUtils::CBuilder->new(quiet => 1);
my $object = $builder->compile(source => 'composition.c', include_dirs => ["$root/include"], extra_compiler_flags => '-O2 -g0 -Wall -Wextra -Werror');
$builder->link(objects => $object, module_name => 'CompositionProbe', lib_file => 'Composition.so', extra_linker_flags => '-pthread -Wl,--build-id=none');
`);
		await runCopied(perl, ["build.pl"], consumer, { ...environment, PERL5LIB: lib });
		for(const name of ["composition.c", "composition.o", "build.pl"]) await rm(join(consumer, name));
		pending.push({ consumer, perl, lib, env, files });
	}
	for(const release of releases) await rm(release.handoff, { recursive: true, force: true });
	for(const { consumer, perl, lib, env, files } of pending)
	{
		const reports = [];
		for(const order of ["acyclic-first", "graph-first"]) for(const mode of ["direct", "publication"])
		{
			const run = await runCopied(perl, ["composition.pl", order, mode], consumer, env);
			assert.equal(run.stderr, ""); reports.push(JSON.parse(run.stdout));
		}
		await verifyNativeFiles(lib, files); assert.deepEqual(await nativeArtifactPaths(lib), Object.keys(files));
		observations.push({ reports, installedFiles: files
			, perlSha256: sha256(await readFile(perl))
			, probeSha256: sha256(await readFile(join(consumer, "Composition.so")))
			, sourceFree: true, handoffRemoved: true, relocated: true
			, compilerFreeExecution: true, installedFilesUnchanged: true });
		await rm(consumer, { recursive: true, force: true });
	}
	return { schemaVersion: 1, releases: releases.map(({ handoff, ...release }) => { void handoff; return release; }), observations };
};
