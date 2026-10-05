/**
 * Original recursive CPAN archives installed without producer sources or tools.
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
import { readVerifiedCpanPackage } from "../../src/release/cpan-package.mjs";
import { generateNativeBindingPackages } from "../../src/binding-ir/package-gate.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { saveLakeFile, lakeInputState } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { nativeRecursiveSource } from "./native-recursive-transport.mjs";
import { nativeRecursiveReviewedIr } from "./native-recursive-reviewed.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { perlGraphCommands } from "./perl-graph-probes.mjs";
import { checkPerlGraphPackageDrift } from "./perl-graph-package-drift.mjs";
import { preparePerlGraphPackageFaults } from "./perl-graph-package-faults.mjs";

const inventory = async root => Object.fromEntries(await Promise.all((await nativeArtifactPaths(root)).map(async path => {
	const bytes = await readFile(join(root, path)); return [path, { bytes: bytes.length, sha256: sha256(bytes) }];
})));

const installerRecord = path => /\/auto\/LeanBridge\/(?:Runtime|Recursive)\/\.packlist$/.test(path) || /\/perllocal\.pod$/.test(path);

/**
 * Normalize only MakeMaker's installation prefix and dated POD headings.
 * Preserve raw file hashes separately; package sources and binaries stay exact.
 *
 * @param path - Installed bookkeeping path.
 * @param source - Original MakeMaker record.
 * @param prefix - Absolute installation prefix before relocation.
 */
export const normalizedPerlInstallerRecord = (path, source, prefix) => {
	assert.ok(installerRecord(path)); assert.ok(prefix.startsWith("/") && prefix.length > 1);
	if(path.endsWith("/.packlist"))
	{
		const lines = source.trimEnd().split("\n");
		assert.ok(lines.length > 0 && lines.every(line => line.startsWith(`${prefix}/`) && !line.split("/").includes("..")));
		assert.equal(new Set(lines).size, lines.length);
		return lines.map(line => line.slice(prefix.length)).join("\n") + "\n";
	}
	const modules = [];
	const value = source.replace(/^=head2 ([^\n]+): C<Module> L<LeanBridge::(Runtime|Recursive)\|LeanBridge::\2>$/gm, (_, date, module) => {
		assert.ok(Number.isFinite(Date.parse(`${date} UTC`))); modules.push(module);
		return `=head2 <installation time>: C<Module> L<LeanBridge::${module}|LeanBridge::${module}>`;
	});
	assert.deepEqual(modules, ["Runtime", "Recursive"]);
	assert.equal(value.split(`C<installed into: ${prefix}/lib/perl5>`).length, 3);
	return value.replaceAll(`C<installed into: ${prefix}/lib/perl5>`, "C<installed into: <prefix>/lib/perl5>");
};

const comparableInstall = ({ installedFiles, ...rest }) => ({ ...rest
	, installedFiles: Object.fromEntries(Object.entries(installedFiles).filter(([path]) => !installerRecord(path))) });

/**
 * Build each source path, remove the producer, then install and relocate each ABI.
 *
 * @param directory - Test-owned temporary workspace.
 * @param diagnostic - Progress callback for long-running compiler checks.
 */
export const checkPerlGraphPackages = async (directory, diagnostic = () => {}) => {
	const perls = perlGraphCommands();
	const environment = { ...nativeFixtureEnvironment(["perl"]), LEAN_BRIDGE_PERLS: JSON.stringify(perls), LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR: "2.36" };
	const original = await nativeRecursiveSource(), reviewedIr = nativeRecursiveReviewedIr();
	const fixture = await readFile("tests/fixtures/structured-types/recursive-perl-fixture.pl", "utf8");
	const consumerSource = await readFile("tests/fixtures/structured-types/recursive-perl-package.pl", "utf8");
	const observations = [];
	for(const iteration of [0, 1]) for(const reviewed of [false, true])
	{
		diagnostic(`${reviewed ? "reviewed" : "ordinary"}: independent build ${iteration + 1}, CPAN-only archives`);
		const root = join(directory, `independent-${iteration}`, reviewed ? "reviewed" : "ordinary"), project = join(root, "project"), output = join(root, "output");
		await saveLakeFile(project, "Recursive.lean", original);
		await saveLakeFile(project, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
		await saveLakeFile(project, "lakefile.toml", 'name = "recursive"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Recursive"\n');
		const configuration = { schemaVersion: 1, modules: ["Recursive"]
			, targets: { cpan: { module: "LeanBridge::Recursive" } }
			, ...reviewed ? {} : { exports: reviewedIr.declarations.map(item => item.source.declaration) } };
		await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(configuration));
		if(reviewed) await saveLakeFile(project, "reviewed.binding-ir.json", canonicalJson(reviewedIr));
		const before = await lakeInputState(project);
		const built = await buildCanonicalProject({ projectRoot: project, outputRoot: output, targets: ["cpan"], environment })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		assert.deepEqual(await lakeInputState(project), before);
		assert.deepEqual(built.targets, ["cpan"]); assert.equal(built.packages.length, 2);
		const handoff = join(root, "handoff"), packages = await copyPackageSetHandoff(output, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		assert.equal(packages.packages.length, 2); assert.ok(packages.packages.every(pkg => pkg.target === "cpan"));
		const model = JSON.parse(await readFile(join(output, "native/component/model.json")));
		assert.equal(model.schemaVersion, reviewed ? 5 : 4); assert.equal(model.moduleName, "LeanBridge::Recursive");
		const receipt = JSON.parse(await readFile(join(output, "native/component/native-component.json")));
		const binary = receipt.nativeLibrary.sha256;
		const prepared = await readVerifiedCpanPackage(join(output, "packages/component"));
		const generated = generateNativeBindingPackages(model, { ...receipt, runtimeIdentity: prepared.manifest.runtimeIdentity }).perl;
		for(const [path, bytes] of Object.entries(generated))
			if(!path.endsWith(".pm")) assert.equal(prepared.files.get(path)?.toString(), bytes, path);
		const verification = await checkPerlGraphPackageDrift(output, built.packages);
		await rm(project, { recursive: true, force: true }); await rm(output, { recursive: true, force: true });
		const installs = [], pending = [];
		for(const [index, perl] of perls.entries()) for(const mode of ["prebuilt-only", "build-xs"])
		{
			diagnostic(`${reviewed ? "reviewed" : "ordinary"}: ${perl}, ${mode}`);
			const consumer = join(root, `consumer-${index}-${mode}`), prefix = join(consumer, "installed"), tools = join(consumer, "tools");
			await mkdir(tools, { recursive: true });
			const commands = ["make", "tar", "gzip", "sh", "cp", "mv", "rm"
				, "chmod", "mkdir", "touch", "true"
				, ...mode === "build-xs" ? ["cc", "gcc", "x86_64-linux-gnu-gcc", "as", "ld"] : []];
			for(const tool of commands) await symlink(`/usr/bin/${tool}`, join(tools, tool));
			const env = { ...copiedCleanEnvironment, PATH: tools
				, ...mode === "build-xs" ? { CC: "/usr/bin/cc", LD: "/usr/bin/cc" } : {} };
			for(const pkg of built.packages)
			{
				const archive = join(handoff, "archives", pkg.archive); assert.equal(sha256(await readFile(archive)), pkg.sha256);
				await installCpanArchive({ archive, workingRoot: consumer, prefix, perl, mode, environment: env });
			}
			const relocated = join(consumer, "relocated"); await rename(prefix, relocated);
			const lib = join(relocated, "lib/perl5"), files = await inventory(lib);
			const installerRecords = {};
			for(const path of Object.keys(files).filter(installerRecord))
				installerRecords[path] = sha256(normalizedPerlInstallerRecord(path, await readFile(join(lib, path), "utf8"), prefix));
			assert.equal(Object.keys(installerRecords).length, 3);
			const receipts = Object.keys(files).filter(path => path.endsWith("install-receipt.json"));
			assert.equal(receipts.length, 2);
			for(const path of receipts) assert.equal(JSON.parse(await readFile(join(lib, path))).operation, mode === "build-xs" ? "generated-xs-only" : "prebuilt-xs");
			const api = Object.keys(files).filter(path => path.endsWith("/LeanBridge/Recursive.pm")); assert.equal(api.length, 1);
			const xs = Object.keys(files).filter(path => path.endsWith("/auto/LeanBridge/Recursive/Recursive.so")); assert.equal(xs.length, 1);
			const symbols = (await runCopied("/usr/bin/nm", ["-D", "--defined-only", join(lib, xs[0])], consumer)).stdout;
			assert.match(symbols, /boot_LeanBridge__Recursive/); assert.doesNotMatch(symbols, /\b(?:recursive_\w+_graph|lpg_\w+|ng_\w+)\b/);
			await saveLakeFile(consumer, "fixture.pl", fixture); await saveLakeFile(consumer, "check.pl", consumerSource);
			const runEnv = { ...copiedCleanEnvironment, PERL5LIB: lib };
			await runCopied(perl, ["-MPod::Checker", "-e", 'exit Pod::Checker::podchecker($ARGV[0], "/dev/null")', join(lib, api[0])], consumer, runEnv);
			const faults = await preparePerlGraphPackageFaults({ consumer, perl, prepared, lib, environment });
			pending.push({ consumer, mode, perl, lib, files, runEnv, faults, installerRecords });
		}
		await rm(handoff, { recursive: true, force: true });
		for(const { consumer, mode, perl, lib, files, runEnv, faults, installerRecords } of pending)
		{
			const run = await runCopied(perl, ["check.pl"], consumer, runEnv); assert.equal(run.stderr, "");
			const report = JSON.parse(run.stdout); assert.ok(report.checks > 150);
			const repeat = await runCopied(perl, ["check.pl"], consumer, runEnv); assert.equal(repeat.stderr, ""); assert.deepEqual(JSON.parse(repeat.stdout), report);
			const faultReport = await faults();
			await verifyNativeFiles(lib, files); assert.deepEqual(await nativeArtifactPaths(lib), Object.keys(files));
			const installed = { mode
				, ...report
				, faults: faultReport
				, perlSha256: sha256(await readFile(perl))
				, installedFiles: files
				, installerRecords
				, sourceFree: true
				, handoffRemoved: true
				, compilerFreeExecution: true
				, relocated: true
				, repeated: true
				, privateGraphSymbols: true };
			installs.push(installed);
			await rm(consumer, { recursive: true, force: true });
		}
		observations.push({ iteration, reviewed, nativeSha256: binary, packages: built.packages, packageSet: packages, sourceUnchanged: true, verification, installs });
		diagnostic(`${reviewed ? "reviewed" : "ordinary"}: ${installs.length} source-free installations passed`);
	}
	assert.equal(observations[0].nativeSha256, observations[1].nativeSha256);
	assert.deepEqual(observations[0].packages[0], observations[1].packages[0]);
	for(const index of [0, 1])
	{
		assert.equal(observations[index].nativeSha256, observations[index + 2].nativeSha256);
		assert.deepEqual(observations[index].packages, observations[index + 2].packages);
		assert.deepEqual(observations[index].installs.map(comparableInstall), observations[index + 2].installs.map(comparableInstall));
	}
	return { schemaVersion: 1, independentBuilds: 2, observations, fixtureSha256: sha256(fixture), consumerSha256: sha256(consumerSource) };
};
