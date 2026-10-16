/**
 * Hosted-record controls for nested checked-record browser acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkNestedCheckedRecordBrowserCiRecords,
	parseNestedCheckedRecordBrowserCiArgs
} from "./nested-checked-record-browser-ci-report.mjs";
import {
	nestedCheckedRecordBrowserArchive,
	nestedCheckedRecordBrowserChecker,
	nestedCheckedRecordBrowserConsumer,
	nestedCheckedRecordBrowserProducer
} from "./nested-checked-record-browser-archive.mjs";

const tap = tests => `TAP version 13\n${Array.from({ length: tests }, (_, index) => `# Subtest: accepted ${index}\nok ${index + 1} - accepted ${index}\n  ---\n  duration_ms: 1\n  type: 'test'\n  ...\n`).join("")}1..${tests}\n# tests ${tests}\n# suites 0\n# pass ${tests}\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 2\n`;
const args = options => Object.entries(options).flatMap(([key, value]) => ["--" + key, value]);

test("hosted nested checked-record checker closes every original route and control", async () => {
	const index = JSON.parse(await readFile(`${nestedCheckedRecordBrowserArchive}/index.json`));
	for(const run of index.runs)
	{
		const prefix = `${run.route}/records/`;
		const files = index.files.filter(file => file.path.startsWith(prefix));
		const originals = new Map(await Promise.all(files.map(async file => [
			file.path.slice(prefix.length)
			, await readFile(`${nestedCheckedRecordBrowserArchive}/${file.path}`)
		])));
		const options = {
			route: run.route, producer: nestedCheckedRecordBrowserProducer
			, "npm-checker": JSON.parse(originals.get("controls.json")).checkerCommit
			, consumer: nestedCheckedRecordBrowserConsumer
			, checker: nestedCheckedRecordBrowserChecker, directory: "retained"
			, "npm-tap": "npm.tap", "browser-tap": "browser.tap"
			, "controls-tap": "controls.tap", runtime: "runtime.json"
		};
		assert.deepEqual(parseNestedCheckedRecordBrowserCiArgs(args(options)), options);
		const checked = await checkNestedCheckedRecordBrowserCiRecords(options, {
			npmTap: tap(1), browserTap: tap(2), controlsTap: tap(1)
			, runtime: run.runtime, paths: [...originals.keys()].sort()
			, read: path => { assert.ok(originals.has(path), path); return originals.get(path); }
		});
		assert.equal(checked.route, run.route);
		assert.deepEqual(checked.controls, run.controls);
		for(const mutate of [
			value => { value.paths.pop(); }
			, value => { value.browserTap = value.browserTap.replace("# pass 2", "# pass 1"); }
			, value => {
				const changed = JSON.parse(value.originals.get("browser-controls.json"));
				changed.browserControls--;
				value.originals.set("browser-controls.json", Buffer.from(JSON.stringify(changed) + "\n"));
			}
		]) {
			const control = {
				originals: new Map(originals), paths: [...originals.keys()].sort()
				, npmTap: tap(1), browserTap: tap(2), controlsTap: tap(1)
			};
			mutate(control);
			await assert.rejects(checkNestedCheckedRecordBrowserCiRecords(options, {
				...control, runtime: run.runtime
				, read: path => control.originals.get(path)
			}));
		}
	}
});

test("hosted nested checked-record checker refuses ambiguous selections", () => {
	const valid = {
		route: "ordinary-full", producer: "a".repeat(40)
		, "npm-checker": "d".repeat(40), consumer: "b".repeat(40)
		, checker: "c".repeat(40), directory: "records", "npm-tap": "npm.tap"
		, "browser-tap": "browser.tap", "controls-tap": "controls.tap"
		, runtime: "runtime.json"
	};
	for(const changed of [args(valid).slice(2)
		, [...args(valid), "--route", "ordinary-full"]
		, args({ ...valid, route: "invented" })
		, args({ ...valid, producer: "a".repeat(39) })])
		assert.throws(() => parseNestedCheckedRecordBrowserCiArgs(changed));
});
