/**
 * Reproduce dependent checked-record Ruby gems and execute the immutable
 * public caller offline after author sources have been removed.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, realpath, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import {
	dependentCheckedRecordRubyCaller, dependentCheckedRecordRubyCallerArgs
	, dependentCheckedRecordRubyConfiguration, dependentCheckedRecordRubySelection
	, dependentCheckedRecordRubyFixtureRoot
	, dependentCheckedRecordRubyLeanModule
	, parseDependentCheckedRecordRubyResult
} from "./dependent-checked-record-ruby-fixture.mjs";
import { dependentCheckedRecordSelection } from "./dependent-checked-record-browser-fixture.mjs";
import { inspectDependentCheckedRecordRubyPackage } from "./dependent-checked-record-ruby-package.mjs";
import { installFinContainerEdgeRuby, runFinContainerEdgeRuby, verifyFinContainerEdgeRubyEnvironment } from "./fin-container-edge-ruby-closure.mjs";
import { nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { waitNominalSubtypeDotnetResources } from "./nominal-subtype-dotnet-resources.mjs";

const { enabled, routes, maxLoad } = dependentCheckedRecordRubySelection(process.env);

for(const route of routes) test(`installed dependent checked-record Ruby packages reproduce and relocate ${route}`, {
	skip: !enabled, timeout: 3_600_000
}, async t => {
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	for(const path of ["fixture.mjs", "package.mjs", "installed-tests.mjs"])
		execFileSync("git", ["ls-files", "--error-unmatch", `tests/helpers/dependent-checked-record-ruby-${path}`]);
	execFileSync("git", ["ls-files", "--error-unmatch", "tests/fixtures/dependent-checked-record-consumers/ruby.rb"]);
	execFileSync("git", ["diff", "--quiet", "HEAD", "--", "src", "tests", "scripts"]);
	const selection = dependentCheckedRecordSelection(route), mode = selection.resultOnly ? "result-only" : "full";
	const expected = selection.expected, configuration = dependentCheckedRecordRubyConfiguration(route);
	const output = resolve(process.env.LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_RUBY_OUTPUT ?? "build/dependent-checked-record-ruby", route);
	await assert.rejects(access(output), { code: "ENOENT" }); await mkdir(output, { recursive: true });
	const resourceChecks = [];
	const resources = async () => {
		resourceChecks.push(await waitNominalSubtypeDotnetResources(output, {
			maxLoad
			, notify: message => t.diagnostic(message.replaceAll("C#", "dependent checked-record Ruby"))
		}));
		await saveLakeFile(output, "resources.json", canonicalJson(resourceChecks));
	};
	await resources();
	const environment = nativeFixtureEnvironment(["ruby"]);
	assert.ok(typeof environment.LEAN_BRIDGE_RUBY === "string" && isAbsolute(environment.LEAN_BRIDGE_RUBY)
		, "Select an absolute Ruby 3.3 interpreter explicitly");
	const command = await realpath(environment.LEAN_BRIDGE_RUBY), gemCommand = environment.LEAN_BRIDGE_GEM ?? join(dirname(command), "gem");
	assert.ok(isAbsolute(gemCommand), "Select an absolute RubyGems command");
	const commandBytes = await readFile(command);
	const interpreter = { command
		, identity: { bytes: commandBytes.length, sha256: sha256(commandBytes) }
		, run: await runCopied(command, ["--disable-gems", "-rjson", "-e"
			, "print JSON.generate({engine: RUBY_ENGINE, version: RUBY_VERSION, platform: RUBY_PLATFORM})"], output) };
	assert.equal(interpreter.run.stderr, "");
	const ruby = JSON.parse(interpreter.run.stdout);
	assert.equal(ruby.engine, "ruby"); assert.match(ruby.version, /^3\.3\.[0-9]+$/u); assert.equal(ruby.platform, "x86_64-linux");
	const floor = environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR;
	assert.match(floor ?? "", /^2\.[0-9]+$/u, "Select the native glibc floor explicitly");
	assert.equal(process.platform, "linux"); assert.equal(process.arch, "x64");
	const runtime = { platform: process.platform, arch: process.arch
		, glibc: await runCopied("/usr/bin/getconf", ["GNU_LIBC_VERSION"], output) };
	assert.equal(runtime.glibc.stderr, ""); assert.match(runtime.glibc.stdout, /^glibc 2\.[0-9]+\n$/u);
	assert.ok(Number(runtime.glibc.stdout.match(/2\.([0-9]+)/u)[1]) >= Number(floor.split(".")[1]));
	for(const [path, value] of Object.entries({ "runtime.json": runtime
		, "interpreter.json": interpreter
		, "expected.binding-ir.json": expected
		, "configuration.json": configuration }))
		await saveLakeFile(output, path, canonicalJson(value));
	const caller = await dependentCheckedRecordRubyCaller();
	await saveLakeFile(output, "consumer.rb", caller);
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-dependent-checked-record-ruby-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(root, { recursive: true });
		else t.diagnostic(`Retained failed dependent checked-record Ruby inputs: ${root}`);
	});
	const handoff = join(root, "handoff"), builds = []; let model;
	for(const attempt of [0, 1])
	{
		await resources();
		const author = join(root, `author-${attempt}`), projectRoot = join(author, "project"), outputRoot = join(author, "release")
			, record = join(output, `build-${attempt}`);
		await cp(dependentCheckedRecordRubyFixtureRoot, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
		if(selection.reviewed) await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(expected));
		const sourceBefore = await lakeInputState(projectRoot);
		t.diagnostic(`${route} author ${attempt}: reproducible Ruby gem`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["rubygems"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		assert.deepEqual(await lakeInputState(projectRoot), sourceBefore, "Author inputs remain unchanged");
		const modelBytes = await readFile(join(outputRoot, "native/component/model.json")); model = JSON.parse(modelBytes);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		if(selection.reviewed) assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(expected));
		else assert.equal(model.sourceIdentity.reviewedBindingIr, undefined);
		const receiptBytes = await readFile(join(outputRoot, "package-set-receipt.json")), receipt = JSON.parse(receiptBytes);
		await verifyPackageSetReceipt({ receiptPath: join(outputRoot, "package-set-receipt.json") });
		assert.deepEqual(receipt.packages.map(pkg => [pkg.target, pkg.role]), [["rubygems", "component"]]);
		await saveLakeFile(record, "model.json", modelBytes); await saveLakeFile(record, "package-set-receipt.json", receiptBytes);
		await saveLakeFile(record, "author-inputs.json", canonicalJson(sourceBefore));
		for(const name of [`${dependentCheckedRecordRubyLeanModule}.lean`, "lean-bridge.exports.json"])
			await saveLakeFile(record, name, await readFile(join(projectRoot, name)));
		if(selection.reviewed) await saveLakeFile(record, "api.binding-ir.json", canonicalJson(expected));
		if(attempt === 0) await copyPackageSetHandoff(outputRoot, handoff);
		builds.push({ bindingIrSha256: built.bindingIrSha256
			, modelSha256: sha256(modelBytes)
			, receiptSha256: sha256(receiptBytes)
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg =>
				pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))) });
		await rm(author, { recursive: true }); await assert.rejects(access(author), { code: "ENOENT" });
	}
	assert.deepEqual(builds[1], builds[0], "Both author roots reproduce the complete gem");
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	await copyPackageSetHandoff(handoff, join(output, "handoff"));
	const receipt = JSON.parse(await readFile(join(handoff, "package-set-receipt.json"))), pkg = receipt.packages[0];
	const archive = join(handoff, pkg.artifacts[0].path), archiveBytes = await readFile(archive);
	assert.deepEqual({ bytes: archiveBytes.length, sha256: sha256(archiveBytes) }, {
		bytes: pkg.artifacts[0].bytes, sha256: pkg.artifacts[0].sha256 });
	const consumer = join(root, "consumer"); await mkdir(consumer); await saveLakeFile(consumer, "consumer.rb", caller);
	await resources();
	const { context } = await installFinContainerEdgeRuby({ command, gemCommand, root: consumer, archive, archiveSha256: pkg.artifacts[0].sha256 });
	assert.equal(context.command, interpreter.command); assert.deepEqual(context.interpreter, interpreter.identity);
	const gem = await inspectDependentCheckedRecordRubyPackage({ context, pkg, model, floor, output });
	await saveLakeFile(output, "environment.json", canonicalJson(context));
	const observations = [];
	for(const [index, location] of [consumer, consumer + "-relocated"].entries())
	{
		await resources();
		if(index)
		{
			await rename(consumer, location);
			await assert.rejects(access(consumer), { code: "ENOENT" });
		}
		const selected = { ...context, gems: join(location, "gems") }, args = ["consumer.rb", ...dependentCheckedRecordRubyCallerArgs(route)];
		const before = await verifyFinContainerEdgeRubyEnvironment(selected);
		const run = await runFinContainerEdgeRuby(selected, args, location);
		assert.equal(run.stderr, ""); const counts = parseDependentCheckedRecordRubyResult(run.stdout, mode);
		assert.deepEqual(await verifyFinContainerEdgeRubyEnvironment(selected), before);
		assert.equal(await readFile(join(location, "consumer.rb"), "utf8"), caller);
		const observation = { relocated: Boolean(index), command, args, cwd: location, gems: selected.gems, run, counts, closure: before };
		observations.push(observation); await saveLakeFile(output, `${index ? "relocated" : "installed"}.json`, canonicalJson(observation));
	}
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	await saveLakeFile(output, "report.json", canonicalJson({ schemaVersion: 1
		, route, mode, producerCommit, runtime, interpreter, builds, receipt
		, observations
		, declaredGlibcFloor: floor, expectedBindingIrSha256: hashBindingIr(expected)
		, gemReceiptSha256: gem.receiptSha256, resourceChecks, loadCeiling: maxLoad
		, reproducible: true, independentBuilds: 2, authorInputsUnchanged: true
		, sourceRemovedBeforeInstallation: true, offlineInstall: true
		, compilerFreeReplay: true, relocatedInstallation: true }));
	complete = true;
});
