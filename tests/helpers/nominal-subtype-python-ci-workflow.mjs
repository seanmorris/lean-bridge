/**
 * Require all nominal Python selections after the existing Python corpus work.
 *
 * @file
 */
import assert from "node:assert/strict";

export const nominalSubtypePythonCiBlock = `      - name: Require nominal Python packages on both interpreter floors
        if: matrix.profile == 'python'
        timeout-minutes: 45
        env:
          LEAN_NUM_THREADS: "2"
          NOMINAL_PYTHON_311: \${{ steps.collection_python311.outputs.python-path }}
          NOMINAL_PYTHON_312: \${{ steps.collection_python312.outputs.python-path }}
        run: |
          source scripts/env.sh
          bash scripts/run-nominal-subtype-python-ci.sh "$NOMINAL_PYTHON_311" "$NOMINAL_PYTHON_312"
      - name: Preserve complete and partial nominal Python records
        if: always() && matrix.profile == 'python'
        uses: actions/upload-artifact@v7
        with:
          name: nominal-subtype-python-\${{ github.sha }}
          path: build/nominal-subtype-python-ci/
          if-no-files-found: error
          retention-days: 30
`;
const anchor = "      - name: Upload the real-Lean type corpus report\n        if: always() && matrix.profile == 'python'\n";

/**
 * Add required acceptance without replacing any older producer or upload.
 *
 * @param source - Complete predecessor workflow.
 */
export const enableNominalSubtypePythonWorkflow = source => {
	assert.ok(!source.includes("run-nominal-subtype-python-ci.sh"));
	assert.equal(source.split(anchor).length, 2);
	return source.replace(anchor, () => nominalSubtypePythonCiBlock + anchor);
};

/**
 * Remove only the complete expected addition for predecessor comparison.
 *
 * @param source - Complete current workflow.
 */
export const disableNominalSubtypePythonWorkflow = source => {
	assert.equal(source.split(nominalSubtypePythonCiBlock).length, 2);
	return source.replace(nominalSubtypePythonCiBlock, "");
};

/**
 * Permit the original workflow without concealing changed or partial additions.
 *
 * @param source - Current or earlier workflow.
 */
export const withoutNominalSubtypePythonWorkflow = source => source.includes("run-nominal-subtype-python-ci.sh")
	? disableNominalSubtypePythonWorkflow(source) : source;

/**
 * Require both interpreter setups, original gates, full history and required job status.
 *
 * @param source - Actual current workflow.
 */
export const assertNominalSubtypePythonWorkflow = source => {
	assert.equal(enableNominalSubtypePythonWorkflow(disableNominalSubtypePythonWorkflow(source)), source);
	const position = source.indexOf(nominalSubtypePythonCiBlock);
	const job = [...source.slice(0, position).matchAll(/^ {2}([a-z][a-z0-9-]*):\n/gmu)].at(-1)?.[1];
	assert.equal(job, "native-consumers");
	const body = source.split("\n  native-consumers:\n")[1]?.split(/\n {2}[a-z][a-z0-9-]*:\n/u)[0];
	assert.equal(typeof body, "string");
	assert.match(body, /^ {4}runs-on: ubuntu-24\.04$/mu);
	assert.match(body, /^ {8}profile: \[c-family, python, rust\]$/mu);
	assert.match(body, /^ {10}fetch-depth: 0$/mu);
	assert.doesNotMatch(body, /^ {4}(?:if:|continue-on-error:)|LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR|LEAN_BRIDGE_NOMINAL_SUBTYPE_PYTHONS/mu);
	for(const [minor, suffix] of [["3.11", "311"], ["3.12", "312"]])
	{
		const setup = `        id: collection_python${suffix}\n        if: matrix.profile == 'python'\n        uses: actions/setup-python@v7\n        with:\n          python-version: "${minor}"\n`;
		assert.equal(body.split(setup).length, 2); assert.ok(body.indexOf(setup) < body.indexOf(nominalSubtypePythonCiBlock));
	}
	assert.ok(body.indexOf("          test -s build/type-corpus/reviewed-native-python.json\n") < body.indexOf(nominalSubtypePythonCiBlock));
	assert.equal(source.split("          bash scripts/run-nominal-subtype-python-ci.sh ").length, 2);
	assert.match(source.split("\n  support-summary:\n")[1], /^ {6}- native-consumers$/mu);
};
