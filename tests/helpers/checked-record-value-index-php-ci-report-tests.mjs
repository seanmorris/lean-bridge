/**
 * Fast negative controls for the hosted value-index native-PHP checker.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertCheckedRecordValueIndexPhpCiTap, checkedRecordValueIndexPhpCiTestName
	, parseCheckedRecordValueIndexPhpCiArgs
} from "./checked-record-value-index-php-ci-report.mjs";

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
	, "--glibc"
	, "2.38"
	, "--php"
	, "/nix/store/php/bin/php"
	, "--composer"
	, "/nix/store/composer/bin/composer"
	, "--php-version"
	, "8.3.24"
	, "--composer-version"
	, "2.8.11"
];
const tap = `TAP version 13\n# Subtest: ${checkedRecordValueIndexPhpCiTestName(route)}\nok 1 - ${checkedRecordValueIndexPhpCiTestName(route)}\n  ---\n  duration_ms: 1\n  type: 'test'\n  ...\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 1\n`;

test("value-index PHP CI checker closes arguments and zero-skip TAP", () => {
	assert.deepEqual(parseCheckedRecordValueIndexPhpCiArgs(args), {
		route
		, producer: "a".repeat(40)
		, directory: "/records"
		, tap: "/records/run.tap"
		, glibc: "2.38"
		, php: "/nix/store/php/bin/php", composer: "/nix/store/composer/bin/composer"
		, "php-version": "8.3.24", "composer-version": "2.8.11"
	});
	assertCheckedRecordValueIndexPhpCiTap(tap, route);
	assert.throws(() => parseCheckedRecordValueIndexPhpCiArgs(args.slice(0, -2)));
	assert.throws(() => assertCheckedRecordValueIndexPhpCiTap(tap.replace("# skipped 0", "# skipped 1"), route));
});

test("value-index PHP workflow uses one bounded all-route acceptance gate", async () => {
	const source = await readFile(".github/workflows/checked-record-value-index-php.yml", "utf8");
	assert.ok(source.startsWith("name: Installed value-index checked records in native PHP\n"));
	assert.ok(source.includes("group: checked-record-value-index-php-${{ github.ref }}\n"));
	assert.ok(source.includes("timeout-minutes: 210\n"));
	assert.ok(source.includes("timeout-minutes: 150\n"));
	assert.ok(source.includes("bash scripts/run-checked-record-value-index-php-ci.sh"));
	assert.ok(source.includes("if: always() && steps.acceptance.outcome != 'success'\n        run: exit 1\n"));
	assert.doesNotMatch(source, /continue-on-error:|set \+e|\|\| true/u);
});
