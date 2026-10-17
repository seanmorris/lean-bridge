/**
 * Source-only controls for the recursive checked-record native PHP caller. Genuine generated
 * value classes and host checks run here; no compiled Lean library or installed package does.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { bundledBrickMath } from "../../src/backends/php/brick-math.mjs";
import { generateCopiedPhpGraphPackage } from "../../src/backends/php/copied-graph-package.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { mutualCheckedRecordConfiguration } from "./mutual-checked-record-fixture.mjs";
import { recursiveCheckedRecordConfiguration } from "./recursive-checked-record-fixture.mjs";
import {
	parseRecursiveCheckedRecordPhpResult, recursiveCheckedRecordPhpCaller
	, recursiveCheckedRecordPhpConfiguration
	, recursiveCheckedRecordPhpCounts, recursiveCheckedRecordPhpPackage
	, recursiveCheckedRecordPhpReview, recursiveCheckedRecordPhpSelection
} from "./recursive-checked-record-php-fixture.mjs";
import { assertRecursiveCheckedRecordPhpResources } from "./recursive-checked-record-php-resources.mjs";
import {
	assertRecursiveCheckedRecordPhpGraphIdentity
} from "./recursive-checked-record-php-package.mjs";

export const recursiveCheckedRecordPhpModuleFaults = Object.freeze({
	recursive: Object.freeze(["second-normalizes-root-only"])
	, mutual: Object.freeze(["stop-as-none"])
});
export const recursiveCheckedRecordPhpFaults = Object.freeze([
	"produce-offset", "produce-single", "produce-digits", "accept-int"
	, "accept-keyed", "wrong-host-exception", "missing-fin"
	, "missing-normalization", "conflated-constructor", "diagnostic-suffix"
	, "wrong-status", "wrong-path", "root-only", "echo-unnormalized"
	, "echo-drops-tail", "cycle-as-lean", "depth-unbounded", "shared-as-cycle"
	, "groups-drop-none", "echo-groups-drops-none", "poison-after-reject"
]);
const php = resolve(process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php");

test("recursive checked-record PHP caller detects every result, input and cycle fault in an oracle", async t => {
	if(await access(php).then(() => false, () => true))
	{
		t.skip(`PHP is unavailable at ${php}`);
		return;
	}
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-recursive-php-model-"));
	t.after(() => rm(root, { recursive: true }));
	const caller = await readFile(recursiveCheckedRecordPhpCaller, "utf8");
	await saveLakeFile(root, "consumer.php", caller);
	for(const [path, text] of Object.entries(bundledBrickMath())) await saveLakeFile(root, path, text);
	const apis = [];
	for(const fixture of ["recursive", "mutual"])
	{
		const files = generateCopiedPhpGraphPackage(recursiveCheckedRecordPhpReview(fixture), null, { refinementDiagnostics: true });
		for(const [path, text] of Object.entries(files)) await saveLakeFile(root, `${fixture}/${path}`, text);
		apis.push(join(root, fixture, "src/Api.php"));
	}
	const model = resolve("tests/helpers/recursive-checked-record-php-model.php");
	const brick = join(root, "dependencies/brick-math/autoload.php");
	const run = await runCopied(php, ["-d", "display_errors=stderr", model
		, join(root, "consumer.php"), brick, ...apis], root);
	assert.equal(run.stderr, "");
	const result = JSON.parse(run.stdout);
	assert.equal(result.installedAcceptance, false);
	assert.deepEqual(result.results, [recursiveCheckedRecordPhpCounts.recursive, recursiveCheckedRecordPhpCounts.mutual]);
	assert.deepEqual(result.rejectedFaults, Object.fromEntries(["recursive", "mutual"].map(fixture =>
		[fixture, [...recursiveCheckedRecordPhpFaults, ...recursiveCheckedRecordPhpModuleFaults[fixture], "alias-constant"]])));
	assert.equal(await readFile(join(root, "consumer.php"), "utf8"), caller);
	t.diagnostic("A PHP runtime double exercises the caller with generated value classes and host checks; no installed Lean library executes.");
});

test("recursive checked-record PHP keeps both author contracts and Composer coordinates", () => {
	const base = { recursive: recursiveCheckedRecordConfiguration, mutual: mutualCheckedRecordConfiguration };
	for(const route of ["ordinary", "reviewed"]) for(const fixture of ["recursive", "mutual"])
	{
		const expected = base[fixture](route);
		const actual = recursiveCheckedRecordPhpConfiguration(route, fixture);
		validateExportConfiguration(actual);
		assert.deepEqual({ ...actual, targets: expected.targets }, expected);
		assert.deepEqual(actual.targets, { "php-native": { name: `example/${fixture}checkedrecords`, version: "1.0.0" } });
		const pkg = recursiveCheckedRecordPhpPackage(fixture);
		assert.equal(pkg.namespace, `Lean${fixture[0].toUpperCase()}${fixture.slice(1)}checkedrecords`);
		const source = generateCopiedPhpGraphPackage(recursiveCheckedRecordPhpReview(fixture))["src/Api.php"];
		assert.match(source, new RegExp(`^namespace ${pkg.namespace};$`, "mu"));
		assert.deepEqual([...source.matchAll(/^function ([a-z_]+)\(/gmu)].map(match => match[1])
			, ["first", "second", "echo_", "groups", "echo_groups", "produce"]);
	}
	const caller = readFileSync(recursiveCheckedRecordPhpCaller, "utf8");
	// The installer derives strict.php from the weak caller, and the package selects the module.
	assert.equal(caller.match(/^declare\(strict_types=0\);$/gmu).length, 1);
	assert.match(caller, /if \(\$argc !== 1\) throw new InvalidArgumentException/u);
	for(const fixture of ["recursive", "mutual"])
	{
		const counts = recursiveCheckedRecordPhpCounts[fixture];
		const stdout = `${JSON.stringify(Object.fromEntries(Object.entries(counts).sort()))}\n`;
		assert.deepEqual(parseRecursiveCheckedRecordPhpResult(stdout, fixture), counts);
		for(const key of Object.keys(counts).filter(key => key !== "module"))
			assert.throws(() => parseRecursiveCheckedRecordPhpResult(stdout.replace(`"${key}":${counts[key]}`
				, `"${key}":${counts[key] + 1}`), fixture));
		assert.throws(() => parseRecursiveCheckedRecordPhpResult(stdout.replace("{", "{\"extra\":1,"), fixture));
	}
	assert.throws(() => recursiveCheckedRecordPhpPackage("unknown"));
});

test("recursive checked-record PHP requires the canonical non-callable graph shape", () => {
	assert.doesNotThrow(() => assertRecursiveCheckedRecordPhpGraphIdentity({
		copiedGraph: { schemaVersion: 1, types: [], exports: [] }
	}));
	for(const copiedGraph of [undefined, null, false, { callbacks: false }
		, { callbacks: true }, { callbacks: [] }])
		assert.throws(() => assertRecursiveCheckedRecordPhpGraphIdentity({ copiedGraph }));
});

test("recursive checked-record PHP gates reject disabled selections and unsupported modules", () => {
	const prefix = "LEAN_BRIDGE_RECURSIVE_CHECKED_RECORD_PHP_", enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(recursiveCheckedRecordPhpSelection({}), {
		enabled: false, routes: ["ordinary", "reviewed"]
		, fixtures: ["recursive", "mutual"], maxLoad: 8
	});
	for(const flag of ["", "true", "2", true, null])
		assert.throws(() => recursiveCheckedRecordPhpSelection({ [prefix + "TEST"]: flag }));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["FIXTURES", "recursive"]])
	{
		for(const raw of ["", "unknown", `${valid},`, `${valid},${valid}`, true, null])
			assert.throws(() => recursiveCheckedRecordPhpSelection({ ...enabled, [prefix + name]: raw }));
		for(const flag of [undefined, "0"])
			assert.throws(() => recursiveCheckedRecordPhpSelection({ [prefix + "TEST"]: flag, [prefix + name]: valid }));
	}
	assert.deepEqual(recursiveCheckedRecordPhpSelection({ ...enabled, [prefix + "FIXTURES"]: "mutual" }).fixtures
		, ["mutual"]);
	for(const maxLoad of [8, 12, 16, 20])
		assert.equal(recursiveCheckedRecordPhpSelection({ ...enabled, [prefix + "MAX_LOAD"]: String(maxLoad) }).maxLoad
			, maxLoad);
	for(const maxLoad of ["", "6", "24", "eight"])
		assert.throws(() => recursiveCheckedRecordPhpSelection({ ...enabled, [prefix + "MAX_LOAD"]: maxLoad }));
	const GiB = 1024 ** 3, admitted = { freeBytes: 3 * GiB, availableBytes: 4 * GiB, load: 7.5 };
	assertRecursiveCheckedRecordPhpResources({ observations: [admitted], waits: 0 }, 8);
	assert.throws(() => assertRecursiveCheckedRecordPhpResources({ observations: [{ ...admitted, load: 8 }], waits: 0 }, 8));
});
