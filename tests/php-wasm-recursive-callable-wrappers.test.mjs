/**
 * Execute public PHP conversions independently of a native or Wasm transport.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { compileCallablePhpGraphZendModel } from "../src/backends/php/callable-graph-zend-model.mjs";
import { generateCallablePhpGraphZendPhp } from "../src/backends/php/callable-graph-zend-php.mjs";
import { bundledBrickMath } from "../src/backends/php/brick-math.mjs";
import { structuredCallableReviewedIr } from "./helpers/structured-callable-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
const transport = model => `<?php
namespace ${model.transport};
$GLOBALS['closed'] = 0; $GLOBALS['retired'] = 0; $GLOBALS['captures'] = [];
function retire() { ++$GLOBALS['retired']; }
${model.functions.filter(fn => /^(call|twice|make)_/.test(fn.publicName)).map(fn => {
	const args = fn.parameterNames.map(name => `$${name}`), first = args[0], last = args[1];
	const body = fn.publicName.startsWith("make_")
		? `$token = fopen('php://memory', 'r+'); $GLOBALS['captures'][(int)$token] = ${first}; return $token;`
		: `$GLOBALS['lastCallback'] = ${last}; if ($GLOBALS['malformed'] ?? false) return [99, []]; return ${last}(${fn.publicName.startsWith("twice_") ? `${last}(${first})` : first});`;
	return `function call${fn.index}(${args.join(", ")}) { ${body} }`;
}).join("\n")}
${[...model.callbacks.values()].filter(cb => cb.parameters.length === 2).map(cb => `function invoke${cb.index}($token, $first, $value) {
    if (isset($GLOBALS['duringInvoke'])) ($GLOBALS['duringInvoke'])();
    return $first ? $GLOBALS['captures'][(int)$token] : $value;
}
function close${cb.index}($token) { ++$GLOBALS['closed']; unset($GLOBALS['captures'][(int)$token]); fclose($token); }`).join("\n")}
`;

test("recursive Zend PHP wrappers preserve values, failure identity and exact lease cleanup", { skip: !existsSync(php) }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-recursive-wrappers-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const model = compileCallablePhpGraphZendModel(structuredCallableReviewedIr({ recursive: true }));
	const files = generateCallablePhpGraphZendPhp(model);
	assert.deepEqual(files, generateCallablePhpGraphZendPhp(model));
	for(const [path, source] of Object.entries({ ...files, ...bundledBrickMath(), "transport.php": transport(model) }))
		await saveLakeFile(root, path, source);
	for(const path of Object.keys(files).filter(path => path.endsWith(".php"))) await runCopied(php, ["-n", "-l", path], root);
	const source = await readFile("tests/fixtures/structured-callable-consumers/php-wasm-recursive-wrapper.php", "utf8");
	for(const strict of [0, 1])
	{
		await saveLakeFile(root, "check.php", source.replace("strict_types=0", `strict_types=${strict}`));
		const result = await runCopied(php, ["-n", "check.php"], root);
		assert.equal(result.stderr, ""); const observed = JSON.parse(result.stdout);
		assert.ok(observed.checks > 570); assert.equal(observed.closed, 38); assert.equal(observed.retired, 1);
		assert.equal(observed.compiledLean, false);
		t.diagnostic(JSON.stringify({ strict, ...observed }));
	}
});

test("recursive Zend invalid calls reject before extension loading in weak and strict PHP", { skip: !existsSync(php) }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-recursive-cold-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const files = generateCallablePhpGraphZendPhp(compileCallablePhpGraphZendModel(structuredCallableReviewedIr({ recursive: true })));
	for(const [path, source] of Object.entries({ ...files, ...bundledBrickMath() })) await saveLakeFile(root, path, source);
	const source = await readFile("tests/fixtures/structured-callable-consumers/php-recursive-cold.php", "utf8");
	for(const strict of [0, 1])
	{
		await saveLakeFile(root, "cold.php", source.replace("strict_types=1", `strict_types=${strict}`));
		const result = await runCopied(php, ["-n", "cold.php"], root);
		assert.equal(result.stderr, "");
		assert.deepEqual(JSON.parse(result.stdout), { coldChecks: 26, ffiDisabled: true, ffiLoaded: false, leanLoaded: false });
	}
});
