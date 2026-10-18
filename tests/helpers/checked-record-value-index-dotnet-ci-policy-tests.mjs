/**
 * Refuse ambiguous CI selections and incomplete value-index .NET TAP.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkedRecordValueIndexDotnetCiTestName
	, assertCheckedRecordValueIndexDotnetCiTap
	, parseCheckedRecordValueIndexDotnetCiArgs
} from "./checked-record-value-index-dotnet-ci-report.mjs";
import {
	checkedRecordValueIndexDotnetRoutes
} from "./checked-record-value-index-dotnet-fixture.mjs";

const argsOf = options => Object.entries(options)
	.flatMap(([key, value]) => ["--" + key, value]);
const options = {
	route: "ordinary-source", producer: "a".repeat(40)
	, consumer: "b".repeat(40), directory: "records", tap: "run.tap"
	, glibc: "2.38", dotnet: "/runtime/dotnet"
};
const completeTap = route => {
	const name = checkedRecordValueIndexDotnetCiTestName(route)
		.replace("#", "\\#");
	return `TAP version 13\n# Subtest: ${name}\nok 1 - ${name}\n  ---\n  duration_ms: 1\n  type: 'test'\n  ...\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 2\n`;
};

test("value-index .NET CI selects one closed route and two exact revisions"
	, () => {
		const args = argsOf(options);
		assert.deepEqual(parseCheckedRecordValueIndexDotnetCiArgs(args), options);
		for(const key of Object.keys(options))
		{
			assert.throws(() => parseCheckedRecordValueIndexDotnetCiArgs(argsOf(
				Object.fromEntries(Object.entries(options)
					.filter(([name]) => name !== key))
			)));
			assert.throws(() => parseCheckedRecordValueIndexDotnetCiArgs([
				...args, "--" + key, options[key]
			]));
			for(const value of ["", "--other", "bad\0value"])
				assert.throws(() => parseCheckedRecordValueIndexDotnetCiArgs(
					argsOf({ ...options, [key]: value })
				));
		}
		for(const changed of [
			{ route: "ordinary-source,reviewed-ir" }, { route: "unknown" }
			, { producer: "a".repeat(39) }, { producer: "G".repeat(40) }
			, { consumer: "b".repeat(39) }, { consumer: "G".repeat(40) }
			, { glibc: "2.36" }, { glibc: "2.39" }
			, { dotnet: "dotnet" }, { unknown: "value" }
		]) assert.throws(() => parseCheckedRecordValueIndexDotnetCiArgs(
			argsOf({ ...options, ...changed })
		));
	}
);

test("value-index .NET CI requires exact zero-skip terminal TAP", t => {
	let controls = 0;
	for(const route of checkedRecordValueIndexDotnetRoutes)
	{
		const source = completeTap(route);
		assertCheckedRecordValueIndexDotnetCiTap(source, route);
		for(const changed of [
			source.replace("TAP version 13\n", "")
			, source.replace("ok 1 -", "not ok 1 -")
			, source.replace("ok 1 -", "ok 2 -")
			, source.replace("1..1\n", "1..2\n")
			, source.replace("# skipped 0", "# skipped 1")
			, source.replace("# Subtest:", "# Wrong:")
			, source + "Bail out! stopped\n"
			, source + "# TODO later\n"
			, source + "incomplete\n"
		]) {
			assert.throws(() =>
				assertCheckedRecordValueIndexDotnetCiTap(changed, route));
			controls++;
		}
		const other = checkedRecordValueIndexDotnetRoutes.find(
			candidate => candidate !== route
		);
		assert.throws(() =>
			assertCheckedRecordValueIndexDotnetCiTap(source, other));
		controls++;
	}
	t.diagnostic(`${controls} incomplete, mismatched, skipped, or failed TAP controls`);
});

test("hosted value-index .NET checker replays the complete control suite"
	, async () => {
		const source = await readFile(
			"scripts/check-checked-record-value-index-dotnet-ci.mjs", "utf8"
		);
		assert.match(source
			, /await checkCheckedRecordValueIndexDotnetControls\(read,/u);
		assert.match(source, /Controls begin and end at the accepted record set/u);
		assert.doesNotMatch(source, /representative|controls:\s*"none"/u);
	}
);
