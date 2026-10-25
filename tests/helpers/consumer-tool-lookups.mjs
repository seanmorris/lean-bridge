/**
 * Keep executable discovery separate from export so Bash preserves failures.
 *
 * @file
 */
import assert from "node:assert/strict";

export const consumerToolCommands = Object.freeze({
	DOTNET: "dotnet", RUBY: "ruby", GEM: "gem", MAVEN: "mvn"
	, PHP: "php", COMPOSER: "composer", PYTHON: "python3"
});

/**
 * Render the exact tool setup required by current downstream CI.
 * Legacy syntax is only for the explicitly selected, hash-authenticated Perl
 * predecessor; the live workflow contract rejects it in every current step.
 *
 * @param name - Closed Lean Bridge tool name without the environment prefix.
 * @param legacy - Preserve the original archived producer's combined export.
 */
export const consumerToolExportLines = (name, legacy = false) => {
	assert.ok(Object.hasOwn(consumerToolCommands, name));
	assert.equal(typeof legacy, "boolean");
	const variable = "LEAN_BRIDGE_" + name;
	const assignment = variable + '="$(command -v ' + consumerToolCommands[name] + ')"';
	return legacy ? ["export " + assignment] : [assignment, "export " + variable];
};
