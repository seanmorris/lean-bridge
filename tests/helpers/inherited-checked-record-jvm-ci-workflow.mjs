/**
 * Require all four inherited checked-record Maven selections on the pinned JDK
 * and Kotlin compiler in a dedicated workflow.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	assertWorkflowRunBudget, workflowRunScalars
} from "./native-observation-split.mjs";

export const inheritedCheckedRecordJvmKotlinZipSha256
	= "1adb6f1a5845ba0aa5a59e412e44c8e405236b957de1a9683619f1dca3b16932";
const kotlinInstall = "set -euo pipefail\nmkdir -p build\ncurl -fL --retry 3 --output build/kotlin-compiler.zip https://github.com/JetBrains/kotlin/releases/download/v2.2.0/kotlin-compiler-2.2.0.zip\n"
	+ `echo '${inheritedCheckedRecordJvmKotlinZipSha256}  build/kotlin-compiler.zip' | sha256sum --check\nunzip -q build/kotlin-compiler.zip -d build/kotlin-tools`;

/**
 * Check the workflow without weakening the managed JVM consumer job.
 *
 * @param source - Complete inherited-checked-record-jvm.yml source.
 */
export const assertInheritedCheckedRecordJvmWorkflow = source => {
	assert.ok(source.startsWith(
		"name: Installed inherited checked records in Java and Kotlin\n"
	));
	assert.ok(source.includes(
		"on:\n  push:\n  pull_request:\n  workflow_dispatch:\n"
	));
	assert.ok(source.includes("permissions:\n  contents: read\n"));
	assert.ok(source.includes("concurrency:\n  group: inherited-checked-record-jvm-${{ github.ref }}\n  cancel-in-progress: true\n"));
	assert.deepEqual([...source.matchAll(
		/^ {2}([a-z][a-z0-9_-]*):\n/gmu
	)].map(match => match[1]), [
		"push", "pull_request", "workflow_dispatch"
		, "inherited-checked-record-jvm"
	]);
	assert.doesNotMatch(source
		, /continue-on-error:|needs:|strategy:|defaults:|set \+e|\|\| true/u);
	assert.doesNotMatch(source
		, /LEAN_BRIDGE_(?:NATIVE_TEST_GLIBC_FLOOR|INHERITED_CHECKED_RECORD_JVM_|NOMINAL_SUBTYPE_JVM_|JAVA|JAVAC|KOTLINC)/u);
	assert.deepEqual(source.match(/^\s+if:.*$/gmu), [
		"        if: always()"
		, "        if: always() && steps.acceptance.outcome != 'success'"
	]);
	assert.equal((source.match(/^\s+env:/gmu) ?? []).length, 1);
	assert.ok(source.includes(
		'    env:\n      LEAN_NUM_THREADS: "1"\n    steps:\n'
	));
	assert.ok(source.includes("    runs-on: ubuntu-24.04\n"));
	assert.ok(source.includes("    timeout-minutes: 180\n"));
	const names = [...source.matchAll(/^ {6}- name: (.+)$/gmu)]
		.map(match => match[1]);
	assert.deepEqual(names, [
		"Check out the exact revision and original evidence history"
		, "Install Node.js", "Bound apt network waits"
		, "Install compiler and archive dependencies"
		, "Install dependencies and the pinned Lean compiler"
		, "Select Java 22", "Install the checksummed Kotlin 2.2.0 compiler"
		, "Require both source routes and API modes in Java and Kotlin"
		, "Preserve original and partial installed records"
		, "Enforce installed inherited checked-record Java and Kotlin acceptance"
	]);
	const step = name => source.split("      - name: " + name + "\n")[1]
		.split("      - name: ")[0];
	assert.equal(step(names[0]), "        uses: actions/checkout@v6\n        with:\n          fetch-depth: 0\n          persist-credentials: false\n");
	assert.equal(step(names[1]), '        uses: actions/setup-node@v6\n        with:\n          node-version: "22"\n          cache: npm\n');
	assert.equal(step(names[2]), "        uses: ./.github/actions/bounded-apt\n        timeout-minutes: 1\n");
	assert.equal(step(names[3]), "        timeout-minutes: 20\n        run: |\n          sudo apt-get update\n          sudo apt-get install -y build-essential cmake git jq libgmp-dev libuv1-dev m4 pkg-config ripgrep unzip xz-utils zstd\n");
	assert.equal(step(names[4]), "        timeout-minutes: 30\n        shell: bash\n        run: |\n          set -euo pipefail\n          npm ci --ignore-scripts --no-audit --no-fund\n          mkdir -p build\n          bash scripts/bootstrap-toolchains.sh --lean-only 2>&1 | tee build/inherited-checked-record-jvm-toolchain.log\n");
	assert.equal(step(names[5]), "        uses: actions/setup-java@v4\n        with:\n          distribution: temurin\n          java-version: '22.0.2'\n");
	assert.equal(step(names[6]), "        timeout-minutes: 10\n        shell: bash\n        run: |\n" + kotlinInstall.split("\n").map(line => "          " + line + "\n").join(""));
	assert.equal(step(names[7]), "        id: acceptance\n        timeout-minutes: 120\n        shell: bash\n        run: |\n          set -euo pipefail\n          source scripts/env.sh\n          bash scripts/run-inherited-checked-record-jvm-ci.sh \"$JAVA_HOME/bin/java\" \"$JAVA_HOME/bin/javac\" \"$PWD/build/kotlin-tools/kotlinc/bin/kotlinc\"\n");
	assert.equal(step(names[8]), "        if: always()\n        uses: actions/upload-artifact@v7\n        with:\n          name: inherited-checked-record-jvm-${{ github.sha }}\n          path: |\n            build/inherited-checked-record-jvm-ci/\n            build/inherited-checked-record-jvm-toolchain.log\n          if-no-files-found: error\n          retention-days: 30\n");
	assert.equal(step(names[9]), "        if: always() && steps.acceptance.outcome != 'success'\n        run: exit 1\n");
	const commands = workflowRunScalars(source).map(run => run.source.trim());
	assert.deepEqual(commands, [
		"sudo apt-get update\nsudo apt-get install -y build-essential cmake git jq libgmp-dev libuv1-dev m4 pkg-config ripgrep unzip xz-utils zstd"
		, "set -euo pipefail\nnpm ci --ignore-scripts --no-audit --no-fund\nmkdir -p build\nbash scripts/bootstrap-toolchains.sh --lean-only 2>&1 | tee build/inherited-checked-record-jvm-toolchain.log"
		, kotlinInstall
		, "set -euo pipefail\nsource scripts/env.sh\nbash scripts/run-inherited-checked-record-jvm-ci.sh \"$JAVA_HOME/bin/java\" \"$JAVA_HOME/bin/javac\" \"$PWD/build/kotlin-tools/kotlinc/bin/kotlinc\""
		, "exit 1"
	]);
	assert.equal(assertWorkflowRunBudget(source), commands.length);
};
