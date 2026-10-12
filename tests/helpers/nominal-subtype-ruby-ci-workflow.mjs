/**
 * Require four complete nominal Ruby selections without replacing earlier gates.
 *
 * @file
 */
import assert from "node:assert/strict";

export const nominalSubtypeRubyCiBlock = `      - name: Require nominal Ruby packages on the pinned interpreter
        if: matrix.profile == 'ruby'
        timeout-minutes: 45
        env:
          LEAN_NUM_THREADS: "2"
        run: |
          source scripts/env.sh
          bash scripts/run-nominal-subtype-ruby-ci.sh "$(command -v ruby)" "$(command -v gem)"
      - name: Preserve complete and partial nominal Ruby records
        if: always() && matrix.profile == 'ruby'
        uses: actions/upload-artifact@v7
        with:
          name: nominal-subtype-ruby-\${{ github.sha }}
          path: build/nominal-subtype-ruby-ci/
          if-no-files-found: error
          retention-days: 30
`;
const anchor = "      - name: Upload the Ruby real-Lean type corpus report\n        if: always() && matrix.profile == 'ruby'\n";

/**
 * Add the required gate and full record upload at the existing Ruby boundary.
 *
 * @param source - Complete predecessor workflow.
 */
export const enableNominalSubtypeRubyWorkflow = source => {
	assert.ok(!source.includes("run-nominal-subtype-ruby-ci.sh"));
	assert.equal(source.split(anchor).length, 2);
	return source.replace(anchor, () => nominalSubtypeRubyCiBlock + anchor);
};

/**
 * Remove only the exact addition, preserving every older step byte-for-byte.
 *
 * @param source - Complete current workflow.
 */
export const disableNominalSubtypeRubyWorkflow = source => {
	assert.equal(source.split(nominalSubtypeRubyCiBlock).length, 2);
	return source.replace(nominalSubtypeRubyCiBlock, "");
};

/**
 * Permit historical workflows without hiding partial or altered additions.
 *
 * @param source - Current or earlier complete workflow.
 */
export const withoutNominalSubtypeRubyWorkflow = source => source.includes("run-nominal-subtype-ruby-ci.sh")
	? disableNominalSubtypeRubyWorkflow(source) : source;

/**
 * Require the actual interpreter setup, full history and blocking job status.
 *
 * @param source - Complete current workflow.
 */
export const assertNominalSubtypeRubyWorkflow = source => {
	assert.equal(enableNominalSubtypeRubyWorkflow(disableNominalSubtypeRubyWorkflow(source)), source);
	const position = source.indexOf(nominalSubtypeRubyCiBlock);
	const job = [...source.slice(0, position).matchAll(/^ {2}([a-z][a-z0-9-]*):\n/gmu)].at(-1)?.[1];
	assert.equal(job, "managed-consumers");
	const body = source.split("\n  managed-consumers:\n")[1]?.split(/\n {2}[a-z][a-z0-9-]*:\n/u)[0];
	assert.equal(typeof body, "string");
	assert.match(body, /^ {4}runs-on: ubuntu-24\.04$/mu);
	assert.match(body, /^ {4}timeout-minutes: 240$/mu);
	assert.match(body, /^ {8}profile: \[dotnet, jvm, ruby\]$/mu);
	assert.match(body, /^ {10}fetch-depth: 0$/mu);
	assert.doesNotMatch(body, /^ {4}(?:if:|continue-on-error:)|LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR|LEAN_BRIDGE_NOMINAL_SUBTYPE_RUBY_/mu);
	const setup = "      - name: Install the ordinary Ruby runtime\n        if: matrix.profile == 'ruby'\n        uses: ruby/setup-ruby@v1\n        with:\n          ruby-version: '3.3.12'\n";
	assert.equal(body.split(setup).length, 2);
	assert.ok(body.indexOf(setup) < body.indexOf(nominalSubtypeRubyCiBlock));
	const previous = "          test -s build/type-corpus/reviewed-native-ruby.json\n";
	assert.ok(body.includes(previous)); assert.ok(body.indexOf(previous) < body.indexOf(nominalSubtypeRubyCiBlock));
	assert.equal(source.split("          bash scripts/run-nominal-subtype-ruby-ci.sh ").length, 2);
	assert.match(source.split("\n  support-summary:\n")[1], /^ {6}- managed-consumers$/mu);
};
