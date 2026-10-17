/**
 * Keep the complete Core contract bounded without truncating its evidence checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const assertCoreQualityBudget = source => {
	const timeouts = [...source.matchAll(/^\s+timeout-minutes:\s*(\d+)\s*$/gmu)];
	assert.equal(timeouts.length, 1, "Core quality must have one explicit job timeout");
	assert.equal(Number(timeouts[0][1]), 180, "Core quality must retain its reviewed 180-minute bound");
	assert.equal([...source.matchAll(/^\s+npm run check:core\s*$/gmu)].length, 1
		, "Core quality must execute the complete check:core contract exactly once");
	assert.equal([...source.matchAll(/^\s+fetch-depth:\s*0\s*$/gmu)].length, 1
		, "Core quality must retain all producer history");
	assert.equal([...source.matchAll(/^\s+persist-credentials:\s*false\s*$/gmu)].length, 1
		, "Core quality checkout must not persist credentials");
	assert.ok(!/^\s+continue-on-error:\s*true\s*$/mu.test(source), "Core quality failures must remain fatal");
};

const assertCoreProcessBudget = source => {
	assert.equal([...source.matchAll(/requested === "contract" && process\.env\.CI === "true"/gu)].length, 1
		, "Only the hosted Core profile must use the resource bound");
	assert.equal([...source.matchAll(/"--test-concurrency=2"/gu)].length, 1
		, "Hosted Core must run at most two contract files concurrently");
	assert.equal([...source.matchAll(/"--max-old-space-size=4096"/gu)].length, 1
		, "Each hosted Core process must have a visible 4 GiB heap failure bound");
	assert.match(source, /const childEnvironment = boundedHostedCore \? \{\n\t\.\.\.process\.env\n\t, NODE_OPTIONS:/u
		, "Hosted Core must bound only the hosted contract environment");
	assert.match(source, /NODE_OPTIONS: \[process\.env\.NODE_OPTIONS, "--max-old-space-size=4096"\]\s*\.filter\(Boolean\)\.join\(" "\)/u
		, "Hosted Core must preserve prior Node options and append its reviewed heap bound");
	assert.match(source, /"--test", \.\.\.boundedHostedCore \? \["--test-concurrency=2"\] : \[\], \.\.\.selected\s*\]/u
		, "Hosted Core must execute every selected contract test under the bound");
	assert.match(source, /\], \{ cwd: root, env: childEnvironment, stdio: "inherit" \}\);/u
		, "Hosted Core must spawn the child with the bounded environment");
};

const checkedRecordEvidencePartitions = Object.freeze({
	"tests/checked-record-native-history.test.mjs": [
		"checked-record-native-host-tests.mjs"
		, "checked-record-native-host-history-tests.mjs"
		, "checked-record-native-fixture-tests.mjs"
		, "checked-record-native-installed-tests.mjs"
		, "checked-record-native-installed-history-tests.mjs"
	]
	, "tests/checked-record-native-archives.test.mjs": [
		"checked-record-python-archive-tests.mjs"
		, "checked-record-python-history-tests.mjs"
		, "checked-record-ruby-jvm-archive-tests.mjs"
		, "checked-record-ruby-jvm-history-tests.mjs"
		, "checked-record-remaining-hosts-archive-tests.mjs"
	]
	, "tests/checked-record-native-ci.test.mjs": [
		"checked-record-remaining-hosts-history-tests.mjs"
		, "checked-record-host-ci-report-tests.mjs"
		, "checked-record-host-ci-shell-tests.mjs"
		, "checked-record-native-promotion-tests.mjs"
	]
	, "tests/checked-record-perl-acceptance.test.mjs": [
		"checked-record-perl-source-tests.mjs"
		, "checked-record-perl-fixture-tests.mjs"
		, "checked-record-perl-history-tests.mjs"
		, "checked-record-perl-installed-source-tests.mjs"
		, "checked-record-perl-installed-tests.mjs"
		, "checked-record-perl-installed-history-tests.mjs"
	]
	, "tests/checked-record-browser-foundation.test.mjs": [
		"checked-record-browser-tests.mjs"
		, "checked-record-browser-installed-tests.mjs"
		, "checked-record-browser-history-tests.mjs"
		, "checked-record-browser-evidence-tests.mjs"
		, "checked-record-browser-archive-history-tests.mjs"
	]
	, "tests/checked-record-browser-ci.test.mjs": [
		"checked-record-browser-ci-tests.mjs"
		, "checked-record-browser-ci-shell-tests.mjs"
		, "checked-record-browser-ci-workflow-tests.mjs"
		, "checked-record-browser-ci-history-tests.mjs"
	]
	, "tests/checked-record-browser-promotion.test.mjs": [
		"checked-record-browser-promotion-tests.mjs"
		, "checked-record-browser-promotion-history-tests.mjs"
	]
	, "tests/checked-record-php-wasm-foundation.test.mjs": [
		"checked-record-php-wasm-tests.mjs"
		, "checked-record-php-wasm-caller-control-tests.mjs"
		, "checked-record-php-wasm-lean-tests.mjs"
		, "checked-record-php-wasm-reconcile-tests.mjs"
		, "checked-record-php-wasm-installed-tests.mjs"
	]
	, "tests/checked-record-php-wasm-evidence-ci.test.mjs": [
		"checked-record-php-wasm-history-tests.mjs"
		, "checked-record-php-wasm-evidence-tests.mjs"
		, "checked-record-php-wasm-archive-history-tests.mjs"
		, "checked-record-php-wasm-ci-tests.mjs"
		, "checked-record-php-wasm-ci-shell-tests.mjs"
	]
	, "tests/checked-record-php-wasm-promotion.test.mjs": [
		"checked-record-php-wasm-ci-workflow-tests.mjs"
		, "checked-record-php-wasm-ci-history-tests.mjs"
		, "checked-record-php-wasm-promotion-tests.mjs"
		, "checked-record-php-wasm-promotion-history-tests.mjs"
	]
});

test("Core quality has a bounded budget for the complete evidence contract", async () => {
	const source = await readFile(".github/workflows/quality.yml", "utf8");
	assertCoreQualityBudget(source);
	for(const changed of [
		source.replace("timeout-minutes: 180", "timeout-minutes: 90")
		, source.replace("timeout-minutes: 180", "timeout-minutes: 179")
		, source.replace("timeout-minutes: 180", "timeout-minutes: 181")
		, source.replace("    timeout-minutes: 180\n", "")
		, source.replace("    timeout-minutes: 180\n", "    timeout-minutes: 180\n    timeout-minutes: 180\n")
		, source.replace("npm run check:core", "npm run lint")
		, source.replace("npm run check:core", "npm run check:core -- --test-name-pattern smoke")
		, source.replace("fetch-depth: 0", "fetch-depth: 1")
		, source.replace("persist-credentials: false", "persist-credentials: true")
		, source.replace("        run: |\n          source scripts/env.sh\n", "        continue-on-error: true\n        run: |\n          source scripts/env.sh\n")
	]) {
		assert.notEqual(changed, source);
		assert.throws(() => assertCoreQualityBudget(changed));
	}
});

test("Hosted Core bounds concurrent history replay without truncating the profile", async () => {
	const source = await readFile("scripts/run-test-profile.mjs", "utf8");
	assertCoreProcessBudget(source);
	for(const changed of [
		source.replace("--test-concurrency=2", "--test-concurrency=3")
		, source.replace("--max-old-space-size=4096", "--max-old-space-size=8192")
		, source.replace(" && process.env.CI === \"true\"", "")
		, source.replace("...selected", "...selected.slice(0, 10)")
		, source.replace("env: childEnvironment", "env: process.env")
		, source.replace("boundedHostedCore ? {", "!boundedHostedCore ? {")
		, source.replace("[process.env.NODE_OPTIONS, \"--max-old-space-size=4096\"]"
			, "[\"--max-old-space-size=4096\", process.env.NODE_OPTIONS]")
		, source.replace("...boundedHostedCore ? [\"--test-concurrency=2\"] : []", "...[]")
	]) {
		assert.notEqual(changed, source);
		assert.throws(() => assertCoreProcessBudget(changed));
	}
});

test("checked-record evidence runs in bounded process-isolated partitions", async () => {
	const aggregate = await readFile("tests/checked-records.test.mjs", "utf8");
	assert.doesNotMatch(aggregate, /import "\.\/helpers\/checked-record-/u);
	const observed = [];
	for(const [path, expected] of Object.entries(
		checkedRecordEvidencePartitions
	)) {
		const source = await readFile(path, "utf8");
		const imports = [...source.matchAll(
			/^import "\.\/helpers\/(checked-record-[^"]+-tests\.mjs)";$/gmu
		)].map(match => match[1]);
		assert.deepEqual(imports, expected, path);
		assert.ok(imports.length > 0 && imports.length <= 6, path);
		observed.push(...imports);
	}
	assert.equal(new Set(observed).size, observed.length);
	assert.equal(observed.length, 45);
});

test("recursive checked-record whitespace rules stay inside each archive", async () => {
	const root = await readFile(".gitattributes", "utf8");
	assert.doesNotMatch(root, /recursive-checked-record-(?:wit|rust|php)-20261017/u);
	const attributes = {
		"docs/evidence/recursive-checked-record-wit-20261017/.gitattributes": "# Preserve byte-authenticated package outputs without normalizing producer whitespace.\n*-mutual/records/package/share/lean-bridge/component/generated.lean whitespace=-blank-at-eol\n*/records/package/share/lean-bridge/licenses/Lean-LICENSE whitespace=-blank-at-eof\n*/records/package/share/lean-bridge/licenses/Wasmtime-LICENSE whitespace=-blank-at-eof\n*/records/package/src/*_wasmtime.c whitespace=-blank-at-eof\n"
		, "docs/evidence/recursive-checked-record-rust-20261017/.gitattributes": "# Preserve byte-authenticated package outputs without normalizing producer whitespace.\n*-mutual/records/package/lean-bridge/component/generated.lean whitespace=-blank-at-eol\n*/records/package/lean-bridge/licenses/Lean-LICENSE whitespace=-blank-at-eof\n"
		, "docs/evidence/recursive-checked-record-php-20261017/.gitattributes": "# Preserve byte-authenticated package and installation outputs.\n*/records/installation/vendor/composer/autoload_static.php whitespace=-blank-at-eol\n*-mutual/records/package/lean-bridge/component/generated.lean whitespace=-blank-at-eol\n*/records/package/licenses/Lean-LICENSE whitespace=-blank-at-eof\n*/records/package/src/Internal/GraphNative.php whitespace=-blank-at-eof\n"
	};
	for(const [path, expected] of Object.entries(attributes))
		assert.equal(await readFile(path, "utf8"), expected, path);
	const paths = [
		"docs/evidence/recursive-checked-record-wit-20261017/ordinary-mutual/records/package/share/lean-bridge/component/generated.lean"
		, "docs/evidence/recursive-checked-record-wit-20261017/ordinary-mutual/records/package/share/lean-bridge/licenses/Lean-LICENSE"
		, "docs/evidence/recursive-checked-record-wit-20261017/ordinary-mutual/records/package/src/mutualcheckedrecords_wasmtime.c"
		, "docs/evidence/recursive-checked-record-rust-20261017/ordinary-mutual/records/package/lean-bridge/component/generated.lean"
		, "docs/evidence/recursive-checked-record-php-20261017/ordinary-mutual/records/installation/vendor/composer/autoload_static.php"
		, "docs/evidence/recursive-checked-record-php-20261017/ordinary-mutual/records/package/src/Internal/GraphNative.php"
		, "docs/evidence/recursive-checked-record-php-20261017/index.json"
	];
	const values = ["-blank-at-eol", "-blank-at-eof", "-blank-at-eof"
		, "-blank-at-eol", "-blank-at-eol", "-blank-at-eof", "unspecified"];
	const output = execFileSync("git", ["check-attr", "whitespace", "--", ...paths]
		, { encoding: "utf8" }).trim().split("\n");
	assert.deepEqual(output, paths.map((path, index) =>
		`${path}: whitespace: ${values[index]}`));
});
