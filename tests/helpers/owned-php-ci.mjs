/**
 * Require native PHP ownership execution, reports and failure propagation in CI.
 *
 * @file
 */
import assert from "node:assert/strict";

export const ownedPhpCiGroups = [
	["owned-php-runtime", "owned-php-conversions", "owned-php-calls", "owned-php-package"]
	, ["owned-php-packaging", "owned-php-coexistence", "owned-php-documentation"]
];
export const ownedPhpCiCommands = [
	"LEAN_BRIDGE_OWNED_PHP_VALUES_TEST=1 node --test --test-name-pattern='^(?!.*32-bit PHP-Wasm)' tests/owned-php-values.test.mjs"
	, ...ownedPhpCiGroups.map(group => "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 "
		+ group.map(name => "tests/" + name + ".test.mjs").join(" "))
];
export const ownedPhpCiReports = ["build/owned/php-values.json"
	, ...Object.entries({
		"owned-php-runtime": ["ordinary", "reviewed"]
		, "owned-php-conversions": ["composition-ordinary", "composition-reviewed", "scalars-ordinary", "scalars-reviewed"]
		, "owned-php-calls": ["ordinary", "reviewed"]
		, "owned-php-packaging": ["ordinary", "reviewed", "coexistence", "documentation"]
	}).flatMap(([directory, names]) => names.map(name => "build/" + directory + "/" + name + ".json"))];

/**
 * Confirm execution cannot be replaced by generated source or a skipped suite.
 *
 * @param workflow - Complete current workflow text.
 */
export const assertOwnedPhpCi = workflow => {
	const step = workflow.match(/^ {6}- name: Execute owned native PHP values and source-free Composer releases\n([^]*?)(?=^ {6}- name: )/mu)?.[0];
	assert.ok(step);
	assert.match(step, /^ {8}id: owned_php$/mu);
	assert.doesNotMatch(step, /^ {8}if:/mu);
	const record = workflow.split("\n").find(line => line.includes("record --consumer php-native"));
	assert.ok(record);
	for(const command of ownedPhpCiCommands)
	{
		assert.ok(step.includes("          " + command + "\n"), command);
		assert.ok(record.includes(" && " + command), command);
	}
	const upload = workflow.match(/^ {6}- name: Upload installed PHP corpus observations\n([^]*?)(?=^ {6}- name: )/mu)?.[0];
	assert.ok(upload); assert.match(upload, /^ {8}if: always\(\)$/mu);
	assert.match(upload, /^ {10}if-no-files-found: error$/mu);
	for(const path of ownedPhpCiReports)
	{
		assert.ok(step.includes("          test -s " + path + "\n"), path);
		const artifact = path === "build/owned/php-values.json" ? path : path.slice(0, path.lastIndexOf("/") + 1);
		assert.ok(upload.includes("            " + artifact + "\n"), path);
	}
	const nativeFailure = workflow.split("\n").find(line => line.includes("steps.ordinary_php.outcome") && line.includes("; then"));
	assert.ok(nativeFailure?.includes('[ "${{ steps.owned_php.outcome }}" != success ]'));
	const enforcement = workflow.split("      - name: Enforce PHP support\n")[1]?.split("\n\n")[0];
	assert.ok(enforcement?.includes("steps.owned_php.outcome != 'success'"));
	assert.match(enforcement, /run: exit 1/u);
	return { testFiles: 1 + ownedPhpCiGroups.flat().length
		, requiredReports: ownedPhpCiReports.length
		, recordedRouteMatches: true, realExecutionRequired: true
		, failurePropagated: true };
};
