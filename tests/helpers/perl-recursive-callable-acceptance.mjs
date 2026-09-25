/**
 * Original recursive CPAN archives installed on the selected Perl ABIs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, readFile, readdir, rename, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { installCpanArchive } from "../../src/release/cpan-install.mjs";
import { readVerifiedCpanPackage } from "../../src/release/cpan-package.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { saveLakeFile, lakeInputState } from "./lake-workspace.mjs";
import { nativeFixtureEnvironment, copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { perlGraphCommands } from "./perl-graph-probes.mjs";
import { nativeRecursiveCallableReviewedIr, nativeRecursiveCallableExports, nativeRecursiveCallableArities } from "./native-recursive-callable-fixture.mjs";
import { perlRecursiveAcyclicConsumer } from "./perl-recursive-callable-consumers.mjs";
import { perlRecursiveCallableDocumentation } from "./perl-recursive-callable-docs.mjs";
import { preparePerlRecursiveFaults } from "./perl-recursive-callable-faults.mjs";

/**
 * Build both source paths, remove producers, install and relocate the original archives.
 *
 * @param directory - Test-owned temporary workspace.
 * @param diagnostic - Progress callback for compilation and installation.
 */
export const checkPerlRecursiveCallables = async (directory, diagnostic = () => {}) => {
	const documentation = await perlRecursiveCallableDocumentation();
	const perls = perlGraphCommands();
	const environment = {...nativeFixtureEnvironment(["perl"]), LEAN_BRIDGE_PERLS: JSON.stringify(perls), LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR: "2.36"};
	const source = await readFile("tests/fixtures/structured-callable-consumers/perl-recursive.pl", "utf8");
	const lifetimeSource = await readFile("tests/fixtures/structured-callable-consumers/perl-recursive-lifetimes.pl", "utf8");
	const acyclic = await perlRecursiveAcyclicConsumer();
	const reports = [];
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const root = join(directory, path), author = join(root, "author");
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(root, "handoff");
		await cp("tests/fixtures/onboarding/structured-callables", projectRoot, {recursive: true});
		await saveLakeFile(projectRoot, "Structured.lean", documentation.source);
		const selection = {schemaVersion: 1, modules: ["Structured"], targets: {cpan: {module: "LeanBridge::Recursive", version: "1.000"}}};
		if(path === "ordinary-source")
		{ selection.exports = nativeRecursiveCallableExports; selection.arities = nativeRecursiveCallableArities; }
		else await saveLakeFile(projectRoot, "structured.binding-ir.json", canonicalJson(nativeRecursiveCallableReviewedIr()));
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(selection));
		const before = await lakeInputState(projectRoot);
		diagnostic(`${path}: build CPAN-only recursive callbacks for ${perls.length} ABIs`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot
			, targets: ["cpan"], environment
			, onProgress: event => diagnostic(event.message ?? event.phase) }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		assert.deepEqual(await lakeInputState(projectRoot), before);
		assert.deepEqual(built.targets, ["cpan"]);
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		assert.equal(model.schemaVersion, path === "ordinary-source" ? 4 : 5);
		assert.equal(model.bindingIr.declarations.length, 33); assert.equal(model.copiedGraph.callbacks.length, 18);
		const packageSet = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({receiptPath: join(handoff, "package-set-receipt.json")});
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		assert.equal(packageSet.packages.length, 2);
		assert.ok(packageSet.packages.every(pkg => pkg.ecosystem === "cpan"));
		await rm(author, {recursive: true, force: true});
		const pending = [];
		for(const [index, perl] of perls.entries()) for(const mode of ["prebuilt-only", "build-xs"])
		{
			diagnostic(`${path}: install ${perl}, ${mode}, without author sources`);
			const consumer = join(root, `consumer-${index}-${mode}`), tools = join(consumer, "tools");
			const original = join(consumer, "installed"), relocated = join(consumer, "relocated");
			await mkdir(tools, {recursive: true});
			for(const name of ["make", "tar", "gzip", "sh", "cp", "mv", "rm"
				, "chmod", "mkdir", "touch", "true"
				, ...mode === "build-xs" ? ["cc", "gcc", "x86_64-linux-gnu-gcc", "as", "ld"] : []]) await symlink(`/usr/bin/${name}`, join(tools, name));
			for(const role of ["runtime", "component"])
			{
				const pkg = packageSet.packages.find(pkg => pkg.role === role);
				assert.equal(pkg.artifacts.length, 1);
				const archive = join(handoff, pkg.artifacts[0].path);
				assert.equal(sha256(await readFile(archive)), pkg.artifacts[0].sha256);
				await installCpanArchive({ archive, workingRoot: consumer
					, prefix: original, perl, mode
					, environment: { ...copiedCleanEnvironment, PATH: tools, ...mode === "build-xs" ? { CC: "/usr/bin/cc", LD: "/usr/bin/cc" } : {} } });
			}
			await rename(original, relocated);
			const lib = join(relocated, "lib/perl5"), paths = await nativeArtifactPaths(lib);
			const files = Object.fromEntries(await Promise.all(paths.map(async name => {
				const bytes = await readFile(join(lib, name)); return [name, {bytes: bytes.length, sha256: sha256(bytes)}];
			})));
			const receipts = paths.filter(name => name.endsWith("install-receipt.json")); assert.equal(receipts.length, 2);
			for(const name of receipts) assert.equal(JSON.parse(await readFile(join(lib, name))).operation, mode === "build-xs" ? "generated-xs-only" : "prebuilt-xs");
			const api = paths.filter(name => name.endsWith("/LeanBridge/Recursive.pm")); assert.equal(api.length, 1);
			const binary = paths.filter(name => name.endsWith("/auto/LeanBridge/Recursive/Recursive.so")); assert.equal(binary.length, 1);
			const symbols = await runCopied("/usr/bin/nm", ["-D", "--defined-only", join(lib, binary[0])], consumer);
			assert.match(symbols.stdout, /boot_LeanBridge__Recursive/);
			assert.doesNotMatch(symbols.stdout, /\b(?:structured_\w+_(?:graph|lease_call|lease_dispose)|lpc_\w+|lpg_\w+|ng_\w+)\b/);
			await saveLakeFile(consumer, "check.pl", source);
			await saveLakeFile(consumer, "lifetimes.pl", lifetimeSource);
			await saveLakeFile(consumer, "acyclic.pl", acyclic);
			await saveLakeFile(consumer, "documentation.pl", documentation.consumer);
			const env = {...copiedCleanEnvironment, PERL5LIB: lib};
			await runCopied(perl, ["-MPod::Checker", "-e", 'exit Pod::Checker::podchecker($ARGV[0], "/dev/null")', join(lib, api[0])], consumer, env);
			const extraction = join(consumer, "verified-component");
			await mkdir(extraction);
			const component = packageSet.packages.find(pkg => pkg.role === "component");
			await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip"
				, "-xf"
				, join(handoff, component.artifacts[0].path), "-C", extraction], consumer);
			const entries = await readdir(extraction); assert.equal(entries.length, 1);
			const prepared = await readVerifiedCpanPackage(join(extraction, entries[0]));
			assert.equal(await readFile(join(lib, api[0]), "utf8"), prepared.files.get("lib/LeanBridge/Recursive.pm").toString());
			const faults = await preparePerlRecursiveFaults({ consumer, perl, prepared, model, lib, environment });
			await rm(extraction, { recursive: true, force: true });
			await verifyNativeFiles(lib, files);
			pending.push({consumer, perl, mode, lib, files, env, faults});
		}
		await rm(handoff, {recursive: true, force: true});
		for(const {consumer, perl, mode, lib, files, env, faults} of pending)
		{
			const first = await runCopied(perl, ["check.pl"], consumer, env);
			assert.equal(first.stderr, ""); const result = JSON.parse(first.stdout); assert.equal(result.identities, 0); assert.ok(result.checks >= 202);
			const second = await runCopied(perl, ["check.pl"], consumer, env);
			assert.equal(second.stderr, ""); assert.deepEqual(JSON.parse(second.stdout), result);
			const acyclicRun = await runCopied(perl, ["acyclic.pl"], consumer, env);
			assert.equal(acyclicRun.stderr, ""); const acyclicResult = JSON.parse(acyclicRun.stdout);
			assert.ok(acyclicResult.checks > 50000); assert.ok(acyclicResult.rejected > 250);
			const lifetimeRun = await runCopied(perl, ["lifetimes.pl"], consumer, env);
			assert.equal(lifetimeRun.stderr, ""); const lifetimes = JSON.parse(lifetimeRun.stdout);
			assert.equal(lifetimes.capacity, 4096); assert.equal(lifetimes.identities, 0);
			const example = await runCopied(perl, ["documentation.pl"], consumer, env);
			assert.equal(example.stderr, ""); assert.equal(example.stdout, "19\n19\n");
			const probes = await faults();
			const afterProbes = await runCopied(perl, ["check.pl"], consumer, env);
			assert.equal(afterProbes.stderr, ""); assert.deepEqual(JSON.parse(afterProbes.stdout), result);
			await verifyNativeFiles(lib, files); assert.deepEqual(await nativeArtifactPaths(lib), Object.keys(files));
			reports.push({ path, mode, profile: "perl", exports: 33, signatures: 18
				, documentation: { authorSha256: sha256(documentation.author)
					, configurationSha256: sha256(documentation.configuration)
					, consumerSha256: sha256(documentation.consumer)
					, compiled: true
					, executed: true }
				, ...result
				, acyclic: acyclicResult, lifetimes
				, probes, bindingIrSha256: built.bindingIrSha256, receiptSha256
				, modelSha256: sha256(canonicalJson(model))
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, packages: packageSet.packages, sourceSha256: sha256(source)
				, acyclicSourceSha256: sha256(acyclic)
				, lifetimeSourceSha256: sha256(lifetimeSource), installedFiles: files
				, perlSha256: sha256(await readFile(perl)), producerRemoved: true
				, handoffRemoved: true, relocated: true, compilerFreeExecution: true
				, repeated: true, installedFilesUnchanged: true });
			diagnostic(`${path}/${mode}/${result.perl}: ${result.checks} recursive checks, ${acyclicResult.checks} acyclic checks, ${probes.faults.failures} injected failures`);
			await rm(consumer, {recursive: true, force: true});
		}
	}
	return {schemaVersion: 1, reports};
};
