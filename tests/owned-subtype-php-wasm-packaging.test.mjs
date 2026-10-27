/**
 * Installed PHP-Wasm acceptance for checked fields inside owned values.
 *
 * @file
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { checkOwnedPhpWasmPackages } from "./helpers/owned-php-wasm-packages.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const enabled = process.env.LEAN_BRIDGE_OWNED_SUBTYPE_PHP_WASM_TEST === "1";

test("installed PHP-Wasm checked owners preserve validation and ownership in Node and Chromium", {
	skip: !enabled, timeout: 3_600_000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-owned-subtype-php-wasm-installed-"));
	const output = resolve("build/owned-subtype-php-wasm");
	await rm(output, { recursive: true, force: true });
	let complete = false;
	t.after(async () => {
		if(complete) await rm(directory, { recursive: true, force: true });
		else t.diagnostic(`Retained failed checked-owner PHP-Wasm inputs: ${directory}`);
	});
	const report = await checkOwnedPhpWasmPackages(directory, message => {
		t.diagnostic(message); process.stderr.write(message + "\n");
	}, { checkedRefinements: true, evidenceRoot: join(output, "evidence") });
	await saveLakeFile(output, "packages.json", canonicalJson(report));
	complete = true;
});

test("checked-owner PHP-Wasm acceptance remains a separate recurring gate", async () => {
	const { readFile } = await import("node:fs/promises");
	const workflow = await readFile(".github/workflows/owned-subtype-php-wasm.yml", "utf8");
	const cli = JSON.parse(await readFile("config/cli-package.v1.json", "utf8"));
	for(const dependency of [
		"src/abi/owned-refinement-model.mjs"
		, "src/build/owned-refinement-carriers.mjs"
	]) if(!cli.files.includes(dependency))
		throw new Error(`The standalone CLI omitted ${dependency}`);
	for(const required of [
		"on:\n  workflow_dispatch:\n"
		, "cancel-in-progress: true"
		, "npm run test:owned-subtype-php-wasm"
		, "rg '^# fail 0$'"
		, "rg '^# skipped 0$'"
		, "test -s build/owned-subtype-php-wasm/packages.json"
		, "build/owned-subtype-php-wasm/evidence"
		, "if: always()\n        uses: actions/upload-artifact@v7"
		, "if: always() && steps.acceptance.outcome != 'success'"
	]) if(!workflow.includes(required)) throw new Error(`Missing PHP-Wasm checked-owner gate: ${required}`);
});
