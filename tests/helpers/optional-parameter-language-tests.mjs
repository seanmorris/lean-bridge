/**
 * Static controls for optional-parameter language-package lanes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("optional language runner owns all profiles, routes and its checker", async () => {
	const source = await readFile(
		"scripts/run-optional-parameter-language-ci.sh", "utf8");
	const installed = await readFile(
		"tests/optional-parameter-language-installed.test.mjs", "utf8");
	assert.match(source, /perl && \$1 != python && \$1 != ruby && \$1 != rust/u);
	assert.match(source, /for route in ordinary reviewed/u);
	assert.match(source, /optional-parameter-language-installed\.test\.mjs/u);
	assert.match(source, /check-optional-parameter-language-ci\.mjs/u);
	assert.match(source, /LEAN_BRIDGE_OPTIONAL_PARAMETER_LANGUAGE_TEST=1/u);
	assert.match(installed
		, /targets: \[target\[profile\]\], environment/u);
});

test("consumer workflows retain and enforce every optional language lane", async () => {
	const consumer = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const perl = await readFile(".github/workflows/perl-consumer.yml", "utf8");
	assert.match(consumer
		, /optional-parameter-language-\$\{\{ matrix\.profile \}\}-\$\{\{ github\.sha \}\}/u);
	assert.match(consumer
		, /optional-parameter-language-ruby-\$\{\{ github\.sha \}\}/u);
	assert.match(perl
		, /optional-parameter-language-perl-\$\{\{ github\.sha \}\}/u);
	for(const source of [consumer, perl])
	{
		assert.match(source, /run-optional-parameter-language-ci\.sh/u);
		assert.match(source
			, /steps\.optional_parameters_language\.outcome != 'success'/u);
	}
});
