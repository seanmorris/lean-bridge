/**
 * Authenticate reviewed callback Fin acceptance without borrowing other hosts or callback directions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { compilePrimitiveCSurface } from "../../src/backends/c/primitive-surface.mjs";
import { reviewedCallbackFinReview } from "./reviewed-callback-fin-fixture.mjs";
import { reviewedCallbackNodeExpected, reviewedCallbackNodeConsumer, reviewedCallbackTypescript } from "./reviewed-callback-fin-consumer.mjs";

export const reviewedCallbackFinEvidenceDirectory = "docs/evidence/reviewed-callback-fin-20261008";
export const reviewedCallbackFinEvidenceRevision = "f9cda046e0b624bd847fe41d521b9cb9f84f21a3";
export const reviewedCallbackFinEvidenceFiles = Object.freeze({
	"c-cpp.json": { original: "build/vo1445-reviewed-callback-fin-c-cpp-f9cda04.json", sha256: "1a5bcc37b01ceacbf265a62175adc1ffd8e05be504560fd21fb91fb8d37b1fed" }
	, "npm-r1.json": { original: "build/vo1445-reviewed-callback-fin-npm-r1-f9cda04.json", sha256: "e8840fe72af7d690a623d1d4547a7fb477bd52c5933687c0fa010cd56c54c8ef" }
	, "npm-r2.json": { original: "build/vo1445-reviewed-callback-fin-npm-r2-f9cda04.json", sha256: "d115e621640798fbcc57131b192f9eb465b44ab9b2a3bb004357f9874061e93c" }
	, "original.tap": { original: "build/vo1445-reviewed-callback-fin-f9cda04.tap", sha256: "1fb8b536cd41c7aae857a4c201a38931eae1eecd61ccb73adfb6943eed594da9" }
	, "original.queue": { original: "build/vo1445-reviewed-callback-fin-f9cda04.queue", sha256: "b5e686cfac8e32c3d32d035ca61390e3eea361666bc1ce76b3e678d547aa152e" }
});
const fixtureRoot = "tests/fixtures/onboarding/reviewed-callback-fin/";
const fixtureFiles = ["LICENSE", "ReviewedCallbacks.lean", "lakefile.toml", "lean-toolchain", "package.json"];
export const reviewedCallbackFinEvidenceSourcePaths = [
	"src/analyze/NativeExports.lean"
	, "src/analyze/reviewed-source.mjs"
	, "src/analyze/reviewed-refinements.mjs"
	, "src/analyze/callback-signature.mjs"
	, "src/analyze/semantic-model.mjs"
	, "src/analyze/lean-project.mjs"
	, "src/build/native-model.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/component-recursive-lean.mjs"
	, "src/build/component-refinements.mjs"
	, "src/build/component-callable-adapters.mjs"
	, "src/backends/c/native-callables.mjs"
	, "src/backends/c/primitive-surface.mjs"
	, "tests/reviewed-callback-fin.test.mjs"
	, "tests/helpers/reviewed-callback-fin-fixture.mjs"
	, "tests/helpers/reviewed-callback-fin-consumer.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/fixtures/reviewed-callback-fin-consumers/c.c"
	, "tests/fixtures/reviewed-callback-fin-consumers/cpp.cpp"
	, ...fixtureFiles.map(path => fixtureRoot + path)
];

/**
 * Reconstruct the npm analyzed input tree from the pinned fixture and the harness's generated files.
 *
 * @param hostReply - Select the npm-only R2 review.
 * @param readSource - Read an authenticated producer file.
 */
export const reviewedCallbackFinNpmFixture = async (hostReply, readSource) => {
	assert.equal(typeof hostReply, "boolean");
	const inputs = await Promise.all(fixtureFiles.map(async path => ({ path, sha256: sha256(await readSource(fixtureRoot + path)) })));
	inputs.push({ path: "lean-bridge.exports.json", sha256: sha256(canonicalJson({ schemaVersion: 1, modules: ["ReviewedCallbacks"] })) }
		, { path: "api.binding-ir.json", sha256: sha256(canonicalJson(reviewedCallbackFinReview({ hostReply }))) });
	inputs.sort((left, right) => left.path.localeCompare(right.path));
	return { inputs, sha256: sha256(inputs.map(input => `${input.sha256}  ${input.path}\n`).join("")) };
};

/**
 * Reconstruct native caller macros in the compiler's declaration order, not the authored review order.
 *
 * @param readSource - Read an authenticated producer file.
 */
export const reviewedCallbackFinNativeCallers = async readSource => {
	const review = reviewedCallbackFinReview();
	const surface = compilePrimitiveCSurface(review, { callables: true, structuredCallables: true, compounds: true, lists: true, variants: true });
	const names = {};
	for(const item of [...review.declarations].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
	{
		const name = item.id.split(".").at(-1).toUpperCase(), host = item.parameters.find(site => surface.callbacks.has(site.type.id));
		if(surface.callbacks.has(item.result.type.id)) names[`CLOSURE_${name}`] = `${surface.prefix}_owned_${surface.callbacks.get(item.result.type.id).field}`;
		if(host) names[`HOST_${name}`] = `${surface.prefix}_${surface.callbacks.get(host.type.id).field}`;
	}
	const c = await readSource("tests/fixtures/reviewed-callback-fin-consumers/c.c");
	return { c: sha256(`${Object.entries(names).map(([macro, value]) => `#define ${macro} ${value}`).join("\n")}\n${c}`)
		, cpp: sha256(await readSource("tests/fixtures/reviewed-callback-fin-consumers/cpp.cpp")) };
};

/**
 * Collect report identities only after the caller authenticates the original report hash.
 *
 * @param id - Installed selection identifier.
 * @param report - Authenticated original report.
 */
export const reviewedCallbackFinReportIdentities = (id, report) => {
	if(id !== "c-cpp") return { receipt: report.receipt, receiptSha256: report.receiptSha256 };
	const consumers = report.reports.map(item => ({
		profile: item.profile, bindingIrSha256: item.bindingIrSha256
		, modelSha256: item.modelSha256, receiptSha256: item.receiptSha256
		, packages: item.packages
	}));
	return { archives: report.archives, consumers };
};

/**
 * Validate exact reviewed source routes, measured checks, isolated consumption and retained identities.
 *
 * @param report - Candidate installed observation.
 * @param run - Selection and identities from an authenticated receipt.
 * @param readSource - Read an authenticated producer file.
 */
export const assertReviewedCallbackFinReport = async (report, run, readSource) => {
	assert.ok(["c-cpp", "npm-r1", "npm-r2"].includes(run.id));
	assert.equal(report.schemaVersion, 1); assert.equal(report.reproducible, true);
	assert.deepEqual(reviewedCallbackFinReportIdentities(run.id, report), run.identities);
	if(run.id === "c-cpp")
	{
		assert.deepEqual(Object.keys(report).sort(), ["archives", "reports", "reproducible", "schemaVersion"]);
		assert.deepEqual(report.reports.map(item => item.profile), ["c", "cpp"]);
		const callers = await reviewedCallbackFinNativeCallers(readSource);
		for(const item of report.reports)
		{
			assert.deepEqual(Object.keys(item).sort(), ["bindingIrSha256", "checks", "compilerFreePath", "consumerSha256", "dispatch", "modelSha256", "offlineInstall", "packages", "path", "profile", "receiptSha256", "review", "reviewedBindingIrSha256", "sourceRemovedBeforeInstallation"].sort());
			assert.equal(item.path, "reviewed-source"); assert.equal(item.review, "R1");
			assert.equal(item.checks, item.profile === "c" ? 266 : 260);
			assert.equal(item.reviewedBindingIrSha256, hashBindingIr(reviewedCallbackFinReview()));
			assert.equal(item.consumerSha256, callers[item.profile]); assert.equal(item.dispatch, "not measured");
			for(const flag of ["compilerFreePath", "offlineInstall", "sourceRemovedBeforeInstallation"]) assert.equal(item[flag], true, flag);
			assert.equal(item.packages.length, 1);
			const pkg = item.packages[0];
			assert.equal(pkg.target, item.profile); assert.equal(pkg.ecosystem, item.profile);
			assert.equal(pkg.name, "reviewedcallbacks"); assert.equal(pkg.profile, "native-library-v1");
			assert.deepEqual(pkg.requires, []); assert.equal(pkg.runtimeDelivery, "embedded");
			assert.equal(pkg.artifacts.length, 1);
			for(const file of pkg.artifacts) assert.equal(report.archives[file.path], file.sha256);
		}
		return;
	}
	assert.deepEqual(Object.keys(report).sort(), ["dispatch", "observed", "path", "profile", "receipt", "receiptSha256", "reproducible", "review", "reviewedBindingIrSha256", "schemaVersion", "sourceRemovedBeforeInstallation", "typescript"].sort());
	const hostReply = run.id === "npm-r2";
	assert.equal(report.profile, "npm"); assert.equal(report.path, "reviewed-source");
	assert.equal(report.review, hostReply ? "R2" : "R1"); assert.equal(report.dispatch, "not measured");
	assert.equal(report.reviewedBindingIrSha256, hashBindingIr(reviewedCallbackFinReview({ hostReply })));
	assert.equal(report.sourceRemovedBeforeInstallation, true);
	assert.deepEqual(report.observed, reviewedCallbackNodeExpected[hostReply ? "r2" : "r1"]);
	assert.deepEqual(report.typescript, { strict: true, skipLibCheck: false });
	assert.equal(report.receiptSha256, sha256(canonicalJson(report.receipt)));
	assert.equal(report.receipt.source.treeSha256, (await reviewedCallbackFinNpmFixture(hostReply, readSource)).sha256);
};

/** Record reconstructed npm caller identities separately from absent consumer hashes in the original reports. */
export const reviewedCallbackFinNpmCallers = () => ({
	r1: sha256(reviewedCallbackNodeConsumer(false))
	, r2: sha256(reviewedCallbackNodeConsumer(true))
	, typescript: sha256(reviewedCallbackTypescript)
});

/**
 * Authenticate all three selected executions, without treating aggregated TAP as one test block.
 *
 * @param tap - Original aggregate TAP text.
 * @param queue - Original shell queue.
 */
export const assertReviewedCallbackFinExecution = (tap, queue) => {
	const titles = ["independently reviewed C and C++ packages install R1 callback bounds from source-free archives"
		, "an independently reviewed npm package installs R1 callback bounds for Node and strict TypeScript"
		, "an independently reviewed npm package installs R2 with the npm-only host-reply bound"];
	const steps = ["c-cpp", "npm-r1", "npm-r2"];
	const reportVariables = ["LEAN_BRIDGE_REVIEWED_CALLBACK_FIN_REPORT"
		, "LEAN_BRIDGE_REVIEWED_CALLBACK_FIN_NPM_REPORT"
		, "LEAN_BRIDGE_REVIEWED_CALLBACK_FIN_R2_NPM_REPORT"];
	const events = [...queue.matchAll(/^(start|end) ([a-z0-9-]+) .*$/gmu)];
	assert.deepEqual(events.map(match => [match[1], match[2]]), steps.flatMap(step => [["start", step], ["end", step]]));
	const blocks = tap.split(/^# step /mu).slice(1);
	assert.equal(blocks.length, 3);
	for(const [index, block] of blocks.entries())
	{
		assert.ok(block.startsWith(`${steps[index]} pattern=`));
		const pattern = block.split("\n")[0].slice(`${steps[index]} pattern=`.length);
		assert.ok(events[index * 2][0].includes(` pattern=${pattern} env=`));
		assert.ok(` ${events[index * 2][0]} `.includes(` ${reportVariables[index]}=/app/${reviewedCallbackFinEvidenceFiles[`${steps[index]}.json`].original} `));
		assert.ok(block.includes(`ok 1 - ${titles[index]}\n`));
		assert.doesNotMatch(block, /^not ok /mu);
		for(const [key, count] of Object.entries({ tests: 1, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
			assert.deepEqual([...block.matchAll(new RegExp(`^# ${key} (.+)$`, "gmu"))].map(match => match[1]), [String(count)]);
		assert.deepEqual([...block.matchAll(/^exit=(.+)$/gmu)].map(match => match[1]), ["0"]);
		assert.match(queue, new RegExp(`^start ${steps[index]} .*pattern=`, "mu"));
		assert.match(queue, new RegExp(`^end ${steps[index]} .*exit=0$`, "mu"));
	}
	assert.match(queue, new RegExp(`^revision=${reviewedCallbackFinEvidenceRevision}$`, "mu"));
	assert.match(queue, /node=v22\.23\.3 cpu=3 concurrency=1/u);
	assert.match(queue, /LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2\.36/u);
	assert.match(queue, /^all steps passed /mu);
};
