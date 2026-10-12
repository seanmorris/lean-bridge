/**
 * Require all four nominal CPAN selections in the existing four-ABI job.
 *
 * @file
 */
import assert from "node:assert/strict";

export const nominalSubtypePerlCiBlock = `      - name: Require ordinary and reviewed full and result-only nominal CPAN packages
        env:
          LEAN_NUM_THREADS: "2"
        run: |
          source scripts/env.sh
          bash scripts/run-nominal-subtype-perl-ci.sh
      - name: Preserve complete and partial nominal CPAN records
        if: always()
        uses: actions/upload-artifact@v7
        with:
          name: nominal-subtype-perl-\${{ github.sha }}
          path: build/nominal-subtype-perl-ci/
          if-no-files-found: error
          retention-days: 30
`;

/**
 * Append required acceptance without replacing any older producer or upload.
 *
 * @param source - Complete predecessor workflow.
 */
export const enableNominalSubtypePerlWorkflow = source => {
	assert.ok(!source.includes("run-nominal-subtype-perl-ci.sh"));
	assert.equal(source.split("\n  nix-engine:\n").length, 2);
	return source.replace("\n  nix-engine:\n", () => nominalSubtypePerlCiBlock + "\n  nix-engine:\n");
};

/**
 * Remove only the complete expected addition for comparison with earlier gates.
 *
 * @param source - Complete current workflow.
 */
export const disableNominalSubtypePerlWorkflow = source => {
	assert.equal(source.split(nominalSubtypePerlCiBlock).length, 2);
	return source.replace(nominalSubtypePerlCiBlock, "");
};

/**
 * Support an earlier workflow without masking edited or incomplete additions.
 *
 * @param source - Current or predecessor workflow.
 */
export const withoutNominalSubtypePerlWorkflow = source => source.includes("run-nominal-subtype-perl-ci.sh")
	? disableNominalSubtypePerlWorkflow(source) : source;

/**
 * Refuse skipped jobs, changed toolchains, narrowed uploads and tolerated failures.
 *
 * @param source - Actual live workflow, not a reconstructed predecessor.
 */
export const assertNominalSubtypePerlWorkflow = source => {
	assert.equal(enableNominalSubtypePerlWorkflow(disableNominalSubtypePerlWorkflow(source)), source);
	const position = source.indexOf(nominalSubtypePerlCiBlock);
	const job = [...source.slice(0, position).matchAll(/^ {2}([a-z][a-z0-9-]*):\n/gmu)].at(-1)?.[1];
	assert.equal(job, "checked-records");
	const body = source.split("\n  checked-records:\n")[1]?.split(/\n {2}[a-z][a-z0-9-]*:\n/u)[0];
	assert.equal(typeof body, "string");
	assert.match(body, /^ {4}runs-on: ubuntu-24\.04$/mu);
	assert.match(body, /^ {4}timeout-minutes: 120$/mu);
	assert.doesNotMatch(body, /continue-on-error:|set \+e|\|\| true|^ {4}if:/mu);
	assert.doesNotMatch(body, /LEAN_BRIDGE_(?:(?:NATIVE|PERL)_TEST_GLIBC_FLOOR|NOMINAL_SUBTYPE_PERLS|PERLS|CORPUS_PERL)/u);
	const command = "          bash scripts/run-nominal-subtype-perl-ci.sh\n";
	assert.equal(source.split(command).length, 2);
	for(const configuration of ["5.36.3 threaded", "5.36.3 unthreaded", "5.38.2 threaded", "5.38.2 unthreaded"])
	{
		const line = `          node scripts/build-perl-toolchains.mjs ${configuration}\n`;
		assert.equal(body.split(line).length, 2); assert.ok(body.indexOf(line) < body.indexOf(command));
	}
	const summary = source.split("\n  perl-summary:\n")[1];
	assert.match(summary, /^ {6}- checked-records$/mu);
	assert.ok(summary.includes("needs.checked-records.result == 'success'"));
};
