/**
 * Fast negative controls for zero-payload PHP-Wasm CI TAP parsing.
 *
 * @file
 */
import assert from "node:assert/strict";
import { zeroPayloadPhpRoutes } from "./zero-payload-checked-record-php-fixture.mjs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { zeroPayloadPhpWasmSelection } from "./zero-payload-checked-record-php-wasm-fixture.mjs";
import {
	assertZeroPayloadPhpWasmCiTap
	, assertZeroPayloadPhpWasmCompilerTap
	, parseZeroPayloadPhpWasmCiArgs
} from "./zero-payload-checked-record-php-wasm-ci-report.mjs";
import { zeroPayloadPhpWasmRecords } from "./zero-payload-checked-record-php-wasm-report.mjs";
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
const installedName = value => `installed zero-payload checked records PHP-Wasm ${value} reproduce and relocate`;
const installedTap = value => `TAP version 13\n# Subtest: ${installedName(value)}\nok 1 - ${installedName(value)}\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n`;
const compilerRows = zeroPayloadPhpRoutes.map(value => {
	const selection = zeroPayloadPhpWasmSelection(value);
	return {
		sourceCompilationOnly: true
		, route: value
		, module: "ZeroPayloadCheckedRecords"
		, pointerBits: 32
		, exports: selection.expected.declarations.length
		, generatedCSha256: "a".repeat(64)
		, installedAcceptance: false
	};
});
const compilerTap = (() => {
	const names = zeroPayloadPhpRoutes.map(value =>
		`fresh Lean PHP-Wasm zero-payload checked-record ${value}`);
	return "TAP version 13\n" + names.map((name, index) => `# Subtest: ${name}\nok ${index + 1} - ${name}\n# ${JSON.stringify(compilerRows[index])}\n`).join("")
		+ "1..4\n# tests 4\n# suites 0\n# pass 4\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n";
})();

test("zero-payload PHP-Wasm CI parser closes route, producer, and zero-skip producer TAP", () => {
	assert.deepEqual(parseZeroPayloadPhpWasmCiArgs(args), {
		route
		, producer: "a".repeat(40)
		, directory: "/records"
		, tap: "/records/run.tap"
	});
	assertZeroPayloadPhpWasmCiTap(installedTap(route), route);
	for(const invalid of [
		[]
		, args.slice(0, -1)
		, [...args, "--route", route]
		, ["--route", "ordinary", ...args.slice(2)]
		, ["--route", route, "--producer", "HEAD", ...args.slice(4)]
	])
		assert.throws(() => parseZeroPayloadPhpWasmCiArgs(invalid));
	for(const changed of [installedTap(route).replace("# skipped 0", "# skipped 1")
		, installedTap(route).replace("ok 1 -", "not ok 1 -")
		, installedTap(route).replaceAll(route, "invented")
		, installedTap(route).replace("1..1", "1..2")])
		assert.throws(() => assertZeroPayloadPhpWasmCiTap(changed, route));
});

test("zero-payload PHP-Wasm compiler parser closes four fresh compiler diagnostics", () => {
	assertZeroPayloadPhpWasmCompilerTap(compilerTap);
	for(const changed of [compilerTap.replace("# tests 4", "# tests 3")
		, compilerTap.replace("generatedCSha256", "wrong")
		, compilerTap.replace('"installedAcceptance":false', '"installedAcceptance":true')
		, compilerTap.replace("1..4", "1..3")])
		assert.throws(() => assertZeroPayloadPhpWasmCompilerTap(changed));
	for(const invalid of [[], ["--bad"]])
		assert.notEqual(spawnSync(process.execPath, [
			"scripts/check-zero-payload-checked-record-php-wasm-compiler-ci.mjs"
			, ...invalid
		], { encoding: "utf8" }).status, 0);
});

test("zero-payload PHP-Wasm record closure retains the receipt sidecar and every prepared archive", async t => {
	const { receipt } = await createPackageSetHandoff(t);
	for(const selectedRoute of zeroPayloadPhpRoutes)
	{
		const fixed = zeroPayloadPhpWasmRecords(selectedRoute);
		const complete = zeroPayloadPhpWasmRecords(selectedRoute, receipt);
		assert.ok(fixed.includes("handoff/package-set-receipt.json"));
		assert.ok(fixed.includes("handoff/package-set-receipt.json.sha256"));
		assert.equal(fixed.includes("build-0/api.binding-ir.json")
			, selectedRoute.endsWith("reviewed-ir"));
		assert.deepEqual(complete.slice(fixed.length), receipt.packages.flatMap(pkg =>
			pkg.artifacts.map(artifact => "handoff/" + artifact.path)));
		assert.equal(new Set(complete).size, complete.length);
	}
});
