/**
 * Reproduce inherited checked-record CPAN packages twice and consume every
 * pinned Perl ABI and installation mode after author-source removal.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import {
	inheritedCheckedRecordFixture, inheritedCheckedRecordModule
} from "./inherited-checked-record-fixture.mjs";
import {
	inheritedCheckedRecordPerlCaller
	, inheritedCheckedRecordPerlConfiguration
	, inheritedCheckedRecordPerlReview
	, inheritedCheckedRecordPerlSelection
	, inheritedCheckedRecordPerlTarget
} from "./inherited-checked-record-perl-fixture.mjs";
import {
	installInheritedCheckedRecordPerl
	, inheritedCheckedRecordPerlConfigurations
	, inheritedCheckedRecordPerlExecutables
	, inheritedCheckedRecordPerlInstallModes
} from "./inherited-checked-record-perl-install.mjs";
import { nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import {
	waitNominalSubtypeDotnetResources
} from "./nominal-subtype-dotnet-resources.mjs";

const { enabled, routes, modes, maxLoad }
	= inheritedCheckedRecordPerlSelection(process.env);
const executables = enabled ? inheritedCheckedRecordPerlExecutables(
	process.env.LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PERLS
) : null;

for(const route of routes) for(const apiMode of modes)
	test(`installed inherited checked-record Perl packages reproduce and relocate ${route} ${apiMode}`, {
		skip: !enabled, timeout: 3_600_000
	}, async t => {
		const producerCommit = execFileSync("git", ["rev-parse", "HEAD"]
			, { encoding: "utf8" }).trim();
		for(const path of [
			"tests/helpers/inherited-checked-record-perl-fixture.mjs"
			, "tests/helpers/inherited-checked-record-perl-install.mjs"
			, "tests/helpers/inherited-checked-record-perl-installed-tests.mjs"
			, "tests/fixtures/inherited-checked-record-consumers/perl.pl"
		]) execFileSync("git", ["ls-files", "--error-unmatch", path]);
		execFileSync("git", ["diff", "--quiet", "HEAD", "--"
			, "src", "tests", "scripts"]);
		const expected = inheritedCheckedRecordPerlReview(apiMode);
		const configuration
			= inheritedCheckedRecordPerlConfiguration(route, apiMode);
		const output = resolve(
			process.env.LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PERL_OUTPUT
				?? "build/inherited-checked-record-perl"
			, route, apiMode
		);
		await assert.rejects(access(output), { code: "ENOENT" });
		await mkdir(output, { recursive: true });
		const resourceChecks = [];
		const resources = async () => {
			resourceChecks.push(await waitNominalSubtypeDotnetResources(
				output, {
					maxLoad
					, notify: message => t.diagnostic(
						message.replaceAll("C#", "inherited Perl")
					)
				}
			));
			await saveLakeFile(output, "resources.json"
				, canonicalJson(resourceChecks));
		};
		await resources();
		const interpreterRecords = [];
		for(const configurationName of inheritedCheckedRecordPerlConfigurations)
		{
			const command = executables[configurationName];
			const bytes = await readFile(command);
			const run = await runCopied(command, ["-MConfig", "-MJSON::PP", "-e"
				, "print JSON::PP->new->canonical->encode({map { $_ => $Config{$_} } qw(version archname useithreads usemultiplicity ivsize ptrsize)})"
			], output);
			assert.equal(run.stderr, "");
			interpreterRecords.push({
				configuration: configurationName, command
				, executable: { bytes: bytes.length, sha256: sha256(bytes) }
				, identity: JSON.parse(run.stdout)
			});
		}
		const environment = {
			...nativeFixtureEnvironment(["perl"])
			, LEAN_BRIDGE_PERLS: JSON.stringify(
				inheritedCheckedRecordPerlConfigurations.map(name =>
					executables[name])
			)
		};
		const floor = environment.LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR;
		assert.match(floor ?? "", /^2\.[0-9]+$/u);
		assert.equal(process.platform, "linux");
		assert.equal(process.arch, "x64");
		const runtime = {
			platform: process.platform, arch: process.arch
			, glibc: await runCopied(
				"/usr/bin/getconf", ["GNU_LIBC_VERSION"], output
			)
		};
		assert.equal(runtime.glibc.stderr, "");
		assert.match(runtime.glibc.stdout, /^glibc 2\.[0-9]+\n$/u);
		assert.ok(Number(runtime.glibc.stdout.match(/2\.([0-9]+)/u)[1])
			>= Number(floor.split(".")[1]));
		for(const [path, value] of Object.entries({
			"runtime.json": runtime
			, "interpreters.json": interpreterRecords
			, "expected.binding-ir.json": expected
			, "configuration.json": configuration
		})) await saveLakeFile(output, path, canonicalJson(value));
		const caller = await inheritedCheckedRecordPerlCaller();
		await saveLakeFile(output, "consumer.pl", caller);
		const root = await mkdtemp(join(
			tmpdir(), "lean-bridge-inherited-checked-record-perl-"
		));
		let complete = false;
		t.after(async () => {
			if(complete) await rm(root, { recursive: true });
			else t.diagnostic(
				`Retained failed inherited checked-record Perl inputs: ${root}`
			);
		});
		const handoff = join(root, "handoff");
		const builds = [];
		for(const attempt of [0, 1])
		{
			await resources();
			const author = join(root, `author-${attempt}`);
			const projectRoot = join(author, "project");
			const outputRoot = join(author, "release");
			const record = join(output, `build-${attempt}`);
			await cp(inheritedCheckedRecordFixture, projectRoot
				, { recursive: true });
			await saveLakeFile(projectRoot, "lean-bridge.exports.json"
				, canonicalJson(configuration));
			if(route === "reviewed")
				await saveLakeFile(projectRoot, "api.binding-ir.json"
					, canonicalJson(expected));
			const sourceBefore = await lakeInputState(projectRoot);
			t.diagnostic(
				`${route} ${apiMode} author ${attempt}: four Perl ABIs`
			);
			const built = await buildCanonicalProject({
				projectRoot, outputRoot, targets: ["cpan"], environment
			}).catch(error => {
				error.message += `: ${JSON.stringify(error.details)}`;
				throw error;
			});
			assert.deepEqual(await lakeInputState(projectRoot), sourceBefore);
			const modelBytes = await readFile(join(
				outputRoot, "native/component/model.json"
			));
			const model = JSON.parse(modelBytes);
			assert.equal(model.moduleName
				, inheritedCheckedRecordPerlTarget.module);
			assert.equal(reviewedContractDifference(expected, model.bindingIr)
				, null);
			if(route === "reviewed")
				assert.equal(model.sourceIdentity.reviewedBindingIr.source
					, canonicalJson(expected));
			else assert.equal(model.sourceIdentity.reviewedBindingIr, undefined);
			const receiptBytes = await readFile(join(
				outputRoot, "package-set-receipt.json"
			));
			const receipt = JSON.parse(receiptBytes);
			await verifyPackageSetReceipt({
				receiptPath: join(outputRoot, "package-set-receipt.json")
			});
			const packageCoordinates = receipt.packages.map(pkg =>
				[pkg.target, pkg.role]).sort((left, right) =>
				left[1].localeCompare(right[1]));
			const expectedCoordinates = [
				["cpan", "component"], ["cpan", "runtime"]
			];
			assert.deepEqual(packageCoordinates, expectedCoordinates);
			await saveLakeFile(record, "model.json", modelBytes);
			await saveLakeFile(record, "package-set-receipt.json", receiptBytes);
			await saveLakeFile(record, "author-inputs.json"
				, canonicalJson(sourceBefore));
			for(const name of [
				`${inheritedCheckedRecordModule}.lean`
				, "lean-bridge.exports.json"
			]) await saveLakeFile(record, name
				, await readFile(join(projectRoot, name)));
			if(route === "reviewed")
				await saveLakeFile(record, "api.binding-ir.json"
					, canonicalJson(expected));
			if(attempt === 0)
				await copyPackageSetHandoff(outputRoot, handoff);
			const archives = {};
			for(const pkg of receipt.packages)
				for(const artifact of pkg.artifacts)
					archives[artifact.path] = artifact.sha256;
			builds.push({
				bindingIrSha256: built.bindingIrSha256
				, modelSha256: sha256(modelBytes)
				, receiptSha256: sha256(receiptBytes)
				, archives
			});
			await rm(author, { recursive: true });
			await assert.rejects(access(author), { code: "ENOENT" });
		}
		assert.deepEqual(builds[1], builds[0]
			, "Independent author roots reproduce every prepared archive");
		await verifyPackageSetReceipt({
			receiptPath: join(handoff, "package-set-receipt.json")
		});
		await copyPackageSetHandoff(handoff, join(output, "handoff"));
		const receipt = JSON.parse(await readFile(join(
			handoff, "package-set-receipt.json"
		)));
		const consumer = join(root, "consumer");
		const reports = [];
		for(const configurationName of inheritedCheckedRecordPerlConfigurations)
			for(const installMode of inheritedCheckedRecordPerlInstallModes)
			{
				await resources();
				t.diagnostic(
					`Installing ${route}/${apiMode}/${configurationName}/${installMode}`
				);
				const record = join(
					output, configurationName, installMode
				);
				const report = await installInheritedCheckedRecordPerl({
					configuration: configurationName
					, command: executables[configurationName]
					, installMode, route, apiMode, consumer, handoff
					, packages: receipt.packages, output: record
				});
				reports.push(report);
				await saveLakeFile(record, "report.json"
					, canonicalJson(report));
				await rm(join(consumer
					, `${configurationName}-${installMode}-relocated`)
					, { recursive: true });
			}
		await verifyPackageSetReceipt({
			receiptPath: join(handoff, "package-set-receipt.json")
		});
		await saveLakeFile(output, "report.json", canonicalJson({
			schemaVersion: 1, route, mode: apiMode, producerCommit
			, configurations: inheritedCheckedRecordPerlConfigurations
			, installModes: inheritedCheckedRecordPerlInstallModes
			, glibcMinimumVersion: floor
			, interpreters: interpreterRecords, builds, reports, runtime
			, reproducible: true, independentBuilds: 2
			, authorInputsUnchanged: true
			, sourceRemovedBeforeInstallation: true
			, expectedBindingIrSha256: hashBindingIr(expected)
			, resourceChecks, loadCeiling: maxLoad
		}));
		complete = true;
	});
