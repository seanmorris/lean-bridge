/**
 * Keep every reusable Perl checkout bounded while preserving the one lane that
 * authenticates source history before its long installed ABI build.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = ".github/workflows/perl-consumer.yml";
const checkoutJobs = [
	"checked-records", "nix-engine", "compiler-checks", "perl"
	, "perl-receivers", "perl-summary"
];
const sparsePatterns = [
	"/*", "!/*/", "/.github/", "/acceptance/", "/config/"
	, "/containers/", "/demos/", "/nix/", "/notices/", "/patches/"
	, "/poc/", "/schema/", "/scripts/", "/site/", "/src/", "/tests/"
	, "/docs/", "!/docs/evidence/*", "/docs/evidence/*.json"
	, "/docs/evidence/*.md", "/docs/evidence/*.xml"
	, "/docs/evidence/*/index.json"
];
const sparseDeclaration = ["  LEAN_BRIDGE_PERL_SPARSE_CHECKOUT: |"
	, ...sparsePatterns.map(pattern => `    ${pattern}`)].join("\n") + "\n";
const receiptEnvironment = "  LEAN_BRIDGE_TYPE_SURFACE_EVIDENCE_RECEIPT: ${{ github.workspace }}/build/consumer-type-surface/receipt.json\n";
const receiptDownload = "      - name: Restore the authenticated type-surface receipt\n        uses: actions/download-artifact@v8\n        with:\n          name: consumer-type-surface-${{ github.sha }}\n          path: build/consumer-type-surface\n";
const preflight = "      - name: Require source history before the Perl ABI build\n        run: test \"$(git rev-parse --is-shallow-repository)\" = false\n";

const jobs = source => {
	const starts = [...source.matchAll(/^ {2}([a-z][a-z0-9-]*):\n/gmu)];
	return new Map(starts.map((match, index) => [match[1]
		, source.slice(match.index, starts[index + 1]?.index ?? source.length)]));
};

const checkoutInput = job => {
	const matches = [...job.matchAll(
		/^ {6}- uses: actions\/checkout@v6\n {8}with:\n((?: {10}.*\n)+)/gmu
	)];
	assert.equal(matches.length, 1);
	return matches[0][1];
};

const assertBoundedCheckouts = source => {
	assert.equal(source.split(receiptEnvironment).length, 2);
	assert.equal(source.split(sparseDeclaration).length, 2);
	const blocks = jobs(source);
	const actual = [...blocks].filter(([, body]) => body.includes(
		"uses: actions/checkout@v6")).map(([name]) => name);
	assert.deepEqual(actual, checkoutJobs);
	for(const name of checkoutJobs)
	{
		const input = checkoutInput(blocks.get(name));
		assert.match(input, new RegExp(`^ {10}fetch-depth: ${name === "perl" ? 0 : 1}$`, "mu"));
		for(const line of [
			"          filter: blob:none\n"
			, "          persist-credentials: false\n"
			, "          sparse-checkout: ${{ env.LEAN_BRIDGE_PERL_SPARSE_CHECKOUT }}\n"
			, "          sparse-checkout-cone-mode: false\n"
		]) assert.equal(input.split(line).length, 2, `${name}: ${line.trim()}`);
		assert.equal(blocks.get(name).split(receiptDownload).length, 2, name);
	}
	return blocks;
};

const requireHistory = source => {
	const job = assertBoundedCheckouts(source).get("perl");
	assert.equal(job.split(preflight).length, 2);
	assert.ok(job.indexOf("uses: actions/checkout@v6")
		< job.indexOf("      - uses: actions/setup-node@v6\n"));
	assert.ok(job.indexOf(preflight)
		< job.indexOf("      - name: Test both install paths on this Perl configuration\n"));
	assert.doesNotMatch(job, /^ {4}(?:continue-on-error|if):/mu);
	assert.deepEqual([...job.matchAll(/^ {10}- (5\.\d+\.\d+-(?:un)?threaded)$/gmu)]
		.map(match => match[1]), [
		"5.36.3-threaded", "5.36.3-unthreaded"
		, "5.38.2-threaded", "5.38.2-unthreaded"]
	);
};

test("all six reusable Perl checkouts are sparse, blobless and bounded", async () => {
	assertBoundedCheckouts(await readFile(workflowPath, "utf8"));
});

test("Perl checkout closure rejects every unbounded job and weakened manifest", async t => {
	const source = await readFile(workflowPath, "utf8"), blocks = jobs(source);
	let mutations = 0;
	for(const name of checkoutJobs)
	{
		const job = blocks.get(name), input = checkoutInput(job);
		for(const line of [
			`          fetch-depth: ${name === "perl" ? 0 : 1}\n`
			, "          filter: blob:none\n"
			, "          persist-credentials: false\n"
			, "          sparse-checkout: ${{ env.LEAN_BRIDGE_PERL_SPARSE_CHECKOUT }}\n"
			, "          sparse-checkout-cone-mode: false\n"
		]) {
			const changedJob = job.replace(input, () => input.replace(line, ""));
			assert.notEqual(changedJob, job);
			assert.throws(() => assertBoundedCheckouts(
				source.replace(job, () => changedJob)), { name: "AssertionError" });
			mutations++;
		}
	}
	for(const line of ["    !/docs/evidence/*\n"
		, "    /docs/evidence/*/index.json\n", receiptEnvironment]) {
		const changed = source.replace(line, "");
		assert.notEqual(changed, source);
		assert.throws(() => assertBoundedCheckouts(changed)
			, { name: "AssertionError" });
		mutations++;
		}
	for(const name of checkoutJobs)
	{
		const job = blocks.get(name);
		const changedJob = job.replace(receiptDownload, "");
		assert.notEqual(changedJob, job);
		assert.throws(() => assertBoundedCheckouts(
			source.replace(job, () => changedJob)), { name: "AssertionError" });
		mutations++;
	}
	assert.equal(mutations, 39);
	t.diagnostic(`${mutations} per-job and manifest weakening controls`);
});

test("Perl ABI CI fetches history bloblessly and checks it before installing tools", async () => {
	requireHistory(await readFile(workflowPath, "utf8"));
});

test("Perl ABI CI rejects shallow, absent and bypassed historical-evidence checks", async () => {
	const source = await readFile(workflowPath, "utf8")
		, job = jobs(source).get("perl");
	for(const changedJob of [
		job.replace("          fetch-depth: 0\n", "          fetch-depth: 1\n")
		, job.replace(preflight, "")
		, job.replace(preflight, preflight.replace("        run:"
			, "        if: false\n        run:"))
		, job.replace(preflight, preflight.replace("        run:"
			, "        continue-on-error: true\n        run:"))
		, job.replace(preflight, preflight.replace("= false", "= true"))
		, job.replace(preflight, preflight.replace("= false"
			, "= false || true"))
	]) {
		assert.notEqual(changedJob, job);
		assert.throws(() => requireHistory(source.replace(job, () => changedJob)));
	}
});
