/**
 * Distinct Perl namespaces must not load conflicting native component coordinates.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, rename, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { installCpanArchive } from "../../src/release/cpan-install.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { nativeFixtureEnvironment, runCopied, copiedCleanEnvironment } from "./copied-fixture-install.mjs";
import { perlGraphCommands } from "./perl-graph-probes.mjs";

/**
 * Compile disjoint Lean modules under one coordinate and load both orders.
 *
 * @param root - Test-owned temporary workspace.
 */
export const checkPerlComponentCollision = async root => {
	const perls = perlGraphCommands();
	const environment = { ...nativeFixtureEnvironment(["perl"])
		, LEAN_BRIDGE_PERLS: JSON.stringify(perls)
		, LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR: "2.36" };
	const releases = [];
	for(const suffix of ["A", "B"])
	{
		const module = `Collision${suffix}`, author = join(root, suffix), project = join(author, "project"), output = join(author, "output");
		await saveLakeFile(project, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
		await saveLakeFile(project, "lakefile.toml", `name = "duplicate"\nversion = "1.0.0"\n[[lean_lib]]\nname = "${module}"\n`);
		await saveLakeFile(project, `${module}.lean`, `namespace ${module}
inductive Tree where
  | leaf (value : UInt32)
  | next (child : Tree)
def echo (value : Tree) : Tree := value
end ${module}
`);
		await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: [module], exports: [`${module}.echo`]
			, targets: { cpan: { module: `LeanBridge::${module}` } } }));
		const built = await buildCanonicalProject({ projectRoot: project, outputRoot: output, targets: ["cpan"], environment })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const receipt = JSON.parse(await readFile(join(output, "native/component/native-component.json")));
		const model = JSON.parse(await readFile(join(output, "native/component/model.json")));
		if(releases.length) assert.deepEqual(built.packages[0], releases[0].runtime);
		const handoff = join(root, `handoff-${suffix}`), packages = await copyPackageSetHandoff(output, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		releases.push({ handoff, packages, runtime: built.packages[0]
			, component: built.component, nativeSha256: receipt.nativeLibrary.sha256
			, library: receipt.library, componentId: model.component.id, module
			, sources: Object.fromEntries(model.sourceIdentity.modules.map(item => [item.module, item.source.sha256])) });
		await rm(author, { recursive: true, force: true });
	}
	assert.deepEqual(releases[0].component, releases[1].component);
	assert.notEqual(releases[0].nativeSha256, releases[1].nativeSha256);
	const source = `use strict;
use warnings;
use JSON::PP;
my ($first, $second, $metadata) = @ARGV;
my $identity = JSON::PP->new->decode($metadata);
eval "require LeanBridge::Collision$first; 1" or die $@;
my $module = "LeanBridge::Collision$first";
my $call = $module->can('echo');
my $value = ($module . '::Tree::Leaf')->new(value => 23);
die 'first component call failed' unless $call->($value)->value == 23;
LeanBridge::Runtime::_load_component($INC{"LeanBridge/Collision$first.pm"},
  $identity->{library}, $identity->{nativeSha256}, LeanBridge::Runtime::_identity(),
  $identity->{sources}, $identity->{componentId});
die 'same-identity reload failed' unless $call->($value)->value == 23;
my ($ok, $error, $opened) = (0, '', 0);
{
  no warnings 'redefine';
  local *DynaLoader::dl_load_file = sub { ++$opened; die 'conflict reached dlopen'; };
  local *LeanBridge::Runtime::_read = sub { ++$opened; die 'conflict read an artifact'; };
  $ok = eval "require LeanBridge::Collision$second; 1"; $error = $@;
}
my $rejected = !$ok && index($error, 'Conflicting compiled Lean component: duplicate@1.0.0') == 0;
die 'rejection changed the first component' unless $call->($value)->value == 23;
print JSON::PP->new->canonical->encode({ rejected => $rejected ? JSON::PP::true : JSON::PP::false,
  openedAfterConflict => $opened, sameIdentityReload => JSON::PP::true, error => $error }), "\\n";
`;
	const pending = [], results = [];
	for(const [index, perl] of perls.entries())
	{
		const consumer = join(root, `consumer-${index}`), tools = join(consumer, "tools"), prefix = join(consumer, "installed");
		await mkdir(tools, { recursive: true });
		for(const tool of ["make", "tar", "gzip", "sh", "cp", "mv", "rm", "chmod", "mkdir", "touch", "true"])
			await symlink(`/usr/bin/${tool}`, join(tools, tool));
		for(const [releaseIndex, release] of releases.entries())
		{
			const selected = [release.packages.packages.find(item => item.role === "runtime"), release.packages.packages.find(item => item.role === "component")];
			for(const pkg of selected.filter(item => releaseIndex === 0 || item.role === "component"))
				await installCpanArchive({ archive: join(release.handoff, pkg.artifacts[0].path)
					, workingRoot: consumer, prefix, perl, mode: "prebuilt-only"
					, environment: { ...copiedCleanEnvironment, PATH: tools } });
		}
		const relocated = join(consumer, "relocated"); await rename(prefix, relocated);
		const lib = join(relocated, "lib/perl5");
		const files = Object.fromEntries(await Promise.all((await nativeArtifactPaths(lib)).map(async path => {
			const bytes = await readFile(join(lib, path)); return [path, { bytes: bytes.length, sha256: sha256(bytes) }];
		})));
		await saveLakeFile(consumer, "check.pl", source);
		pending.push({ consumer, perl, lib, files });
	}
	for(const release of releases) await rm(release.handoff, { recursive: true, force: true });
	for(const { consumer, perl, lib, files } of pending)
	{
		for(const order of [["A", "B"], ["B", "A"]])
		{
			const identity = releases.find(item => item.module === `Collision${order[0]}`);
			const run = await runCopied(perl, ["check.pl", ...order, JSON.stringify(identity)], consumer, { ...copiedCleanEnvironment, PERL5LIB: lib });
			assert.equal(run.stderr, ""); const result = JSON.parse(run.stdout);
			assert.equal(result.rejected, true, `Conflicting component coordinate loaded: ${order.join(" then ")}; ${result.error}`);
			assert.equal(result.openedAfterConflict, 0); assert.equal(result.sameIdentityReload, true);
			results.push({ order, rejected: true, openedAfterConflict: 0
				, sameIdentityReload: true, perlSha256: sha256(await readFile(perl)) });
		}
		await verifyNativeFiles(lib, files); assert.deepEqual(await nativeArtifactPaths(lib), Object.keys(files));
		await rm(consumer, { recursive: true, force: true });
	}
	return { schemaVersion: 1, sourceFree: true
		, handoffRemoved: true, relocated: true
		, compilerFreeExecution: true, installedFilesUnchanged: true
		, releases: releases.map(({ handoff, ...release }) => { void handoff; return release; })
		, results };
};
