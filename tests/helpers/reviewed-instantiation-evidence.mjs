/**
 * Authenticate installed reviewed generic records, their producers and superseded attempts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import identities from "../fixtures/reviewed-instantiation-evidence-identities.json" with { type: "json" };
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { composedGenericRecordReview, genericRecordInstantiationReview } from "./reviewed-instantiation-fixture.mjs";
import { genericRecordInstantiations, genericRecordNodeConsumer } from "./generic-record-packages.mjs";
import { genericRecordSpecializations, specializedGenericRecordCase, specializedGenericRecordConsumer } from "./generic-record-specializations.mjs";

export const reviewedInstantiationEvidenceDirectory = "docs/evidence/reviewed-instantiations-20261008";
export const reviewedInstantiationEvidenceIdentities = identities;
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const review = (host, composed) => (composed ? composedGenericRecordReview : genericRecordInstantiationReview)(host === "npm" ? { module: "OnboardingSmall", component: "onboarding-small" } : {});

/**
 * Check the measured properties independently of the file's pinned digest.
 *
 * @param report - Original installed report.
 * @param host - Native or npm producer.
 * @param composed - Whether this report includes the nine function specializations.
 */
export const assertReviewedInstantiationReport = async (report, host, composed) => {
	assert.ok(["native", "npm"].includes(host)); assert.equal(typeof composed, "boolean");
	assert.equal(report.schemaVersion, 1); assert.equal(report.reproducible, true);
	const observations = host === "npm" ? [report] : report.reports;
	assert.deepEqual(observations.map(item => item.profile), host === "npm" ? ["npm"] : ["c", "cpp"]);
	for(const item of observations)
	{
		assert.equal(item.path, "reviewed-source");
		assert.deepEqual(item.instantiations, genericRecordInstantiations);
		assert.equal(item.reviewedBindingIrSha256, hashBindingIr(review(host, composed)));
		for(const flag of ["sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath"]) assert.equal(item[flag], true, flag);
		for(const key of ["bindingIrSha256", "reviewedBindingIrSha256", "receiptSha256", "consumerSha256"]) digest(item[key]);
		const module = host === "npm" ? "OnboardingSmall" : "GenericRecords";
		if(composed) assert.deepEqual(item.specializations, genericRecordSpecializations(module));
		else assert.equal(Object.hasOwn(item, "specializations"), false);
		if(host === "npm")
		{
			assert.equal(item.abi, 7); assert.equal(item.independentBuilds, 2);
			assert.equal(item.checks, composed ? 1019 : 1010); assert.equal(item.rejections, composed ? 1010 : 1005);
			assert.equal(item.dispatch, "not measured");
			assert.equal(item.typescript.strict, true); assert.equal(item.typescript.skipLibCheck, false);
			for(const key of ["sourceSha256", "declarationsSha256"]) digest(item.typescript[key]);
			assert.equal(item.consumerSha256, sha256(composed ? await specializedGenericRecordCase.nodeConsumer() : genericRecordNodeConsumer()));
			assert.equal(item.receiptSha256, sha256(canonicalJson(item.receipt)));
			assert.equal(item.receipt.bindingIrSha256, item.bindingIrSha256);
			assert.equal(item.receipt.package.sha256, item.archiveSha256);
			assert.equal(item.receipt.runtime.sha256, item.runtimeArchiveSha256);
			assert.equal(item.receipt.package.package, "onboarding-small@1.0.0");
			assert.deepEqual(item.receipt.policies, { componentCompiledOnce: true, nativeCallablesOnly: true, runtimeBinaryInComponent: false, runtimeShared: true });
			for(const key of ["archiveSha256", "runtimeArchiveSha256", "bindingIrFileSha256"]) digest(item[key]);
			continue;
		}
		assert.equal(item.checks, { c: composed ? 1029 : 1013, cpp: composed ? 1024 : 1012 }[item.profile]);
		digest(item.modelSha256);
		const consumer = composed ? await specializedGenericRecordConsumer(item.profile, item.profile) : await readFile(`tests/fixtures/generic-record-consumers/${item.profile}.${item.profile}`);
		assert.equal(item.consumerSha256, sha256(consumer));
		assert.equal(item.packages.length, 1);
		for(const pkg of item.packages)
		{
			assert.equal(pkg.target, item.profile); assert.equal(pkg.artifacts.length, 1);
			for(const artifact of pkg.artifacts)
			{
				assert.equal(report.archives[artifact.path], artifact.sha256);
				assert.ok(Number.isSafeInteger(artifact.bytes) && artifact.bytes > 0); digest(artifact.sha256);
			}
		}
	}
	if(host === "native")
	{
		assert.deepEqual(Object.keys(report.archives).sort(), ["archives/genericrecords-1.0.0-c.tar.gz", "archives/genericrecords-1.0.0-cpp.tar.gz"]);
		for(const key of ["bindingIrSha256", "modelSha256", "receiptSha256", "reviewedBindingIrSha256"])
			assert.equal(observations[0][key], observations[1][key]);
	}
};

/**
 * Require exactly two completed producer selections, with neither silently skipped.
 *
 * @param text - Original concatenated TAP runs.
 * @param host - Native or npm queue.
 */
export const assertReviewedInstantiationTap = (text, host) => {
	assert.ok(["native", "npm"].includes(host));
	const names = host === "native" ? [
		"independently reviewed C and C++ packages install every alias-named generic record from source-free archives"
		, "a composed review installs C and C++ specializations over alias-instantiated records in two namespaces"
	] : [
		"an independently reviewed npm package keeps every alias-named record for Node and strict TypeScript"
		, "a composed review keeps npm specializations over alias-instantiated records for Node and strict TypeScript"
	];
	const runs = text.split(/^# step /mu).slice(1);
	assert.equal(runs.length, 2);
	for(const [index, run] of runs.entries())
	{
		assert.deepEqual([...run.matchAll(/^ok \d+ - (.+)$/gmu)].map(match => match[1]), [names[index]]);
		for(const [key, count] of Object.entries({ tests: 1, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
			assert.deepEqual([...run.matchAll(new RegExp(`^# ${key} (\\d+)$`, "gmu"))].map(match => Number(match[1])), [count]);
		assert.equal([...run.matchAll(/^1\.\.1$/gmu)].length, 1);
		assert.equal([...run.matchAll(/^exit=0$/gmu)].length, 1);
		assert.doesNotMatch(run, /^not ok |# SKIP|# TODO/mu);
	}
};

/** Exact receipt shape, including the weaker attempts that must never replace acceptance. */
export const reviewedInstantiationEvidenceReceipt = () => ({
	schemaVersion: 1, planNode: 1433, execution: "local"
	, scope: {
		sourcePath: "reviewed-source", hosts: ["c", "cpp", "npm"]
		, cases: ["direct alias-named records", "nine finite function specializations over record and List/Option aliases"]
		, strictTypescript: true, browser: false, dispatch: "not measured"
		, sourceIdentity: "Selected compiler, harness, fixture and caller files; not a complete dependency closure."
		, nativeCompilerFreePath: "No Lean or producer toolchain in the consumer path; C/C++ callers still compile against installed archives with the host compiler."
		, npmCompilerFreePath: "Offline install and Node calls use a Node-only PATH after author/build deletion; strict TypeScript uses the engine checkout's tsc."
		, environment: { node: "v22.23.3", nativeGlibcFloorOverride: "2.36", cpu: 3, concurrency: 1, npmEngine: "local" }
		, hostedCi: false, binaryArchivesRetained: false
	}
	, producers: identities.sources
	, artifacts: Object.entries(identities.originals).map(([name, item]) => ({ path: `${reviewedInstantiationEvidenceDirectory}/${name}`, ...item }))
	, earlierAttempts: [
		{ revision: identities.sources.native.revision, artifacts: ["npm-source-drift.queue", "npm-source-drift.tap"], accepted: false, reason: "lake-source-drift before installation; composed selection did not run" }
		, { revision: "4bab1c77f750e5420bde7a8ecc9b6f03467fff6b", artifacts: ["npm-renamed-direct.json", "npm-renamed-composed.json", "npm-renamed.queue", "npm-renamed.tap"], acceptedForSourceDeletion: false, reason: "Author directories were renamed, not deleted; the later 111ec13 runs establish actual deletion." }
	]
	, freshLean: { artifact: "fresh-lean.tap", tests: 14, passed: 10, failed: 0, skipped: 4, scope: "Four nested mismatch controls count separately; four installed package gates were skipped." }
	, remaining: ["Promote only these reviewed C/C++ and Node/TypeScript observations.", "Browser reviewed generics, inherited, recursive, refined and dependent instantiations need separate evidence."]
});

/**
 * Authenticate all artifacts before interpreting observations or following producer pins.
 *
 * @param receipt - Archived receipt.
 * @param reader - Exact path reader, injectable for corruption controls.
 */
export const assertReviewedInstantiationArchive = async (receipt, reader = readFile) => {
	assert.deepEqual(receipt, reviewedInstantiationEvidenceReceipt());
	const loaded = new Map();
	for(const file of receipt.artifacts)
	{
		const bytes = await reader(file.path);
		assert.equal(bytes.length, file.bytes, file.path); assert.equal(sha256(bytes), file.sha256, file.path);
		loaded.set(file.path.split("/").at(-1), bytes.toString());
	}
	for(const [host, producer] of Object.entries(receipt.producers))
	{
		for(const file of producer.files)
			assert.equal(sha256(beforeFinRefinementSource(file.path, await reader(file.path), file.sha256)), file.sha256, `${host}/${file.path}`);
		const queue = loaded.get(`${host}.queue`);
		assert.ok(queue.startsWith(`revision=${producer.revision}\n`));
		assert.match(queue, /cpu=3 concurrency=1/u); assert.match(queue, /all steps passed/u);
		assert.equal([...queue.matchAll(/^end .+ exit=0$/gmu)].length, 2);
		assertReviewedInstantiationTap(loaded.get(`${host}.tap`), host);
		for(const composed of [false, true])
			await assertReviewedInstantiationReport(JSON.parse(loaded.get(`${host}-${composed ? "composed" : "direct"}.json`)), host, composed);
	}
	const failure = loaded.get("npm-source-drift.tap");
	assert.match(failure, /code: 'lake-source-drift'/u); assert.match(failure, /^# fail 1$/mu); assert.match(failure, /^exit=1$/mu);
	assert.ok(!loaded.get("npm-source-drift.queue").includes("start composed"));
	assertReviewedInstantiationTap(loaded.get("npm-renamed.tap"), "npm");
	for(const kind of ["direct", "composed"])
		assert.equal(Object.hasOwn(JSON.parse(loaded.get(`npm-renamed-${kind}.json`)), "sourceRemovedBeforeInstallation"), false);
	const lean = loaded.get("fresh-lean.tap");
	for(const [key, count] of Object.entries({ tests: 14, pass: 10, fail: 0, cancelled: 0, skipped: 4, todo: 0 }))
		assert.match(lean, new RegExp(`^# ${key} ${count}$`, "mu"));
};

/**
 * Keep existing evidence immutable while allowing an identical archive regeneration.
 *
 * @param path - Validated destination.
 * @param bytes - Exact original contents.
 */
export const writeReviewedInstantiationArtifact = async (path, bytes) => {
	await mkdir(dirname(path), { recursive: true });
	try
	{ await writeFile(path, bytes, { flag: "wx" }); }
	catch(error)
	{ if(error.code !== "EEXIST") throw error; assert.deepEqual(await readFile(path), bytes, path); }
};
