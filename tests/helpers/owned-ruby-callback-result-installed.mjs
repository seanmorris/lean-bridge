/**
 * Exercise callback owners through an installed gem's public API only.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/**
 * Select public scenarios without binding or configuring a native runtime.
 *
 * @param hostCallbacks - Exercise Ruby callback replies and recovery values.
 * @param combined - Exercise consuming receivers as well.
 */
export const ownedRubyCallbackInstalledProbe = async (hostCallbacks, combined = hostCallbacks) => {
	const source = `HOST_CALLBACKS = ${hostCallbacks}\nCOMBINED = ${combined}\n`
		+ await readFile("tests/fixtures/structured-types/owned-installed-ruby-callback-results.rb", "utf8");
	assert.doesNotMatch(source, /Fiddle|Native\.bind|instance_variable|const_get|require_relative/u);
	return source;
};
