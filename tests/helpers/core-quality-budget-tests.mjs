/**
 * Keep the complete Core contract bounded without truncating its evidence checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import {
	collectCoreContractTestPaths, collectRepositoryTestPaths
	, coreContractShardLabels
	, coreContractShardManifest, verifyCoreContractShardManifests
} from "../../scripts/core-contract-shards.mjs";

const assertCoreQualityBudget = source => {
	const timeouts = [...source.matchAll(/^\s+timeout-minutes:\s*(\d+)\s*$/gmu)]
		.map(match => Number(match[1]));
	assert.deepEqual(timeouts, [30, 90, 240, 10]
		, "Static, type-surface, contract-shard, and aggregate jobs retain explicit bounds");
	assert.match(source
		, /strategy:\n {6}fail-fast: false\n {6}max-parallel: 6\n {6}matrix:\n {8}shard: \[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12\]/u
		, "Core must run one closed twelve-shard matrix with at most six concurrent jobs and without cancelling siblings");
	assert.match(source, /name: Contract shard \$\{\{ matrix\.shard \}\}\/12/u
		, "Every shard must expose its fixed denominator in the hosted job name");
	assert.equal([...source.matchAll(/^\s+npm run env:check:core\s*$/gmu)].length, 1
		, "Core inventory must execute exactly once");
	assert.equal([...source.matchAll(/^\s+npm run lint\s*$/gmu)].length, 1
		, "Core lint must execute exactly once");
	assert.equal([...source.matchAll(/^\s+npm run typecheck\s*$/gmu)].length, 1
		, "Core checked JavaScript must execute exactly once");
	assert.equal([...source.matchAll(/^\s+bash scripts\/run-test-profile\.sh contract \\\n\s+--shard "\$\{\{ matrix\.shard \}\}\/12" \\\n\s+--shard-manifest "build\/core-shards\/core-shard-\$\{\{ matrix\.shard \}\}\.json"\s*$/gmu)].length, 1
		, "Every matrix cell must execute its exact contract shard");
	assert.doesNotMatch(source, /^\s+npm run check:core\s*$/mu
		, "Static checks and contract shards must not be recombined in one timed job");
	assert.match(source
		, / {2}contract:\n {4}name: Contract shard \$\{\{ matrix\.shard \}\}\/12\n {4}needs: \[static, type_surface\]\n/u
		, "History-heavy contract shards must wait for static and shared evidence gates");
	assert.equal([...source.matchAll(/^\s+fetch-depth:\s*0\s*$/gmu)].length, 1
		, "Only contract shards may retain all producer history");
	assert.equal([...source.matchAll(/^\s+fetch-depth:\s*1\s*$/gmu)].length, 3
		, "Static, type-surface, and aggregate jobs must read only the exact current tree");
	const staticJob = source.slice(source.indexOf("\n  static:\n")
		, source.indexOf("\n  type_surface:\n"));
	const typeSurfaceJob = source.slice(source.indexOf("\n  type_surface:\n")
		, source.indexOf("\n  contract:\n"));
	const contractJob = source.slice(source.indexOf("\n  contract:\n")
		, source.indexOf("\n  quality:\n"));
	assert.match(staticJob, /fetch-depth: 1/u
		, "Static analysis must not download historical evidence producers");
	assert.doesNotMatch(staticJob, /fetch-depth: 0/u);
	const staticSparse = /sparse-checkout: \|\n((?: {12}\S+\n)+)/u.exec(
		staticJob);
	assert.ok(staticSparse, "Static analysis must declare its complete source roots");
	assert.deepEqual(staticSparse[1].trim().split("\n").map(line => line.trim()), [
		".github", "acceptance", "config", "containers", "demos", "nix"
		, "notices", "patches", "poc", "schema", "scripts", "site", "src"
		, "tests"
	], "Static analysis must omit only the retained documentation payload tree");
	assert.match(staticJob, /sparse-checkout-cone-mode: true/u);
	assert.doesNotMatch(staticJob, /^\s+filter:/mu
		, "Checkout must derive blob:none from the sparse source roots");
	assert.match(typeSurfaceJob, /fetch-depth: 1/u);
	assert.match(typeSurfaceJob
		, / {2}type_surface:\n {4}name: Type-surface evidence authentication\n {4}needs: static\n/u
		, "Corpus authentication must wait for the cheap static gate");
	assert.match(typeSurfaceJob
		, /create-core-type-surface-evidence-receipt\.mjs \\\n\s+--receipt build\/core-type-surface\/receipt\.json \\\n\s+--manifest build\/core-type-surface\/materialization\.json \\\n\s+--commit "\$\{\{ github\.sha \}\}"/u
		, "One prerequisite job must authenticate the complete type-surface corpus");
	assert.match(typeSurfaceJob, /name: core-type-surface-\$\{\{ github\.sha \}\}/u);
	const evidenceBaseline = [
		"/*", "!/*/", "/.github/", "/acceptance/", "/config/"
		, "/containers/", "/demos/", "/nix/", "/notices/", "/patches/"
		, "/poc/", "/schema/", "/scripts/", "/site/", "/src/", "/tests/"
		, "/docs/", "!/docs/evidence/*", "/docs/evidence/*.json"
		, "/docs/evidence/*.md", "/docs/evidence/*.xml"
		, "/docs/evidence/*/index.json"
	];
	const typeSurfaceSparse = /sparse-checkout: \|\n((?: {12}\S+\n)+)/u.exec(
		typeSurfaceJob);
	assert.ok(typeSurfaceSparse);
	assert.deepEqual(typeSurfaceSparse[1].trim().split("\n")
		.map(line => line.trim()), evidenceBaseline);
	const contractSparse = /sparse-checkout: \|\n((?: {12}\S+\n)+)/u.exec(
		contractJob);
	assert.ok(contractSparse
		, "Contract shards must declare the common evidence baseline");
	assert.deepEqual(contractSparse[1].trim().split("\n").map(line => line.trim())
		, evidenceBaseline
		, "Evidence baselines must retain source, docs, root records, and every archive index");
	assert.match(contractJob, /fetch-depth: 0/u);
	assert.match(contractJob, /sparse-checkout-cone-mode: false/u);
	assert.doesNotMatch(contractJob, /^\s+filter:/mu
		, "Contract checkout must derive blob:none from non-cone sparse patterns");
	assert.equal([...contractJob.matchAll(/^\s+node scripts\/materialize-core-contract-evidence\.mjs \\\n\s+--shard "\$\{\{ matrix\.shard \}\}\/12" \\\n\s+--manifest "build\/core-evidence\/core-shard-\$\{\{ matrix\.shard \}\}-evidence\.json" \\\n\s+--type-surface-receipt build\/core-type-surface\/receipt\.json\s*$/gmu)].length, 1
		, "Every shard must materialize and record its exact retained evidence closure");
	assert.match(contractJob
		, /LEAN_BRIDGE_TYPE_SURFACE_EVIDENCE_RECEIPT: \$\{\{ github\.workspace \}\}\/build\/core-type-surface\/receipt\.json/u);
	const aggregate = source.slice(source.indexOf("\n  quality:\n"));
	assert.match(aggregate, /fetch-depth: 1\n {10}persist-credentials: false\n {10}sparse-checkout: \|\n {12}scripts\n {12}src\n {12}tests\n {10}sparse-checkout-cone-mode: true\n/u
		, "The aggregate needs the complete test tree and verifier source, not retained evidence");
	assert.equal([...source.matchAll(/^\s+sparse-checkout: \|\s*$/gmu)].length, 4
		, "Static, type-surface, contract, and aggregate jobs must all bound materialization");
	assert.equal([...source.matchAll(/^\s+sparse-checkout-cone-mode: true\s*$/gmu)].length, 2);
	assert.equal([...source.matchAll(/^\s+sparse-checkout-cone-mode: false\s*$/gmu)].length, 2);
	assert.doesNotMatch(aggregate, /^\s+filter:/mu
		, "Use checkout's sparse blob filter without overriding it");
	assert.equal([...source.matchAll(/^\s+persist-credentials:\s*false\s*$/gmu)].length, 4
		, "No checkout may persist credentials");
	assert.equal([...source.matchAll(/^\s+- name: Free hosted runner disk for the evidence checkout\s*$/gmu)].length, 2
		, "Both archive-heavy jobs must remove only reviewed unused hosted SDKs");
	assert.equal([...source.matchAll(/^\s+sudo rm -rf \/usr\/share\/dotnet \/usr\/local\/lib\/android \/opt\/ghc \/usr\/local\/\.ghcup \/opt\/hostedtoolcache\/CodeQL\s*$/gmu)].length, 2
		, "Both archive-heavy jobs must reclaim the same bounded SDK roots");
	assert.equal([...source.matchAll(/^\s+- name: Report disk after the evidence baseline checkout\s*$/gmu)].length, 1);
	assert.match(source, /- name: Report disk after the evidence baseline checkout\n {8}run: df -h \/ "\$GITHUB_WORKSPACE"/u);
	assert.equal([...source.matchAll(/^\s+- name: Report disk after shard evidence materialization\s*$/gmu)].length, 1);
	assert.match(source, /- name: Report disk after shard evidence materialization\n {8}run: df -h \/ "\$GITHUB_WORKSPACE"/u);
	assert.equal([...source.matchAll(/^\s+- name: Report disk and memory after the shard\s*$/gmu)].length, 1);
	assert.match(source, /- name: Report disk and memory after the shard\n {8}if: always\(\)\n {8}run: \|\n {10}df -h \/ "\$RUNNER_TEMP" "\$GITHUB_WORKSPACE"\n {10}free -m/u
		, "Core must retain terminal disk and memory diagnostics even when a shard fails");
	assert.match(source, /if: always\(\)\n {8}uses: actions\/upload-artifact@v7/u);
	assert.equal([...source.matchAll(/^\s+if-no-files-found: error\s*$/gmu)].length, 2);
	assert.equal([...source.matchAll(/^\s+overwrite: true\s*$/gmu)].length, 2);
	assert.match(source
		, /build\/core-shards\/core-shard-\$\{\{ matrix\.shard \}\}\.json\n {12}build\/core-evidence\/core-shard-\$\{\{ matrix\.shard \}\}-evidence\.json/u
		, "Failure artifacts must preserve both execution and evidence manifests");
	assert.match(source, /uses: actions\/download-artifact@v8/u);
	assert.match(source, /pattern: core-shard-\*-\$\{\{ github\.sha \}\}/u);
	assert.match(source, /merge-multiple: true/u);
	assert.equal([...source.matchAll(/^\s+run: node scripts\/check-core-contract-shards\.mjs build\/core-shards\s*$/gmu)].length, 1
		, "The aggregate must authenticate shard closure before accepting results");
	assert.match(source, / {2}quality:\n {4}name: quality\n {4}if: always\(\)\n {4}needs: \[static, type_surface, contract\]/u
		, "The stable quality check must aggregate static, shared evidence, and every matrix result");
	assert.match(source, /STATIC_RESULT: \$\{\{ needs\.static\.result \}\}/u);
	assert.match(source, /TYPE_SURFACE_RESULT: \$\{\{ needs\.type_surface\.result \}\}/u);
	assert.match(source, /CONTRACT_RESULT: \$\{\{ needs\.contract\.result \}\}/u);
	assert.equal([...source.matchAll(/^\s+test "\$STATIC_RESULT" = success\s*$/gmu)].length, 1);
	assert.equal([...source.matchAll(/^\s+test "\$TYPE_SURFACE_RESULT" = success\s*$/gmu)].length, 1);
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
	assert.match(shards, /export const coreContractShardCount = 12;/u);
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
		, "checked-record-value-index-php-wasm-installed-tests.mjs"
		, "checked-record-value-index-php-wasm-ci-report-tests.mjs"
		, "checked-record-value-index-php-wasm-ci-shell-tests.mjs"
		, "checked-record-value-index-php-wasm-ci-workflow-tests.mjs"
	]
	, "tests/checked-record-value-index-php-wasm-evidence.test.mjs": [
		"checked-record-value-index-php-wasm-source-history-tests.mjs"
		, "checked-record-value-index-php-wasm-evidence-tests.mjs"
	]
	, "tests/dependent-checked-record-php-wasm.test.mjs": [
		"dependent-checked-record-php-wasm-fixture-tests.mjs"
		, "dependent-checked-record-php-wasm-lean-tests.mjs"
		, "dependent-checked-record-php-wasm-installed-tests.mjs"
		, "dependent-checked-record-php-wasm-ci-report-tests.mjs"
		, "dependent-checked-record-php-wasm-ci-shell-tests.mjs"
		, "dependent-checked-record-php-wasm-ci-workflow-tests.mjs"
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
		source.replace("timeout-minutes: 240", "timeout-minutes: 90")
		, source.replace("shard: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]", "shard: [1, 2, 3, 4, 5, 6]")
		, source.replace("shard: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]", "shard: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 11]")
		, source.replace("${{ matrix.shard }}/12", "${{ matrix.shard }}/11")
		, source.replace("fail-fast: false", "fail-fast: true")
		, source.replace("max-parallel: 6", "max-parallel: 12")
		, source.replace("npm run env:check:core", "npm run lint")
		, source.replace("npm run typecheck", "npm run lint")
		, source.replace('--shard "${{ matrix.shard }}/12"'
			, '--test-name-pattern "${{ matrix.shard }}/12"')
		, source.replace("    needs: static\n    runs-on: ubuntu-24.04"
			, "    runs-on: ubuntu-24.04")
		, source.replace("fetch-depth: 0", "fetch-depth: 1")
		, source.replace("fetch-depth: 1", "fetch-depth: 0")
		, source.replace("persist-credentials: false", "persist-credentials: true")
		, source.replace("            tests\n", "            tests/helpers\n")
		, source.replace("            src\n", "            docs/evidence\n")
		, source.replace("            scripts\n", "")
		, source.replace("sparse-checkout-cone-mode: true", "sparse-checkout-cone-mode: false")
		, source.replace("          sparse-checkout-cone-mode: false"
			, "          sparse-checkout-cone-mode: true")
		, source.replace("            /docs/evidence/*/index.json\n", "")
		, source.replace("node scripts/materialize-core-contract-evidence.mjs"
			, "node scripts/snapshot-core-contract-evidence.mjs")
		, source.replace("create-core-type-surface-evidence-receipt.mjs"
			, "snapshot-core-type-surface-evidence.mjs")
		, source.replace("--type-surface-receipt build/core-type-surface/receipt.json"
			, "--type-surface-receipt build/core-type-surface/missing.json")
		, source.replace("build/core-evidence/core-shard-${{ matrix.shard }}-evidence.json"
			, "build/core-shards/core-shard-${{ matrix.shard }}.json")
		, source.replace("          sparse-checkout: |", "          filter: tree:0\n          sparse-checkout: |")
		, source.replace("/opt/hostedtoolcache/CodeQL", "/opt/hostedtoolcache")
		, source.replace('df -h / "$GITHUB_WORKSPACE"', "true")
		, source.replace("Report disk and memory after the shard\n        if: always()"
			, "Report disk and memory after the shard\n        if: success()")
		, source.replace("needs: [static, type_surface, contract]"
			, "needs: [static, contract]")
		, source.replace("if: always()", "if: success()")
		, source.replace("merge-multiple: true", "merge-multiple: false")
		, source.replace("overwrite: true", "overwrite: false")
		, source.replace("check-core-contract-shards.mjs", "snapshot-core-contract-shards.mjs")
		, source.replace('test "$CONTRACT_RESULT" = success', "true")
		, source.replace('test "$TYPE_SURFACE_RESULT" = success', "true")
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

test("history inventory checks reuse the authenticated type-surface pass", async () => {
	const paths = [
		"tests/hosted-container-inventory.test.mjs"
		, "tests/native-edge-array-harness-history.test.mjs"
		, "tests/perl-relocated-promotion.test.mjs"
		, "tests/reviewed-fin-refusal-history.test.mjs"
		, "tests/wasm-ci-array-history.test.mjs"
		, "tests/wasm-entry-archive-history.test.mjs"
		, "tests/wasm-entry-controls-history.test.mjs"
		, "tests/wasm-entry-harness-history.test.mjs"
		, "tests/helpers/cpp-fin-dispatch-integration-tests.mjs"
		, "tests/helpers/fin-container-evidence-ci-tests.mjs"
		, "tests/helpers/fin-entry-integration-tests.mjs"
		, "tests/helpers/perl-closure-native-budget-tests.mjs"
		, "tests/helpers/reviewed-fin-refusal-ci-tests.mjs"
	];
	for(const path of paths)
	{
		const source = await readFile(path, "utf8");
		assert.match(source, /await readTypeSurface\(\)/u, path);
		assert.doesNotMatch(source
			, /sha256\(await readFile\(file[.]path\)\), file[.]sha256/u
			, `${path}: do not rehash the complete live corpus`);
	}
});

test("inherited-record history reads its immutable record endpoint", async () => {
	const source = await readFile(
		"tests/helpers/inherited-checked-record-promotion-source-history-tests.mjs"
		, "utf8"
	);
	assert.match(source
		, /import \{ sourceAtFinHistoryRecordSource \} from "[.]\/source-at-fin-history-milestone[.]mjs";/u);
	assert.equal([...source.matchAll(/sourceAtFinHistoryRecordSource\(/gu)].length, 2
		, "Both updated and added sources must use the immutable record endpoint");
	assert.doesNotMatch(source, /sourceAtFinHistoryMilestone/u
		, "The inherited-record replay must not reconstruct the complete Fin history hub");
});

test("owned callback negatives reuse only an authenticated source identity", async () => {
	const source = await readFile(
		"tests/helpers/owned-callback-result-evidence.mjs", "utf8");
	const producer = await readFile(
		"tests/helpers/owned-callback-result-producer.mjs", "utf8");
	const start = source.indexOf("const assertOwnedCallbackResultSources");
	const end = source.indexOf("\n};", start) + 3;
	assert.ok(start >= 0 && end > start);
	const helper = source.slice(start, end);
	assert.match(source, /let authenticatedSourceIdentity;/u);
	assert.match(helper, /const identity = hash\(sources\);/u
		, "Cache selection must include every supplied source digest");
	assert.match(helper
		, /if\(authenticatedSourceIdentity === identity\) return;/u);
	assert.match(helper
		, /for\(const \[path, value\] of Object\.entries\(sources\)\)[\s\S]*bytesAtProducer\([\s\S]*ownedCallbackResultProducer, path, value/u
		, "A new identity must authenticate every source at the immutable producer");
	assert.ok(helper.indexOf("authenticatedSourceIdentity = identity;")
		> helper.indexOf("for(const [path, value] of Object.entries(sources))")
		, "The cache must publish only after complete byte authentication");
	assert.equal([...source.matchAll(
		/await assertOwnedCallbackResultSources\(record\.sources\);/gu
	)].length, 1);
	assert.match(producer
		, /readBytes: async \(path, expected = sources\[path\]\) => \{[\s\S]*bytesAtProducer\(ownedCallbackResultProducer, path, expected\)/u);
	assert.equal([...source.matchAll(/replay\.readBytes, sources/gu)].length, 3
		, "Every retained CLI inventory must read exact producer bytes");
	assert.match(source
		, /if\(sha256\(text\) !== sources\[path\]\)\n\t+text = beforeCallbackInventoryRepair/u
		, "Exact producer runtime sources must stop before the history hub");
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
		schemaVersion: 1, partition: "sorted-index-modulo-v1", shards: 12
		, contractFiles: paths.length, contractSha256: manifests[0].contract.sha256
	});
	assert.deepEqual(manifests.map(item => item.selection.count)
		, Array.from({ length: 12 }, (_, index) =>
			Math.ceil((paths.length - index) / 12)));
	for(const mutate of [
		values => values.pop()
		, values => { values[11] = structuredClone(values[10]); }
		, values => { values[0].selection.files[0] = values[1].selection.files[0]; }
		, values => { values[0].contract.sha256 = "0".repeat(64); }
		, values => { values[0].unexpected = true; }
	]) {
		const changed = structuredClone(manifests); mutate(changed);
		assert.throws(() => verifyCoreContractShardManifests(paths, changed));
	}
});

test("Core aggregate authenticates every manifest from an evidence-free sparse checkout", async t => {
	const root = resolve(".");
	const directory = await mkdtemp(join(tmpdir(), "lean-core-aggregate-sparse-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const checkout = join(directory, "repository");
	const git = (arguments_, cwd = root) => execFileSync("git", arguments_
		, { cwd, encoding: "utf8", maxBuffer: 1024 * 1024, timeout: 30000 });
	const revision = git(["rev-parse", "HEAD"]).trim();
	git(["clone", "--quiet", "--shared", "--no-checkout", root, checkout]);
	git(["sparse-checkout", "set", "--cone", "scripts", "src", "tests"], checkout);
	git(["checkout", "--quiet", "--detach", revision], checkout);
	assert.equal(git(["rev-parse", "HEAD"], checkout).trim(), revision);
	await assert.rejects(access(join(checkout, "docs")), { code: "ENOENT" });
	assert.deepEqual(await collectRepositoryTestPaths(checkout)
		, await collectRepositoryTestPaths(root));
	const paths = await collectCoreContractTestPaths(root);
	assert.deepEqual(await collectCoreContractTestPaths(checkout), paths);
	const manifests = coreContractShardLabels.map(label =>
		coreContractShardManifest(paths, label));
	const manifestDirectory = join(directory, "manifests");
	await mkdir(manifestDirectory);
	for(const manifest of manifests)
		await writeFile(join(manifestDirectory
			, `core-shard-${manifest.shard.index}.json`), canonicalJson(manifest));
	const verify = () => execFileSync(process.execPath
		, ["scripts/check-core-contract-shards.mjs", manifestDirectory]
		, { cwd: checkout, encoding: "utf8", stdio: "pipe", maxBuffer: 1024 * 1024, timeout: 30000 });
	assert.deepEqual(JSON.parse(verify())
		, verifyCoreContractShardManifests(paths, manifests));
	t.diagnostic(`Complete sparse aggregate: ${paths.length} contract files across twelve shards at ${revision}`);
	const changed = structuredClone(manifests[0]);
	changed.selection.files.pop();
	await writeFile(join(manifestDirectory, "core-shard-1.json"), canonicalJson(changed));
	assert.throws(verify, /Core shard 1\/12/u);
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
				/^import "\.\/helpers\/((?:dependent-)?checked-record-[^"]+-tests\.mjs)";$/gmu
		)].map(match => match[1]);
		assert.deepEqual(imports, expected, path);
		assert.ok(imports.length > 0 && imports.length <= 6, path);
		observed.push(...imports);
	}
	assert.equal(new Set(observed).size, observed.length);
	assert.equal(observed.length, 59);
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
