/**
 * Reproduce dependent checked-record CPAN packages twice, then consume
 * every pinned Perl ABI and delivery mode after author-source removal.
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
import {
	readVerifiedPackageSetReceipt, verifyPackageSetReceipt
} from "../../src/release/package-set-receipt.mjs";
import {
	dependentCheckedRecordPerlCaller, dependentCheckedRecordPerlConfigurations
	, dependentCheckedRecordPerlFixtureRoot, dependentCheckedRecordPerlInstallModes
	, dependentCheckedRecordPerlLeanModule, dependentCheckedRecordPerlModule
	, dependentCheckedRecordPerlRoutes, dependentCheckedRecordPerlSelection
} from "./dependent-checked-record-perl-fixture.mjs";
import {
	installDependentCheckedRecordPerl, dependentCheckedRecordPerlExecutables
} from "./dependent-checked-record-perl-install.mjs";
import {
	assertDependentCheckedRecordPerlRecords
} from "./dependent-checked-record-perl-records.mjs";
import { nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";

const flag = "LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PERL_TEST";
if(process.env[flag] !== undefined)
	assert.ok(["0", "1"].includes(process.env[flag]), `Invalid ${flag}`);
const enabled = process.env[flag] === "1";
const routeVariable = "LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PERL_ROUTES";
const routes = process.env[routeVariable]?.split(",")
	?? dependentCheckedRecordPerlRoutes;
assert.ok(routes.length && new Set(routes).size === routes.length
	&& routes.every(route => dependentCheckedRecordPerlRoutes.includes(route)));
if(process.env[routeVariable] !== undefined)
	assert.ok(enabled, "Explicit Perl routes require the installed gate");

for(const route of routes) test(
	`installed dependent checked-record Perl packages reproduce and relocate for ${route}`
	, { skip: !enabled, timeout: 3_600_000 }, async t => {
		const producerCommit = execFileSync("git", ["rev-parse", "HEAD"]
			, { encoding: "utf8" }).trim();
		assert.doesNotThrow(() => execFileSync("git", [
			"diff", "--quiet", "HEAD", "--", "src", "tests", "scripts"
		], { stdio: "ignore" }), "Installed evidence requires clean tracked source");
		const output = resolve(process.env.LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PERL_OUTPUT
			?? "build/dependent-checked-record-perl", route);
		await assert.rejects(access(output), { code: "ENOENT" });
		await mkdir(output, { recursive: true });
		const executables = dependentCheckedRecordPerlExecutables(
			process.env.LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_PERLS);
		const environment = {
			...nativeFixtureEnvironment(["perl"])
			, LEAN_BRIDGE_PERLS: JSON.stringify(
				dependentCheckedRecordPerlConfigurations.map(name => executables[name]))
			, LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR:
				process.env.LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR ?? "2.38"
		};
		const floor = environment.LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR;
		assert.match(floor, /^2\.[0-9]+$/u);
		const glibc = await runCopied("/usr/bin/getconf", ["GNU_LIBC_VERSION"], output);
		assert.equal(glibc.stderr, ""); assert.match(glibc.stdout, /^glibc 2\.[0-9]+\n$/u);
		assert.ok(Number(glibc.stdout.match(/2\.([0-9]+)/u)[1])
			>= Number(floor.split(".")[1]));
		const runtime = {
			platform: process.platform
			, arch: process.arch
			, glibc: glibc.stdout.trim().slice(6)
		};
		assert.deepEqual([runtime.platform, runtime.arch], ["linux", "x64"]);
		const selection = dependentCheckedRecordPerlSelection(route);
		await saveLakeFile(output, "runtime.json", canonicalJson(runtime));
		await saveLakeFile(output, "configuration.json", canonicalJson(selection.configuration));
		await saveLakeFile(output, "expected.binding-ir.json", canonicalJson(selection.expected));
		const interpreters = [];
		for(const configuration of dependentCheckedRecordPerlConfigurations)
		{
			const command = executables[configuration];
			const bytes = await readFile(command);
			const run = await runCopied(command, ["-MConfig", "-MJSON::PP", "-e"
				, "print JSON::PP->new->canonical->encode({map { $_ => $Config{$_} } qw(version archname useithreads usemultiplicity ivsize ptrsize)})"
			], output);
			assert.equal(run.stderr, "");
			interpreters.push({
				configuration
				, command
				, executable: { bytes: bytes.length, sha256: sha256(bytes) }
				, identity: JSON.parse(run.stdout)
			});
		}
		await saveLakeFile(output, "interpreters.json", canonicalJson(interpreters));
		const caller = await dependentCheckedRecordPerlCaller();
		await saveLakeFile(output, "consumer.pl", caller);
		const root = await mkdtemp(join(
			tmpdir(), "lean-bridge-dependent-checked-record-perl-"
		));
		let complete = false;
		t.after(async () => {
			if(complete) await rm(root, { recursive: true });
			else t.diagnostic(`Retained failed dependent checked-record Perl inputs: ${root}`);
		});
		const handoff = join(root, "handoff"), builds = [];
		for(const attempt of [0, 1])
		{
			const author = join(root, `author-${attempt}`);
			const projectRoot = join(author, "project");
			const outputRoot = join(author, "release");
			const record = join(output, `build-${attempt}`);
			await cp(dependentCheckedRecordPerlFixtureRoot, projectRoot, { recursive: true });
			await saveLakeFile(projectRoot, "lean-bridge.exports.json"
				, canonicalJson(selection.configuration));
			if(selection.reviewed)
				await saveLakeFile(projectRoot, "api.binding-ir.json"
					, canonicalJson(selection.expected));
			const sourceBefore = await lakeInputState(projectRoot);
			t.diagnostic(`${route} dependent checked-record Perl author ${attempt}: four ABIs`);
			const built = await buildCanonicalProject({
				projectRoot, outputRoot, targets: ["cpan"], environment
			}).catch(error => {
				error.message += `: ${JSON.stringify(error.details)}`; throw error;
			});
			assert.deepEqual(await lakeInputState(projectRoot), sourceBefore);
			const modelBytes = await readFile(join(outputRoot, "native/component/model.json"));
			const model = JSON.parse(modelBytes);
			assert.equal(model.moduleName, dependentCheckedRecordPerlModule);
			assert.equal(reviewedContractDifference(selection.expected, model.bindingIr), null);
			if(selection.reviewed)
				assert.equal(model.sourceIdentity.reviewedBindingIr.source
					, canonicalJson(selection.expected));
			else assert.equal(model.sourceIdentity.reviewedBindingIr, undefined);
			const receiptPath = join(outputRoot, "package-set-receipt.json");
			const { receipt } = await readVerifiedPackageSetReceipt({ receiptPath });
			assert.deepEqual(receipt.packages.map(item => [item.target, item.role]).sort()
				, [["cpan", "component"], ["cpan", "runtime"]]);
			for(const [name, bytes] of [
				["model.json", modelBytes]
				, ["package-set-receipt.json", await readFile(receiptPath)]
				, ["author-inputs.json", canonicalJson(sourceBefore)]
			]) await saveLakeFile(record, name, bytes);
			for(const name of [
				`${dependentCheckedRecordPerlLeanModule}.lean`, "lean-bridge.exports.json"
			]) await saveLakeFile(record, name, await readFile(join(projectRoot, name)));
			if(selection.reviewed)
				await saveLakeFile(record, "api.binding-ir.json", canonicalJson(selection.expected));
			if(attempt === 0) await copyPackageSetHandoff(outputRoot, handoff);
			builds.push({
				bindingIrSha256: built.bindingIrSha256, modelSha256: sha256(modelBytes)
				, receiptSha256: sha256(canonicalJson(receipt))
				, archives: Object.fromEntries(receipt.packages.flatMap(pkg =>
					pkg.artifacts.map(artifact => [artifact.path, artifact.sha256])))
			});
			await rm(author, { recursive: true });
			await assert.rejects(access(author), { code: "ENOENT" });
		}
		assert.deepEqual(builds[1], builds[0]
			, "Independent author roots reproduce every prepared archive");
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		await copyPackageSetHandoff(handoff, join(output, "handoff"));
		const { receipt } = await readVerifiedPackageSetReceipt({
			receiptPath: join(handoff, "package-set-receipt.json")
		});
		const consumer = join(root, "consumer"), reports = [];
		for(const configuration of dependentCheckedRecordPerlConfigurations)
			for(const installMode of dependentCheckedRecordPerlInstallModes)
			{
				t.diagnostic(`Installing ${route}/${configuration}/${installMode}`);
				const record = join(output, configuration, installMode);
				const report = await installDependentCheckedRecordPerl({
					configuration, command: executables[configuration], installMode, route
					, consumer, handoff, packages: receipt.packages, output: record
				});
				reports.push(report);
				await saveLakeFile(record, "report.json", canonicalJson(report));
				await rm(join(consumer, `${configuration}-${installMode}-relocated`)
					, { recursive: true });
			}
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		await saveLakeFile(output, "report.json", canonicalJson({
			schemaVersion: 1, route, producerCommit, runtime, glibcMinimumVersion: floor
			, configurations: dependentCheckedRecordPerlConfigurations
			, installModes: dependentCheckedRecordPerlInstallModes
			, interpreters
			, builds
			, reports
			, reproducible: true, independentBuilds: 2, authorInputsUnchanged: true
			, sourceRemovedBeforeInstallation: true
			, expectedBindingIrSha256: hashBindingIr(selection.expected)
		}));
		await assertDependentCheckedRecordPerlRecords({
			route, producerCommit, interpreters
			, read: path => readFile(join(output, path))
		});
		complete = true;
	}
);
