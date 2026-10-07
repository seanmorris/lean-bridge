/**
 * Reconstruct pre-callback Ruby runtimes while retaining immutable old receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { ownedRubyRuntime } from "../../src/backends/ruby/owned-runtime.mjs";
import { generateOwnedRubyPackage } from "../../src/backends/ruby/owned-package.mjs";
import { beforeOwnedRubyCallbackResults } from "./owned-ruby-callback-result-history.mjs";

const retirement = "      # Finalizer guards can outlive their wrappers. An exited State must not\n"
	+ "      # retain the Thread and its return value, which can contain those wrappers.\n"
	+ "      @thread = nil\n";
const restore = source => {
	const path = "src/backends/ruby/owned-runtime.mjs", current = readFileSync(path, "utf8");
	const previous = beforeOwnedRubyCallbackResults(path, current);
	assert.notEqual(previous, current);
	assert.equal(current.split(retirement).length, 2);
	assert.equal(previous, current.replace(retirement, ""));
	assert.equal(source.split(retirement).length, 2);
	return source.replace(retirement, "");
};

/**
 * Reproduce the authenticated generator before the exited-thread retention fix.
 *
 * @param prefix - Native symbol prefix from the frozen compiler input.
 * @param options - Original non-callback ownership capabilities.
 */
export const historicalOwnedRubyCallbackRuntime = (prefix, options = {}) =>
	restore(ownedRubyRuntime(prefix, options));

/**
 * Preserve a legacy package's wrapped runtime, contract and embedded manifest.
 *
 * @param ir - Original compiler-checked API.
 * @param evidence - Original installed native library identities.
 * @param options - Original non-callback ownership capabilities.
 */
export const historicalOwnedRubyCallbackPackage = (ir, evidence = null, options = {}) => {
	const generated = generateOwnedRubyPackage(ir, evidence, options);
	assert.ok(generated.contract.schemaVersion < 5, "Historical Ruby generation cannot accept callback-result packages");
	const path = `lib/${generated.requirePath}/owned.rb`;
	const prefix = `module LeanBridge\n  module ${generated.componentName}\n`, suffix = "\n  end\nend\n";
	const current = generated.files[path];
	assert.ok(current.startsWith(prefix) && current.endsWith(suffix));
	const runtime = restore(current.slice(prefix.length, -suffix.length));
	const contract = { ...generated.contract, runtimeSha256: sha256(runtime) };
	const manifest = JSON.parse(generated.files["binding-manifest.json"]);
	assert.deepEqual(manifest.contract, generated.contract);
	const files = { ...generated.files
		, [path]: prefix + runtime + suffix
		, "binding-manifest.json": canonicalJson({ ...manifest, contract }) };
	return { ...generated, contract, files };
};
