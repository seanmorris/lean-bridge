/**
 * Reject missing PHP-Wasm receiver setup, skipped tests and incomplete reports.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedPhpWasmReceiverCi, ownedPhpWasmReceiverReports } from "./helpers/owned-php-wasm-receiver-ci.mjs";
import "./helpers/php-receiver-dependency-source-history-tests.mjs";

test("PHP-Wasm receiver CI requires all seventeen tests and thirteen reports", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assertOwnedPhpWasmReceiverCi(workflow, manifest);
	const [prefix, suffix] = workflow.split("  php-wasm-receivers:\n");
	for(const line of [
		"          bash scripts/bootstrap-php-wasm-ci.sh\n"
		, "          npx playwright install --with-deps chromium\n"
		, "          bash scripts/build-lean-runtime.sh\n"
		, "          npm run test:owned-php-wasm-receivers > build/owned-php-wasm-receivers.log 2>&1\n"
		, ...["tests 17", "pass 17", "fail 0", "cancelled 0", "skipped 0"].map(value => `          rg '^# ${value}$' build/owned-php-wasm-receivers.log\n`)
		, ...ownedPhpWasmReceiverReports.map(path => `          test -s ${path}\n`)
		, "            build/owned-php-wasm-receivers/\n"
		, "            build/owned-php-wasm-receivers.log\n"
		, "      - php-wasm-receivers\n"
		, "        if: needs.php-wasm-receivers.result != 'success'\n"
	]) {
		assert.ok(suffix.includes(line), line);
		assert.throws(() => assertOwnedPhpWasmReceiverCi(prefix + "  php-wasm-receivers:\n" + suffix.replace(line, ""), manifest), undefined, line);
	}
	for(const token of ["php-cli", "php-dev", "composer", "ripgrep"])
		assert.throws(() => assertOwnedPhpWasmReceiverCi(prefix + "  php-wasm-receivers:\n" + suffix.replace(" " + token, ""), manifest), undefined, token);
	for(const line of ["    if: false\n", "    continue-on-error: true\n"])
		assert.throws(() => assertOwnedPhpWasmReceiverCi(prefix + "  php-wasm-receivers:\n" + line + suffix, manifest));
	const changed = structuredClone(manifest);
	changed.scripts["test:owned-php-wasm-receivers"] += " --test-name-pattern=model";
	assert.throws(() => assertOwnedPhpWasmReceiverCi(workflow, changed));
});

test("PHP-Wasm receiver CI bounds browser dependencies before compiler preparation", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	const name = "      - name: Install dependencies for Build the pinned PHP-Wasm runtime and browser host\n";
	const dependency = "        timeout-minutes: 20\n        run: |\n          npx playwright install --with-deps chromium\n";
	assert.ok(workflow.includes(name + dependency));
	const alternatives = [""
		, dependency.replace("timeout-minutes: 20\n", "timeout-minutes: 240\n")
		, dependency.replace("        timeout-minutes: 20\n", "")
		, "        if: false\n" + dependency
		, "        continue-on-error: true\n" + dependency
		, dependency.replace("--with-deps chromium", "--with-deps chromium || true")
	];
	for(const alternative of alternatives)
		assert.throws(() => assertOwnedPhpWasmReceiverCi(workflow.replace(name + dependency, name + alternative), manifest));
	const runtimeName = "      - name: Build the pinned PHP-Wasm runtime and browser host\n";
	const late = workflow.replace(name + dependency, "").replace(runtimeName, runtimeName + name + dependency);
	assert.throws(() => assertOwnedPhpWasmReceiverCi(late, manifest));
	for(const line of ["        if: false\n", "        continue-on-error: true\n"])
		assert.throws(() => assertOwnedPhpWasmReceiverCi(workflow.replace(runtimeName, runtimeName + line), manifest));
});
