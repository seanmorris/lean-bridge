/**
 * Keep zero-payload JavaScript runtime values and strict TypeScript declarations exact.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import {
	assertZeroPayloadBrowserTap
	, parseZeroPayloadBrowserCiArgs
} from "./helpers/zero-payload-checked-record-browser-ci-report.mjs";
import {
	zeroPayloadBrowserCaller
	, zeroPayloadBrowserExpected
	, zeroPayloadBrowserEngines
	, zeroPayloadBrowserName
	, zeroPayloadBrowserPhases
	, zeroPayloadBrowserProfiles
	, zeroPayloadBrowserRoutes
	, zeroPayloadBrowserSelection
	, validateZeroPayloadBrowserObservation
	, validateZeroPayloadBrowserPhases
} from "./helpers/zero-payload-checked-record-browser-fixture.mjs";
import { checkZeroPayloadRecords } from "./fixtures/zero-payload-checked-record-browser/javascript.mjs";
import "./helpers/zero-payload-browser-ci-source-history-tests.mjs";
import "./helpers/zero-payload-browser-diagnostic-source-history-tests.mjs";
import "./helpers/zero-payload-browser-archive-source-history-tests.mjs";
import "./helpers/zero-payload-browser-source-history-tests.mjs";
import "./helpers/zero-payload-checked-record-hosted-evidence-sources-tests.mjs";
import "./helpers/zero-payload-javascript-source-history-tests.mjs";
import "./helpers/zero-payload-npm-installed-source-history-tests.mjs";
import "./helpers/zero-payload-checked-record-npm-installed-tests.mjs";

const exact = (value, fields, path = "value") => {
	if(!value || typeof value !== "object" || ![Object.prototype, null].includes(
		Object.getPrototypeOf(value)
	)) throw new TypeError(`${path} must be a plain record`);
	const names = Reflect.ownKeys(value);
	if(names.length !== fields.length || names.some(name => !fields.includes(name)))
		throw new TypeError(`${path} does not match the declared copied fields`);
};
const mock = resultOnly => {
	const api = {
		produceWitness: () => ({}), produceToken: () => ({ tag: undefined })
		, witnesses: count => Array(Number(count)).fill(null).map(() => ({}))
		, maybeWitness: present => present
			? { tag: "some", value: {} } : { tag: "none" }
		, produceMarker: () => ({})
		, produceMark: active => active
			? { kind: "marked", witness: {} } : { kind: "blank" }
	};
	if(!resultOnly) Object.assign(api, {
		witnessCount: value => { exact(value, [], "Witness"); return 1n; }
		, absentCount: value => {
			exact(value, [], "Witness");
			throw new Error(
				"absentCount.arg0 was rejected by ZeroPayloadCheckedRecords.mkAbsent"
			);
		}
		, tokenTag: value => { exact(value, ["tag"], "Token"); return value.tag; }
		, markerCount: value => { exact(value, [], "Marker"); return 0n; }
		, markCount: value => {
			exact(value, value?.kind === "blank" ? ["kind"] : ["kind", "witness"], "Mark variant");
			if(value.kind === "blank") return 0n;
			if(value.kind !== "marked") throw new TypeError("Mark must match a declared variant");
			exact(value.witness, [], "Witness"); return 1n;
		}
	});
	return api;
};
const tap = (tests, skipped = 0) => `TAP version 13\n${Array.from({ length: tests }
	, (_, index) => `# Subtest: accepted ${index}\n`
		+ `ok ${index + 1} - accepted ${index}${index >= tests - skipped ? " # SKIP" : ""}\n`
		+ "  ---\n  duration_ms: 1\n  type: 'test'\n  ...\n").join("")}1..${tests}\n# tests ${tests}\n# suites 0\n# pass ${tests - skipped}\n# fail 0\n# cancelled 0\n# skipped ${skipped}\n# todo 0\n# duration_ms 2\n`;

test("zero-payload caller distinguishes empty, Unit and Option values", () => {
	for(const route of zeroPayloadBrowserRoutes)
	{
		const resultOnly = route.startsWith("result-only-");
		assert.deepEqual(checkZeroPayloadRecords(mock(resultOnly), resultOnly)
			, zeroPayloadBrowserExpected(route));
	}
});

test("zero-payload caller binds the exact ordinary and reviewed diagnostics", async () => {
	const ordinary = await zeroPayloadBrowserCaller("ordinary-source");
	const reviewed = await zeroPayloadBrowserCaller("reviewed-ir");
	assert.equal(reviewed, ordinary.replace(
		"absentCount.arg0 was rejected", "absentCount.value0 was rejected"));
	assert.equal(await zeroPayloadBrowserCaller("result-only-ordinary-source")
		, ordinary);
	assert.equal(await zeroPayloadBrowserCaller("result-only-reviewed-ir")
		, reviewed);
});

test("zero-payload browser wrapper closes every engine and lifecycle", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-zero-payload-wrapper-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await cp("tests/fixtures/zero-payload-checked-record-browser/browser.mjs"
		, join(root, "browser.mjs"));
	await cp("tests/fixtures/zero-payload-checked-record-browser/javascript.mjs"
		, join(root, "check.mjs"));
	const { executeCorpus } = await import(pathToFileURL(join(root, "browser.mjs")).href);
	for(const route of zeroPayloadBrowserRoutes)
		for(const profile of zeroPayloadBrowserProfiles)
		{
			const resultOnly = route.startsWith("result-only-");
			const results = executeCorpus({
				module: zeroPayloadBrowserName, profile, route, resultOnly
			}, mock(resultOnly));
			const observation = {
				schemaVersion: 1, profile, module: zeroPayloadBrowserName
				, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
				, results, hostVersion: "fixture-browser"
			};
			validateZeroPayloadBrowserObservation(observation, profile, route);
			const variants = profile === "browser-react"
				? ["production", "strict"] : ["production"];
			const phases = zeroPayloadBrowserEngines.flatMap(engine =>
				variants.flatMap(variant =>
					zeroPayloadBrowserPhases(profile).map(
						phase => ({ engine, variant, phase, observation })
					)
				)
			);
			validateZeroPayloadBrowserPhases(
				phases, profile, zeroPayloadBrowserEngines, route);
		}
	for(const request of [
		{}
		, { module: "wrong", profile: "browser-javascript"
			, route: "ordinary-source", resultOnly: false }
		, { module: zeroPayloadBrowserName, profile: "wrong"
			, route: "ordinary-source", resultOnly: false }
		, { module: zeroPayloadBrowserName, profile: "browser-javascript"
			, route: "ordinary-source", resultOnly: true }
	]) assert.throws(() => executeCorpus(request, mock(false)), /Wrong|Missing/u);
});

test("zero-payload hosted selections require terminal TAP and exact identities", () => {
	assert.doesNotThrow(() => assertZeroPayloadBrowserTap(tap(1), { tests: 1 }));
	assert.doesNotThrow(() => assertZeroPayloadBrowserTap(
		tap(16, 4), { skipped: 4, minimumPasses: 12 }
	));
	for(const source of [
		tap(1).replace("# fail 0", "# fail 1")
		, tap(16, 4).replace("# skipped 4", "# skipped 3")
		, tap(16, 4).replace("ok 1", "not ok 1")
	]) assert.throws(() => assertZeroPayloadBrowserTap(
		source, { skipped: source.includes("1..16") ? 4 : 0 }
	));
	const selected = {
		route: "ordinary-source", producer: "a".repeat(40)
		, "npm-checker": "b".repeat(40), consumer: "c".repeat(40)
		, checker: "d".repeat(40), directory: "records"
		, "acceptance-tap": "acceptance.tap", "controls-tap": "controls.tap"
		, runtime: "runtime.json"
	};
	const args = Object.entries(selected)
		.flatMap(([key, value]) => [`--${key}`, value]);
	assert.deepEqual(parseZeroPayloadBrowserCiArgs(args), selected);
	for(const changed of [args.slice(1), [...args, "--route", "reviewed-ir"]
		, args.map(value => value === selected.producer ? "not-a-commit" : value)])
		assert.throws(() => parseZeroPayloadBrowserCiArgs(changed));
});

test("generated JavaScript packages expose exact empty TypeScript carriers", async t => {
	for(const route of ["ordinary-source", "result-only-ordinary-source"])
	{
		const { expected, resultOnly } = zeroPayloadBrowserSelection(route);
		const files = generateJavaScriptPackage(expected);
		assert.match(files["index.d.ts"]
			, /export type Witness = Readonly<Record<PropertyKey, never>>;/u);
		assert.match(files["index.d.ts"]
			, /export type Marker = Readonly<Record<PropertyKey, never>>;/u);
		assert.match(files["index.d.ts"]
			, /export type Mark = Readonly<\{ readonly kind: "blank" \}> \| Readonly<\{ readonly kind: "marked"; readonly witness: Witness \}>;/u);
		assert.match(files["index.d.ts"], /export interface Token \{\n {2}readonly tag: void;/u);
		const root = await mkdtemp(join(tmpdir(), "lean-bridge-zero-payload-types-"));
		t.after(() => rm(root, { recursive: true, force: true }));
		const installed = join(root, "node_modules/zeropayloadcheckedrecords");
		await mkdir(installed, { recursive: true });
		for(const [path, source] of Object.entries(files))
		{
			await mkdir(join(installed, path, ".."), { recursive: true });
			await writeFile(join(installed, path), source);
		}
		const fixture = `tests/fixtures/zero-payload-checked-record-browser/${resultOnly ? "result-only" : "full"}.mts`;
		await cp(fixture, join(root, "index.mts"));
		const compiler = join(process.cwd(), "node_modules/typescript/lib/tsc.js");
		const run = await processBuildRunner.capture({
			command: process.execPath
			, args: [compiler, "--strict", "--noEmit", "--skipLibCheck", "false"
				, "--target", "ES2022", "--lib", "ES2022,ESNext.Disposable"
				, "--module", "NodeNext", "--moduleResolution", "NodeNext", "index.mts"]
			, cwd: root, timeoutMs: 300_000
		});
		assert.equal(run.stdout, ""); assert.equal(run.stderr, "");
		assert.equal(await readFile(join(root, "index.mts"), "utf8")
			, await readFile(fixture, "utf8"));
	}
});
