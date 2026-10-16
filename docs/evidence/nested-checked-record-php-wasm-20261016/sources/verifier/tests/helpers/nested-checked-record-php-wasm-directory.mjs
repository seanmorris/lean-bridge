/**
 * Validate retained POSIX scratch-directory metadata without reopening that path.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";

/**
 * Accept the producer's configured temporary parent and exact fixture basename.
 *
 * @param directory - Original mkdtemp directory from a Linux producer record.
 */
export const assertNestedCheckedRecordPhpWasmDirectory = directory => {
	assert.equal(typeof directory, "string");
	assert.ok(posix.isAbsolute(directory), "The original temporary directory must be absolute");
	assert.ok(!directory.endsWith("/"), "The original temporary directory cannot end with a slash");
	assert.equal(posix.normalize(directory), directory, "The original temporary directory must be canonical");
	assert.ok([...directory].every(character => character.charCodeAt(0) >= 32 && ![92, 127].includes(character.charCodeAt(0))), "The original temporary directory cannot contain controls or backslashes");
	assert.match(posix.basename(directory), /^lean-bridge-nested-php-wasm-installed-[A-Za-z0-9]+$/u);
};
