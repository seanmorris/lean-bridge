/**
 * Require four nominal C# selections without replacing earlier managed gates.
 *
 * @file
 */
import assert from "node:assert/strict";

export const nominalSubtypeDotnetCiBlock = `      - name: Install the isolated nominal C# SDK
        if: matrix.profile == 'dotnet'
        timeout-minutes: 20
        uses: actions/setup-dotnet@v6
        env:
          DOTNET_INSTALL_DIR: \${{ runner.temp }}/lean-bridge-nominal-dotnet-8.0.424
        with:
          dotnet-version: '8.0.424'
      - name: Require nominal C# packages on the pinned SDK
        if: matrix.profile == 'dotnet'
        timeout-minutes: 45
        env:
          LEAN_NUM_THREADS: "1"
          MSBUILDDISABLENODEREUSE: "1"
        run: |
          set -euo pipefail
          source scripts/env.sh
          bash scripts/run-nominal-subtype-dotnet-ci.sh "$RUNNER_TEMP/lean-bridge-nominal-dotnet-8.0.424/dotnet"
      - name: Preserve complete and partial nominal C# records
        if: always() && matrix.profile == 'dotnet'
        uses: actions/upload-artifact@v7
        with:
          name: nominal-subtype-dotnet-\${{ github.sha }}
          path: build/nominal-subtype-dotnet-ci/
          if-no-files-found: error
          retention-days: 30
`;
const anchor = "      - name: Upload the .NET real-Lean type corpus report\n        if: always() && matrix.profile == 'dotnet'\n";

/**
 * Add an isolated SDK, blocking producer and complete record upload.
 *
 * @param source - Complete predecessor workflow.
 */
export const enableNominalSubtypeDotnetWorkflow = source => {
	assert.ok(!source.includes("run-nominal-subtype-dotnet-ci.sh"));
	assert.equal(source.split(anchor).length, 2);
	return source.replace(anchor, () => nominalSubtypeDotnetCiBlock + anchor);
};

/**
 * Remove only the exact new steps, preserving all previous workflow bytes.
 *
 * @param source - Complete current workflow.
 */
export const disableNominalSubtypeDotnetWorkflow = source => {
	assert.equal(source.split(nominalSubtypeDotnetCiBlock).length, 2);
	return source.replace(nominalSubtypeDotnetCiBlock, "");
};

/**
 * Require pinned tools, complete records, full source history and blocking status.
 *
 * @param source - Complete current workflow.
 */
export const assertNominalSubtypeDotnetWorkflow = source => {
	assert.equal(enableNominalSubtypeDotnetWorkflow(disableNominalSubtypeDotnetWorkflow(source)), source);
	const position = source.indexOf(nominalSubtypeDotnetCiBlock);
	const job = [...source.slice(0, position).matchAll(/^ {2}([a-z][a-z0-9-]*):\n/gmu)].at(-1)?.[1];
	assert.equal(job, "managed-consumers");
	const body = source.split("\n  managed-consumers:\n")[1]?.split(/\n {2}[a-z][a-z0-9-]*:\n/u)[0];
	assert.equal(typeof body, "string");
	assert.match(body, /^ {4}runs-on: ubuntu-24\.04$/mu);
	assert.match(body, /^ {4}timeout-minutes: 240$/mu);
	assert.match(body, /^ {8}profile: \[dotnet, jvm, ruby\]$/mu);
	assert.match(body, /^ {10}fetch-depth: 0$/mu);
	assert.match(body, /^ {10}persist-credentials: false$/mu);
	assert.doesNotMatch(body, /^ {4}(?:if:|continue-on-error:)|LEAN_BRIDGE_NOMINAL_SUBTYPE_DOTNET_/mu);
	const previous = "          test -s build/type-corpus/reviewed-native-dotnet.json\n";
	assert.ok(body.includes(previous));
	assert.ok(body.indexOf(previous) < body.indexOf(nominalSubtypeDotnetCiBlock));
	assert.equal(source.split("          bash scripts/run-nominal-subtype-dotnet-ci.sh ").length, 2);
	assert.match(source.split("\n  support-summary:\n")[1], /^ {6}- managed-consumers$/mu);
};
