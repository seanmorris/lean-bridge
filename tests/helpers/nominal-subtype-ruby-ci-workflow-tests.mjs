/**
 * Keep nominal Ruby acceptance required alongside all older hosted work.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { nominalSubtypeRubyCiBlock, enableNominalSubtypeRubyWorkflow, disableNominalSubtypeRubyWorkflow, assertNominalSubtypeRubyWorkflow } from "./nominal-subtype-ruby-ci-workflow.mjs";
import { assertNominalSubtypePythonWorkflow } from "./nominal-subtype-python-ci-workflow.mjs";
import { assertStructuralSubtypeWorkflow } from "./structural-subtype-ci-workflow.mjs";

const path = ".github/workflows/consumer-matrix.yml";
const predecessor = "e5020a56b2750c42160567ca931d24772679e6e7";

test("nominal Ruby CI preserves older jobs and requires four complete pinned-interpreter selections", async () => {
	const source = await readFile(path, "utf8");
	assertNominalSubtypeRubyWorkflow(source);
	const previous = execFileSync("git", ["show", `${predecessor}:${path}`], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
	assert.equal(disableNominalSubtypeRubyWorkflow(source), previous);
	assert.equal(enableNominalSubtypeRubyWorkflow(previous), source);
	assertNominalSubtypePythonWorkflow(source);
	assertStructuralSubtypeWorkflow(source, "consumer-matrix.yml");
});

test("nominal Ruby CI rejects skipped gates, wrong interpreters and narrowed original records", async t => {
	const source = await readFile(path, "utf8"), block = nominalSubtypeRubyCiBlock;
	const replacements = [
		[block, ""]
		, [block, block.replace("        run: |", "        continue-on-error: true\n        run: |")]
		, [block, block.replace("        if: matrix.profile == 'ruby'", "        if: false")]
		, [block, block.replace("        if: always()", "        if: success()")]
		, [block, block.replace("          if-no-files-found: error", "          if-no-files-found: ignore")]
		, [block, block.replace("          path: build/nominal-subtype-ruby-ci/", "          path: build/nominal-subtype-ruby-ci/*/report.json")]
		, [block, block.replace("          retention-days: 30", "          retention-days: 1")]
		, [block, block.replace(' "$(command -v gem)"', "")]
		, [block, block.replace(' "$(command -v gem)"', ' "$(command -v ruby)"')]
		, [block, block.replace(' "$(command -v ruby)"', ' "ruby"')]
		, [block, block.replace('"$(command -v gem)"\n', '"$(command -v gem)" || true\n')]
		, [block, block.replace("          source scripts/env.sh", "          set +e\n          source scripts/env.sh")]
		, [block, block.replace("        timeout-minutes: 45", "        timeout-minutes: 1")]
		, ["  managed-consumers:\n", "  managed-consumers:\n    if: false\n"]
		, ["  managed-consumers:\n", "  managed-consumers:\n    continue-on-error: true\n"]
		, ["        profile: [dotnet, jvm, ruby]", "        profile: [dotnet, jvm]"]
		, ["      - managed-consumers\n", ""]
		, ["      - name: Install the ordinary Ruby runtime\n", "      - name: Unverified Ruby runtime\n"]
		, ["      - name: Install the ordinary Ruby runtime\n        if: matrix.profile == 'ruby'", "      - name: Install the ordinary Ruby runtime\n        if: false"]
		, ...["LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR", "LEAN_BRIDGE_NOMINAL_SUBTYPE_RUBY_ROUTES", "LEAN_BRIDGE_NOMINAL_SUBTYPE_RUBY_MODES"].map(name => [block, block.replace("          LEAN_NUM_THREADS:", `          ${name}: override\n          LEAN_NUM_THREADS:`)])
	];
	for(const [index, [from, to]] of replacements.entries())
	{
		const changed = source.replace(from, () => to); assert.notEqual(changed, source);
		assert.throws(() => assertNominalSubtypeRubyWorkflow(changed), assert.AssertionError, `workflow mutation ${index}`);
	}
	const rubyJob = source.split("\n  managed-consumers:\n")[1].split(/\n {2}[a-z][a-z0-9-]*:\n/u)[0];
	for(const [from, to] of [["fetch-depth: 0", "fetch-depth: 1"], ["ruby-version: '3.3.12'", "ruby-version: '3.2.0'"], ["timeout-minutes: 240", "timeout-minutes: 1"]])
	{
		const changed = source.replace(rubyJob, () => rubyJob.replaceAll(from, to)); assert.notEqual(changed, source);
		assert.throws(() => assertNominalSubtypeRubyWorkflow(changed), assert.AssertionError);
	}
	t.diagnostic(`${replacements.length + 3} missing, skipped, weakened or narrowed workflow controls`);
});
