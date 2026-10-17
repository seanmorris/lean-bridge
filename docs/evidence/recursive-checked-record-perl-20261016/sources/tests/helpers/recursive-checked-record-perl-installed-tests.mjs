/**
 * Reproduce each recursive checked-record CPAN package twice and consume every ABI/mode.
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
import { nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { probeCheckedRecordPerl } from "./checked-record-perl-install.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import {
	loadRecursiveCheckedRecordPerlCaller, recursiveCheckedRecordPerlConfiguration
	, recursiveCheckedRecordPerlFixtures, recursiveCheckedRecordPerlPackage
	, recursiveCheckedRecordPerlReview, recursiveCheckedRecordPerlRoutes
} from "./recursive-checked-record-perl-fixture.mjs";
import {
	installRecursiveCheckedRecordPerl, recursiveCheckedRecordPerlConfigurations
	, recursiveCheckedRecordPerlExecutables, recursiveCheckedRecordPerlInstallModes
} from "./recursive-checked-record-perl-install.mjs";
import {
	recursiveCheckedRecordPerlLoadCeiling, recursiveCheckedRecordPerlLoadCeilings
	, waitRecursiveCheckedRecordPerlResources
} from "./recursive-checked-record-perl-resources.mjs";

const prefix = "LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PERL_";
const flag = process.env[prefix + "TEST"];
assert.ok(flag === undefined || ["0", "1"].includes(flag)
	, "Unknown recursive checked-record Perl gate value");
const enabled = flag === "1";
const select = (name, values) => {
	const raw = process.env[prefix + name];
	if(raw !== undefined) assert.ok(enabled, `Explicit Perl ${name} requires the installed gate`);
	const selected = raw === undefined ? values : raw.split(",");
	assert.ok(selected.length && selected.every(value => values.includes(value)));
	assert.equal(new Set(selected).size, selected.length);
	return selected;
};
const routes = select("ROUTES", recursiveCheckedRecordPerlRoutes);
const fixtures = select("FIXTURES", recursiveCheckedRecordPerlFixtures);
for(const name of [prefix + "OUTPUT", prefix + "MAX_LOAD", "LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PERLS"])
	if(process.env[name] !== undefined) assert.ok(enabled, `Explicit ${name} requires TEST=1`);
const maxLoad = process.env[prefix + "MAX_LOAD"] === undefined
	? recursiveCheckedRecordPerlLoadCeiling : Number(process.env[prefix + "MAX_LOAD"]);
assert.ok(recursiveCheckedRecordPerlLoadCeilings.includes(maxLoad));
const executables = enabled
	? recursiveCheckedRecordPerlExecutables(process.env.LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PERLS)
	: null;

for(const route of routes) for(const fixture of fixtures)
	test(`installed recursive checked-record Perl packages reproduce and relocate ${route} ${fixture}`, {
		skip: !enabled, timeout: 3_600_000
	}, async t => {
		const producerCommit = execFileSync("git", ["rev-parse", "HEAD"]
			, { encoding: "utf8" }).trim();
		for(const path of [
			"tests/helpers/recursive-checked-record-perl-fixture.mjs"
			, "tests/helpers/recursive-checked-record-perl-install.mjs"
			, "tests/helpers/recursive-checked-record-perl-installed-tests.mjs"
			, "tests/helpers/recursive-checked-record-perl-resources.mjs"
			, "tests/fixtures/recursive-checked-record-consumers/perl.pl"
		]) execFileSync("git", ["ls-files", "--error-unmatch", path]);
		execFileSync("git", ["diff", "--quiet", "HEAD", "--", "src", "tests", "scripts"]);
		const selected = recursiveCheckedRecordPerlPackage(fixture);
		const expected = recursiveCheckedRecordPerlReview(fixture);
		const configuration = recursiveCheckedRecordPerlConfiguration(route, fixture);
		const output = resolve(process.env[prefix + "OUTPUT"]
			?? "build/recursive-checked-record-perl", route, fixture);
		await assert.rejects(access(output), { code: "ENOENT" });
		await mkdir(output, { recursive: true });
		const resourceChecks = [];
		const resources = async () => {
			const notify = message => t.diagnostic(
				message.replaceAll("C#", "recursive Perl")
			);
			resourceChecks.push(await waitRecursiveCheckedRecordPerlResources(
				output, { maxLoad, notify }
			));
			await saveLakeFile(output, "resources.json", canonicalJson(resourceChecks));
		};
		await resources();
		const interpreters = [];
		for(const name of recursiveCheckedRecordPerlConfigurations)
			interpreters.push(await probeCheckedRecordPerl(name, executables[name], output));
		const environment = {
			...nativeFixtureEnvironment(["perl"])
			, LEAN_BRIDGE_PERLS: JSON.stringify(
				recursiveCheckedRecordPerlConfigurations.map(name => executables[name])
			)
		};
		const floor = environment.LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR;
		assert.match(floor ?? "", /^2\.[0-9]+$/u);
		assert.equal(process.platform, "linux"); assert.equal(process.arch, "x64");
		const runtime = { platform: process.platform, arch: process.arch
			, glibc: await runCopied("/usr/bin/getconf", ["GNU_LIBC_VERSION"], output) };
		assert.equal(runtime.glibc.stderr, "");
		assert.match(runtime.glibc.stdout, /^glibc 2\.[0-9]+\n$/u);
		assert.ok(Number(runtime.glibc.stdout.match(/2\.([0-9]+)/u)[1])
			>= Number(floor.split(".")[1]));
		await saveLakeFile(output, "runtime.json", canonicalJson(runtime));
		await saveLakeFile(output, "expected.binding-ir.json", canonicalJson(expected));
		await saveLakeFile(output, "configuration.json", canonicalJson(configuration));
		await saveLakeFile(output, "consumer.pl"
			, await loadRecursiveCheckedRecordPerlCaller());
		const root = await mkdtemp(join(tmpdir(), "lean-bridge-recursive-record-perl-"));
		let complete = false;
		t.after(async () => {
			if(complete) await rm(root, { recursive: true });
			else t.diagnostic(`Retained failed recursive checked-record Perl inputs: ${root}`);
		});
		const handoff = join(root, "handoff"), builds = [];
		for(const attempt of [0, 1])
		{
			await resources();
			const author = join(root, `author-${attempt}`);
			const projectRoot = join(author, "project"), outputRoot = join(author, "release");
			const record = join(output, `build-${attempt}`);
			await cp(selected.root, projectRoot, { recursive: true });
			await saveLakeFile(projectRoot, "lean-bridge.exports.json"
				, canonicalJson(configuration));
			if(route === "reviewed")
				await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(expected));
			const sourceBefore = await lakeInputState(projectRoot);
			t.diagnostic(`${route} ${fixture} author ${attempt}: four Perl ABIs`);
			const built = await buildCanonicalProject({
				projectRoot, outputRoot, targets: ["cpan"], environment
			}).catch(error => {
				error.message += `: ${JSON.stringify(error.details)}`; throw error;
			});
			assert.deepEqual(await lakeInputState(projectRoot), sourceBefore);
			const modelBytes = await readFile(join(outputRoot, "native/component/model.json"));
			const model = JSON.parse(modelBytes);
			assert.equal(model.moduleName, selected.module);
			assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
			if(route === "reviewed")
				assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(expected));
			else assert.equal(model.sourceIdentity.reviewedBindingIr, undefined);
			const receiptBytes = await readFile(join(outputRoot, "package-set-receipt.json"));
			const receipt = JSON.parse(receiptBytes);
			await verifyPackageSetReceipt({
				receiptPath: join(outputRoot, "package-set-receipt.json")
			});
			await saveLakeFile(record, "model.json", modelBytes);
			await saveLakeFile(record, "package-set-receipt.json", receiptBytes);
			await saveLakeFile(record, "author-inputs.json", canonicalJson(sourceBefore));
			for(const name of [`${selected.leanModule}.lean`, "lean-bridge.exports.json"])
				await saveLakeFile(record, name, await readFile(join(projectRoot, name)));
			if(route === "reviewed")
				await saveLakeFile(record, "api.binding-ir.json", canonicalJson(expected));
			if(attempt === 0) await copyPackageSetHandoff(outputRoot, handoff);
			builds.push({
				bindingIrSha256: built.bindingIrSha256
				, modelSha256: sha256(modelBytes), receiptSha256: sha256(receiptBytes)
				, archives: Object.fromEntries(receipt.packages.flatMap(pkg =>
					pkg.artifacts.map(artifact => [artifact.path, artifact.sha256])))
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
		const receipt = JSON.parse(await readFile(join(handoff, "package-set-receipt.json")));
		const consumer = join(root, "consumer");
		const reports = [];
		for(const configurationName of recursiveCheckedRecordPerlConfigurations)
			for(const installMode of recursiveCheckedRecordPerlInstallModes)
			{
				await resources();
				t.diagnostic(`Installing ${route}/${fixture}/${configurationName}/${installMode}`);
				const record = join(output, configurationName, installMode);
				const report = await installRecursiveCheckedRecordPerl({
					configuration: configurationName, command: executables[configurationName]
					, installMode, route, fixture, consumer, handoff
					, packages: receipt.packages, output: record
				});
				reports.push(report);
				await saveLakeFile(record, "report.json", canonicalJson(report));
				await rm(join(consumer, `${configurationName}-${installMode}-relocated`)
					, { recursive: true });
			}
		await verifyPackageSetReceipt({
			receiptPath: join(handoff, "package-set-receipt.json")
		});
		await saveLakeFile(output, "report.json", canonicalJson({
			schemaVersion: 1, route, fixture, producerCommit
			, configurations: recursiveCheckedRecordPerlConfigurations
			, installModes: recursiveCheckedRecordPerlInstallModes
			, glibcMinimumVersion: floor, interpreters, builds, reports, runtime
			, reproducible: true, independentBuilds: 2
			, authorInputsUnchanged: true, sourceRemovedBeforeInstallation: true
			, expectedBindingIrSha256: hashBindingIr(expected)
			, resourceChecks, loadCeiling: maxLoad
		}));
		complete = true;
	});
