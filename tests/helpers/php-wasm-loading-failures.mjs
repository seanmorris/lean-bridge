/**
 * Exercise real PHP lazy-loading failures without retrying a partial Wasm link.
 *
 * @file
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Check configuration failures, missing assets and the shared terminal failure.
 *
 * @param options - Installed packages and the pinned PHP host.
 */
export const exercisePhpWasmLoadingFailures = async options => {
	const { consumer, phpHost, imports, t } = options;
	for(const failure of ["disabled", "unregistered", "missing-component", "missing-runtime"])
	{
		await saveLakeFile(consumer, "loading-failure.mjs", `import assert from 'node:assert/strict';
import { PhpNode } from ${JSON.stringify(pathToFileURL(join(phpHost, "PhpNode.mjs")).href)};
${imports}
const failure = ${JSON.stringify(failure)}, libraries = [];
const apis = [api0, api1];
const php = new PhpNode({version: '8.4', dynamicLibs: apis.map(api => failure === 'unregistered' ? {getLibs: () => [], getFiles: php => api.getFiles(php)} : api.lazy), ini: failure === 'disabled' ? 'enable_dl=0' : '', locateFile: name => {
  if (name.endsWith('.so') && name !== 'libxml2.so') libraries.push(name);
  if (failure === 'missing-component' && name.startsWith('php8.4-lb_willow_') || failure === 'missing-runtime' && name.startsWith('liblean_bridge_php_wasm_copied_')) return new URL('./deliberately-absent.so', import.meta.url).href;
}});
let stdout = '', stderr = '';
php.addEventListener('output', e => stdout += e.detail.join(''));
php.addEventListener('error', e => stderr += e.detail.join(''));
for (const api of apis) assert.equal(await php.run("<?php require_once '" + api.autoload + "';"), 0);
assert.equal(libraries.length, 0);
const attempt = async namespace => {
  stdout = ''; stderr = '';
  const code = "<?php $handler = static function () { return true; }; set_error_handler($handler); try { " + namespace + "\\\\answer(); throw new Exception('Expected loading error'); } catch (" + namespace + "\\\\LeanBridgeError $error) { echo $error->getMessage(); } finally { $restored = set_error_handler(null); if ($restored !== $handler) throw new Exception('Error handler not restored'); }";
  assert.equal(await php.run(code), 0); assert.equal(stderr, ''); return stdout;
};
const first = await attempt('LeanWillow'), afterFirst = libraries.length;
const second = await attempt('LeanAspen'), third = await attempt('LeanWillow');
assert.equal(libraries.length, afterFirst, 'A failed loader must not retry or link another component');
const pattern = failure === 'disabled' ? /enable_dl=1/ : failure === 'unregistered' ? /Register this package lazy descriptor/ : /create a new PHP instance/;
for (const message of [first, second, third]) assert.match(message, pattern);
if (failure.startsWith('missing-')) { assert(afterFirst > 0); assert.equal(second, first); assert.equal(third, first); }
else assert.equal(afterFirst, 0);
stdout = ''; assert.equal(await php.run('<?php echo 42;'), 0); assert.equal(stdout, '42');
console.log(JSON.stringify({failure, afterFirst, messages: 3, interpreterAlive: true}));
`);
		const result = await processBuildRunner.capture({ command: process.execPath, args: ["loading-failure.mjs"], cwd: consumer, env: { ...process.env, PATH: join(consumer, "no-compilers") }, timeoutMs: 30000 });
		const parsed = JSON.parse(result.stdout.trim());
		assert.equal(parsed.failure, failure); assert.equal(parsed.messages, 3); assert.equal(parsed.interpreterAlive, true);
		t.diagnostic(`PHP-Wasm ${failure}: explicit errors, no repeated loads, previous error handler restored`);
	}
};
