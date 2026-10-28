/**
 * Require all four JVM selections without replacing earlier managed gates.
 *
 * @file
 */
import assert from "node:assert/strict";

export const nominalSubtypeJvmCiBlock = `      - name: Require nominal Java and Kotlin packages
        if: matrix.profile == 'jvm'
        id: nominal_jvm
        timeout-minutes: 45
        run: |
          set -euo pipefail
          source scripts/env.sh
          bash scripts/run-nominal-subtype-jvm-ci.sh "$JAVA_HOME/bin/java" "$JAVA_HOME/bin/javac" "$PWD/build/kotlin-tools/kotlinc/bin/kotlinc"
      - name: Preserve complete and partial nominal JVM records
        if: always() && matrix.profile == 'jvm'
        uses: actions/upload-artifact@v7
        with:
          name: nominal-subtype-jvm-\${{ github.sha }}
          path: build/nominal-subtype-jvm-ci/
          if-no-files-found: error
          retention-days: 30
`;
const anchor = "      - name: Upload installed Java and Kotlin corpus observations\n        if: always() && matrix.profile == 'jvm'\n";
const command = '              consumer_command="$consumer_command && bash scripts/run-nominal-subtype-jvm-ci.sh \\"$JAVA_HOME/bin/java\\" \\"$JAVA_HOME/bin/javac\\" \\"$PWD/build/kotlin-tools/kotlinc/bin/kotlinc\\""\n';
const directProofCommand = '              consumer_command="$consumer_command && bash scripts/run-direct-proof-erasure-managed-ci.sh jvm"\n';
const variants = [
	{
		summary: '              if [ "${{ steps.ordinary_jvm.outcome }}" != success ] || [ "${{ steps.type_corpus_jvm.outcome }}" != success ] || [ "${{ steps.direct_proof_managed.outcome }}" != success ]; then\n'
		, updatedSummary: '              if [ "${{ steps.ordinary_jvm.outcome }}" != success ] || [ "${{ steps.type_corpus_jvm.outcome }}" != success ] || [ "${{ steps.nominal_jvm.outcome }}" != success ] || [ "${{ steps.direct_proof_managed.outcome }}" != success ]; then\n'
		, gate: "(matrix.profile == 'jvm' && (steps.ordinary_jvm.outcome != 'success' || steps.type_corpus_jvm.outcome != 'success' || steps.direct_proof_managed.outcome != 'success'))"
		, updatedGate: "(matrix.profile == 'jvm' && (steps.ordinary_jvm.outcome != 'success' || steps.type_corpus_jvm.outcome != 'success' || steps.nominal_jvm.outcome != 'success' || steps.direct_proof_managed.outcome != 'success'))"
		, beforeSummary: directProofCommand
		, afterCommand: directProofCommand
	}
	, {
		summary: '              if [ "${{ steps.ordinary_jvm.outcome }}" != success ] || [ "${{ steps.type_corpus_jvm.outcome }}" != success ]; then\n'
		, updatedSummary: '              if [ "${{ steps.ordinary_jvm.outcome }}" != success ] || [ "${{ steps.type_corpus_jvm.outcome }}" != success ] || [ "${{ steps.nominal_jvm.outcome }}" != success ]; then\n'
		, gate: "(matrix.profile == 'jvm' && (steps.ordinary_jvm.outcome != 'success' || steps.type_corpus_jvm.outcome != 'success'))"
		, updatedGate: "(matrix.profile == 'jvm' && (steps.ordinary_jvm.outcome != 'success' || steps.type_corpus_jvm.outcome != 'success' || steps.nominal_jvm.outcome != 'success'))"
		, beforeSummary: ""
		, afterCommand: ""
	}
];
const replaceOnce = (source, from, to) => {
	assert.equal(source.split(from).length, 2);
	return source.replace(from, () => to);
};
const variantFor = (source, enabled) => {
	const matches = variants.filter(variant => source.includes(enabled
		? command + variant.afterCommand + variant.updatedSummary
		: variant.beforeSummary + variant.summary)
		&& source.includes(enabled ? variant.updatedGate : variant.gate));
	assert.equal(matches.length, 1, "Expected one coherent JVM nominal-Subtype workflow epoch");
	return matches[0];
};

/**
 * Add one blocking gate, complete artifact retention and an enforced summary.
 *
 * @param source - Complete predecessor workflow.
 */
export const enableNominalSubtypeJvmWorkflow = source => {
	assert.ok(!source.includes("run-nominal-subtype-jvm-ci.sh"));
	const { summary, updatedSummary, gate, updatedGate, beforeSummary, afterCommand } = variantFor(source, false);
	source = replaceOnce(source, anchor, nominalSubtypeJvmCiBlock + anchor);
	source = replaceOnce(source, beforeSummary + summary, command + afterCommand + updatedSummary);
	return replaceOnce(source, gate, updatedGate);
};

/**
 * Remove only the exact new gate and its enforced summary additions.
 *
 * @param source - Complete current workflow.
 */
export const disableNominalSubtypeJvmWorkflow = source => {
	const { summary, updatedSummary, gate, updatedGate, beforeSummary, afterCommand } = variantFor(source, true);
	source = replaceOnce(source, nominalSubtypeJvmCiBlock, "");
	source = replaceOnce(source, command + afterCommand + updatedSummary, beforeSummary + summary);
	return replaceOnce(source, updatedGate, gate);
};

/**
 * Require pinned tools, complete records and the unchanged managed job budget.
 *
 * @param source - Complete current workflow.
 */
export const assertNominalSubtypeJvmWorkflow = source => {
	assert.equal(enableNominalSubtypeJvmWorkflow(disableNominalSubtypeJvmWorkflow(source)), source);
	const { updatedSummary, updatedGate, afterCommand } = variantFor(source, true);
	const body = source.split("\n  managed-consumers:\n")[1]?.split(/\n {2}[a-z][a-z0-9-]*:\n/u)[0];
	assert.equal(typeof body, "string"); assert.ok(body.includes(nominalSubtypeJvmCiBlock));
	assert.match(body, /^ {4}runs-on: ubuntu-24\.04$/mu);
	assert.match(body, /^ {4}timeout-minutes: 240$/mu);
	assert.match(body, /^ {8}profile: \[dotnet, jvm, ruby\]$/mu);
	assert.match(body, /^ {10}fetch-depth: 0$/mu);
	assert.match(body, /^ {10}persist-credentials: false$/mu);
	assert.doesNotMatch(body, /^ {4}(?:if:|continue-on-error:)|LEAN_BRIDGE_NOMINAL_SUBTYPE_JVM_/mu);
	assert.ok(body.includes("          java-version: '22.0.2'\n"));
	assert.ok(body.includes("echo '1adb6f1a5845ba0aa5a59e412e44c8e405236b957de1a9683619f1dca3b16932  build/kotlin-compiler.zip' | sha256sum --check"));
	const previous = "          test -s build/type-corpus/reviewed-native-java-kotlin.json\n";
	assert.ok(body.includes(previous) && body.indexOf(previous) < body.indexOf(nominalSubtypeJvmCiBlock));
	assert.ok(body.includes(command + afterCommand + updatedSummary)); assert.ok(body.includes(updatedGate));
	assert.equal(source.split("          bash scripts/run-nominal-subtype-jvm-ci.sh ").length, 2);
	assert.match(source.split("\n  support-summary:\n")[1], /^ {6}- managed-consumers$/mu);
};
