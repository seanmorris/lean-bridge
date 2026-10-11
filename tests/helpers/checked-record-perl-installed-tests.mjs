/**
 * Build four-route checked-record CPAN packages, then consume both delivery modes on all four ABIs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { readVerifiedPackageSetReceipt, verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { nativeFixtureEnvironment } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { checkedRecordFixture } from "./checked-record-fixture.mjs";
import { checkedRecordPerlConsumer, checkedRecordPerlRoutes, checkedRecordPerlSelection } from "./checked-record-perl-fixture.mjs";
import { checkedRecordPerlConfigurations, checkedRecordPerlExecutables, checkedRecordPerlModes, installCheckedRecordPerl, probeCheckedRecordPerl } from "./checked-record-perl-install.mjs";
import { assertCheckedRecordPerlRecords } from "./checked-record-perl-records.mjs";

const enabled = process.env.LEAN_BRIDGE_CHECKED_RECORD_PERL_TEST === "1";
if(process.env.LEAN_BRIDGE_CHECKED_RECORD_PERL_TEST !== undefined)
	assert.ok(["0", "1"].includes(process.env.LEAN_BRIDGE_CHECKED_RECORD_PERL_TEST), "Unknown installed Perl gate value");
const routes = process.env.LEAN_BRIDGE_CHECKED_RECORD_PERL_ROUTES?.split(",") ?? checkedRecordPerlRoutes;
assert.ok(routes.length && routes.every(route => checkedRecordPerlRoutes.includes(route)));
assert.equal(new Set(routes).size, routes.length);
if(process.env.LEAN_BRIDGE_CHECKED_RECORD_PERL_ROUTES !== undefined) assert.ok(enabled, "Explicit Perl routes require the installed gate");

for(const route of routes) test(`installed checked-record Perl packages reproduce and relocate both delivery modes for ${route}`, {
	skip: !enabled, timeout: 3_600_000
}, async t => {
	const selection = checkedRecordPerlSelection(route);
	const executables = checkedRecordPerlExecutables(process.env.LEAN_BRIDGE_CHECKED_RECORD_PERLS);
	const output = resolve(process.env.LEAN_BRIDGE_CHECKED_RECORD_PERL_OUTPUT ?? "build/checked-record-perl", route);
	await assert.rejects(access(output), { code: "ENOENT" });
	await mkdir(output, { recursive: true });
	const interpreters = [];
	for(const configuration of checkedRecordPerlConfigurations)
		interpreters.push(await probeCheckedRecordPerl(configuration, executables[configuration], output));
	const environment = { ...nativeFixtureEnvironment(["perl"])
		, LEAN_BRIDGE_PERLS: JSON.stringify(checkedRecordPerlConfigurations.map(name => executables[name])) };
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-checked-record-perl-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(root, { recursive: true });
		else t.diagnostic(`Retained failed Perl checked-record inputs: ${root}`);
	});
	const consumer = join(root, "consumer"), handoff = join(consumer, "handoff"), builds = [];
	for(const attempt of [0, 1])
	{
		const author = join(root, `author-${attempt}`), projectRoot = join(author, "project"), outputRoot = join(author, "release");
		const record = join(output, `build-${attempt}`);
		await cp(checkedRecordFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(selection.configuration));
		if(selection.reviewed) await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(selection.expected));
		t.diagnostic(`${route} author ${attempt}: four Perl ABIs`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["cpan"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		assert.equal(model.moduleName, selection.configuration.targets.cpan.module);
		assert.equal(reviewedContractDifference(selection.expected, model.bindingIr), null);
		if(selection.reviewed) assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(selection.expected));
		else assert.equal(model.sourceIdentity.reviewedBindingIr, undefined);
		const { receipt } = await readVerifiedPackageSetReceipt({ receiptPath: join(outputRoot, "package-set-receipt.json") });
		for(const [name, value] of [["model.json", model], ["expected.json", selection.expected], ["package-set-receipt.json", receipt]])
			await saveLakeFile(record, name, canonicalJson(value));
		for(const name of ["CheckedRecords.lean", "lean-bridge.exports.json"])
			await saveLakeFile(record, name, await readFile(join(projectRoot, name)));
		if(selection.reviewed) await saveLakeFile(record, "api.binding-ir.json", canonicalJson(selection.expected));
		if(attempt === 0)
		{
			await copyPackageSetHandoff(outputRoot, handoff);
			await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		}
		builds.push({
			bindingIrSha256: built.bindingIrSha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256: sha256(canonicalJson(receipt))
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))) });
		await rm(author, { recursive: true });
		await assert.rejects(access(author), { code: "ENOENT" });
	}
	assert.deepEqual(builds[1], builds[0], "Both author roots must reproduce the complete four-ABI archives");
	const receipt = JSON.parse(await readFile(join(handoff, "package-set-receipt.json")));
	const source = await checkedRecordPerlConsumer(route), reports = [];
	await saveLakeFile(output, "consumer.pl", source);
	for(const configuration of checkedRecordPerlConfigurations) for(const mode of checkedRecordPerlModes)
	{
		t.diagnostic(`Installing ${configuration}/${mode}/${route}`);
		const record = join(output, configuration, mode);
		const report = await installCheckedRecordPerl({
			configuration, mode, route, consumer, handoff, output: record
			, command: executables[configuration], packages: receipt.packages });
		assert.equal(report.consumerSha256, sha256(source));
		reports.push(report);
		await saveLakeFile(record, "report.json", canonicalJson(report));
		await rm(join(consumer, `${configuration}-${mode}-relocated`), { recursive: true });
	}
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const report = {
		schemaVersion: 1, route, configurations: checkedRecordPerlConfigurations
		, glibcMinimumVersion: environment.LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR ?? "2.38"
		, modes: checkedRecordPerlModes, interpreters, builds, reports
		, reproducible: true, sourceRemovedBeforeInstallation: true
		, expectedBindingIrSha256: hashBindingIr(selection.expected)
	};
	await saveLakeFile(output, "report.json", canonicalJson(report));
	await assertCheckedRecordPerlRecords({ route, read: path => readFile(join(output, path)) });
	complete = true;
});
