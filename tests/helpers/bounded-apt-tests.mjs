/**
 * CI dependency installation must fail promptly instead of consuming a whole test job.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const action = "./.github/actions/bounded-apt";
const network = /\bapt-get\s+(?:update|install)\b|\bplaywright\s+install[^\n]*--with-deps/u;

/**
 * Check every apt or Playwright dependency step in our two-space-indented workflows.
 *
 * @param source - Complete checked-in workflow text.
 */
export const assertBoundedAptWorkflow = source => {
	assert.match(source, /^jobs:\s*$/mu);
	const jobs = source.slice(source.indexOf("\njobs:") + 1).split(/(?=^ {2}[\w-]+:\s*$)/mu).slice(1);
	let checked = 0;
	for(const job of jobs)
	{
		const name = job.split("\n")[0].trim();
		const steps = job.split(/(?=^ {6}- )/mu).slice(1);
		const configured = steps.findIndex(step => step.includes(`uses: ${action}`));
		for(const [index, step] of steps.entries())
		{
			if(!network.test(step)) continue;
			assert.ok(configured >= 0 && configured < index, `${name} must configure apt before network use`);
			const setup = steps[configured];
			assert.doesNotMatch(setup, /^ {8}(?:if|continue-on-error):/mu, `${name} must not skip apt configuration`);
			assert.ok(steps.slice(0, configured).some(value => /uses: actions\/checkout@/u.test(value)), `${name} needs the local action checkout`);
			const timeout = Number(step.match(/^ {8}timeout-minutes: (\d+)\s*$/mu)?.[1]);
			assert.ok(timeout > 0 && timeout <= 20, `${name} dependency step must finish within 20 minutes`);
			assert.doesNotMatch(step, /^ {8}continue-on-error: true\s*$/mu, `${name} must not ignore dependency failure`);
			checked++;
		}
	}
	assert.ok(checked > 0, "workflow must contain checked apt-dependent steps");
	return checked;
};

test("apt limits cover HTTP, HTTPS, retries and partial update failures", async () => {
	const config = await readFile(".github/actions/bounded-apt/apt-network.conf", "utf8");
	assert.equal(config, 'Acquire::http::Timeout "30";\nAcquire::https::Timeout "30";\nAcquire::Retries "2";\nAPT::Update::Error-Mode "any";\n');
	const source = await readFile(".github/actions/bounded-apt/action.yml", "utf8");
	assert.match(source, /using: composite/u);
	assert.match(source, /sudo install -m 0644 "\$\{\{ github\.action_path \}\}\/apt-network\.conf" \/etc\/apt\/apt\.conf\.d\/99lean-bridge-network/u);
	assert.doesNotMatch(source, /continue-on-error|\|\| true/u);
});

test("apt guard rejects missing configuration, unbounded steps and indirect Playwright apt", () => {
	const source = `name: fixture
jobs:
  native:
    steps:
      - uses: actions/checkout@v6
      - uses: ${action}
      - name: Install tools
        timeout-minutes: 15
        run: sudo apt-get update && sudo apt-get install -y curl
      - name: Install browsers
        timeout-minutes: 20
        run: npx playwright install --with-deps chromium
`;
	assert.equal(assertBoundedAptWorkflow(source), 2);
	for(const [before, after] of [
		[`      - uses: ${action}\n`, ""]
		, ["      - uses: actions/checkout@v6\n", ""]
		, [`      - uses: ${action}\n`, `      - uses: ${action}\n        if: false\n`]
		, ["        timeout-minutes: 15\n", ""]
		, ["        timeout-minutes: 20\n", ""]
		, ["timeout-minutes: 20", "timeout-minutes: 120"]
		, ["timeout-minutes: 15", "timeout-minutes: 0"]
		, ["        timeout-minutes: 20\n", "        timeout-minutes: 20\n        continue-on-error: true\n"]
	]) assert.throws(() => assertBoundedAptWorkflow(source.replace(before, after)));
});

test("downstream and Perl workflows bound direct and indirect apt installation", async () => {
	for(const path of [".github/workflows/consumer-matrix.yml", ".github/workflows/perl-consumer.yml"])
		assertBoundedAptWorkflow(await readFile(path, "utf8"));
});
