/**
 * Real ordinary/reviewed Ruby gems with two-root reproduction and relocated execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { structuralSubtypeFixture, structuralSubtypeReview } from "./structural-subtype-installed-fixture.mjs";
import { structuralSubtypeRubyConfiguration, structuralSubtypeRubyCaller, structuralSubtypeRubyCounts, parseStructuralSubtypeRubyResult } from "./structural-subtype-ruby-fixture.mjs";
import { installCopiedConsumer, nativeFixtureEnvironment } from "./copied-fixture-install.mjs";
import { installFinContainerEdgeRuby, runFinContainerEdgeRuby, verifyFinContainerEdgeRubyEnvironment } from "./fin-container-edge-ruby-closure.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const enabled = process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_RUBY_TEST === "1";
const routes = process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_RUBY_ROUTES?.split(",") ?? ["ordinary", "reviewed"];
assert.ok(routes.length && routes.every(route => ["ordinary", "reviewed"].includes(route)));
assert.equal(new Set(routes).size, routes.length);

for(const route of routes) test(`installed structural Subtypes Ruby ${route} reproduce and relocate`, { skip: !enabled, timeout: 2_400_000 }, async t => {
	const output = resolve(process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_RUBY_OUTPUT ?? "build/structural-subtype-ruby", route);
	await assert.rejects(access(output), { code: "ENOENT" }); await mkdir(output, { recursive: true });
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-structural-ruby-installed-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(directory, { recursive: true });
		else t.diagnostic(`Retained structural Ruby inputs: ${directory}`);
	});
	const expected = structuralSubtypeReview(), configuration = structuralSubtypeRubyConfiguration(route);
	const environment = nativeFixtureEnvironment(["ruby"]), handoff = join(directory, "handoff"), consumer = join(directory, "consumer");
	environment.LEAN_BRIDGE_RUBY ??= resolve(".toolchains/ruby33/bin/ruby");
	environment.LEAN_BRIDGE_GEM ??= join(dirname(environment.LEAN_BRIDGE_RUBY), "gem");
	assert.ok(environment.LEAN_BRIDGE_RUBY.startsWith("/"), "Select an absolute Ruby toolchain");
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	await saveLakeFile(output, "expected.binding-ir.json", canonicalJson(expected));
	await saveLakeFile(output, "configuration.json", canonicalJson(configuration));
	const builds = [];
	for(const attempt of [0, 1])
	{
		const author = join(directory, `author-${attempt}`), projectRoot = join(author, "project"), outputRoot = join(author, "release");
		await cp(structuralSubtypeFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
		if(route === "reviewed") await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(expected));
		t.diagnostic(`Ruby ${route}: author ${attempt}`);
		await buildCanonicalProject({ projectRoot, outputRoot, environment, targets: ["rubygems"] })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const modelBytes = await readFile(join(outputRoot, "native/component/model.json")), model = JSON.parse(modelBytes);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		if(route === "reviewed") assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(expected));
		else assert.ok(!model.sourceIdentity.reviewedBindingIr);
		const receiptBytes = await readFile(join(outputRoot, "package-set-receipt.json")), receipt = JSON.parse(receiptBytes);
		await verifyPackageSetReceipt({ receiptPath: join(outputRoot, "package-set-receipt.json") });
		await saveLakeFile(output, `build-${attempt}/model.json`, modelBytes);
		await saveLakeFile(output, `build-${attempt}/package-set-receipt.json`, receiptBytes);
		await saveLakeFile(output, `build-${attempt}/StructuralSubtypes.lean`, await readFile(join(projectRoot, "StructuralSubtypes.lean")));
		builds.push({ modelSha256: sha256(modelBytes)
			, receiptSha256: sha256(receiptBytes)
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(item => [item.path, item.sha256]))) });
		if(attempt === 0) await copyPackageSetHandoff(outputRoot, handoff);
		await rm(author, { recursive: true }); await assert.rejects(access(author), { code: "ENOENT" });
	}
	assert.deepEqual(builds[1], builds[0]);
	const receipt = JSON.parse(await readFile(join(handoff, "package-set-receipt.json")));
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const packages = receipt.packages.filter(pkg => pkg.target === "rubygems"), source = await structuralSubtypeRubyCaller(route);
	await saveLakeFile(output, "consumer.rb", source);
	const installed = await installCopiedConsumer({
		profile: "ruby", consumer, handoff, packages, environment
		, fixture: {
			source: () => source, expectedChecks: structuralSubtypeRubyCounts.checks
			, parseResult: parseStructuralSubtypeRubyResult
			, installRuby: installFinContainerEdgeRuby
		}
	});
	delete installed.command;
	const version = await runFinContainerEdgeRuby(installed.rubyEnvironment, ["-e", "print RUBY_VERSION"], join(consumer, "ruby"));
	assert.equal(version.stderr, ""); assert.match(version.stdout, /^3\.[3-9]\.[0-9]+$/u);
	const root = join(consumer, "ruby"), observations = [];
	for(const [position, location] of [root, root + "-relocated"].entries())
	{
		if(position)
		{ await rename(root, location); await assert.rejects(access(root), { code: "ENOENT" }); }
		const context = { ...installed.rubyEnvironment, gems: join(location, "gems") };
		const before = await verifyFinContainerEdgeRubyEnvironment(context);
		const run = await runFinContainerEdgeRuby(context, ["consumer.rb"], location);
		assert.equal(run.stderr, ""); const counts = parseStructuralSubtypeRubyResult(run.stdout);
		assert.deepEqual(await verifyFinContainerEdgeRubyEnvironment(context), before);
		assert.equal(await readFile(join(location, "consumer.rb"), "utf8"), source);
		observations.push({ relocated: Boolean(position), run, counts, closure: before });
		await saveLakeFile(output, `${position ? "relocated" : "installed"}.json`, canonicalJson(observations.at(-1)));
	}
	await saveLakeFile(output, "report.json", canonicalJson({
		schemaVersion: 1, route, ruby: version.stdout, producerCommit
		, configuration, expectedBindingIrSha256: hashBindingIr(expected)
		, builds, receipt, installed, observations
		, reproducible: true, independentBuilds: 2
		, sourceRemovedBeforeInstallation: true
		, offlineInstall: true, compilerFreeReplay: true, relocatedInstallation: true
		, declaredGlibcFloor: environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38"
		, dispatch: { observed: false, reason: "No Ruby entry counters in this installed acceptance" } }));
	complete = true;
});
