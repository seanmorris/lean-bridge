/**
 * Source-free CPAN acceptance for directional callback Subtypes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";
import { reviewedContractDifference } from "../src/analyze/reviewed-source.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { installCpanArchive } from "../src/release/cpan-install.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { callbackSubtypeConfiguration, callbackSubtypeFixture, callbackSubtypeReviewedIr } from "./helpers/callback-subtype-fixture.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { perlGraphCommands } from "./helpers/perl-graph-probes.mjs";

const enabled = process.env.LEAN_BRIDGE_CALLBACK_SUBTYPE_PERL_TEST === "1";
const inventory = async root => Object.fromEntries(await Promise.all(
	(await nativeArtifactPaths(root)).map(async path => {
		const bytes = await readFile(join(root, path));
		return [path, { bytes: bytes.length, sha256: sha256(bytes) }];
	})
));

test("ordinary and reviewed callback Subtypes run on every prepared Perl ABI", {
	skip: !enabled, timeout: 3_600_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-callback-subtype-perl-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(root, { recursive: true, force: true });
		else t.diagnostic(`Retained failed callback Subtype Perl inputs: ${root}`);
	});
	const perls = perlGraphCommands();
	const environment = { ...nativeFixtureEnvironment(["perl"])
		, LEAN_BRIDGE_PERLS: JSON.stringify(perls)
		, LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR:
			process.env.LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR ?? "2.36" };
	const consumerSource = await readFile("tests/fixtures/callback-subtype-consumers/perl.pl", "utf8");
	const reports = [];
	let review;
	for(const route of ["ordinary", "reviewed"])
	{
		const routeRoot = join(root, route), author = join(routeRoot, "author");
		const projectRoot = join(author, "project"), outputRoot = join(author, "release");
		const handoff = join(routeRoot, "handoff");
		await cp(callbackSubtypeFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({
			...callbackSubtypeConfiguration(route)
			, targets: { cpan: { module: "LeanBridge::CallbackSubtypes", version: "1.000" } }
		}));
		if(route === "reviewed") await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(review));
		const before = await lakeInputState(projectRoot);
		t.diagnostic(`${route}: building callback Subtypes for ${perls.length} Perl ABIs`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["cpan"], environment })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		assert.deepEqual(await lakeInputState(projectRoot), before);
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		if(route === "ordinary") review = callbackSubtypeReviewedIr(model.bindingIr);
		else assert.equal(reviewedContractDifference(review, model.bindingIr), null);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		await rm(author, { recursive: true, force: true });
		const pending = [];
		for(const [index, perl] of perls.entries()) for(const mode of ["prebuilt-only", "build-xs"])
		{
			const consumer = join(routeRoot, `consumer-${index}-${mode}`);
			const installed = join(consumer, "installed"), relocated = join(consumer, "relocated");
			const tools = join(consumer, "tools");
			await mkdir(tools, { recursive: true });
			const commands = ["make", "tar", "gzip", "sh", "cp", "mv", "rm"
				, "chmod", "mkdir", "touch", "true"
				, ...mode === "build-xs" ? ["cc", "gcc", "x86_64-linux-gnu-gcc", "as", "ld"] : []];
			for(const command of commands) await symlink(`/usr/bin/${command}`, join(tools, command));
			const installEnvironment = { ...copiedCleanEnvironment, PATH: tools
				, PERL5LIB: join(installed, "lib/perl5")
				, ...mode === "build-xs" ? { CC: "/usr/bin/cc", LD: "/usr/bin/cc" } : {} };
			for(const role of ["runtime", "component"])
			{
				const pkg = receipt.packages.find(item => item.role === role);
				assert.ok(pkg); assert.equal(pkg.artifacts.length, 1);
				await installCpanArchive({ archive: join(handoff, pkg.artifacts[0].path)
					, workingRoot: consumer, prefix: installed, perl, mode
					, environment: installEnvironment })
					.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
			}
			await rename(installed, relocated);
			const lib = join(relocated, "lib/perl5"), files = await inventory(lib);
			await saveLakeFile(consumer, "check.pl", consumerSource);
			pending.push({ consumer, perl, mode, lib, files });
		}
		await rm(handoff, { recursive: true, force: true });
		for(const { consumer, perl, mode, lib, files } of pending)
		{
			const runEnvironment = { ...copiedCleanEnvironment, PERL5LIB: lib };
			const execute = async () => {
				const result = await runCopied(perl, ["check.pl"], consumer, runEnvironment);
				assert.equal(result.stderr, ""); return JSON.parse(result.stdout);
			};
			const first = await execute();
			assert.deepEqual(await execute(), first);
			assert.ok(first.checks >= 30); assert.equal(first.rejected, 6);
			await verifyNativeFiles(lib, files);
			reports.push({ route, mode
				, ...first
				, hostVersion: (await runCopied(perl, ["-e", "print $^V"], consumer, runEnvironment)).stdout
				, perlSha256: sha256(await readFile(perl)), installedFiles: files
				, packages: receipt.packages, bindingIrSha256: built.bindingIrSha256
				, sourceRemovedBeforeInstallation: true, handoffRemovedBeforeExecution: true
				, relocated: true, repeated: true });
			await rm(consumer, { recursive: true, force: true });
		}
	}
	assert.equal(reports.length, 2 * perls.length * 2);
	const output = resolve(process.env.LEAN_BRIDGE_CALLBACK_SUBTYPE_PERL_OUTPUT
		?? "build/callback-subtypes/perl.json");
	await saveLakeFile(dirname(output), basename(output), canonicalJson({ schemaVersion: 1, reports }));
	complete = true;
});
