/**
 * Keep the complete Core contract bounded without truncating its evidence checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	collectCoreContractTestPaths, collectRepositoryTestPaths
	, coreContractShardLabels
	, coreContractShardManifest, verifyCoreContractShardManifests
} from "../../scripts/core-contract-shards.mjs";

const assertCoreQualityBudget = source => {
	const timeouts = [...source.matchAll(/^\s+timeout-minutes:\s*(\d+)\s*$/gmu)]
		.map(match => Number(match[1]));
	assert.deepEqual(timeouts, [30, 180, 10]
		, "Static, contract-shard, and aggregate jobs retain explicit bounds");
	assert.match(source
		, /strategy:\n {6}fail-fast: false\n {6}matrix:\n {8}shard: \[1, 2, 3, 4, 5, 6\]/u
		, "Core must run one closed six-shard matrix without cancelling siblings");
	assert.match(source, /name: Contract shard \$\{\{ matrix\.shard \}\}\/6/u
		, "Every shard must expose its fixed denominator in the hosted job name");
	assert.equal([...source.matchAll(/^\s+npm run env:check:core\s*$/gmu)].length, 1
		, "Core inventory must execute exactly once");
	assert.equal([...source.matchAll(/^\s+npm run lint\s*$/gmu)].length, 1
		, "Core lint must execute exactly once");
	assert.equal([...source.matchAll(/^\s+npm run typecheck\s*$/gmu)].length, 1
		, "Core checked JavaScript must execute exactly once");
	assert.equal([...source.matchAll(/^\s+bash scripts\/run-test-profile\.sh contract \\\n\s+--shard "\$\{\{ matrix\.shard \}\}\/6" \\\n\s+--shard-manifest "build\/core-shards\/core-shard-\$\{\{ matrix\.shard \}\}\.json"\s*$/gmu)].length, 1
		, "Every matrix cell must execute its exact contract shard");
	assert.doesNotMatch(source, /^\s+npm run check:core\s*$/mu
		, "Static checks and contract shards must not be recombined in one timed job");
	assert.equal([...source.matchAll(/^\s+fetch-depth:\s*0\s*$/gmu)].length, 2
		, "Static and contract jobs must retain all producer history");
	assert.equal([...source.matchAll(/^\s+fetch-depth:\s*1\s*$/gmu)].length, 1
		, "The aggregate must recompute closure from the exact current tree");
	assert.equal([...source.matchAll(/^\s+persist-credentials:\s*false\s*$/gmu)].length, 3
		, "No checkout may persist credentials");
	assert.match(source, /if: always\(\)\n {8}uses: actions\/upload-artifact@v7/u);
	assert.match(source, /if-no-files-found: error/u);
	assert.match(source, /overwrite: true/u);
	assert.match(source, /uses: actions\/download-artifact@v8/u);
	assert.match(source, /pattern: core-shard-\*-\$\{\{ github\.sha \}\}/u);
	assert.match(source, /merge-multiple: true/u);
	assert.equal([...source.matchAll(/^\s+run: node scripts\/check-core-contract-shards\.mjs build\/core-shards\s*$/gmu)].length, 1
		, "The aggregate must authenticate shard closure before accepting results");
	assert.match(source, / {2}quality:\n {4}name: quality\n {4}if: always\(\)\n {4}needs: \[static, contract\]/u
		, "The stable quality check must aggregate static and every matrix result");
	assert.match(source, /STATIC_RESULT: \$\{\{ needs\.static\.result \}\}/u);
	assert.match(source, /CONTRACT_RESULT: \$\{\{ needs\.contract\.result \}\}/u);
	assert.equal([...source.matchAll(/^\s+test "\$STATIC_RESULT" = success\s*$/gmu)].length, 1);
	assert.equal([...source.matchAll(/^\s+test "\$CONTRACT_RESULT" = success\s*$/gmu)].length, 1);
	assert.ok(!/^\s+continue-on-error:\s*true\s*$/mu.test(source), "Core quality failures must remain fatal");
};

const assertCoreProcessBudget = (source, shards) => {
	assert.equal([...source.matchAll(/requested === "contract" && process\.env\.CI === "true"/gu)].length, 1
		, "Only the hosted Core profile must use the resource bound");
	assert.equal([...source.matchAll(/"--test-concurrency=2"/gu)].length, 1
		, "Hosted Core must run at most two contract files concurrently");
	assert.match(source, /arguments_\.length !== 4 \|\| arguments_\[0\] !== "--shard"/u);
	assert.match(source, /arguments_\[2\] !== "--shard-manifest" \|\| requested !== "contract"/u
		, "Only the complete contract profile may emit a shard manifest");
	assert.match(source, /const manifest = shard \? coreContractShardManifest\(complete, shard\) : null/u);
	assert.match(source, /const selected = manifest\?\.selection\.files \?\? complete/u
		, "The runner must execute the exact authenticated selection");
	assert.match(source, /await writeFile\(shardManifestPath, canonicalJson\(manifest\)\)/u);
	assert.match(shards, /export const coreContractShardCount = 6;/u);
	assert.match(shards, /position % coreContractShardCount === index - 1/u);
	assert.match(shards, /assert\.deepEqual\(files\.toSorted\(\), paths\)/u
		, "The aggregate must require a disjoint full-file union");
	assert.equal([...source.matchAll(/"--max-old-space-size=4096"/gu)].length, 1
		, "Each hosted Core process must have a visible 4 GiB heap failure bound");
	assert.match(source, /const childEnvironment = boundedHostedCore \? \{\n\t\.\.\.process\.env\n\t, NODE_OPTIONS:/u
		, "Hosted Core must bound only the hosted contract environment");
	assert.match(source, /NODE_OPTIONS: \[process\.env\.NODE_OPTIONS, "--max-old-space-size=4096"\]\s*\.filter\(Boolean\)\.join\(" "\)/u
		, "Hosted Core must preserve prior Node options and append its reviewed heap bound");
	assert.match(source, /"--test", \.\.\.boundedHostedCore \? \["--test-concurrency=2"\] : \[\], \.\.\.selected\n\]/u
		, "Hosted Core must pass every explicitly selected shard file to Node");
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
	, "tests/checked-record-value-index-php-wasm.test.mjs": [
		"checked-record-value-index-php-wasm-fixture-tests.mjs"
		, "checked-record-value-index-php-wasm-lean-tests.mjs"
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

test("Core quality has bounded static, sharded contract, and aggregate gates", async () => {
	const source = await readFile(".github/workflows/quality.yml", "utf8");
	assertCoreQualityBudget(source);
	for(const [index, changed] of [
		source.replace("timeout-minutes: 180", "timeout-minutes: 90")
		, source.replace("shard: [1, 2, 3, 4, 5, 6]", "shard: [1, 2, 3, 4, 5]")
		, source.replace("shard: [1, 2, 3, 4, 5, 6]", "shard: [1, 2, 3, 4, 5, 5]")
		, source.replace("${{ matrix.shard }}/6", "${{ matrix.shard }}/5")
		, source.replace("fail-fast: false", "fail-fast: true")
		, source.replace("npm run env:check:core", "npm run lint")
		, source.replace("npm run typecheck", "npm run lint")
		, source.replace('--shard "${{ matrix.shard }}/6"'
			, '--test-name-pattern "${{ matrix.shard }}/6"')
		, source.replace("fetch-depth: 0", "fetch-depth: 1")
		, source.replace("persist-credentials: false", "persist-credentials: true")
		, source.replace("needs: [static, contract]", "needs: [static]")
		, source.replace("if: always()", "if: success()")
		, source.replace("merge-multiple: true", "merge-multiple: false")
		, source.replace("overwrite: true", "overwrite: false")
		, source.replace("check-core-contract-shards.mjs", "snapshot-core-contract-shards.mjs")
		, source.replace('test "$CONTRACT_RESULT" = success', "true")
		, source.replace("        run: |\n          source scripts/env.sh\n", "        continue-on-error: true\n        run: |\n          source scripts/env.sh\n")
	].entries()) {
		assert.notEqual(changed, source, `workflow mutation ${index}`);
		assert.throws(() => assertCoreQualityBudget(changed), undefined
			, `workflow mutation ${index}`);
	}
});

test("Hosted Core bounds each closed shard without truncating the profile", async () => {
	const [source, shards] = await Promise.all([
		readFile("scripts/run-test-profile.mjs", "utf8")
		, readFile("scripts/core-contract-shards.mjs", "utf8")
	]);
	assertCoreProcessBudget(source, shards);
	for(const [index, changed] of [
		source.replace("--test-concurrency=2", "--test-concurrency=3")
		, source.replace("--max-old-space-size=4096", "--max-old-space-size=8192")
		, source.replace('arguments_[2] !== "--shard-manifest"', 'arguments_[2] !== "--optional-manifest"')
		, source.replace('requested !== "contract"', 'requested !== "all"')
		, source.replace("manifest?.selection.files", "complete.slice(0, 10)")
		, source.replace("canonicalJson(manifest)", '"accepted"')
		, source.replace(" && process.env.CI === \"true\"", "")
		, source.replace("...selected", "...selected.slice(0, 10)")
		, source.replace("env: childEnvironment", "env: process.env")
		, source.replace("boundedHostedCore ? {", "!boundedHostedCore ? {")
		, source.replace("[process.env.NODE_OPTIONS, \"--max-old-space-size=4096\"]"
			, "[\"--max-old-space-size=4096\", process.env.NODE_OPTIONS]")
		, source.replace("...boundedHostedCore ? [\"--test-concurrency=2\"] : []", "...[]")
	].entries()) {
		assert.notEqual(changed, source, `runner mutation ${index}`);
		assert.throws(() => assertCoreProcessBudget(changed, shards), undefined
			, `runner mutation ${index}`);
	}
});

test("Core shard enumeration has one repository-wide code-unit order", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-core-shards-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await mkdir(join(root, "tests", "internal"), { recursive: true });
	for(const path of [
		"tests/a_b.test.mjs", "tests/a-b.test.mjs"
		, "tests/internal/z.test.mjs", "tests/internal-x.test.mjs"
	]) {
		await writeFile(join(root, path), "");
	}
	assert.deepEqual(await collectRepositoryTestPaths(root), [
		"tests/a-b.test.mjs", "tests/a_b.test.mjs"
		, "tests/internal-x.test.mjs", "tests/internal/z.test.mjs"
	]);
});

test("Core shard manifests cover every contract file exactly once", async () => {
	const paths = await collectCoreContractTestPaths();
	assert.ok(paths.length > 800);
	const manifests = coreContractShardLabels.map(label =>
		coreContractShardManifest(paths, label));
	const accepted = verifyCoreContractShardManifests(paths, manifests);
	assert.deepEqual(accepted, {
		schemaVersion: 1, partition: "sorted-index-modulo-v1", shards: 6
		, contractFiles: paths.length, contractSha256: manifests[0].contract.sha256
	});
	assert.deepEqual(manifests.map(item => item.selection.count)
		, Array.from({ length: 6 }, (_, index) =>
			Math.ceil((paths.length - index) / 6)));
	for(const mutate of [
		values => values.pop()
		, values => { values[5] = structuredClone(values[4]); }
		, values => { values[0].selection.files[0] = values[1].selection.files[0]; }
		, values => { values[0].contract.sha256 = "0".repeat(64); }
		, values => { values[0].unexpected = true; }
	]) {
		const changed = structuredClone(manifests); mutate(changed);
		assert.throws(() => verifyCoreContractShardManifests(paths, changed));
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
	assert.equal(observed.length, 47);
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
