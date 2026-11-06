/**
 * Keep complete optional-parameter replay and production fail-closed.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	optionalParameterCompleteReferencePaths
} from "./optional-parameter-complete-promotion.mjs";
import {
	optionalParameterHostedEvidenceDirectory
} from "./optional-parameter-hosted-archive.mjs";
import { collectModuleClosure } from "./module-closure.mjs";

const workflowPath = ".github/workflows/optional-parameter-complete.yml";
const requiredInputs = Object.freeze([
	workflowPath
	, "docs/evidence/optional-parameter-hosted-*/**"
	, "docs/lean/**"
	, "docs/reference/**"
	, "docs/consumer-support.v1.json"
	, "docs/type-surface.v1.json"
	, "package-lock.json"
	, "package.json"
	, "schema/binding-ir.schema.json"
	, "scripts/*optional-parameter*.mjs"
	, "scripts/generate-reference-docs.mjs"
	, "scripts/generate-type-docs.mjs"
	, "src/adoption/type-surface.mjs"
	, "src/capsule/node.mjs"
	, "tests/optional-parameter-complete-*.test.mjs"
	, "tests/helpers/optional-parameter-complete-*.mjs"
	, "tests/helpers/optional-parameter-hosted-*.mjs"
]);

const producerRevision = "496de9b6f22725da76e2fbe3aba9a2a1dd76ce06";
const archiveRevision = "faf28c4216c0b68a742d4e5f6119432d78912e2f";
const auditSparseRoots = Object.freeze([
	".github", "schema", "scripts", "site", "src", "tests", "docs"
]);
const auditCheckout = `      - name: Check out complete history and the exact optional-parameter corpus
        uses: actions/checkout@v6
        with:
          fetch-depth: 0
          filter: blob:none
          persist-credentials: false
          sparse-checkout: |
            /*
            !/*/
            /.github/
            /schema/
            /scripts/
            /site/
            /src/
            /tests/
            /docs/
            !/docs/evidence/*
            /docs/evidence/optional-parameter-hosted-20261029/
          sparse-checkout-cone-mode: false
`;
const auditHistoryGuard = `      - name: Require complete immutable source history
        shell: bash
        run: |
          set -euo pipefail
          test "$(git rev-parse --is-shallow-repository)" = false
          git cat-file -e ${producerRevision}^{commit}
          git cat-file -e ${archiveRevision}^{commit}
`;

const auditSparseSelects = path => {
	assert.ok(typeof path === "string" && path.length > 0
		&& !path.startsWith("/") && !path.includes("\\"));
	if(!path.includes("/")) return true;
	const root = path.slice(0, path.indexOf("/"));
	if(!auditSparseRoots.includes(root)) return false;
	if(!path.startsWith("docs/evidence/")) return true;
	return path.startsWith(`${optionalParameterHostedEvidenceDirectory}/`);
};

const auditEntryPoints = Object.freeze([
	"tests/optional-parameter-complete-hosted-evidence.test.mjs"
	, "tests/optional-parameter-complete-promotion.test.mjs"
	, ...["npm", "native", "php", "language", "managed", "wit"]
		.map(name => `scripts/check-optional-parameter-${name}-ci.mjs`)
]);

const assertWorkflow = source => {
	const keys = [...source.matchAll(/^ {2}([a-z][a-z0-9_-]*):\n/gmu)]
		.map(match => match[1]);
	assert.deepEqual(keys, [
		"push", "pull_request", "workflow_call", "workflow_dispatch"
		, "schedule", "audit", "npm-browser", "native-perl", "languages"
		, "managed-wit", "php", "receipt"
	]);
	for(const input of requiredInputs)
		assert.equal(source.split(`      - "${input}"\n`).length - 1
			, 2, `${input} must trigger push and pull_request`);
	assert.match(source, /workflow_call:\n {4}inputs:\n {6}suite:[\s\S]*? {8}default: produce[\s\S]*? {8}type: string/u);
	assert.match(source, /workflow_dispatch:[\s\S]*?options:\n {10}- audit\n {10}- produce/u);
	assert.match(source, /schedule:\n {4}- cron: "43 10 \* \* 0"/u);
	assert.match(source, / {2}audit:\n {4}if: inputs\.suite != 'produce'/u);
	const audit = source.slice(source.indexOf("  audit:\n")
		, source.indexOf("  npm-browser:\n"));
	assert.equal(audit.split(auditCheckout).length - 1, 1);
	assert.equal(audit.split(auditHistoryGuard).length - 1, 1);
	assert.equal(audit.match(/actions\/checkout@/gu)?.length, 1);
	assert.ok(audit.indexOf(auditCheckout) < audit.indexOf(auditHistoryGuard));
	assert.ok(audit.indexOf(auditHistoryGuard)
		< audit.indexOf("      - name: Install Node.js\n"));
	assert.match(source, /npm ci --ignore-scripts --no-audit --no-fund/u);
	assert.equal(source.match(/^ {10}set -o pipefail$/gmu)?.length, 2);
	assert.match(source, /tests\/optional-parameter-complete-hosted-evidence\.test\.mjs \\\n {12}\| tee build\/optional-parameter-complete\/evidence\.tap/u);
	assert.match(source, /tests\/optional-parameter-complete-promotion\.test\.mjs \\\n {12}\| tee build\/optional-parameter-complete\/promotion\.tap/u);
	assert.match(source, /if: always\(\)\n {8}uses: actions\/upload-artifact@v7/u);
	assert.equal(source.match(/if-no-files-found: error/gmu)?.length, 2);
	for(const job of [
		"npm-browser", "native-perl", "languages", "managed-wit", "php"
	]) {
		const start = source.indexOf(`  ${job}:\n`);
		assert.notEqual(start, -1, job);
		const ends = keys.map(key => source.indexOf(`  ${key}:\n`, start + 3))
			.filter(index => index > start);
		const body = source.slice(start
			, ends.length === 0 ? undefined : Math.min(...ends));
		assert.match(body, /^ {4}if: inputs\.suite == 'produce'$/mu);
	}
	const receipt = source.slice(source.indexOf("  receipt:\n"));
	assert.match(receipt
		, /^ {4}if: always\(\) && inputs\.suite == 'produce'$/mu);
	assert.match(receipt
		, /pattern: optional-parameter-\*-\$\{\{ github\.sha \}\}/u);
	assert.ok(receipt.includes(
		"node scripts/reconcile-optional-parameter-matrix.mjs"));
	assert.match(receipt
		, /name: optional-parameter-matrix-\$\{\{ github\.sha \}\}/u);
	assert.equal(receipt.match(/^ {8}continue-on-error: true$/gmu)?.length, 2);
	for(const job of [
		"npm-browser", "native-perl", "languages", "managed-wit", "php"
	]) assert.ok(receipt.includes(`needs.${job}.result != 'success'`), job);
	assert.ok(receipt.includes("steps.download.outcome != 'success'"));
	assert.ok(receipt.includes("steps.reconciliation.outcome != 'success'"));
	assert.doesNotMatch(source, /\|\| true/u);
};

test("complete optional-parameter replay is one bounded recurring audit"
	, async () => assertWorkflow(await readFile(workflowPath, "utf8")));

test("optional-parameter audit materializes only its complete input closure"
	, async () => {
		const archiveIndexPath
			= `${optionalParameterHostedEvidenceDirectory}/index.json`;
		const archiveIndex = JSON.parse(await readFile(
			archiveIndexPath, "utf8"));
		const required = new Set([
			"package.json", "package-lock.json", archiveIndexPath
			, "docs/type-surface.v1.json", "docs/consumer-support.v1.json"
			, "docs/lean/existing-package.md", "docs/lean/export-decisions.md"
			, "schema/binding-ir.schema.json"
			, ...optionalParameterCompleteReferencePaths
		]);
		for(const entry of auditEntryPoints)
			for(const path of await collectModuleClosure(entry)) required.add(path);
		for(const descriptor of archiveIndex.files)
			required.add(
				`${optionalParameterHostedEvidenceDirectory}/${descriptor.path}`);
		for(const path of required)
			assert.equal(auditSparseSelects(path), true, path);

		const evidenceEntries = execFileSync("git", [
			"ls-tree", "--name-only", "HEAD:docs/evidence"
		], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
		assert.ok(evidenceEntries.length > 1);
		for(const entry of evidenceEntries)
		{
			const path = `docs/evidence/${entry}`;
			assert.equal(auditSparseSelects(path + (entry
				=== "optional-parameter-hosted-20261029" ? "/index.json" : "/"))
				, entry === "optional-parameter-hosted-20261029", path);
		}
	}
);

test("complete optional-parameter workflow rejects bypasses", async () => {
	const source = await readFile(workflowPath, "utf8");
	for(const input of requiredInputs)
	{
		const line = `      - "${input}"\n`;
		assert.throws(() => assertWorkflow(source.replace(line, "")), input);
	}
	for(const [index, changed] of [
		source.replace("          set -o pipefail\n", "")
		, source.replace("        default: produce\n", "        default: audit\n")
		, source.replace("          fetch-depth: 0\n"
			, "          fetch-depth: 1\n")
		, source.replace("          filter: blob:none\n", "")
		, source.replace("          persist-credentials: false\n"
			, "          persist-credentials: true\n")
		, source.replace("            !/docs/evidence/*\n", "")
		, source.replace(
			"            /docs/evidence/optional-parameter-hosted-20261029/\n"
			, "            /docs/evidence/\n")
		, source.replace("          sparse-checkout-cone-mode: false\n"
			, "          sparse-checkout-cone-mode: true\n")
		, ...auditSparseRoots.map(root => source.replace(
			`            /${root}/\n`, ""))
		, source.replace("          test \"$(git rev-parse --is-shallow-repository)\" = false\n", "")
		, source.replace(producerRevision, "0".repeat(40))
		, source.replace(archiveRevision, "0".repeat(40))
		, source.replace("tests/optional-parameter-complete-hosted-evidence.test.mjs"
			, "tests/helpers/optional-parameter-hosted-archive-tests.mjs")
		, source.replace("tests/optional-parameter-complete-promotion.test.mjs"
			, "tests/helpers/optional-parameter-complete-promotion-tests.mjs")
		, source.replace("if-no-files-found: error", "if-no-files-found: ignore")
		, source.replace("inputs.suite == 'produce'", "true")
		, source.replace("steps.reconciliation.outcome != 'success'", "false")
	].entries()) assert.throws(() => assertWorkflow(changed)
		, undefined, `bypass control ${index}`);
});
