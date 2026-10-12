/**
 * Reproduce nominal CPAN packages and consume both delivery modes on four ABIs.
 * Full and constructor-free result-only packages have separate installed gates.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { nominalSubtypeFixture, nominalSubtypeModule, nominalSubtypeInstalledReview } from "./nominal-subtype-installed-fixture.mjs";
import { nominalSubtypePerlCaller, nominalSubtypePerlConfiguration, nominalSubtypePerlSelection } from "./nominal-subtype-perl-fixture.mjs";
import { checkedRecordPerlConfigurations, checkedRecordPerlExecutables, checkedRecordPerlModes, probeCheckedRecordPerl } from "./checked-record-perl-install.mjs";
import { installNominalSubtypePerl } from "./nominal-subtype-perl-install.mjs";

const { enabled, routes, modes } = nominalSubtypePerlSelection(process.env);

for(const route of routes) for(const mode of modes) test(`installed nominal Perl packages reproduce and relocate ${route} ${mode}`, {
	skip: !enabled, timeout: 3_600_000
}, async t => {
	const expected = nominalSubtypeInstalledReview(mode === "result-only"), configuration = nominalSubtypePerlConfiguration(route, mode);
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	const executables = checkedRecordPerlExecutables(process.env.LEAN_BRIDGE_NOMINAL_SUBTYPE_PERLS);
	const output = resolve(process.env.LEAN_BRIDGE_NOMINAL_SUBTYPE_PERL_OUTPUT ?? "build/nominal-subtype-perl", route, mode);
	await assert.rejects(access(output), { code: "ENOENT" }); await mkdir(output, { recursive: true });
	const interpreters = [];
	for(const name of checkedRecordPerlConfigurations)
		interpreters.push(await probeCheckedRecordPerl(name, executables[name], output));
	const environment = { ...nativeFixtureEnvironment(["perl"])
		, LEAN_BRIDGE_PERLS: JSON.stringify(checkedRecordPerlConfigurations.map(name => executables[name])) };
	const floor = environment.LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR;
	assert.match(floor ?? "", /^2\.[0-9]+$/u, "Select and report the CPAN glibc floor explicitly");
	assert.equal(process.platform, "linux");
	const runtime = { platform: process.platform, arch: process.arch
		, glibc: await runCopied("/usr/bin/getconf", ["GNU_LIBC_VERSION"], output) };
	assert.equal(runtime.glibc.stderr, ""); assert.match(runtime.glibc.stdout, /^glibc 2\.[0-9]+\n$/u);
	assert.ok(Number(runtime.glibc.stdout.match(/2\.([0-9]+)/u)[1]) >= Number(floor.split(".")[1]));
	await saveLakeFile(output, "runtime.json", canonicalJson(runtime));
	await saveLakeFile(output, "expected.binding-ir.json", canonicalJson(expected));
	await saveLakeFile(output, "configuration.json", canonicalJson(configuration));
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-subtype-perl-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(root, { recursive: true });
		else t.diagnostic(`Retained failed nominal Perl inputs: ${root}`);
	});
	const consumer = join(root, "consumer"), handoff = join(consumer, "handoff"), builds = [];
	for(const attempt of [0, 1])
	{
		const author = join(root, `author-${attempt}`), projectRoot = join(author, "project"), outputRoot = join(author, "release");
		const record = join(output, `build-${attempt}`);
		await cp(nominalSubtypeFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
		if(route === "reviewed") await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(expected));
		const sourceBefore = await lakeInputState(projectRoot);
		t.diagnostic(`${route} ${mode} author ${attempt}: four Perl ABIs`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["cpan"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		assert.deepEqual(await lakeInputState(projectRoot), sourceBefore, "Author inputs remain unchanged");
		const modelBytes = await readFile(join(outputRoot, "native/component/model.json")), model = JSON.parse(modelBytes);
		assert.equal(model.moduleName, configuration.targets.cpan.module);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		if(route === "reviewed") assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(expected));
		else assert.equal(model.sourceIdentity.reviewedBindingIr, undefined);
		const receiptBytes = await readFile(join(outputRoot, "package-set-receipt.json")), receipt = JSON.parse(receiptBytes);
		await verifyPackageSetReceipt({ receiptPath: join(outputRoot, "package-set-receipt.json") });
		assert.deepEqual(receipt.packages.map(pkg => [pkg.target, pkg.role]).sort(), [["cpan", "component"], ["cpan", "runtime"]]);
		await saveLakeFile(record, "model.json", modelBytes);
		await saveLakeFile(record, "package-set-receipt.json", receiptBytes);
		await saveLakeFile(record, "author-inputs.json", canonicalJson(sourceBefore));
		for(const name of [`${nominalSubtypeModule}.lean`, "lean-bridge.exports.json"])
			await saveLakeFile(record, name, await readFile(join(projectRoot, name)));
		if(route === "reviewed") await saveLakeFile(record, "api.binding-ir.json", canonicalJson(expected));
		if(attempt === 0)
		{
			await copyPackageSetHandoff(outputRoot, handoff);
			await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		}
		builds.push({ bindingIrSha256: built.bindingIrSha256
			, modelSha256: sha256(modelBytes), receiptSha256: sha256(receiptBytes)
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))) });
		await rm(author, { recursive: true }); await assert.rejects(access(author), { code: "ENOENT" });
	}
	assert.deepEqual(builds[1], builds[0], "Both author roots reproduce the complete four-ABI archives");
	const receipt = JSON.parse(await readFile(join(handoff, "package-set-receipt.json")));
	const source = await nominalSubtypePerlCaller(route), reports = [];
	await saveLakeFile(output, "consumer.pl", source);
	for(const name of checkedRecordPerlConfigurations) for(const delivery of checkedRecordPerlModes)
	{
		t.diagnostic(`Installing ${name}/${delivery}/${route}/${mode}`);
		const record = join(output, name, delivery);
		const report = await installNominalSubtypePerl({ configuration: name
			, delivery, route, mode, consumer, handoff, output: record
			, command: executables[name], packages: receipt.packages });
		assert.equal(report.consumerSha256, sha256(source)); reports.push(report);
		await saveLakeFile(record, "report.json", canonicalJson(report));
		await rm(join(consumer, `${name}-${delivery}-relocated`), { recursive: true });
	}
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	await saveLakeFile(output, "report.json", canonicalJson({ schemaVersion: 1
		, route, mode, producerCommit
		, configurations: checkedRecordPerlConfigurations
		, deliveryModes: checkedRecordPerlModes
		, interpreters, builds, reports, runtime, declaredGlibcFloor: floor
		, reproducible: true, independentBuilds: 2, authorInputsUnchanged: true
		, sourceRemovedBeforeInstallation: true
		, expectedBindingIrSha256: hashBindingIr(expected) }));
	complete = true;
});
