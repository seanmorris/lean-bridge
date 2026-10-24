/**
 * Closed contract for the recurring complete PHP-Wasm refinement-entry
 * promotion workflow.
 *
 * @file
 */
import assert from "node:assert/strict";
import { phpWasmRefinementCiMatrix } from "./php-wasm-refinement-ci-matrix.mjs";

export const phpWasmRefinementEntryPromotionPath
	= ".github/workflows/php-wasm-refinement-entry-promotion.yml";
export const phpWasmRefinementEntryPromotionProducers = Object.freeze([
	Object.freeze({
		id: "copied", name: "Produce copied refinement entry artifacts"
		, workflow: "php-wasm-refinement-entry", needs: null
	})
	, Object.freeze({
		id: "owned", name: "Produce owned refinement entry artifacts"
		, workflow: "php-wasm-owned-refinement-entry", needs: null
	})
	, Object.freeze({
		id: "callback", name: "Produce callback refinement entry artifacts"
		, workflow: "php-wasm-callback-entry", needs: "owned"
	})
	, Object.freeze({
		id: "indexed", name: "Produce indexed refinement entry artifacts"
		, workflow: "php-wasm-indexed-refinement-entry", needs: "copied"
	})
]);

const blocks = source => {
	const marker = "\njobs:\n";
	const start = source.indexOf(marker);
	assert.ok(start >= 0);
	const jobs = source.slice(start + marker.length);
	const heads = [...jobs.matchAll(/^ {2}([a-z][a-z0-9-]*):\n/gmu)];
	return heads.map((head, index) => ({
		id: head[1]
		, source: jobs.slice(head.index
			, heads[index + 1]?.index ?? jobs.length).trimEnd()
	}));
};
const exactProducer = producer => `  ${producer.id}:\n`
	+ `    name: ${producer.name}\n`
	+ (producer.needs === null ? "" : `    needs: ${producer.needs}\n`)
	+ `    uses: ./.github/workflows/${producer.workflow}.yml`;

/**
 * Require the exact schedule, bounded producer topology and same-run artifact
 * verifier used to promote all 30 logical entry routes.
 *
 * @param source - Complete workflow source.
 */
export const assertPhpWasmRefinementEntryPromotionWorkflow = source => {
	assert.equal(typeof source, "string");
	const header = /\non:\n[\s\S]*?\njobs:\n/u.exec(source);
	assert.ok(header);
	assert.equal(header[0], `
on:
  schedule:
    - cron: "17 5 1 * *"
  workflow_dispatch:

permissions:
  actions: read
  contents: read

concurrency:
  group: php-wasm-refinement-entry-promotion-\${{ github.ref }}
  cancel-in-progress: true

jobs:
`);
	assert.doesNotMatch(source, /continue-on-error:/u);
	const jobs = blocks(source);
	assert.deepEqual(jobs.map(job => job.id)
		, [...phpWasmRefinementEntryPromotionProducers.map(item => item.id), "promote"]);
	for(const producer of phpWasmRefinementEntryPromotionProducers)
	{
		const job = jobs.find(item => item.id === producer.id);
		assert.equal(job.source, exactProducer(producer));
		const lane = phpWasmRefinementCiMatrix.find(item => item.id === producer.workflow);
		assert.ok(lane?.kind === "measurement");
		assert.equal(lane.maxParallel, 2);
	}
	const promote = jobs.at(-1).source;
	assert.ok(promote.startsWith(`  promote:
    name: Authenticate all 30 refinement entry routes
    needs:
      - copied
      - owned
      - callback
      - indexed
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    steps:
`));
	const steps = [...promote.matchAll(/^ {6}- name: (.+)$/gmu)]
		.map(match => match[1]);
	assert.deepEqual(steps, [
		"Check out the exact producer revision and evidence history"
		, "Install Node.js"
		, "Install verifier dependencies without lifecycle scripts"
		, "Download the exact current-run producer artifacts"
		, "Recheck every retained record and close the route matrix"
		, "Preserve the complete promotion result or verifier diagnostics"
		, "Enforce complete route promotion"
	]);
	assert.equal([...promote.matchAll(/^ {8}uses: actions\/checkout@v6$/gmu)].length, 1);
	assert.equal([...promote.matchAll(/^ {10}fetch-depth: 0$/gmu)].length, 1);
	assert.equal([...promote.matchAll(/^ {10}persist-credentials: false$/gmu)].length, 1);
	assert.equal([...promote.matchAll(/^ {8}uses: actions\/setup-node@v6$/gmu)].length, 1);
	assert.equal([...promote.matchAll(/^ {10}node-version: "22"$/gmu)].length, 1);
	assert.equal([...promote.matchAll(/^ {10}cache: npm$/gmu)].length, 1);
	assert.ok(promote.includes("        run: npm ci --ignore-scripts --no-audit --no-fund\n"));
	assert.ok(promote.includes(`        uses: actions/download-artifact@v8
        with:
          pattern: php-wasm-*-entry-*-\${{ github.sha }}
          path: build/php-wasm-refinement-entry-hosted-artifacts
          merge-multiple: false
`));
	assert.doesNotMatch(promote, /^ {10}(?:run-id|github-token|repository):/mu);
	assert.ok(promote.includes(`        id: verification
        shell: bash
        run: |
          mkdir -p build/php-wasm-refinement-entry-promotion
          node scripts/summarize-php-wasm-refinement-entry-hosted.mjs \\
            --producer "$GITHUB_SHA" \\
            --directory "$GITHUB_WORKSPACE/build/php-wasm-refinement-entry-hosted-artifacts" \\
            > build/php-wasm-refinement-entry-promotion/summary.json \\
            2> build/php-wasm-refinement-entry-promotion/verification.log
          test -s build/php-wasm-refinement-entry-promotion/summary.json
`));
	assert.ok(promote.includes(`        if: always()
        uses: actions/upload-artifact@v7
        with:
          name: complete-php-wasm-refinement-entry-promotion-\${{ github.sha }}
          path: build/php-wasm-refinement-entry-promotion/
          if-no-files-found: error
          retention-days: 30
`));
	assert.ok(promote.endsWith(`      - name: Enforce complete route promotion
        if: always() && steps.verification.outcome != 'success'
        run: exit 1`));
	return Object.freeze({
		schedule: "17 5 1 * *", producers: 4, maximumProducerJobs: 4
		, cells: 27, artifacts: 27, logicalRoutes: 30
	});
};
