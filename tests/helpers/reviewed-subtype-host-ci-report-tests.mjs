/**
 * Exercise the native CI report gate against original runs and deliberately broken records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { assertReviewedSubtypeHostCiRecords, assertReviewedSubtypeHostCiTap, parseReviewedSubtypeHostCiArgs, reviewedSubtypeHostCiLanes, reviewedSubtypeHostCiTestName, reviewedSubtypePerlConfigurations } from "./reviewed-subtype-host-ci-report.mjs";
import "./reviewed-subtype-host-ci-report-history-tests.mjs";
import "./reviewed-subtype-host-ci-shell-tests.mjs";

const samples = [
	...["3.11", "3.12"].map(python => ({ root: `docs/evidence/reviewed-subtype-python-hosts-20261010/${python}`, profiles: ["python"], python }))
	, ...["ruby", "jvm"].map(group => ({ root: `docs/evidence/reviewed-subtype-ruby-jvm-hosts-20261010/${group}`, profiles: group === "jvm" ? ["java", "kotlin"] : ["ruby"] }))
	, ...["rust", "dotnet", "php-native", "wit-wasi"].map(group => ({ root: `docs/evidence/reviewed-subtype-remaining-hosts-20261010/${group}`, profiles: [group] }))
	, ...reviewedSubtypePerlConfigurations.map(perl => ({ root: `docs/evidence/reviewed-subtype-remaining-hosts-20261010/perl-${perl}`, profiles: ["perl"], perl }))
];
const args = sample => [
	"--profiles", sample.profiles.join(","), "--directory", sample.root
	, "--tap", join(sample.root, "run.tap"), "--glibc", "2.36"
	, ...sample.python ? ["--python", sample.python] : []
	, ...sample.perl ? ["--perl", sample.perl] : []];
const input = async sample => ({ ...sample, glibc: "2.36", tap: await readFile(join(sample.root, "run.tap"), "utf8"), read: path => readFile(join(sample.root, path)) });
const cli = values => spawnSync(process.execPath, ["scripts/check-reviewed-subtype-host-reports.mjs", ...values], { encoding: "utf8" });

test("reviewed native CI checker accepts all twelve original runs and checks every lane", async () => {
	assert.equal(samples.length, 12);
	assert.deepEqual([...new Set(samples.map(sample => sample.profiles.join(",")))].sort(), [...reviewedSubtypeHostCiLanes].sort());
	for(const sample of samples)
	{
		assert.deepEqual(parseReviewedSubtypeHostCiArgs(args(sample)).profiles, sample.profiles);
		const report = await assertReviewedSubtypeHostCiRecords(await input(sample));
		assert.deepEqual(report.profiles, sample.profiles);
		const executed = cli(args(sample));
		assert.equal(executed.status, 0, executed.stderr);
		for(const item of report.reports) assert.ok(executed.stdout.includes(`${item.profile} ${item.checks} checks`));
	}
});

test("reviewed native CI TAP rejects skips, missing execution, repeated totals and substituted tests", async () => {
	const source = (await input(samples[0])).tap;
	assert.equal(assertReviewedSubtypeHostCiTap(source), true);
	for(const changed of ["", source + source
		, source.replace("ok 1 -", "not ok 1 -")
		, source.replaceAll(reviewedSubtypeHostCiTestName, "source-only fixture checks")
		, source.replace(/^ok 1.*\n/mu, "")
		, source.replace(/^ok 1.*$/mu, match => match + " # SKIP")
		, source.replace(/^ok 1.*$/mu, match => match + " # TODO")
		, source.replace("# pass 1", "# pass 0")
		, source.replace("# tests 1", "# tests 0")
		, source.replace("# skipped 0", "# skipped 1")
		, source.replace("# cancelled 0", "# cancelled 1")
		, source.replace("# fail 0", "# fail 1")
		, source.replace("# fail 0", "# fail 0\n# fail 0")
		, source.replace("1..1", "1..0"), source + "1..2\n", source + "Bail out!\n"
	]) assert.throws(() => assertReviewedSubtypeHostCiTap(changed));
});

test("reviewed native CI selection rejects unknown lanes, versions, missing options and duplicates", () => {
	const base = args(samples[0]);
	for(const changed of [
		[], base.slice(0, -2), [...base, "--unknown", "value"]
		, [...base, "--tap", "another.tap"]
		, base.map(value => value === "python" ? " python" : value)
		, base.map(value => value === "python" ? "python,python" : value)
		, base.map(value => value === "python" ? "rust,python" : value)
		, base.map(value => value === "3.11" ? "3.13" : value)
		, base.map(value => value === "2.36" ? "2.0" : value)
		, [...args(samples[4]), "--python", "3.11"]
		, args(samples.at(-1)).slice(0, -2)
		, [...args(samples[4]), "--perl", "5.36.3-threaded"]
		, args(samples.at(-1)).map(value => value === samples.at(-1).perl ? "5.40.0-threaded" : value)
		, base.slice(0, -1), base.map(value => value === "3.11" ? "" : value)
		, base.map(value => value === samples[0].root ? "--directory" : value)
	]) assert.throws(() => parseReviewedSubtypeHostCiArgs(changed));
	const result = cli(["--profiles", "unknown", "--directory", "missing", "--tap", "missing", "--glibc", "2.38"]);
	assert.equal(result.status, 1); assert.match(result.stderr, /Usage:/u); assert.doesNotMatch(result.stderr, /ENOENT/u);
});

test("reviewed native CI checker rejects the wrong Python floor, Perl ABI and recorded glibc floor", async () => {
	const python = await input(samples[0]);
	await assert.rejects(() => assertReviewedSubtypeHostCiRecords({ ...python, python: "3.12" }));
	for(const sample of samples.filter(sample => sample.perl))
	{
		const original = await input(sample);
		for(const perl of reviewedSubtypePerlConfigurations.filter(value => value !== sample.perl))
			await assert.rejects(() => assertReviewedSubtypeHostCiRecords({ ...original, perl }));
	}
	for(const sample of samples.filter(sample => sample.profiles.some(profile => ["ruby", "java", "dotnet", "php-native"].includes(profile))))
	{
		const original = await input(sample);
		await assert.rejects(() => assertReviewedSubtypeHostCiRecords({ ...original, glibc: "2.38" }));
	}
});

test("reviewed native CI requires complete matching records, source removal and compiler-free replay", async () => {
	const original = await input(samples[0]);
	for(const path of ["report.json", "build-0/model.json", "build-1/review.json", "build-1/package-set-receipt.json", "python.json"])
		await assert.rejects(() => assertReviewedSubtypeHostCiRecords({ ...original, read: name => name === path ? Promise.reject(new Error("missing " + name)) : original.read(name) }));
	for(const mutate of [item => { item.reproducible = false; }
		, item => { item.reports[0].checks = 0; }
		, item => { item.reports[0].sourceRemovedBeforeInstallation = false; }
		, item => { item.reports[0].offlineInstall = false; }
		, item => { item.reports[0].compilerFreeReplay = false; }
		, item => { item.reports[0].relocatedInstallation = false; }
		, item => { item.reports[0].sourceUnchangedAfterReplay = false; }
		, item => { item.builds[1].modelSha256 = "0".repeat(64); }])
		await assert.rejects(() => assertReviewedSubtypeHostCiRecords({ ...original, read: async path => {
			const bytes = await original.read(path);
			if(path !== "report.json") return bytes;
			const value = JSON.parse(bytes); mutate(value); return Buffer.from(canonicalJson(value));
		} }));
	const result = cli(args(samples[0]).map(value => value === samples[0].root ? "build/nonexistent-reviewed-subtype-records" : value));
	assert.equal(result.status, 1); assert.match(result.stderr, /ENOENT/u);
});
