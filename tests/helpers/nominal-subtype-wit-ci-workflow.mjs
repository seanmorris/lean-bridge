/**
 * Require all four nominal WIT selections while preserving every existing consumer gate.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertIsolatedWasmtimeCapiBootstraps } from "./wasmtime-capi-bootstrap.mjs";

export const nominalSubtypeWitCiBlock = `      - name: Require nominal WIT packages
        id: nominal_wit
        continue-on-error: true
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
const nominalSubtypeWitHistoricalCiBlock = nominalSubtypeWitCiBlock.replace(
	"        continue-on-error: true\n", ""
);
const anchor = "      - name: Record WIT and WASI observations\n";
export const nominalSubtypeWitRequiredSteps = [
	"consumer", "ordinary_wit", "structured_wit", "recursive_wit"
	, "type_corpus_wit"
	, "owned_wit_projection", "owned_wit_native", "owned_wit_session"
	, "owned_wit_package", "owned_wit_callback_packages"
	, "owned_wit_transfers", "owned_wit_borrows"
];
const condition = nominalSubtypeWitRequiredSteps.map(id => `steps.${id}.outcome != 'success'`).join(" || ");
const success = "steps.owned_wit_borrows.outcome == 'success' && ";
const command = ' && npm run test:owned-wit-callback-packages"\n';
const nominalCommand = ' && bash scripts/run-nominal-subtype-wit-ci.sh \\"/usr/bin/cc\\" \\"$PWD/.toolchains/wasm-tools/bin/wasm-tools\\" \\"$PWD/build/wasmtime-c-api\\"';
const directProofCommand = " && bash scripts/run-direct-proof-erasure-wit-ci.sh";
const optionalParameterCommand = " && bash scripts/run-optional-parameter-wit-ci.sh";
const variants = [
	{
		gate: "        if: always() && (" + condition + " || steps.direct_proof_wit.outcome != 'success' || steps.optional_parameters_wit.outcome != 'success')\n"
		, updatedGate: "        if: always() && (" + condition + " || steps.nominal_wit.outcome != 'success' || steps.direct_proof_wit.outcome != 'success' || steps.optional_parameters_wit.outcome != 'success')\n"
		, success: success + "steps.direct_proof_wit.outcome == 'success' && steps.optional_parameters_wit.outcome == 'success' && "
		, updatedSuccess: success + "steps.nominal_wit.outcome == 'success' && steps.direct_proof_wit.outcome == 'success' && steps.optional_parameters_wit.outcome == 'success' && "
		, command: command.replace('"\n', directProofCommand + optionalParameterCommand + '"\n')
		, updatedCommand: command.replace('"\n', nominalCommand + directProofCommand + optionalParameterCommand + '"\n')
		, anchor: "      - name: Qualify optional parameters in the prepared WIT package\n"
	}

	, {
		gate: "        if: always() && (" + condition + " || steps.direct_proof_wit.outcome != 'success')\n"
		, updatedGate: "        if: always() && (" + condition + " || steps.nominal_wit.outcome != 'success' || steps.direct_proof_wit.outcome != 'success')\n"
		, success: success + "steps.direct_proof_wit.outcome == 'success' && "
		, updatedSuccess: success + "steps.nominal_wit.outcome == 'success' && steps.direct_proof_wit.outcome == 'success' && "
		, command: command.replace('"\n', directProofCommand + '"\n')
		, updatedCommand: command.replace('"\n', nominalCommand + directProofCommand + '"\n')
		, anchor: "      - name: Qualify direct proof erasure in the prepared WIT package\n"
	}
	, {
		gate: "        if: " + condition + "\n"
		, updatedGate: "        if: always() && (" + condition + " || steps.nominal_wit.outcome != 'success')\n"
		, success
		, updatedSuccess: success + "steps.nominal_wit.outcome == 'success' && "
		, command
		, updatedCommand: command.replace('"\n', nominalCommand + '"\n')
		, anchor
	}
];
const jobBody = (source, job) => {
	const body = new RegExp(`^ {2}${job}:\\n[\\s\\S]*?(?=^ {2}[a-z][a-z0-9-]*:\\n)`, "mu")
		.exec(source)?.[0];
	assert.equal(typeof body, "string"); return body;
};
const historicalBodyOf = source => jobBody(source, "wasi-consumer");
const once = (source, from, to) => {
	assert.equal(source.split(from).length, 2); return source.replace(from, () => to);
};
const variantFor = (body, enabled) => {
	const matches = variants.filter(variant => body.includes(enabled ? variant.updatedGate : variant.gate)
		&& body.includes(enabled ? variant.updatedCommand : variant.command)
		&& body.split(enabled ? variant.updatedSuccess : variant.success).length === 3);
	assert.equal(matches.length, 1, "Expected one coherent WIT nominal-Subtype workflow epoch");
	return matches[0];
};
/**
 * Add the exact required runner, full artifact upload and enforced observations.
 *
 * @param source - Complete consumer workflow text.
 */
export const enableNominalSubtypeWitWorkflow = source => {
	const body = historicalBodyOf(source);
	assert.ok(!body.includes("run-nominal-subtype-wit-ci.sh"));
	const { gate, updatedGate, success, updatedSuccess, command, updatedCommand, anchor: insertion } = variantFor(body, false);
	let updated = once(body, insertion
		, nominalSubtypeWitHistoricalCiBlock + insertion);
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
	const body = historicalBodyOf(source);
	const { gate, updatedGate, success, updatedSuccess, command, updatedCommand } = variantFor(body, true);
	let previous = once(body, nominalSubtypeWitHistoricalCiBlock, "");
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
	const base = jobBody(source, "wasi-consumer");
	const qualifications = jobBody(source, "wasi-qualifications");
	const finalize = jobBody(source, "wasi-consumer-finalize");
	assert.match(base, /^ {4}runs-on: ubuntu-24\.04$/mu);
	assert.match(base, /^ {4}timeout-minutes: 300$/mu);
	assert.match(base, /^ {10}fetch-depth: 0$/mu);
	assert.match(base, /^ {10}persist-credentials: false$/mu);
	assert.doesNotMatch(base, /^ {4}(?:if:|continue-on-error:)/mu);
	assert.doesNotMatch(base
		, /test:owned-wit-callback-evidence|id: (?:nominal_wit|direct_proof_wit|optional_parameters_wit)/u);
	for(const id of nominalSubtypeWitRequiredSteps)
	{
		assert.equal(base.split(`steps.${id}.outcome == 'success'`).length - 1
			, 2, `${id} base observations`);
		assert.equal(base.split(`steps.${id}.outcome != 'success'`).length - 1
			, 1, `${id} base gate`);
	}
	assert.match(qualifications, /^ {4}needs: type-surface-authentication$/mu);
	assert.match(qualifications, /^ {4}runs-on: ubuntu-24\.04$/mu);
	assert.match(qualifications, /^ {4}timeout-minutes: 330$/mu);
	assert.match(qualifications, /^ {10}fetch-depth: 0$/mu);
	assert.match(qualifications, /^ {10}persist-credentials: false$/mu);
	assert.doesNotMatch(qualifications, /^ {4}(?:if:|continue-on-error:)/mu);
	assert.ok(qualifications.includes(nominalSubtypeWitCiBlock));
	assert.equal(qualifications.split("        continue-on-error: true\n").length - 1, 3);
	assert.equal(qualifications.split("        if: ${{ !cancelled() }}\n").length - 1, 2);
	for(const required of ["build-essential cmake pkg-config zstd ripgrep"
		, "          bash scripts/bootstrap-toolchains.sh --lean-only\n"
		, "          bash scripts/bootstrap-toolchains.sh --wasm-tools-only\n"
		, "bash scripts/run-optional-parameter-wit-ci.sh"
		, "bash scripts/run-direct-proof-erasure-wit-ci.sh"])
		assert.ok(qualifications.includes(required), required);
	assertIsolatedWasmtimeCapiBootstraps(qualifications);
	assert.match(qualifications
		, /name: Enforce all three WIT qualifications\n {8}if: always\(\) && \(steps\.nominal_wit\.outcome/u);
	for(const id of ["nominal_wit", "direct_proof_wit", "optional_parameters_wit"])
		assert.equal(qualifications.split(`steps.${id}.outcome != 'success'`).length - 1
			, 1, `${id} qualification gate`);
	assert.match(finalize, /^ {4}if: always\(\)$/mu);
	for(const job of ["wasi-consumer", "wasi-qualifications"])
	{
		assert.match(finalize, new RegExp(`^ {6}- ${job}$`, "mu"));
		assert.equal(finalize.split(`needs.${job}.result == 'success'`).length - 1
			, 2, `${job} final observations`);
		assert.equal(finalize.split(`needs.${job}.result != 'success'`).length - 1
			, 1, `${job} final gate`);
	}
	assert.match(finalize, /name: consumer-results-wasi-\$\{\{ github\.sha \}\}/u);
	assert.equal(source.split('          bash scripts/run-nominal-subtype-wit-ci.sh "/usr/bin/cc" "$PWD/.toolchains/wasm-tools/bin/wasm-tools" "$PWD/build/wasmtime-c-api"\n').length, 2);
	const supportSummary = source.split("\n  support-summary:\n")[1];
	assert.match(supportSummary, /^ {6}- wasi-consumer$/mu);
	assert.match(supportSummary, /^ {6}- wasi-consumer-finalize$/mu);
	assert.match(supportSummary
		, /name: Enforce combined WIT and WASI acceptance\n {8}if: needs\.wasi-consumer-finalize\.result != 'success'\n {8}run: exit 1/u);
	assert.match(source.split("\n  optional-parameter-matrix:\n")[1]
		, /^ {6}- wasi-consumer-finalize$/mu);
};
