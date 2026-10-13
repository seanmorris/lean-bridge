/**
 * Require all four nominal Composer selections without replacing earlier PHP gates.
 *
 * @file
 */
import assert from "node:assert/strict";

export const nominalSubtypePhpCiBlock = `      - name: Require nominal native PHP packages
        id: nominal_php
        timeout-minutes: 45
        run: |
          set -euo pipefail
          source scripts/env.sh
          bash scripts/run-nominal-subtype-php-ci.sh "/usr/bin/php" "/usr/bin/composer"
      - name: Preserve complete and partial nominal PHP records
        if: always()
        uses: actions/upload-artifact@v7
        with:
          name: nominal-subtype-php-\${{ github.sha }}-attempt-\${{ github.run_attempt }}
          path: build/nominal-subtype-php-ci/
          if-no-files-found: error
          overwrite: false
          retention-days: 30
`;
const anchor = "      - name: Upload installed PHP corpus observations\n";
const summary = '          if [ "${{ steps.ordinary_php.outcome }}" != success ] || [ "${{ steps.type_corpus_php_native.outcome }}" != success ] || [ "${{ steps.owned_php.outcome }}" != success ]; then\n';
const updatedSummary = summary.replace("; then", ' || [ "${{ steps.nominal_php.outcome }}" != success ]; then');
const command = ' && npm run test:owned-php-borrows"\n';
const updatedCommand = command.replace('"\n', ' && bash scripts/run-nominal-subtype-php-ci.sh \\"/usr/bin/php\\" \\"/usr/bin/composer\\""\n');
const condition = "steps.consumer.outcome != 'success' || steps.ordinary_php.outcome != 'success' || steps.type_corpus_php_native.outcome != 'success' || steps.owned_php.outcome != 'success'";
const gate = "        if: " + condition + "\n";
const updatedGate = "        if: always() && (" + condition + " || steps.nominal_php.outcome != 'success')\n";
const bodyOf = source => {
	const body = /^ {2}php-consumers:\n[\s\S]*?(?=^ {2}[a-z][a-z0-9-]*:\n)/mu.exec(source)?.[0];
	assert.equal(typeof body, "string"); return body;
};
const replaceOnce = (source, from, to) => {
	assert.equal(source.split(from).length, 2);
	return source.replace(from, () => to);
};

/**
 * Add the required selection runner, full artifact upload and enforced observation.
 *
 * @param source - Complete predecessor workflow.
 */
export const enableNominalSubtypePhpWorkflow = source => {
	const body = bodyOf(source); assert.ok(!body.includes("run-nominal-subtype-php-ci.sh"));
	let updated = replaceOnce(body, anchor, nominalSubtypePhpCiBlock + anchor);
	updated = replaceOnce(updated, summary, updatedSummary);
	updated = replaceOnce(updated, command, updatedCommand);
	updated = replaceOnce(updated, gate, updatedGate);
	return replaceOnce(source, body, updated);
};

/**
 * Restore only the exact new gate and its observation/command additions.
 *
 * @param source - Complete current workflow.
 */
export const disableNominalSubtypePhpWorkflow = source => {
	const body = bodyOf(source);
	let previous = replaceOnce(body, nominalSubtypePhpCiBlock, "");
	previous = replaceOnce(previous, updatedSummary, summary);
	previous = replaceOnce(previous, updatedCommand, command);
	previous = replaceOnce(previous, updatedGate, gate);
	return replaceOnce(source, body, previous);
};

/**
 * Require the complete native PHP gate and unchanged job-level budget/bootstrap.
 *
 * @param source - Complete current workflow.
 */
export const assertNominalSubtypePhpWorkflow = source => {
	assert.equal(enableNominalSubtypePhpWorkflow(disableNominalSubtypePhpWorkflow(source)), source);
	const body = bodyOf(source); assert.ok(body.includes(nominalSubtypePhpCiBlock));
	assert.match(body, /^ {4}runs-on: ubuntu-24\.04$/mu);
	assert.match(body, /^ {4}timeout-minutes: 240$/mu);
	assert.match(body, /^ {10}fetch-depth: 0$/mu);
	assert.match(body, /^ {10}persist-credentials: false$/mu);
	assert.doesNotMatch(body, /^ {4}(?:if:|continue-on-error:)|LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_/mu);
	assert.ok(body.includes("php-cli php-dev php-common php-zip php-mbstring composer"));
	assert.ok(body.includes("          bash scripts/bootstrap-toolchains.sh --lean-only\n"));
	assert.ok(body.includes(summary.replace("; then", ' || [ "${{ steps.nominal_php.outcome }}" != success ]; then')));
	assert.ok(body.includes(updatedCommand)); assert.ok(body.includes(updatedGate));
	assert.ok(body.indexOf("        id: owned_php\n") < body.indexOf(nominalSubtypePhpCiBlock));
	assert.ok(body.indexOf(nominalSubtypePhpCiBlock) < body.indexOf("        id: consumer\n"));
	assert.equal(source.split('          bash scripts/run-nominal-subtype-php-ci.sh "/usr/bin/php" "/usr/bin/composer"\n').length, 2);
	assert.match(source.split("\n  support-summary:\n")[1], /^ {6}- php-consumers$/mu);
};
