/**
 * Reconcile archive-derived Ruby installation inventories without opening old paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nominalPrimitiveSubtypeRubyReceipt } from "./nominal-primitive-subtype-ruby-package.mjs";

const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
const absolute = path => assert.ok(typeof path === "string" && path.startsWith("/") && !path.includes("\0") && !/[\n\r]/u.test(path) && posix.normalize(path) === path);

/**
 * Bind recorded MRI identity and version to the independently selected runtime.
 *
 * @param interpreter - Original command, executable digest and version query.
 * @param rubyVersion - Independently selected MRI 3.3 patch version.
 */
export const assertNominalPrimitiveSubtypeRubyInterpreter = (interpreter, rubyVersion) => {
	assert.deepEqual(Object.keys(interpreter).sort(), ["command", "identity", "run"]);
	absolute(interpreter.command);
	assert.deepEqual(Object.keys(interpreter.identity).sort(), ["bytes", "sha256"]);
	assert.ok(Number.isSafeInteger(interpreter.identity.bytes) && interpreter.identity.bytes > 0);
	assert.match(interpreter.identity.sha256, /^[a-f0-9]{64}$/u); assert.match(rubyVersion, /^3\.3\.[0-9]+$/u);
	assert.deepEqual(interpreter.run, { code: 0, stderr: "", stdout: JSON.stringify({ engine: "ruby", version: rubyVersion, platform: "x86_64-linux" }) });
};

/**
 * Require the exact gem payload, cache and installed specification inventory.
 * The producer derives this baseline from the original archive before installation.
 *
 * @param options - Original records and independent package identities.
 * @param options.environment - Original archive-derived Ruby installation context.
 * @param options.interpreter - Verified selected MRI record.
 * @param options.gem - Verified package files and archive identity.
 * @param options.receiptBytes - Original canonical gem receipt bytes.
 * @param options.gemspecBytes - Retained installed specification, checked against the archive-derived baseline.
 */
export const checkNominalPrimitiveSubtypeRubyEnvironment = ({ environment, interpreter, gem, receiptBytes, gemspecBytes }) => {
	assert.deepEqual(Object.keys(environment).sort(), ["command", "expectedSha256", "files", "fullName", "gems", "interpreter", "receiptBytes"]);
	assert.equal(environment.command, interpreter.command); assert.deepEqual(environment.interpreter, interpreter.identity);
	absolute(environment.gems); assert.equal(posix.basename(environment.gems), "gems");
	assert.equal(environment.fullName, "nominalprimitivesubtypes-1.0.0-x86_64-linux");
	assert.equal(environment.receiptBytes, receiptBytes.toString());
	const receipt = JSON.parse(receiptBytes); assert.equal(receiptBytes.toString(), canonicalJson(receipt));
	const payload = { ...receipt.files, [nominalPrimitiveSubtypeRubyReceipt]: identity(receiptBytes) };
	assert.deepEqual(payload, gem.files);
	const files = Object.fromEntries(Object.entries(payload).map(([path, value]) => [`gems/${environment.fullName}/${path}`, value]));
	files[`cache/${environment.fullName}.gem`] = { bytes: gem.archive.bytes, sha256: gem.archive.sha256 };
	files[`specifications/${environment.fullName}.gemspec`] = identity(gemspecBytes);
	assert.deepEqual(environment.files, files); assert.equal(environment.expectedSha256, sha256(canonicalJson(files)));
	for(const entry of Object.values(files))
	{
		assert.deepEqual(Object.keys(entry).sort(), ["bytes", "sha256"]);
		assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0); assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
	}
	const closure = { receiptSha256: sha256(receiptBytes)
		, packageFileSetSha256: sha256(canonicalJson(Object.keys(payload).sort()))
		, environmentSha256: environment.expectedSha256
		, interpreterSha256: interpreter.identity.sha256
		, gemspecSha256: sha256(gemspecBytes) };
	assert.deepEqual(gem.closure, closure);
	return closure;
};
