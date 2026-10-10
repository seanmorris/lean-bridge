/**
 * Real independently reviewed Subtype packages across the remaining native consumers.
 * Reports retain complete reviewed decisions, both build identities and installed observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { readVerifiedPackageSetReceipt, verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { nativeSubtypeEnvironment, nativeSubtypeTargets, readArchivedSubtypeXs } from "./native-subtype-install.mjs";
import { prepareRustCorpusDependencies } from "./type-corpus-rust.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { reviewedSubtypeHostIr, reviewedSubtypeHostProfiles, reviewedSubtypeHostSource } from "./reviewed-subtype-host-fixture.mjs";
import { installReviewedSubtypeHost } from "./reviewed-subtype-host-install.mjs";
import "./reviewed-subtype-host-fixture-tests.mjs";
import "./reviewed-subtype-host-history-tests.mjs";
import "./reviewed-subtype-python-archive-tests.mjs";
import "./reviewed-subtype-ruby-jvm-archive-tests.mjs";

/**
 * Reject empty, duplicate, whitespace-padded or unimplemented explicit host selections.
 *
 * @param value - Optional comma-separated selection; omitted means disabled.
 */
export const selectReviewedSubtypeHosts = value => {
	if(value === undefined) return [];
	assert.equal(typeof value, "string");
	const profiles = value.split(",").sort();
	assert.equal(new Set(profiles).size, profiles.length, "Duplicate reviewed Subtype host");
	assert.ok(profiles.every(profile => reviewedSubtypeHostProfiles.includes(profile)), "Unknown or empty reviewed Subtype host");
	return profiles;
};

const profiles = selectReviewedSubtypeHosts(process.env.LEAN_BRIDGE_REVIEWED_SUBTYPE_HOSTS);

test("reviewed Subtype host selection refuses unknown and duplicate profiles without starting builds", () => {
	assert.deepEqual(selectReviewedSubtypeHosts(undefined), []);
	assert.deepEqual(selectReviewedSubtypeHosts("ruby,python"), ["python", "ruby"]);
	assert.deepEqual(selectReviewedSubtypeHosts(reviewedSubtypeHostProfiles.join(",")), [...reviewedSubtypeHostProfiles].sort());
	for(const value of ["", "python,", "python,python", " python", "python,ruby ", "c", "cpp", "php-wasm", "unknown"])
		assert.throws(() => selectReviewedSubtypeHosts(value));
});

test("installed reviewed native Subtype hosts reproduce and relocate the complete checked corpus", {
	skip: !profiles.length, timeout: 3_600_000
}, async t => {
	const output = resolve(process.env.LEAN_BRIDGE_REVIEWED_SUBTYPE_HOST_OUTPUT ?? `build/reviewed-subtype-hosts/${profiles.join("-")}`);
	await assert.rejects(access(output), { code: "ENOENT" });
	await mkdir(output, { recursive: true });
	const targets = Object.fromEntries(profiles.map(profile => nativeSubtypeTargets[profile]));
	const environment = nativeSubtypeEnvironment(profiles), review = reviewedSubtypeHostIr();
	if(profiles.includes("ruby"))
	{
		environment.LEAN_BRIDGE_RUBY ??= resolve(".toolchains/ruby33/bin/ruby");
		environment.LEAN_BRIDGE_GEM ??= join(dirname(environment.LEAN_BRIDGE_RUBY), "gem");
	}
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-reviewed-subtype-hosts-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(root, { recursive: true, force: true });
		else t.diagnostic(`Retained failed reviewed Subtype host inputs: ${root}`);
	});
	const consumer = join(root, "consumer"), handoff = join(consumer, "handoff"), builds = [];
	let dependencies;
	for(const attempt of [0, 1])
	{
		const author = join(root, `author-${attempt}`), projectRoot = join(author, "project"), outputRoot = join(author, "release");
		const record = join(output, `build-${attempt}`);
		await cp("tests/fixtures/onboarding/native-subtype", projectRoot, { recursive: true });
		const original = await readFile(join(projectRoot, "Subtypes.lean"), "utf8");
		await saveLakeFile(projectRoot, "Subtypes.lean", original + reviewedSubtypeHostSource);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Subtypes"], targets }));
		await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(review));
		t.diagnostic(`reviewed Subtype author ${attempt}: ${profiles.join(", ")}`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: Object.keys(targets), environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		assert.equal(reviewedContractDifference(review, model.bindingIr), null);
		assert.equal(model.exports.length, 12);
		assert.deepEqual(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(review));
		const { receipt } = await readVerifiedPackageSetReceipt({ receiptPath: join(outputRoot, "package-set-receipt.json") });
		for(const [name, value] of [["model.json", model], ["review.json", review], ["package-set-receipt.json", receipt]])
			await saveLakeFile(record, name, canonicalJson(value));
		await saveLakeFile(record, "Subtypes.lean", original + reviewedSubtypeHostSource);
		await saveLakeFile(record, "lean-bridge.exports.json", await readFile(join(projectRoot, "lean-bridge.exports.json")));
		if(attempt === 0)
		{
			await copyPackageSetHandoff(outputRoot, handoff);
			await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
			if(profiles.includes("rust")) dependencies = await prepareRustCorpusDependencies({ rustRoot: join(outputRoot, "native/rust"), directory: author, handoff: join(consumer, "dependencies"), environment });
		}
		builds.push({ bindingIrSha256: built.bindingIrSha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256: sha256(canonicalJson(receipt))
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))) });
		await rm(author, { recursive: true });
		await assert.rejects(access(author), { code: "ENOENT" });
	}
	assert.deepEqual(builds[1], builds[0], "independent author roots must reproduce exact model, review and archive identities");
	const receipt = JSON.parse(await readFile(join(handoff, "package-set-receipt.json"))), reports = [];
	if(profiles.includes("perl"))
	{
		const artifact = receipt.packages.find(pkg => pkg.target === "cpan" && pkg.role === "component").artifacts[0];
		const xs = await readArchivedSubtypeXs(join(handoff, artifact.path), consumer);
		assert.equal((xs.match(/was rejected by Subtypes\.[A-Za-z]+"/gu) ?? []).length, 11);
		await saveLakeFile(output, "archived-perl-xs.txt", xs);
	}
	for(const profile of profiles)
	{
		t.diagnostic(`installing and relocating reviewed ${profile}`);
		const packages = receipt.packages.filter(pkg => pkg.target === nativeSubtypeTargets[profile][0]);
		const observation = await installReviewedSubtypeHost({ profile, consumer, handoff, packages, environment, dependencies });
		const report = { profile, path: "reviewed-source", ...observation, packages
			, ...builds[0], reviewedBindingIrSha256: hashBindingIr(review)
			, sourceRemovedBeforeInstallation: true
			, dispatch: { observed: false, reason: "No host entry counters in this installed acceptance" } };
		reports.push(report);
		await saveLakeFile(output, `${profile}.json`, canonicalJson(report));
		await rm(join(consumer, profile + "-relocated"), { recursive: true });
	}
	await saveLakeFile(output, "report.json", canonicalJson({ schemaVersion: 1, profiles, reports, builds, reproducible: true }));
	complete = true;
});
