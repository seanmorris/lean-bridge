/**
 * Require all four nominal WIT selections while preserving every existing consumer gate.
 *
 * @file
 */
import assert from "node:assert/strict";

export const nominalSubtypeWitCiBlock = `      - name: Require nominal WIT packages
        id: nominal_wit
        timeout-minutes: 45
        run: |
          set -euo pipefail
          source scripts/env.sh
          bash scripts/run-nominal-subtype-wit-ci.sh "/usr/bin/cc" "$PWD/.toolchains/wasm-tools/bin/wasm-tools" "$PWD/build/wasmtime-c-api"
      - name: Preserve complete and partial nominal WIT records
        if: always()
        uses: actions/upload-artifact@v7
        with:
          name: nominal-subtype-wit-\${{ github.sha }}-attempt-\${{ github.run_attempt }}
          path: build/nominal-subtype-wit-ci/
          if-no-files-found: error
          overwrite: false
          retention-days: 30
`;
const anchor = "      - name: Record WIT and WASI observations\n";
export const nominalSubtypeWitRequiredSteps = [
	"consumer", "ordinary_wit", "structured_wit", "recursive_wit"
	, "type_corpus_wit"
	, "owned_wit_projection", "owned_wit_native", "owned_wit_session"
	, "owned_wit_package", "owned_wit_callback_packages"
	, "owned_wit_transfers", "owned_wit_borrows"
];
const condition = nominalSubtypeWitRequiredSteps.map(id => `steps.${id}.outcome != 'success'`).join(" || ");
const gate = "        if: " + condition + "\n";
const updatedGate = "        if: always() && (" + condition + " || steps.nominal_wit.outcome != 'success')\n";
const success = "steps.owned_wit_borrows.outcome == 'success' && ";
const updatedSuccess = success + "steps.nominal_wit.outcome == 'success' && ";
const command = ' && npm run test:owned-wit-callback-packages"\n';
const updatedCommand = command.replace('"\n', ' && bash scripts/run-nominal-subtype-wit-ci.sh \\"/usr/bin/cc\\" \\"$PWD/.toolchains/wasm-tools/bin/wasm-tools\\" \\"$PWD/build/wasmtime-c-api\\""\n');
const bodyOf = source => {
	const body = /^ {2}wasi-consumer:\n[\s\S]*?(?=^ {2}[a-z][a-z0-9-]*:\n)/mu.exec(source)?.[0];
	assert.equal(typeof body, "string"); return body;
};
const once = (source, from, to) => {
	assert.equal(source.split(from).length, 2); return source.replace(from, () => to);
};
/**
 * Add the exact required runner, full artifact upload and enforced observations.
 *
 * @param source - Complete consumer workflow text.
 */
export const enableNominalSubtypeWitWorkflow = source => {
	const body = bodyOf(source); assert.ok(!body.includes("run-nominal-subtype-wit-ci.sh"));
	let updated = once(body, anchor, nominalSubtypeWitCiBlock + anchor);
	assert.equal(updated.split(success).length, 3); updated = updated.replaceAll(success, updatedSuccess);
	updated = once(updated, gate, updatedGate); updated = once(updated, command, updatedCommand);
	return once(source, body, updated);
};
/**
 * Remove only this gate and its observation additions for historical comparison.
 *
 * @param source - Complete consumer workflow text.
 */
export const disableNominalSubtypeWitWorkflow = source => {
	const body = bodyOf(source); let previous = once(body, nominalSubtypeWitCiBlock, "");
	assert.equal(previous.split(updatedSuccess).length, 3); previous = previous.replaceAll(updatedSuccess, success);
	previous = once(previous, updatedGate, gate); previous = once(previous, updatedCommand, command);
	return once(source, body, previous);
};
/**
 * Require the complete blocking WIT gate and preserved bootstrap and job budget.
 *
 * @param source - Complete consumer workflow text.
 */
export const assertNominalSubtypeWitWorkflow = source => {
	assert.equal(enableNominalSubtypeWitWorkflow(disableNominalSubtypeWitWorkflow(source)), source);
	const body = bodyOf(source); assert.ok(body.includes(nominalSubtypeWitCiBlock));
	assert.match(body, /^ {4}runs-on: ubuntu-24\.04$/mu);
	assert.match(body, /^ {4}timeout-minutes: 240$/mu);
	assert.match(body, /^ {10}fetch-depth: 0$/mu); assert.match(body, /^ {10}persist-credentials: false$/mu);
	assert.doesNotMatch(body, /^ {4}(?:if:|continue-on-error:)|LEAN_BRIDGE_NOMINAL_SUBTYPE_WIT_/mu);
	for(const required of ["build-essential cmake pkg-config zstd ripgrep"
		, "          bash scripts/bootstrap-toolchains.sh --lean-only\n"
		, "          bash scripts/bootstrap-toolchains.sh --wasm-tools-only\n"
		, "          nix build .#wasmtime-c-api --out-link build/wasmtime-c-api\n"])
		assert.ok(body.includes(required));
	assert.ok(body.includes(updatedCommand)); assert.ok(body.includes(updatedGate));
	assert.ok(body.indexOf("        id: type_corpus_wit\n") < body.indexOf(nominalSubtypeWitCiBlock));
	assert.ok(body.indexOf(nominalSubtypeWitCiBlock) < body.indexOf(anchor));
	assert.equal(source.split('          bash scripts/run-nominal-subtype-wit-ci.sh "/usr/bin/cc" "$PWD/.toolchains/wasm-tools/bin/wasm-tools" "$PWD/build/wasmtime-c-api"\n').length, 2);
	assert.match(source.split("\n  support-summary:\n")[1], /^ {6}- wasi-consumer$/mu);
};
