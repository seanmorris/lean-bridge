/**
 * Independently validate the terminal callback Subtype browser acceptance log.
 *
 * @file
 */
import assert from "node:assert/strict";

export const callbackSubtypeBrowserTestName
	= "callback Subtypes install from reproducible ordinary and reviewed npm builds";

const exactKeys = (value, keys) => {
	assert.ok(value && typeof value === "object" && !Array.isArray(value));
	assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
};

/**
 * Reject ambiguous checker invocations before opening retained files.
 *
 * @param args - Arguments after the checker script name.
 */
export const parseCallbackSubtypeBrowserCiArgs = args => {
	const usage = "Usage: check-callback-subtype-browser-ci.mjs --producer <commit> --tap <original-tap> --runtime <independent-runtime-json>";
	const allowed = ["producer", "tap", "runtime"], selected = {};
	assert.ok(Array.isArray(args) && args.length === allowed.length * 2, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--")
			&& allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && typeof value === "string"
			&& value.length > 0 && !value.startsWith("--")
			&& !/[\0\r\n]/u.test(value), usage);
		selected[key] = value;
	}
	assert.match(selected.producer, /^[a-f0-9]{40}$/u);
	return selected;
};

/**
 * Require exactly one successful, unskipped terminal acceptance test.
 *
 * @param source - Original combined Node test output.
 */
export const assertCallbackSubtypeBrowserTap = source => {
	assert.equal(typeof source, "string");
	assert.doesNotMatch(source, /(?:^|\n)(?:not ok |Bail out!|[ \t]+not ok )/u);
	assert.match(source, new RegExp(
		`^TAP version 13\\n# Subtest: ${callbackSubtypeBrowserTestName.replaceAll(" ", "\\s")}`
		, "u"
	));
	assert.match(source, new RegExp(
		`\\nok 1 - ${callbackSubtypeBrowserTestName.replaceAll(" ", "\\s")}\\n`
		, "u"
	));
	assert.doesNotMatch(source, /# SKIP|# TODO/u);
	assert.match(source, /\n1\.\.1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
};

/**
 * Validate retained CI output independently of the producer process.
 *
 * @param options - Explicit producer selection.
 * @param original - Original TAP and independently observed Node identity.
 */
export const checkCallbackSubtypeBrowserCi = (options, original) => {
	const selected = parseCallbackSubtypeBrowserCiArgs(Object.entries(options)
		.flatMap(([key, value]) => ["--" + key, value]));
	assertCallbackSubtypeBrowserTap(original.tap);
	exactKeys(original.runtime, ["node", "platform", "arch"]);
	assert.match(original.runtime.node, /^v[0-9]+\./u);
	for(const key of ["platform", "arch"])
		assert.match(original.runtime[key], /^[a-z0-9_-]+$/u);
	return {
		schemaVersion: 1
		, producerCommit: selected.producer
		, runtime: original.runtime
		, routes: ["ordinary", "reviewed"]
		, profiles: ["browser-javascript", "browser-react", "browser-worker"]
		, engines: ["chromium", "firefox", "webkit"]
		, nodeAccepted: true
		, browserAccepted: true
	};
};
