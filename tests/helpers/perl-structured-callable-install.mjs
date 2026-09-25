/**
 * Original CPAN archives, relocated installations and separate failure probes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, readFile, readdir, rename, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { readVerifiedCpanPackage } from "../../src/release/cpan-package.mjs";
import { installCpanArchive } from "../../src/release/cpan-install.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { perlStructuredDocumentationExample } from "./perl-structured-callable-fixture.mjs";

const inventory = async root => Object.fromEntries(await Promise.all(
	(await nativeArtifactPaths(root)).map(async path => {
		const bytes = await readFile(join(root, path));
		return [path, { bytes: bytes.length, sha256: sha256(bytes) }];
	})
));

/**
 * Install before removing the handoff; return execution for the source-free phase.
 *
 * @param options - Original package-set archives and the pinned Perl ABI.
 * @param options.consumer - Test-owned workspace.
 * @param options.handoff - Verified package-set handoff directory.
 * @param options.packages - Original runtime and component package entries.
 * @param options.perl - Absolute interpreter executable.
 * @param options.environment - Compiler environment, only for an isolated probe.
 * @param options.inspectInstalled - Optional separately compiled probe preparation.
 */
export const preparePerlStructuredCallables = async options => {
	const { consumer, handoff, packages, perl, environment, inspectInstalled } = options;
	await mkdir(consumer, { recursive: true });
	const tools = join(consumer, "tools"), original = join(consumer, "installed");
	const relocated = join(consumer, "relocated"), lib = join(relocated, "lib/perl5");
	await mkdir(tools);
	for(const tool of ["make", "tar", "gzip", "sh", "cp", "mv", "rm"
		, "chmod", "mkdir", "touch", "true"])
		await symlink(`/usr/bin/${tool}`, join(tools, tool));
	assert.equal(packages.length, 2);
	assert.ok(packages.every(pkg => pkg.ecosystem === "cpan"));
	for(const role of ["runtime", "component"])
	{
		const matches = packages.filter(pkg => pkg.role === role);
		assert.equal(matches.length, 1);
		const pkg = matches[0]; assert.equal(pkg.artifacts.length, 1);
		const archive = join(handoff, pkg.artifacts[0].path);
		assert.equal(sha256(await readFile(archive)), pkg.artifacts[0].sha256);
		await installCpanArchive({ archive, workingRoot: consumer, prefix: original
			, perl, mode: "prebuilt-only"
			, environment: { ...copiedCleanEnvironment, PATH: tools } });
	}
	await rename(original, relocated);
	const files = await inventory(lib);
	const receipts = Object.keys(files).filter(path => path.endsWith("install-receipt.json"));
	assert.equal(receipts.length, 2);
	for(const path of receipts)
		assert.equal(JSON.parse(await readFile(join(lib, path))).operation, "prebuilt-xs");
	const libraries = Object.fromEntries(Object.entries(files)
		.filter(([path]) => path.endsWith(".so"))
		.map(([path, value]) => [path, value.sha256]));
	assert.equal(Object.keys(libraries).length, 5);
	const apiPaths = Object.keys(files).filter(path => path.endsWith("/LeanBridge/Structured.pm"));
	assert.equal(apiPaths.length, 1);
	const api = join(lib, apiPaths[0]), env = { ...copiedCleanEnvironment, PERL5LIB: lib };
	const sources = {};
	for(const name of ["perl-values.pl", "perl.pl"])
		sources[name] = await readFile(`tests/fixtures/structured-callable-consumers/${name}`, "utf8");
	await saveLakeFile(consumer, "check.pl", sources["perl-values.pl"] + "\n" + sources["perl.pl"]);
	const documentationPath = "docs/consume/perl.md";
	const documentation = perlStructuredDocumentationExample(await readFile(documentationPath, "utf8"));
	await saveLakeFile(consumer, documentation.filename, documentation.source);
	const extraction = join(consumer, "verified-component");
	await mkdir(extraction);
	const component = packages.find(pkg => pkg.role === "component");
	await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf"
		, join(handoff, component.artifacts[0].path), "-C", extraction], consumer);
	const entries = await readdir(extraction); assert.equal(entries.length, 1);
	const prepared = await readVerifiedCpanPackage(join(extraction, entries[0]));
	assert.equal(await readFile(api, "utf8"), prepared.files.get("lib/LeanBridge/Structured.pm").toString());
	const podCheck = 'exit Pod::Checker::podchecker($ARGV[0], "/dev/null")';
	await runCopied(perl, ["-MPod::Checker", "-e", podCheck, api], consumer, env);
	const probe = inspectInstalled
		? await inspectInstalled({ consumer, perl, prepared, lib, environment }) : undefined;
	await rm(extraction, { recursive: true, force: true });
	await verifyNativeFiles(lib, files);
	for(const pkg of packages)
		assert.equal(sha256(await readFile(join(handoff, pkg.artifacts[0].path))), pkg.artifacts[0].sha256);
	const execute = async () => {
		const run = await runCopied(perl, ["check.pl"], consumer, env);
		assert.equal(run.stderr, "");
		const report = JSON.parse(run.stdout);
		assert.equal(report.schemaVersion, 1);
		assert.ok(report.checks > 50000); assert.ok(report.calls > 1000);
		assert.ok(report.rejected > 250); assert.equal(report.wordBits, 64);
		assert.deepEqual(report.shapes.map(item => item.shape),
			["array", "list", "option", "result", "tuple", "record", "variant", "alias"]);
		for(const shape of report.shapes)
		{
			assert.ok(shape.checks > 500, shape.shape);
			assert.ok(shape.calls > 100, shape.shape);
			assert.ok(shape.rejected >= 37, shape.shape);
		}
		assert.equal(report.api, api);
		assert.deepEqual(report.nativeLibraries, libraries);
		const example = await runCopied(perl, [documentation.filename], consumer, env);
		assert.equal(example.stderr, ""); assert.equal(example.stdout, documentation.stdout);
		report.documentation = { path: documentationPath
			, sourceSha256: documentation.sourceSha256
			, stdout: example.stdout, stderr: example.stderr, installedPublicApi: true };
		return report;
	};
	return async () => {
		await assert.rejects(access(handoff), { code: "ENOENT" });
		await assert.rejects(access(original), { code: "ENOENT" });
		const first = await execute();
		const faults = probe ? await probe() : undefined;
		assert.deepEqual(await execute(), first);
		await verifyNativeFiles(lib, files);
		assert.deepEqual(await nativeArtifactPaths(lib), Object.keys(files));
		const { api: ignored, ...observation } = first; void ignored;
		const result = { ...observation
			, apiPath: apiPaths[0], installedFiles: files
			, perlSha256: sha256(await readFile(perl))
			, consumerSourceHashes: Object.fromEntries(Object.entries(sources)
				.map(([name, source]) => [name, sha256(source)]))
			, ...faults ? { faults } : {}
			, offlineInstall: true, compilerFreeExecution: true
			, relocatedInstallation: true, handoffRemovedBeforeExecution: true
			, publicCallsUninstrumented: true, repeatExecution: true
			, installedFilesUnchanged: true, installedPodChecked: true };
		await rm(consumer, { recursive: true, force: true });
		return result;
	};
};
