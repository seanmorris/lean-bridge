/**
 * Record explicit PHP/Composer selections and every loaded extension binary.
 * These distributions remain trusted tools, separate from package evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, realpath } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";

/**
 * Refuse implicit tool discovery or an unspecified expected runtime version.
 *
 * @param environment - Explicit producer inputs.
 */
export const nominalSubtypePhpToolSelection = environment => {
	const selected = { php: environment.LEAN_BRIDGE_PHP
		, composer: environment.LEAN_BRIDGE_COMPOSER
		, phpVersion: environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_VERSION
		, composerVersion: environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_COMPOSER_VERSION };
	for(const name of ["php", "composer"])
		assert.ok(typeof selected[name] === "string" && isAbsolute(selected[name]), `Select an absolute PHP ${name} command`);
	assert.match(selected.phpVersion ?? "", /^8\.(?:[2-9]|[1-9][0-9]+)\.[0-9]+$/u);
	assert.match(selected.composerVersion ?? "", /^2\.[0-9]+\.[0-9]+$/u);
	return selected;
};

/**
 * Authenticate command identities, compatible runtime properties and exact versions.
 *
 * @param selected - Validated explicit tool selection.
 * @param cwd - Existing retained-record directory.
 */
export const inspectNominalSubtypePhpTools = async (selected, cwd) => {
	const command = await realpath(selected.php), composer = await realpath(selected.composer);
	const tools = {};
	const remember = async path => {
		const bytes = await readFile(path);
		tools[path] = { bytes: bytes.length, sha256: sha256(bytes) };
	};
	await remember(command); await remember(composer);
	const args = ["-n", "-r", 'echo json_encode(["version"=>PHP_VERSION,"sapi"=>PHP_SAPI,"zts"=>PHP_ZTS,"integerBytes"=>PHP_INT_SIZE,"os"=>PHP_OS_FAMILY,"arch"=>php_uname("m"),"directory"=>ini_get("extension_dir"),"modules"=>get_loaded_extensions()], JSON_THROW_ON_ERROR);'];
	const run = await runCopied(command, args, cwd), php = JSON.parse(run.stdout);
	assert.equal(run.stderr, ""); assert.equal(php.version, selected.phpVersion);
	assert.equal(php.sapi, "cli"); assert.equal(php.zts, 0); assert.equal(php.integerBytes, 8);
	assert.equal(php.os, "Linux"); assert.equal(php.arch, "x86_64");
	const extensions = {};
	for(const name of ["ctype", "ffi", "iconv", "mbstring", "phar", "tokenizer"])
	{
		if(php.modules.some(module => module.toLowerCase() === name)) continue;
		const path = await realpath(join(php.directory, `${name}.so`));
		extensions[name] = path; await remember(path);
	}
	const composerFlags = ["-n", ...Object.values(extensions).flatMap(path => ["-d", `extension=${path}`])];
	const runtimeFlags = ["-n", ...(extensions.ffi ? ["-d", `extension=${extensions.ffi}`] : []), "-d", "ffi.enable=1"];
	const composerArgs = [...composerFlags, composer, "--no-plugins", "--no-scripts", "--no-interaction", "--version"];
	const composerRun = await runCopied(command, composerArgs, cwd, { ...copiedCleanEnvironment, COMPOSER_ALLOW_SUPERUSER: "1", COMPOSER_DISABLE_NETWORK: "1" });
	assert.equal(composerRun.stderr, "");
	assert.equal(composerRun.stdout.match(/^Composer version ([0-9]+\.[0-9]+\.[0-9]+)(?: |\n)/u)?.[1], selected.composerVersion);
	for(const [path, expected] of Object.entries(tools))
	{
		assert.equal(await realpath(path), path);
		const bytes = await readFile(path); assert.deepEqual({ bytes: bytes.length, sha256: sha256(bytes) }, expected);
	}
	return { selected, command, composer, tools, runtimeFlags, composerFlags
		, interpreter: { command, args, run, php }
		, composerVersion: { command, args: composerArgs, run: composerRun } };
};
