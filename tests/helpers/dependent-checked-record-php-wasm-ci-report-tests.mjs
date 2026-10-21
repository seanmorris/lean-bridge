/**
 * Fast negative controls for dependent PHP-Wasm CI TAP parsing.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { dependentCheckedRecordRoutes } from "./dependent-checked-record-browser-fixture.mjs";
import { dependentCheckedRecordPhpWasmSelection } from "./dependent-checked-record-php-wasm-fixture.mjs";
import {
	assertDependentCheckedRecordPhpWasmCiTap
	, assertDependentCheckedRecordPhpWasmCompilerTap
	, parseDependentCheckedRecordPhpWasmCiArgs
} from "./dependent-checked-record-php-wasm-ci-report.mjs";
import { dependentCheckedRecordPhpWasmRecords } from "./dependent-checked-record-php-wasm-report.mjs";
import { createPackageSetHandoff } from "./package-set.mjs";

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
const installedName = value => `installed dependent checked records PHP-Wasm ${value} reproduce and relocate`;
const installedTap = value => `TAP version 13\n# Subtest: ${installedName(value)}\nok 1 - ${installedName(value)}\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n`;
const compilerRows = dependentCheckedRecordRoutes.map(value => {
	const selection = dependentCheckedRecordPhpWasmSelection(value);
	return {
		sourceCompilationOnly: true
		, route: value
		, module: "DependentRecords"
		, pointerBits: 32
		, exports: selection.expected.declarations.length
		, generatedCSha256: "a".repeat(64)
		, installedAcceptance: false
	};
});
const compilerTap = (() => {
	const names = dependentCheckedRecordRoutes.map(value =>
		`fresh Lean PHP-Wasm dependent checked-record ${value}`);
	return "TAP version 13\n" + names.map((name, index) => `# Subtest: ${name}\nok ${index + 1} - ${name}\n# ${JSON.stringify(compilerRows[index])}\n`).join("")
		+ "1..4\n# tests 4\n# suites 0\n# pass 4\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n";
})();

test("dependent PHP-Wasm CI parser closes route, producer, and zero-skip producer TAP", () => {
	assert.deepEqual(parseDependentCheckedRecordPhpWasmCiArgs(args), {
		route
		, producer: "a".repeat(40)
		, directory: "/records"
		, tap: "/records/run.tap"
	});
	assertDependentCheckedRecordPhpWasmCiTap(installedTap(route), route);
	for(const invalid of [
		[]
		, args.slice(0, -1)
		, [...args, "--route", route]
		, ["--route", "ordinary", ...args.slice(2)]
		, ["--route", route, "--producer", "HEAD", ...args.slice(4)]
	])
		assert.throws(() => parseDependentCheckedRecordPhpWasmCiArgs(invalid));
	for(const changed of [installedTap(route).replace("# skipped 0", "# skipped 1")
		, installedTap(route).replace("ok 1 -", "not ok 1 -")
		, installedTap(route).replaceAll(route, "invented")
		, installedTap(route).replace("1..1", "1..2")])
		assert.throws(() => assertDependentCheckedRecordPhpWasmCiTap(changed, route));
});

test("dependent PHP-Wasm compiler parser closes four fresh compiler diagnostics", () => {
	assertDependentCheckedRecordPhpWasmCompilerTap(compilerTap);
	for(const changed of [compilerTap.replace("# tests 4", "# tests 3")
		, compilerTap.replace("generatedCSha256", "wrong")
		, compilerTap.replace('"installedAcceptance":false', '"installedAcceptance":true')
		, compilerTap.replace("1..4", "1..3")])
		assert.throws(() => assertDependentCheckedRecordPhpWasmCompilerTap(changed));
	for(const invalid of [[], ["--bad"]])
		assert.notEqual(spawnSync(process.execPath, [
			"scripts/check-dependent-checked-record-php-wasm-compiler-ci.mjs"
			, ...invalid
		], { encoding: "utf8" }).status, 0);
});

test("dependent PHP-Wasm record closure retains the receipt sidecar and every prepared archive", async t => {
	const { receipt } = await createPackageSetHandoff(t);
	for(const selectedRoute of dependentCheckedRecordRoutes)
	{
		const fixed = dependentCheckedRecordPhpWasmRecords(selectedRoute);
		const complete = dependentCheckedRecordPhpWasmRecords(selectedRoute, receipt);
		assert.ok(fixed.includes("handoff/package-set-receipt.json"));
		assert.ok(fixed.includes("handoff/package-set-receipt.json.sha256"));
		assert.equal(fixed.includes("build-0/api.binding-ir.json")
			, selectedRoute.endsWith("reviewed-ir"));
		assert.deepEqual(complete.slice(fixed.length), receipt.packages.flatMap(pkg =>
			pkg.artifacts.map(artifact => "handoff/" + artifact.path)));
		assert.equal(new Set(complete).size, complete.length);
	}
});
