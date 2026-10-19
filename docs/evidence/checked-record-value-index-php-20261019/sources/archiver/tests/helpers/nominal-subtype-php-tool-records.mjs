/**
 * Check original explicit PHP/Composer probes without reopening historical tools.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";

const absolute = path => assert.ok(typeof path === "string" && posix.isAbsolute(path)
	&& posix.normalize(path) === path && !path.includes("\0"));
const successful = run => {
	assert.deepEqual(Object.keys(run).sort(), ["code", "stderr", "stdout"]);
	assert.equal(run.code, 0); assert.equal(run.stderr, ""); assert.equal(typeof run.stdout, "string");
};

/**
 * Reconcile exact selected versions, runtime properties and loaded extension identities.
 *
 * @param tools - Original command, probe and binary identity records.
 * @param options - Independently selected acceptance versions.
 * @param options.phpVersion - Exact original PHP version.
 * @param options.composerVersion - Exact original Composer version.
 */
export const assertNominalSubtypePhpToolRecords = (tools, { phpVersion, composerVersion }) => {
	assert.match(phpVersion, /^8\.(?:[2-9]|[1-9][0-9]+)\.[0-9]+$/u);
	assert.match(composerVersion, /^2\.[0-9]+\.[0-9]+$/u);
	assert.deepEqual(Object.keys(tools).sort(), [
		"command", "composer", "composerFlags"
		, "composerVersion", "interpreter", "runtimeFlags", "selected", "tools"]);
	assert.deepEqual(Object.keys(tools.selected).sort(), ["composer", "composerVersion", "php", "phpVersion"]);
	for(const path of [tools.command, tools.composer, tools.selected.php, tools.selected.composer]) absolute(path);
	assert.equal(tools.selected.phpVersion, phpVersion); assert.equal(tools.selected.composerVersion, composerVersion);
	const probe = tools.interpreter, php = probe.php;
	assert.deepEqual(Object.keys(probe).sort(), ["args", "command", "php", "run"]);
	assert.equal(probe.command, tools.command);
	assert.deepEqual(probe.args, ["-n", "-r", 'echo json_encode(["version"=>PHP_VERSION,"sapi"=>PHP_SAPI,"zts"=>PHP_ZTS,"integerBytes"=>PHP_INT_SIZE,"os"=>PHP_OS_FAMILY,"arch"=>php_uname("m"),"directory"=>ini_get("extension_dir"),"modules"=>get_loaded_extensions()], JSON_THROW_ON_ERROR);']);
	successful(probe.run); assert.deepEqual(JSON.parse(probe.run.stdout), php);
	assert.deepEqual(Object.keys(php).sort(), ["arch", "directory", "integerBytes", "modules", "os", "sapi", "version", "zts"]);
	assert.equal(php.version, phpVersion); assert.equal(php.sapi, "cli"); assert.equal(php.zts, 0);
	assert.equal(php.integerBytes, 8); assert.equal(php.os, "Linux"); assert.equal(php.arch, "x86_64");
	absolute(php.directory); assert.ok(Array.isArray(php.modules) && php.modules.length);
	assert.ok(php.modules.every(name => typeof name === "string" && /^[A-Za-z0-9_ ]+$/u.test(name)));
	assert.equal(new Set(php.modules.map(name => name.toLowerCase())).size, php.modules.length);
	const extensions = {};
	for(const name of ["ctype", "ffi", "iconv", "mbstring", "phar", "tokenizer"])
	{
		if(php.modules.some(module => module.toLowerCase() === name)) continue;
		const paths = Object.keys(tools.tools).filter(path => posix.basename(path) === `${name}.so`);
		assert.equal(paths.length, 1); extensions[name] = paths[0];
	}
	assert.deepEqual(Object.keys(tools.tools).sort(), [tools.command, tools.composer, ...Object.values(extensions)].sort());
	for(const [path, entry] of Object.entries(tools.tools))
	{
		absolute(path); assert.deepEqual(Object.keys(entry).sort(), ["bytes", "sha256"]);
		assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes > 0); assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
	}
	assert.deepEqual(tools.composerFlags, ["-n", ...Object.values(extensions).flatMap(path => ["-d", `extension=${path}`])]);
	assert.deepEqual(tools.runtimeFlags, ["-n", ...extensions.ffi ? ["-d", `extension=${extensions.ffi}`] : [], "-d", "ffi.enable=1"]);
	const composer = tools.composerVersion;
	assert.deepEqual(Object.keys(composer).sort(), ["args", "command", "run"]);
	assert.equal(composer.command, tools.command);
	assert.deepEqual(composer.args, [...tools.composerFlags, tools.composer, "--no-plugins", "--no-scripts", "--no-interaction", "--version"]);
	successful(composer.run);
	assert.match(composer.run.stdout, new RegExp(`^Composer version ${composerVersion.replaceAll(".", "\\.")}(?: [^\\n]+)?\\n$`, "u"));
};
