/**
 * Check independent native CI routes against the captured acceptance commands.
 *
 * @file
 */
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedTransferC } from "./owned-transfer-c-history.mjs";
import { beforePhpWasmCallbackResultAcceptance } from "./php-wasm-callback-result-acceptance-history.mjs";

export const nativeCiProfiles = {
	"c-family": {
		consumers: ["c", "cpp"], ordinary: "ordinary_c"
		, corpus: "type_corpus_c_family"
		, upload: "Upload installed C and C++ corpus observations"
	}
	, python: {
		consumers: ["python"], ordinary: "ordinary_python"
		, corpus: "type_corpus_python"
		, upload: "Upload the real-Lean type corpus report"
	}
	, rust: {
		consumers: ["rust"], ordinary: "ordinary_rust", corpus: "type_corpus_rust"
		, upload: "Upload installed Rust corpus observations"
	}
};

/**
 * Select the native job without reading neighboring jobs.
 *
 * @param workflow - Complete workflow source.
 */
export const nativeCiJob = workflow => {
	const match = /^ {2}native-consumers:\n[\s\S]*?(?=^ {2}[a-z][a-z0-9-]*:\n)/mu.exec(workflow);
	assert.ok(match); return match[0];
};

/**
 * Read literal steps and their route conditions.
 *
 * @param workflow - Complete workflow source.
 */
export const nativeCiSteps = workflow => nativeCiJob(workflow).split(/^ {6}- name: /mu).slice(1).map(text => ({
	name: text.split("\n")[0], text
	, id: /^ {8}id: (.+)$/mu.exec(text)?.[1]
	, condition: /^ {8}if: (.+)$/mu.exec(text)?.[1]
}));

/**
 * Preserve the complete shell block, including receipt checks.
 *
 * @param step - Parsed workflow step.
 */
export const nativeCiCommands = step => {
	const match = /^ {8}run: \|\n((?: {10}.*\n|\n)*)/mu.exec(step.text);
	assert.ok(match, step.name + " has a literal command block"); return match[1];
};

const context = (profile, overrides) => ({
	always: () => true
	, matrix: { profile, consumers: nativeCiProfiles[profile].consumers.join(" ") }
	, steps: { collection_python312: { outputs: { "python-path": "/fixture/python312/bin/python3.12" } }
		, ...Object.fromEntries(Object.entries({
			consumer: "success"
			, ...Object.fromEntries(Object.entries(nativeCiProfiles).flatMap(([name, spec]) =>
				[spec.ordinary, spec.corpus].map(id => [id, name === profile ? "success" : "skipped"])))
			, ...overrides
		}).map(([id, outcome]) => [id, { outcome }])) }
});
// GitHub permits dashes in property names; JavaScript requires bracket access.
const evaluate = (expression, profile, overrides = {}) => runInNewContext(
	expression.replace(/\.([A-Za-z_][A-Za-z0-9_]*-[A-Za-z0-9_-]+)/gu, (_, property) => `[${JSON.stringify(property)}]`)
	, context(profile, overrides), { timeout: 100 });

/**
 * Render only the closed matrix and step expressions in the recording script.
 *
 * @param workflow - Complete workflow source.
 * @param profile - Known native matrix profile.
 * @param overrides - Explicit step outcomes for failure-path checks.
 */
export const nativeCiRecordScript = (workflow, profile, overrides = {}) => nativeCiCommands(
	nativeCiSteps(workflow).find(step => step.name === "Record native consumer observations")
).replace(/\$\{\{ (.+?) \}\}/gu, (_, expression) => String(evaluate(expression, profile, overrides)));

/**
 * Preserve all native acceptance commands while isolating outcomes and uploads.
 *
 * @param workflow - Complete current workflow.
 * @param baseline - Captured command/step hashes from the pre-split revision.
 */
export const assertNativeCiIsolation = (workflow, baseline) => {
	// The transfer receipt authenticates its added gates separately. Rewind only
	// that exact full-file transition when checking the original shard commands.
	// Peel the authenticated PHP-Wasm integration and its successor CI layout
	// before authenticating the older full-workflow transition.
	const withoutCallbackResults = beforePhpWasmCallbackResultAcceptance(
		".github/workflows/consumer-matrix.yml", workflow
	)
		.replace(/^ {2}php-wasm-callback-results:\n[\s\S]*?(?=^ {2}php-consumers:\n)/mu, "")
		.replace(/^ {6}- php-wasm-callback-results\n/mu, "")
		.replace(/^ {6}- name: Enforce PHP-Wasm callback-result acceptance\n {8}if: needs\.php-wasm-callback-results\.result != 'success'\n {8}run: exit 1\n/mu, "");
	workflow = withoutCallbackResults;
	workflow = beforeOwnedTransferC(".github/workflows/consumer-matrix.yml", workflow);
	assert.equal(baseline.schemaVersion, 1);
	assert.equal(baseline.baselineRevision, "4ae2450fd9dfd164486970993d0923e667c18bbf");
	const body = nativeCiJob(workflow), steps = nativeCiSteps(workflow);
	const named = name => { const step = steps.find(step => step.name === name); assert.ok(step, name); return step; };
	const identified = id => { const step = steps.find(step => step.id === id); assert.ok(step, id); return step; };
	assert.match(body, /^ {4}name: Native consumer \(\$\{\{ matrix.profile \}\}\)$/mu);
	assert.match(body, /^ {4}timeout-minutes: 240$/mu);
	assert.match(body, /^ {4}strategy:\n {6}fail-fast: false\n {6}matrix:\n {8}profile: \[c-family, python, rust\]$/mu);
	const include = /^ {8}include:\n((?: {10,}.+\n)+)/mu.exec(body);
	assert.ok(include);
	assert.equal(include[1], Object.entries(nativeCiProfiles).map(([name, spec]) =>
		`          - profile: ${name}\n            consumers: ${spec.consumers.join(" ")}\n`).join(""));
	const bootstrap = named("Prepare native compiler for this shard");
	assert.equal(bootstrap.condition, undefined);
	assert.equal(nativeCiCommands(bootstrap), baseline.bootstrap);
	const consumer = identified("consumer");
	assert.equal(consumer.condition, undefined);
	assert.match(consumer.text, /^ {8}run: npm run test:consumer:native$/mu);
	const gate = named("Enforce native consumer support");
	assert.match(gate.condition, /^always\(\) && /u);
	assert.match(gate.text, /^ {8}run: exit 1$/mu);
	let commandsCompared = 0, outcomeCases = 0;
	for(const [profile, spec] of Object.entries(nativeCiProfiles))
	{
		for(const id of [spec.ordinary, spec.corpus])
		{
			const step = identified(id);
			assert.ok(steps.indexOf(bootstrap) < steps.indexOf(step));
			assert.equal(step.condition, "matrix.profile == '" + profile + "'");
			assert.equal(sha256(nativeCiCommands(step)), baseline.commandHashes[id], id + " retains every command and report gate");
			++commandsCompared;
		}
		const upload = named(spec.upload);
		assert.equal(upload.condition, "always() && matrix.profile == '" + profile + "'");
		for(const selected of Object.keys(nativeCiProfiles))
			for(const step of [identified(spec.ordinary), identified(spec.corpus), upload])
				assert.equal(evaluate(step.condition, selected), selected === profile);
		assert.equal(evaluate(gate.condition, profile), false, profile + " ignores unselected steps");
		for(const outcome of ["failure", "skipped", "cancelled"])
			for(const id of ["consumer", spec.ordinary, spec.corpus])
			{
				assert.equal(evaluate(gate.condition, profile, { [id]: outcome }), true, profile + "/" + id + "/" + outcome);
				++outcomeCases;
			}
	}
	for(const [name, expected] of Object.entries(baseline.stepHashes))
	{
		const step = named(name);
		assert.equal(sha256(step.text.replace(/^ {8}if: .+\n/mu, "")), expected, name + " retains tools and artifacts");
		if(name.startsWith("Select Python"))
			assert.equal(step.condition, "matrix.profile == 'python'");
	}
	const record = named("Record native consumer observations");
	assert.equal(record.condition, "always()");
	assert.ok(record.text.includes("for consumer in ${{ matrix.consumers }}; do"));
	const normalized = record.text
		.replace("for consumer in ${{ matrix.consumers }}; do", "for consumer in python rust c cpp; do")
		.replace("build/consumer-ci/results/native-${{ matrix.profile }}/$consumer.json", "build/consumer-ci/results/$consumer.json");
	assert.equal(sha256(normalized), baseline.recordStepSha256, "keep all observation commands and failure checks");
	const upload = named("Upload native consumer observations");
	assert.equal(upload.condition, "always()");
	assert.ok(upload.text.includes("name: consumer-results-native-${{ matrix.profile }}-${{ github.sha }}"));
	assert.ok(upload.text.includes("path: build/consumer-ci/results/native-${{ matrix.profile }}/*.json"));
	assert.match(upload.text, /if-no-files-found: error/u);
	assert.match(workflow, /^ {6}- native-consumers$/mu);
	assert.ok(workflow.includes("pattern: consumer-results-*-${{ github.sha }}"));
	return { profiles: Object.keys(nativeCiProfiles), timeoutMinutesPerProfile: 240
		, failFast: false, commandsCompared, selectedOutcomeCases: outcomeCases
		, selectedConsumers: Object.values(nativeCiProfiles).flatMap(spec => spec.consumers) };
};
