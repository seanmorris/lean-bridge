/**
 * Build every nested checked-record CPAN selection twice, then install every supported ABI and mode.
 *
 * @file
 */
import assert from "node:assert/strict";
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
import { nativeFixtureEnvironment } from "./copied-fixture-install.mjs";
import {
	checkedRecordPerlExecutables, probeCheckedRecordPerl
} from "./checked-record-perl-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { nestedCheckedRecordFixture } from "./nested-checked-record-fixture.mjs";
import {
	nestedCheckedRecordPerlCaller
	, nestedCheckedRecordPerlConfiguration
	, nestedCheckedRecordPerlModes
	, nestedCheckedRecordPerlReview
	, nestedCheckedRecordPerlRoutes
} from "./nested-checked-record-perl-fixture.mjs";
import {
	installNestedCheckedRecordPerl
	, nestedCheckedRecordPerlConfigurations
	, nestedCheckedRecordPerlInstallModes
} from "./nested-checked-record-perl-install.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";

const enabled = process.env.LEAN_BRIDGE_NESTED_CHECKED_RECORD_PERL_TEST === "1";
if(process.env.LEAN_BRIDGE_NESTED_CHECKED_RECORD_PERL_TEST !== undefined)
	assert.ok(["0", "1"].includes(process.env.LEAN_BRIDGE_NESTED_CHECKED_RECORD_PERL_TEST)
		, "Unknown nested checked-record Perl gate value");
const allCases = nestedCheckedRecordPerlRoutes.flatMap(authorRoute =>
	nestedCheckedRecordPerlModes.map(apiMode => `${authorRoute}-${apiMode}`));
const cases = process.env.LEAN_BRIDGE_NESTED_CHECKED_RECORD_PERL_CASES?.split(",") ?? allCases;
assert.ok(cases.length && cases.every(name => allCases.includes(name)));
assert.equal(new Set(cases).size, cases.length);
if(process.env.LEAN_BRIDGE_NESTED_CHECKED_RECORD_PERL_CASES !== undefined)
	assert.ok(enabled, "Explicit Perl cases require the installed gate");

for(const name of cases) test(`installed nested checked-record Perl packages reproduce and relocate for ${name}`, {
	skip: !enabled, timeout: 3_600_000
}, async t => {
	const authorRoute = name.startsWith("ordinary-") ? "ordinary" : "reviewed";
	const apiMode = name.endsWith("-result-only") ? "result-only" : "full";
	const configuration = nestedCheckedRecordPerlConfiguration(authorRoute, apiMode);
	const expected = nestedCheckedRecordPerlReview(apiMode);
	const executables = checkedRecordPerlExecutables(
		process.env.LEAN_BRIDGE_NESTED_CHECKED_RECORD_PERLS
	);
	const output = resolve(
		process.env.LEAN_BRIDGE_NESTED_CHECKED_RECORD_PERL_OUTPUT
			?? "build/nested-checked-record-perl", name
	);
	await assert.rejects(access(output), { code: "ENOENT" });
	await mkdir(output, { recursive: true });
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nested-record-perl-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(root, { recursive: true });
		else t.diagnostic(`Retained failed nested checked-record Perl inputs: ${root}`);
	});
	const interpreters = [];
	for(const configurationName of nestedCheckedRecordPerlConfigurations)
	{
		const command = executables[configurationName];
		interpreters.push(await probeCheckedRecordPerl(
			configurationName, command, output
		));
	}
	const environment = {
		...nativeFixtureEnvironment(["perl"])
		, LEAN_BRIDGE_PERLS: JSON.stringify(
			nestedCheckedRecordPerlConfigurations.map(item => executables[item])
		)
	};
	const consumer = join(root, "consumer"), handoff = join(consumer, "handoff");
	const builds = [];
	for(const attempt of [0, 1])
	{
		const author = join(root, `author-${attempt}`);
		const projectRoot = join(author, "project"), outputRoot = join(author, "release");
		const record = join(output, `build-${attempt}`);
		await cp(nestedCheckedRecordFixture, projectRoot, { recursive: true });
		await saveLakeFile(
			projectRoot, "lean-bridge.exports.json", canonicalJson(configuration)
		);
		if(authorRoute === "reviewed")
			await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(expected));
		t.diagnostic(`${name} author ${attempt}: four Perl ABIs`);
		const built = await buildCanonicalProject({
			projectRoot, outputRoot, targets: ["cpan"], environment
		}).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		assert.equal(model.moduleName, configuration.targets.cpan.module);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		if(authorRoute === "reviewed")
			assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(expected));
		else assert.equal(model.sourceIdentity.reviewedBindingIr, undefined);
		const { receipt } = await readVerifiedPackageSetReceipt({
			receiptPath: join(outputRoot, "package-set-receipt.json")
		});
		for(const [filename, value] of [
			["model.json", model], ["expected.binding-ir.json", expected]
			, ["package-set-receipt.json", receipt]
		]) await saveLakeFile(record, filename, canonicalJson(value));
		for(const filename of ["NestedCheckedRecords.lean", "lean-bridge.exports.json"])
			await saveLakeFile(record, filename, await readFile(join(projectRoot, filename)));
		if(authorRoute === "reviewed")
			await saveLakeFile(record, "api.binding-ir.json", canonicalJson(expected));
		if(attempt === 0)
		{
			await copyPackageSetHandoff(outputRoot, handoff);
			await verifyPackageSetReceipt({
				receiptPath: join(handoff, "package-set-receipt.json")
			});
		}
		builds.push({
			bindingIrSha256: built.bindingIrSha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256: sha256(canonicalJson(receipt))
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg =>
				pkg.artifacts.map(artifact => [artifact.path, artifact.sha256])))
		});
		await rm(author, { recursive: true });
		await assert.rejects(access(author), { code: "ENOENT" });
	}
	assert.deepEqual(builds[1], builds[0]
		, "Independent author roots must reproduce every prepared archive");
	const receipt = JSON.parse(await readFile(join(handoff, "package-set-receipt.json")));
	const source = await nestedCheckedRecordPerlCaller(authorRoute, apiMode);
	await saveLakeFile(output, "consumer.pl", source);
	const reports = [];
	for(const configurationName of nestedCheckedRecordPerlConfigurations)
		for(const installMode of nestedCheckedRecordPerlInstallModes)
		{
			t.diagnostic(`Installing ${name}/${configurationName}/${installMode}`);
			const record = join(output, configurationName, installMode);
			const report = await installNestedCheckedRecordPerl({
				configuration: configurationName, command: executables[configurationName]
				, installMode, authorRoute, apiMode, consumer, handoff
				, packages: receipt.packages, output: record
			});
			assert.equal(report.consumerSha256, sha256(source));
			reports.push(report);
			await saveLakeFile(record, "report.json", canonicalJson(report));
			await rm(join(consumer, `${configurationName}-${installMode}-relocated`)
				, { recursive: true });
		}
	await verifyPackageSetReceipt({
		receiptPath: join(handoff, "package-set-receipt.json")
	});
	const report = {
		schemaVersion: 1, name, authorRoute, apiMode
		, configurations: nestedCheckedRecordPerlConfigurations
		, installModes: nestedCheckedRecordPerlInstallModes
		, glibcMinimumVersion: environment.LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR ?? "2.38"
		, interpreters, builds, reports, reproducible: true
		, sourceRemovedBeforeInstallation: true
		, expectedBindingIrSha256: hashBindingIr(expected)
	};
	await saveLakeFile(output, "report.json", canonicalJson(report));
	complete = true;
});
