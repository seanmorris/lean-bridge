/**
 * Require four complete nominal Rust selections without replacing earlier gates.
 *
 * @file
 */
import assert from "node:assert/strict";

export const nominalSubtypeRustCiBlock = `      - name: Require nominal Rust packages on the pinned toolchain
        if: matrix.profile == 'rust'
        timeout-minutes: 45
        env:
          LEAN_NUM_THREADS: "1"
          CARGO_BUILD_JOBS: "1"
        run: |
          set -euo pipefail
          bash scripts/bootstrap-rust-ci.sh
          source scripts/env.sh
          bash scripts/run-nominal-subtype-rust-ci.sh "$PWD/.toolchains/rust-1.90.0/bin/rustc" "$PWD/.toolchains/rust-1.90.0/bin/cargo"
      - name: Preserve complete and partial nominal Rust records
        if: always() && matrix.profile == 'rust'
        uses: actions/upload-artifact@v7
        with:
          name: nominal-subtype-rust-\${{ github.sha }}
          path: build/nominal-subtype-rust-ci/
          if-no-files-found: error
          retention-days: 30
`;
const anchor = "      - name: Upload installed Rust corpus observations\n        if: always() && matrix.profile == 'rust'\n";

/**
 * Add the required gate and full record upload at the existing Rust boundary.
 *
 * @param source - Complete predecessor workflow.
 */
export const enableNominalSubtypeRustWorkflow = source => {
	assert.ok(!source.includes("run-nominal-subtype-rust-ci.sh"));
	assert.equal(source.split(anchor).length, 2);
	return source.replace(anchor, () => nominalSubtypeRustCiBlock + anchor);
};

/**
 * Remove only the exact addition, preserving every older step byte-for-byte.
 *
 * @param source - Complete current workflow.
 */
export const disableNominalSubtypeRustWorkflow = source => {
	assert.equal(source.split(nominalSubtypeRustCiBlock).length, 2);
	return source.replace(nominalSubtypeRustCiBlock, "");
};

/**
 * Permit historical workflows without hiding partial or altered additions.
 *
 * @param source - Current or earlier complete workflow.
 */
export const withoutNominalSubtypeRustWorkflow = source => source.includes("run-nominal-subtype-rust-ci.sh")
	? disableNominalSubtypeRustWorkflow(source) : source;

/**
 * Require the actual pinned setup, full history and blocking native job status.
 *
 * @param source - Complete current workflow.
 */
export const assertNominalSubtypeRustWorkflow = source => {
	assert.equal(enableNominalSubtypeRustWorkflow(disableNominalSubtypeRustWorkflow(source)), source);
	const position = source.indexOf(nominalSubtypeRustCiBlock);
	const job = [...source.slice(0, position).matchAll(/^ {2}([a-z][a-z0-9-]*):\n/gmu)].at(-1)?.[1];
	assert.equal(job, "native-consumers");
	const body = source.split("\n  native-consumers:\n")[1]?.split(/\n {2}[a-z][a-z0-9-]*:\n/u)[0];
	assert.equal(typeof body, "string");
	assert.match(body, /^ {4}runs-on: ubuntu-24\.04$/mu);
	assert.ok(body.includes("    timeout-minutes: ${{ matrix.profile == 'c-family' && 360 || 240 }}\n"));
	assert.match(body, /^ {8}profile: \[c-family, python, rust\]$/mu);
	assert.match(body, /^ {10}fetch-depth: 0$/mu);
	assert.doesNotMatch(body, /^ {4}(?:if:|continue-on-error:)|LEAN_BRIDGE_NOMINAL_SUBTYPE_RUST_/mu);
	const previous = "          test -s build/type-corpus/reviewed-native-rust.json\n";
	assert.ok(body.includes(previous)); assert.ok(body.indexOf(previous) < body.indexOf(nominalSubtypeRustCiBlock));
	assert.equal(source.split("          bash scripts/run-nominal-subtype-rust-ci.sh ").length, 2);
	assert.match(source.split("\n  support-summary:\n")[1], /^ {6}- native-consumers$/mu);
};
