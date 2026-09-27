/**
 * Require owned JVM acceptance, nonempty observations and retained CI artifacts.
 *
 * @file
 */
import assert from "node:assert/strict";

export const ownedJvmCiGroups = [
	["owned-jvm-runtime", "owned-jvm-values", "owned-jvm-layout"
		, "owned-jvm-kotlin", "owned-jvm-conversions"]
	, ["owned-jvm-calls", "verified-jvm-assets", "owned-jvm-package"]
	, ["owned-jvm-packaging", "owned-jvm-coexistence", "owned-jvm-documentation"]
];
export const ownedJvmCiReports = Object.entries({
	"owned-jvm-runtime": ["ordinary", "reviewed"], "owned-jvm-values": ["public"]
	, "owned-jvm-layout": ["ordinary", "reviewed", "scalars-ordinary", "scalars-reviewed"]
	, "owned-jvm-kotlin": ["composed", "scalars"]
	, "owned-jvm-conversions": ["ordinary", "reviewed", "scalars-ordinary", "scalars-reviewed"]
	, "owned-jvm-calls": ["values-ordinary", "values-reviewed", "scalars-ordinary"
		, "scalars-reviewed", "signatures-ordinary", "signatures-reviewed"]
	, "owned-jvm-packaging": ["callbacks-ordinary", "callbacks-reviewed"
		, "scalars-ordinary", "scalars-reviewed", "coexistence", "documentation"]
}).flatMap(([directory, names]) => names.map(name => "build/" + directory + "/" + name + ".json"));

/**
 * Validate live acceptance commands and their separately recorded Docker route.
 *
 * @param workflow - Complete current workflow text.
 */
export const assertOwnedJvmCi = workflow => {
	const step = workflow.match(/^ {6}- name: Compare isolated Java and Kotlin corpus consumers with fresh Lean\n([^]*?)(?=^ {6}- name: )/mu)?.[0];
	assert.ok(step);
	assert.match(step, /^ {8}if: matrix.profile == 'jvm'$/mu);
	assert.match(step, /^ {8}id: type_corpus_jvm$/mu);
	const route = workflow.split('if [ "$consumer" = jvm ]; then\n')[1]?.split('if [ "$consumer" = ruby ]; then\n')[0];
	assert.ok(route);
	for(const group of ownedJvmCiGroups)
	{
		const command = "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 "
			+ group.map(name => "tests/" + name + ".test.mjs").join(" ");
		assert.ok(step.includes("          " + command + "\n"), group.join(","));
		assert.ok(route.includes('consumer_command="$consumer_command && ' + command + '"\n'));
	}
	const upload = workflow.match(/^ {6}- name: Upload installed Java and Kotlin corpus observations\n([^]*?)(?=^ {6}- name: )/mu)?.[0];
	assert.ok(upload);
	assert.match(upload, /^ {8}if: always\(\) && matrix.profile == 'jvm'$/mu);
	assert.match(upload, /^ {10}if-no-files-found: error$/mu);
	for(const path of ownedJvmCiReports)
	{
		assert.ok(step.includes("          test -s " + path + "\n"), path);
		assert.ok(upload.includes("            " + path.slice(0, path.lastIndexOf("/") + 1) + "\n"), path);
	}
	return { testFiles: ownedJvmCiGroups.flat().length
		, requiredReports: ownedJvmCiReports.length, artifactDirectories: 7
		, recordedRouteMatches: true, realExecutionRequired: true };
};
