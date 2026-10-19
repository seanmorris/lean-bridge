/**
 * Fast negative controls for value-index PHP-Wasm CI TAP parsing.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { checkedRecordValueIndexBrowserRoutes } from "./checked-record-value-index-browser-fixture.mjs";
import { checkedRecordValueIndexPhpWasmSelection } from "./checked-record-value-index-php-wasm-fixture.mjs";
import {
	assertCheckedRecordValueIndexPhpWasmCiTap
	, assertCheckedRecordValueIndexPhpWasmCompilerTap
	, parseCheckedRecordValueIndexPhpWasmCiArgs
} from "./checked-record-value-index-php-wasm-ci-report.mjs";

const route = "ordinary-source";
const args = [
	"--route"
	, route
	, "--producer"
	, "a".repeat(40)
	, "--directory"
	, "/records"
	, "--tap"
	, "/records/run.tap"
];
const installedName = value => `installed value-index checked records PHP-Wasm ${value} reproduce and relocate`;
const installedTap = value => `TAP version 13\n# Subtest: ${installedName(value)}\nok 1 - ${installedName(value)}\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n`;
const compilerRows = checkedRecordValueIndexBrowserRoutes.map(value => {
	const selection = checkedRecordValueIndexPhpWasmSelection(value);
	return {
		sourceCompilationOnly: true
		, route: value
		, module: "CheckedRecordValueIndices"
		, pointerBits: 32
		, exports: selection.expected.declarations.length
		, generatedCSha256: "a".repeat(64)
		, installedAcceptance: false
	};
});
const compilerTap = (() => {
	const names = checkedRecordValueIndexBrowserRoutes.map(value =>
		`fresh Lean PHP-Wasm value-index checked-record ${value}`);
	return "TAP version 13\n" + names.map((name, index) => `# Subtest: ${name}\nok ${index + 1} - ${name}\n# ${JSON.stringify(compilerRows[index])}\n`).join("")
		+ "1..4\n# tests 4\n# suites 0\n# pass 4\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n";
})();

test("value-index PHP-Wasm CI parser closes route, producer, and zero-skip producer TAP", () => {
	assert.deepEqual(parseCheckedRecordValueIndexPhpWasmCiArgs(args), {
		route
		, producer: "a".repeat(40)
		, directory: "/records"
		, tap: "/records/run.tap"
	});
	assertCheckedRecordValueIndexPhpWasmCiTap(installedTap(route), route);
	for(const invalid of [
		[]
		, args.slice(0, -1)
		, [...args, "--route", route]
		, ["--route", "ordinary", ...args.slice(2)]
		, ["--route", route, "--producer", "HEAD", ...args.slice(4)]
	])
		assert.throws(() => parseCheckedRecordValueIndexPhpWasmCiArgs(invalid));
	for(const changed of [installedTap(route).replace("# skipped 0", "# skipped 1")
		, installedTap(route).replace("ok 1 -", "not ok 1 -")
		, installedTap(route).replaceAll(route, "invented")
		, installedTap(route).replace("1..1", "1..2")])
		assert.throws(() => assertCheckedRecordValueIndexPhpWasmCiTap(changed, route));
});

test("value-index PHP-Wasm compiler parser closes four fresh compiler diagnostics", () => {
	assertCheckedRecordValueIndexPhpWasmCompilerTap(compilerTap);
	for(const changed of [compilerTap.replace("# tests 4", "# tests 3")
		, compilerTap.replace("generatedCSha256", "wrong")
		, compilerTap.replace('"installedAcceptance":false', '"installedAcceptance":true')
		, compilerTap.replace("1..4", "1..3")])
		assert.throws(() => assertCheckedRecordValueIndexPhpWasmCompilerTap(changed));
	for(const invalid of [[], ["--bad"]])
		assert.notEqual(spawnSync(process.execPath, [
			"scripts/check-checked-record-value-index-php-wasm-compiler-ci.mjs"
			, ...invalid
		], { encoding: "utf8" }).status, 0);
});
