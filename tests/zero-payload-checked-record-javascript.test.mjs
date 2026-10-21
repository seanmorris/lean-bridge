/**
 * Keep zero-payload JavaScript runtime values and strict TypeScript declarations exact.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import {
	zeroPayloadBrowserExpected
	, zeroPayloadBrowserRoutes
	, zeroPayloadBrowserSelection
} from "./helpers/zero-payload-checked-record-browser-fixture.mjs";
import { checkZeroPayloadRecords } from "./fixtures/zero-payload-checked-record-browser/javascript.mjs";
import "./helpers/zero-payload-javascript-source-history-tests.mjs";
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
	});
	return api;
};

test("zero-payload caller distinguishes empty, Unit and Option values", () => {
	for(const route of zeroPayloadBrowserRoutes)
	{
		const resultOnly = route.startsWith("result-only-");
		assert.deepEqual(checkZeroPayloadRecords(mock(resultOnly), resultOnly)
			, zeroPayloadBrowserExpected(route));
	}
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
