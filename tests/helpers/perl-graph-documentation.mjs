/**
 * Compile the publishing guide and execute the consumer guide from CPAN archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, rename, rm, symlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { installCpanArchive } from "../../src/release/cpan-install.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { perlGraphCommands } from "./perl-graph-probes.mjs";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

const snippet = (document, heading, language) => {
	assert.equal(document.split(`${heading}\n`).length, 2);
	const section = document.split(`${heading}\n`)[1].split(/\n#{1,3} /)[0];
	const blocks = [...section.matchAll(new RegExp("```" + language + "\\n([^]*?)\\n```", "g"))];
	assert.equal(blocks.length, 1);
	return blocks[0][1] + "\n";
};

const reviewedContract = () => {
	const ir = corpusReviewedIr({ id: "recursive_demo" }, [{ name: "RecursiveDemo.wrap", parameters: ["unit"], result: "unit" }]);
	const reference = { kind: "named", id: "lean:RecursiveDemo.Tree" }, documentation = ir.documentation;
	const field = (name, type) => ({ name, type, mutability: "immutable", documentation });
	ir.types = [{ id: reference.id
		, name: "Tree"
		, kind: "variant"
		, representation: "copied"
		, mutability: "immutable"
		, typeParameters: []
		, fields: []
		, target: null
		, resource: null
		, callable: null
		, host: null
		, cases: [{ name: "leaf", fields: [field("value", { kind: "primitive", name: "uint32" })], documentation }
			, { name: "next", fields: [field("child", reference)], documentation }]
		, documentation, assurance: []
		, source: { producer: "corpusReview", declaration: "RecursiveDemo.Tree", extensions: {} } }];
	ir.declarations[0].parameters[0].type = reference;
	ir.declarations[0].result.type = reference;
	return ir;
};

const tamperCheck = `use strict;
use warnings;
use DynaLoader;
my $target = shift;
my @opened;
my $load = \\&DynaLoader::dl_load_file;
{
  no warnings 'redefine';
  *DynaLoader::dl_load_file = sub { push @opened, $_[0]; goto &$load; };
}
my $ok = eval { require LeanBridge::RecursiveDemo; 1 };
die 'corrupt native library was admitted' if $ok;
die "unexpected rejection: $@" unless index($@, "Native artifact checksum mismatch: $target\\n") == 0;
die 'corrupt native library reached dlopen' if grep { $_ eq $target } @opened;
print "rejected before dlopen\\n";
`;

/**
 * Test the documented source and call on every selected ABI and both build paths.
 *
 * @param root - Test-owned temporary workspace.
 * @param diagnostic - Progress callback for compiler and installed checks.
 */
export const checkPerlGraphDocumentation = async (root, diagnostic = () => {}) => {
	const author = await readFile("docs/publish/cpan.md", "utf8"), consumer = await readFile("docs/consume/perl.md", "utf8");
	const source = snippet(author, "## Export recursive values", "lean");
	const configurationSource = snippet(author, "## Export recursive values", "json");
	const consumerSource = snippet(consumer, "### Recursive values", "perl");
	const configuration = JSON.parse(configurationSource), review = reviewedContract();
	assert.deepEqual(configuration.exports, review.declarations.map(item => item.source.declaration));
	const perls = perlGraphCommands(), observations = [];
	const environment = { ...nativeFixtureEnvironment(["perl"])
		, LEAN_BRIDGE_PERLS: JSON.stringify(perls)
		, LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR: "2.36" };
	for(const reviewed of [false, true])
	{
		diagnostic(`${reviewed ? "reviewed" : "ordinary"}: compiling the documented recursive module`);
		const directory = join(root, reviewed ? "reviewed" : "ordinary"), producer = join(directory, "producer");
		const project = join(producer, "project"), output = join(producer, "output"), handoff = join(directory, "handoff");
		await saveLakeFile(project, "RecursiveDemo.lean", source);
		await saveLakeFile(project, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
		await saveLakeFile(project, "lakefile.toml", 'name = "recursive_demo"\nversion = "1.0.0"\n[[lean_lib]]\nname = "RecursiveDemo"\n');
		const selected = structuredClone(configuration);
		if(reviewed) delete selected.exports;
		await saveLakeFile(project, "lean-bridge.exports.json", reviewed ? canonicalJson(selected) : configurationSource);
		if(reviewed) await saveLakeFile(project, "reviewed.binding-ir.json", canonicalJson(review));
		const before = await lakeInputState(project);
		await buildCanonicalProject({ projectRoot: project, outputRoot: output, targets: ["cpan"], environment })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		assert.deepEqual(await lakeInputState(project), before);
		const packages = await copyPackageSetHandoff(output, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		await rm(producer, { recursive: true, force: true });
		const pending = [], installs = [];
		for(const [index, perl] of perls.entries())
		{
			const caller = join(directory, `consumer-${index}`), tools = join(caller, "tools"), prefix = join(caller, "installed");
			await mkdir(tools, { recursive: true });
			for(const command of ["make", "tar", "gzip", "sh", "cp", "mv", "rm", "chmod", "mkdir", "touch", "true"])
				await symlink(`/usr/bin/${command}`, join(tools, command));
			for(const role of ["runtime", "component"])
			{
				const pkg = packages.packages.find(item => item.role === role);
				assert.ok(pkg && pkg.artifacts.length === 1);
				await installCpanArchive({ archive: join(handoff, pkg.artifacts[0].path)
					, workingRoot: caller, prefix, perl, mode: "prebuilt-only"
					, environment: { ...copiedCleanEnvironment, PATH: tools } });
			}
			const relocated = join(caller, "relocated"); await rename(prefix, relocated);
			const lib = join(relocated, "lib/perl5");
			const files = Object.fromEntries(await Promise.all((await nativeArtifactPaths(lib)).map(async path => {
				const bytes = await readFile(join(lib, path)); return [path, { bytes: bytes.length, sha256: sha256(bytes) }];
			})));
			await saveLakeFile(caller, "recursive.pl", consumerSource); await saveLakeFile(caller, "tamper.pl", tamperCheck);
			pending.push({ caller, perl, lib, files });
		}
		await rm(handoff, { recursive: true, force: true });
		for(const { caller, perl, lib, files } of pending)
		{
			diagnostic(`${reviewed ? "reviewed" : "ordinary"}: executing documentation and native tamper checks on ${perl}`);
			const env = { ...copiedCleanEnvironment, PERL5LIB: lib };
			const execute = async () => {
				const result = await runCopied(perl, ["recursive.pl"], caller, env);
				assert.equal(result.stderr, ""); assert.equal(result.stdout, "41\n99\n41\n");
			};
			await execute();
			const native = Object.keys(files).filter(path => /\/native\/[^/]+\.so$/.test(path));
			assert.equal(native.length, 3);
			for(const path of native)
			{
				const target = join(lib, path), original = await readFile(target), corrupt = Buffer.from(original);
				corrupt[corrupt.length - 1] ^= 1;
				try
				{
					await saveLakeFile(dirname(target), target.split("/").at(-1), corrupt);
					const result = await runCopied(perl, ["tamper.pl", target], caller, env);
					assert.equal(result.stderr, ""); assert.equal(result.stdout, "rejected before dlopen\n");
				}
				finally
				{
					await saveLakeFile(dirname(target), target.split("/").at(-1), original);
				}
			}
			await execute();
			await verifyNativeFiles(lib, files); assert.deepEqual(await nativeArtifactPaths(lib), Object.keys(files));
			installs.push({ perlSha256: sha256(await readFile(perl))
				, installedFiles: files
				, nativeTamperRejections: native, documentedOutput: "41\n99\n41\n"
				, sourceFree: true
				, handoffRemoved: true
				, relocated: true
				, compilerFreeExecution: true
				, installedFilesRestored: true, repeated: true });
			await rm(caller, { recursive: true, force: true });
		}
		observations.push({ reviewed, sourceUnchanged: true, packages, installs });
	}
	return { schemaVersion: 1
		, sourceSha256: sha256(source)
		, configurationSha256: sha256(configurationSource)
		, consumerSha256: sha256(consumerSource)
		, reviewSha256: sha256(canonicalJson(review))
		, tamperCheckSha256: sha256(tamperCheck), observations };
};
