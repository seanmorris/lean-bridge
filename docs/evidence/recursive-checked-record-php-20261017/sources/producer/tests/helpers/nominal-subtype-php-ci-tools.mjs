/**
 * Observe exact trusted host versions before any nominal PHP package producer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { realpath } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { inspectNominalSubtypePhpTools } from "./nominal-subtype-php-tools.mjs";

/**
 * Select real commands and independently inspect their versions and extensions.
 * These are observed tool versions, not workflow-pinned apt package versions.
 *
 * @param commands - Explicit absolute PHP and Composer command paths.
 * @param commands.php - Trusted PHP CLI executable.
 * @param commands.composer - Trusted Composer PHP script.
 * @param cwd - Existing retained CI output directory.
 */
export const selectNominalSubtypePhpCiTools = async ({ php, composer }, cwd) => {
	for(const command of [php, composer]) assert.ok(typeof command === "string" && isAbsolute(command));
	php = await realpath(php); composer = await realpath(composer);
	const probe = await runCopied(php, ["-n", "-r", 'echo json_encode(["version"=>PHP_VERSION,"directory"=>ini_get("extension_dir"),"modules"=>get_loaded_extensions()], JSON_THROW_ON_ERROR);'], cwd);
	assert.equal(probe.stderr, ""); const interpreter = JSON.parse(probe.stdout);
	assert.match(interpreter.version, /^8\.(?:[2-9]|[1-9][0-9]+)\.[0-9]+$/u);
	const flags = ["-n"];
	for(const name of ["ctype", "ffi", "iconv", "mbstring", "phar", "tokenizer"])
	{
		if(interpreter.modules.some(module => module.toLowerCase() === name)) continue;
		flags.push("-d", "extension=" + await realpath(join(interpreter.directory, `${name}.so`)));
	}
	const version = await runCopied(php, [...flags, composer, "--no-plugins", "--no-scripts", "--no-interaction", "--version"], cwd
		, { ...copiedCleanEnvironment, COMPOSER_ALLOW_SUPERUSER: "1", COMPOSER_DISABLE_NETWORK: "1" });
	assert.equal(version.stderr, "");
	const composerVersion = version.stdout.match(/^Composer version (2\.[0-9]+\.[0-9]+)(?: |\n)/u)?.[1];
	assert.equal(typeof composerVersion, "string");
	return inspectNominalSubtypePhpTools({ php, composer, phpVersion: interpreter.version, composerVersion }, cwd);
};
