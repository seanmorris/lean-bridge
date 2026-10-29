/**
 * Controls for the same-run optional-parameter aggregate receipt.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import {
	optionalParameterFocusedWorkflow, optionalParameterMatrixCases
	, optionalParameterMatrixLanes
	, optionalParameterMatrixRoutes, optionalParameterMatrixWorkflow
} from "./optional-parameter-matrix.mjs";
import {
	buildOptionalParameterMatrixReceipt, optionalParameterMatrixResultPath
	, validateOptionalParameterMatrixReceipt
} from "./optional-parameter-matrix-receipt.mjs";

const producerCommit = "a".repeat(40);
const metrics = lane => lane.key === "npm"
	? { checks: 27, rejections: 7, executions: 2, browserProfiles: 3 }
	: lane.key === "native" ? { checks: 43, rejections: 4, executions: 4 }
		: lane.key === "php" ? { checks: 46, rejections: 44, executions: 16 }
			: lane.key === "managed-jvm" ? { checks: 46, executions: 4 }
				: { checks: 23, executions: 2 };
const result = (lane, route) => ({
	lane: lane.key, route: route.reportRoute, producerCommit
	, profiles: [...lane.profiles], cases: optionalParameterMatrixCases
	, ...metrics(lane)
});
const records = () => new Map(
	optionalParameterMatrixLanes.flatMap(lane =>
		optionalParameterMatrixRoutes.map(route => [
			optionalParameterMatrixResultPath(lane, route, producerCommit)
			, Buffer.from(canonicalJson(result(lane, route)))
		])
	)
);
const build = (values, workflow = optionalParameterMatrixWorkflow) =>
	buildOptionalParameterMatrixReceipt(path => {
		assert.ok(values.has(path), path); return values.get(path);
	}, {
		repository: "seanmorris/lean-bridge"
		, workflow, producerCommit
		, runId: 40700000001, runAttempt: 2
	});

const focusedProducers = [{
	file: ".github/workflows/generic-subtype-npm-browser.yml"
	, records: [{
		name: "Node and browser", script: "run-optional-parameter-npm-ci.sh"
		, artifact: "optional-parameter-node-browser"
		, path: "build/optional-parameter-npm-ci/"
	}]
}
, {
	file: ".github/workflows/generic-subtype-native-perl.yml"
	, records: [{
		name: "C and C++", script: "run-optional-parameter-native-ci.sh"
		, artifact: "optional-parameter-native"
		, path: "build/optional-parameter-native-ci/"
	}
	, {
		name: "Perl", script: "run-optional-parameter-language-ci.sh perl"
		, artifact: "optional-parameter-language-perl"
		, path: "build/optional-parameter-language-ci/perl/"
	}]
}
, {
	file: ".github/workflows/generic-subtype-languages.yml"
	, records: ["python", "ruby", "rust"].map(profile => ({
		name: profile[0].toUpperCase() + profile.slice(1)
		, script: `run-optional-parameter-language-ci.sh ${profile}`
		, artifact: `optional-parameter-language-${profile}`
		, path: `build/optional-parameter-language-ci/${profile}/`
	}))
}
, {
	file: ".github/workflows/generic-subtype-managed-wit.yml"
	, records: [{
		name: ".NET", script: "run-optional-parameter-managed-ci.sh dotnet"
		, artifact: "optional-parameter-managed-dotnet"
		, path: "build/optional-parameter-managed-ci/dotnet/"
	}
	, {
		name: "JVM", script: "run-optional-parameter-managed-ci.sh jvm"
		, artifact: "optional-parameter-managed-jvm"
		, path: "build/optional-parameter-managed-ci/jvm/"
	}
	, {
		name: "WIT", script: "run-optional-parameter-wit-ci.sh"
		, artifact: "optional-parameter-wit"
		, path: "build/optional-parameter-wit-ci/"
	}]
}
, {
	file: ".github/workflows/nominal-subtype-php-wasm.yml"
	, records: [{
		name: "PHP", script: "run-optional-parameter-php-ci.sh"
		, artifact: "optional-parameter-php"
		, path: "build/optional-parameter-php-ci/"
	}]
}];
const step = (source, name) => {
	const marker = `      - name: ${name}\n`, start = source.indexOf(marker);
	assert.notEqual(start, -1, name);
	const next = source.indexOf("\n      - name: ", start + marker.length);
	return source.slice(start, next === -1 ? undefined : next);
};
const assertFocusedProducer = (source, specification) => {
	assert.match(source
		, /^on:\n {2}workflow_call:\n {4}inputs:\n {6}optional_parameters:/mu);
	assert.match(source, /^ {8}default: false$/mu);
	for(const record of specification.records)
	{
		const runName = record.name === "Node and browser"
			? "Execute the complete optional-parameter Node and browser matrix"
			: `Execute optional parameters through ${record.name === "PHP" ? "native PHP and PHP-Wasm packages" : record.name.startsWith("C ") ? "prepared C and C++ packages" : record.name === "JVM" ? "prepared Java and Kotlin packages" : `the prepared ${record.name} package`}`;
		const run = step(source, runName);
		assert.match(run, /^ {8}id: optional_parameters$/mu);
		assert.match(run, /inputs\.optional_parameters/u);
		assert.match(run, /^ {8}continue-on-error: true$/mu);
		assert.ok(run.includes(`bash scripts/${record.script}`));
		const upload = step(source, `Preserve optional-parameter ${record.name} records`);
		assert.ok(upload.includes(`name: ${record.artifact}-\${{ github.sha }}`));
		assert.ok(upload.includes(`path: ${record.path}`));
		assert.match(upload, /inputs\.optional_parameters/u);
		assert.match(upload, /^ {10}if-no-files-found: error$/mu);
		assert.doesNotMatch(upload, /continue-on-error:/u);
		const enforce = step(source
			, `Enforce optional-parameter ${record.name} acceptance`);
		assert.match(enforce
			, /steps\.optional_parameters\.outcome != 'success'/u);
		assert.match(enforce, /inputs\.optional_parameters/u);
		assert.doesNotMatch(enforce, /continue-on-error:/u);
	}
};
const focusedCalls = focusedProducers.map(item => `./${item.file}`);
const assertFocusedCaller = source => {
	assert.ok(source.includes("on:\n  workflow_call:\n"));
	assert.ok(source.includes("  workflow_dispatch:\n"));
	assert.ok(source.includes("  schedule:\n"));
	assert.deepEqual([...source.matchAll(/^ {4}uses: (\.\/\.github\/workflows\/[a-z0-9-]+\.yml)$/gmu)]
		.map(match => match[1]), focusedCalls);
	assert.equal(source.match(/^ {6}optional_parameters: true$/gmu)?.length, 5);
	const receiptStart = source.indexOf("  receipt:\n");
	assert.notEqual(receiptStart, -1);
	const receipt = source.slice(receiptStart);
	assert.match(receipt, /^ {4}if: always\(\)$/mu);
	assert.doesNotMatch(receipt, /^ {4}continue-on-error:/mu);
	for(const job of ["npm-browser", "native-perl", "languages", "managed-wit", "php"])
		assert.match(receipt, new RegExp(`^ {6}- ${job}$`, "mu"));
	assert.match(receipt
		, /pattern: optional-parameter-\*-\$\{\{ github\.sha \}\}/u);
	assert.match(receipt
		, /node scripts\/reconcile-optional-parameter-matrix\.mjs \\\n/u);
	assert.ok(receipt.includes(
		'--workflow ".github/workflows/optional-parameter-complete.yml"'));
	assert.match(receipt
		, /name: optional-parameter-matrix-\$\{\{ github\.sha \}\}/u);
	assert.match(receipt, /^ {10}if-no-files-found: error$/mu);
	assert.doesNotMatch(step(receipt
		, "Preserve the complete optional-parameter receipt")
	, /continue-on-error:/u);
	assert.doesNotMatch(receipt, /npm (?:ci|install)/u);
	assert.match(receipt
		, /steps\.download\.outcome != 'success'/u);
	assert.match(receipt
		, /steps\.reconciliation\.outcome != 'success'/u);
	for(const job of ["npm-browser", "native-perl", "languages", "managed-wit", "php"])
		assert.ok(receipt.includes(`needs.${job}.result != 'success'`));
};

test("optional matrix receipt authenticates all twenty same-run reports", async () => {
	const receipt = await build(records());
	assert.equal(validateOptionalParameterMatrixReceipt(receipt), receipt);
	assert.deepEqual(receipt.matrix
		, { lanes: 10, routes: 2, profiles: 17, cells: 34 });
	assert.deepEqual(receipt.totals
		, { reports: 20, checks: 600, executions: 76, rejections: 110 });
	assert.equal(new Set(receipt.records.map(item => item.artifact)).size, 10);
	assert.equal(new Set(receipt.records.map(item => item.path)).size, 20);
	const focused = await build(records(), optionalParameterFocusedWorkflow);
	assert.equal(focused.run.workflow, optionalParameterFocusedWorkflow);
	assert.equal(validateOptionalParameterMatrixReceipt(focused), focused);
});

test("optional matrix receipt rejects absent, noncanonical and drifted reports", async () => {
	const absent = records(); absent.delete(absent.keys().next().value);
	await assert.rejects(build(absent));
	const noncanonical = records(), path = noncanonical.keys().next().value;
	noncanonical.set(path, Buffer.from(JSON.stringify(
		JSON.parse(noncanonical.get(path)), null, 2
	)));
	await assert.rejects(build(noncanonical));
	const drifted = records(), value = JSON.parse(drifted.get(path));
	value.cases.explicitHostNull = false;
	drifted.set(path, Buffer.from(canonicalJson(value)));
	await assert.rejects(build(drifted));
});

test("retained optional matrix receipts reject derived-field substitution", async () => {
	const original = await build(records());
	for(const mutate of [
		value => { value.records.pop(); }
		, value => { value.records[0].sha256 = "0".repeat(64); }
		, value => { value.records[0].result.checks++; }
		, value => { value.totals.executions++; }
		, value => { value.run.producerCommit = "b".repeat(40); }
		, value => { value.run.workflow = ".github/workflows/quality.yml"; }
	]) {
		const changed = structuredClone(original); mutate(changed);
		assert.throws(() => validateOptionalParameterMatrixReceipt(changed));
	}
});

test("consumer CI downloads, reconciles, retains and enforces the matrix", async () => {
	const workflow = await readFile(
		".github/workflows/consumer-matrix.yml", "utf8");
	assert.match(workflow, /^ {2}optional-parameter-matrix:\n/gmu);
	assert.match(workflow
		, /pattern: optional-parameter-\*-\$\{\{ github\.sha \}\}/u);
	assert.match(workflow, /node scripts\/reconcile-optional-parameter-matrix\.mjs \\\n/u);
	assert.ok(workflow.includes(
		'--workflow ".github/workflows/consumer-matrix.yml"'));
	assert.match(workflow
		, /name: optional-parameter-matrix-\$\{\{ github\.sha \}\}/u);
	assert.match(workflow
		, /if: needs\.optional-parameter-matrix\.result != 'success'/u);
});

test("focused recurring CI produces and reconciles the exact optional matrix", async t => {
	const sources = new Map(await Promise.all(focusedProducers.map(async item => [
		item.file, await readFile(item.file, "utf8")
	]))), callerPath = ".github/workflows/optional-parameter-complete.yml";
	const caller = await readFile(callerPath, "utf8");
	for(const item of focusedProducers)
		assertFocusedProducer(sources.get(item.file), item);
	assertFocusedCaller(caller);
	const callerMutations = [
		caller.replace(focusedCalls[0], "./.github/workflows/quality.yml")
		, caller.replace("      - npm-browser\n", "")
		, caller.replace("if-no-files-found: error", "if-no-files-found: ignore")
		, caller.replace("steps.download.outcome != 'success'", "false")
		, caller.replace("optional-parameter-*-${{ github.sha }}"
			, "optional-parameter-node-browser-${{ github.sha }}")
		, caller.replace("  receipt:\n", "  receipt:\n    continue-on-error: true\n")
	];
	for(const changed of callerMutations)
		assert.throws(() => assertFocusedCaller(changed), assert.AssertionError);
	for(const item of focusedProducers)
	{
		const source = sources.get(item.file), first = item.records[0];
		for(const changed of [
			source.replace("  workflow_call:\n", "")
			, source.replace(first.script, `disabled-${first.script}`)
			, source.replace(first.artifact, `disabled-${first.artifact}`)
			, source.replace(first.path, `disabled/${first.path}`)
			, source.replace("steps.optional_parameters.outcome != 'success'", "false")
		]) assert.throws(() => assertFocusedProducer(changed, item)
			, assert.AssertionError, item.file);
	}
	t.diagnostic(`${callerMutations.length + focusedProducers.length * 5} focused-CI bypasses refused`);
});
