/**
 * Keep the recurring dependent checked-record matrix fail-closed.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath
	= ".github/workflows/dependent-checked-record-matrix.yml";

const documentationInputs = Object.freeze([
	"docs/consume/**", "docs/reference/**", "site/reference/**"
	, "scripts/generate-reference-docs.mjs", "scripts/generate-type-docs.mjs"
]);
const documentationStep = [
	"      - name: Audit all 68 promoted inventory cells and generated documentation"
	, "        shell: bash"
	, "        run: |"
	, "          set -o pipefail"
	, "          node --test --test-concurrency=1 \\"
	, "            tests/dependent-checked-record-matrix-inventory.test.mjs \\"
	, "            | tee build/dependent-checked-record-matrix/inventory.tap"
].join("\n") + "\n";
const assertDocumentationGate = workflow => {
	for(const input of documentationInputs)
		assert.equal(workflow.split(`      - "${input}"\n`).length - 1
			, 2, `${input} must trigger both push and pull_request`);
	assert.ok(workflow.includes(documentationStep)
		, "Generated documentation must be checked without rewriting it");
	assert.doesNotMatch(workflow, /continue-on-error|\|\| true/u);
};

test("dependent checked-record matrix replays evidence and inventory weekly"
	, async () => {
	const workflow = await readFile(workflowPath, "utf8");
	for(const source of [
		workflowPath
		, "docs/evidence/dependent-checked-record-*/**"
		, "docs/consumer-support.v1.json"
		, "docs/type-surface.v1.json"
		, "package-lock.json"
		, "package.json"
		, "schema/binding-ir.schema.json"
		, "scripts/*dependent-checked-record*.mjs"
		, "src/adoption/type-surface.mjs"
		, "src/capsule/node.mjs"
		, "tests/dependent-checked-record-matrix.test.mjs"
		, "tests/dependent-checked-record-matrix-inventory.test.mjs"
		, "tests/dependent-checked-record-promotion.test.mjs"
		, "tests/helpers/dependent-checked-record-*.mjs"
	]) assert.ok(workflow.includes(`      - "${source}"\n`), source);
	assert.match(workflow, /schedule:\n {4}- cron: "41 7 \* \* 1"/u);
	assert.match(workflow, /concurrency:\n {2}group: dependent-checked-record-matrix-\$\{\{ github\.ref \}\}\n {2}cancel-in-progress: false/u);
	assert.match(workflow, /runs-on: ubuntu-24\.04/u);
	assert.match(workflow, /timeout-minutes: 90/u);
	assert.match(workflow, /uses: actions\/checkout@v6\n {8}with:\n {10}fetch-depth: 0\n {10}persist-credentials: false/u);
	assert.match(workflow, /uses: actions\/setup-node@v6/u);
	assert.match(workflow, /npm ci --ignore-scripts --no-audit --no-fund/u);
	assert.match(workflow, /node --test --test-concurrency=1 \\\n {12}tests\/dependent-checked-record-matrix\.test\.mjs/u);
	assert.match(workflow, /node --test --test-concurrency=1 \\\n {12}tests\/dependent-checked-record-matrix-inventory\.test\.mjs/u);
	assert.match(workflow, /if: always\(\)\n {8}uses: actions\/upload-artifact@v7/u);
	assert.match(workflow, /if-no-files-found: error/u);
	assert.doesNotMatch(workflow, /continue-on-error|\|\| true/u);
	}
);

test("dependent checked-record matrix checks generated documentation on both triggers"
	, async () => assertDocumentationGate(await readFile(workflowPath, "utf8"))
);

test("dependent documentation gate rejects missing triggers and bypassed checks"
	, async () => {
	const workflow = await readFile(workflowPath, "utf8");
	assertDocumentationGate(workflow);
	for(const input of documentationInputs)
	{
		const line = `      - "${input}"\n`;
		assert.throws(() => assertDocumentationGate(workflow.replace(line, "")));
		assert.throws(() => assertDocumentationGate(workflow.replaceAll(line, "")));
	}
	for(const changed of [
		workflow.replace(documentationStep, "")
		, workflow.replace(documentationStep
			, documentationStep.replace("node --test --test-concurrency=1", "true"))
		, workflow.replace(documentationStep
			, documentationStep.replace("          set -o pipefail\n", ""))
		, workflow.replace("inventory.tap", "discarded.log")
		, workflow.replace("        shell: bash", "        continue-on-error: true\n        shell: bash")
	]) assert.throws(() => assertDocumentationGate(changed));
	}
);
