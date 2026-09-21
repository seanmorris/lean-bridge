/**
 * Closed startup descriptors compose across independently installed packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createPhpWasmCopiedDescriptor as descriptor } from "../src/backends/php/php-wasm-copied-host.mjs";
import { buildPhpWasmCopiedPackages } from "../src/release/php-wasm-copied-package.mjs";

const runtime = { identity: "1".repeat(64), loaderIdentity: "2".repeat(64), library: `liblean_bridge_php_wasm_copied_${"3".repeat(20)}.so`, url: new URL("file:///installed/runtime/runtime.so") };
const component = { id: "willow@1.0.0", identity: "4".repeat(64), runtimeIdentity: runtime.identity, namespace: "LeanWillow", library: `php8.4-lb_willow_${"5".repeat(16)}.so`, composer: "example/willow" };
const base = { library: new URL("file:///installed/willow/api.so"), api: new URL("file:///installed/willow/Api.php"), native: new URL("file:///installed/willow/Native.php"), registration: new URL("file:///installed/willow/lazy-library.txt") };
const host = () => ({ phpVersion: "8.4", phpVariant: "", phpArgs: {} });

test("installed descriptors deduplicate runtime, extension and PHP files per host", () => {
	const a = descriptor(runtime, component, base), alias = descriptor(runtime, component, { ...base, library: new URL("file:///moved/willow/api.so") });
	const b = descriptor(runtime, { ...component, id: "aspen@1.0.0", namespace: "LeanAspen", composer: "example/aspen", library: `php8.4-lb_aspen_${"6".repeat(16)}.so` }, base);
	const php = host();
	const first = a.getLibs(php);
	assert.equal(first.length, 2); assert.equal(first[0].ini, false); assert.equal(first[1].ini, true);
	assert.equal(a.getFiles(php).length, 2);
	assert.deepEqual(alias.getLibs(php), []); assert.deepEqual(alias.getFiles(php), []);
	assert.equal(b.getLibs(php).length, 1); assert.equal(b.getFiles(php).length, 2);
	assert.equal(a.getLibs(host()).length, 2);
	const filesFirst = host();
	assert.equal(a.getFiles(filesFirst).length, 2); assert.equal(a.getLibs(filesFirst).length, 2);
	assert.equal(a.autoload, "/vendor/example/willow/src/Api.php");
	assert.deepEqual(Object.keys(a.extensions), ["getLibs"]);
	assert.equal(a.extensions.getLibs(host()).length, 2);
});

test("descriptor registration rejects incompatible identities before accepting another package", () => {
	const a = descriptor(runtime, component, base), php = host(); a.getLibs(php);
	for(const [otherRuntime, otherComponent, code] of [
		[{ ...runtime, identity: "0".repeat(64) }, { ...component, runtimeIdentity: "0".repeat(64) }, "php-wasm-runtime-conflict"]
		, [{ ...runtime, loaderIdentity: "0".repeat(64) }, component, "php-wasm-runtime-conflict"]
		, [runtime, { ...component, identity: "0".repeat(64) }, "php-wasm-component-conflict"]
		, [runtime, { ...component, id: "another@1.0.0" }, "php-wasm-namespace-conflict"]
		, [runtime, { ...component, id: "another@1.0.0", namespace: "LeanOther" }, "php-wasm-package-path-conflict"]
		, [runtime, { ...component, id: "another@1.0.0", namespace: "LeanOther", composer: "example/other" }, "php-wasm-package-path-conflict"]
	]) assert.throws(() => descriptor(otherRuntime, otherComponent, base).getLibs(php), error => error.code === code);
	assert.deepEqual(a.getLibs(php), []);
	assert.equal(php.phpArgs.__leanBridgePhpWasmBootstrapV1.components.size, 1);
	const alpha = host(); alpha.phpArgs.__leanBridgePhpWasmBootstrapV1 = { protocol: "legacy-alpha" };
	assert.throws(() => a.getLibs(alpha), error => error.code === "php-wasm-runtime-conflict");
	assert.throws(() => descriptor({ ...runtime, identity: "0".repeat(64) }, component, base), /another PHP-Wasm runtime/);
});

test("bundled PHP dependencies mount once without affecting extension-only Composer loading", () => {
	const assets = { ...base, php: { "bootstrap.php": new URL("./bootstrap.php", base.api), "dependencies/brick-math/src/BigInteger.php": new URL("./BigInteger.php", base.api) } };
	const a = descriptor(runtime, component, assets), php = host();
	assert.equal(a.autoload, "/vendor/example/willow/bootstrap.php");
	assert.equal(a.getFiles(php).length, 4); assert.deepEqual(a.getFiles(php), []);
	assert.deepEqual(Object.keys(a.extensions), ["getLibs"]);
	for(const key of ["../escape.php", "dependencies/brick-math/../../escape.php", "src/Api.php"])
		assert.throws(() => descriptor(runtime, component, { ...assets, php: { ...assets.php, [key]: base.api } }), /Invalid bundled PHP dependencies/);
});

test("alias catalogs mount once at their exact package-relative path", () => {
	const php = { "bootstrap.php": base.api, "lean-bridge/aliases.json": new URL("./aliases.json", base.api) };
	for(const mode of ["startup", "lazy"])
	{
		const a = descriptor(runtime, component, { ...base, php });
		const entry = mode === "lazy" ? a.lazy : a, instance = host();
		const files = entry.getFiles(instance);
		assert.deepEqual(files.filter(file => file.path.endsWith("/aliases.json")), [{ path: "/vendor/example/willow/lean-bridge/aliases.json", url: php["lean-bridge/aliases.json"] }]);
		assert.deepEqual(entry.getFiles(instance), []);
	}
	for(const key of ["lean-bridge/other.json", "lean-bridge/../aliases.json", "/lean-bridge/aliases.json", "lean-bridge/aliases.json/escape.php"])
		assert.throws(() => descriptor(runtime, component, { ...base, php: { ...php, [key]: base.api } }), /Invalid bundled PHP dependencies/);
	assert.throws(() => descriptor(runtime, component, { ...base, php: { ...php, "lean-bridge/aliases.json": "aliases.json" } }), /Invalid bundled PHP dependencies/);
});

test("descriptors reject unsupported versions, variants, misplaced modes and late registration", async () => {
	const a = descriptor(runtime, component, base);
	for(const php of [null, {}, { ...host(), phpVersion: "8.3" }, { ...host(), phpVariant: "zts" }])
		assert.throws(() => a.getLibs(php), error => error.code === "unsupported-php-wasm-host");
	assert.throws(() => a.getLibs({ ...host(), binary: Promise.resolve({}) }), error => error.code === "php-wasm-host-already-started");
	for(const entry of [a, a.extensions])
		assert.throws(() => a.getLibs({ ...host(), phpArgs: { dynamicLibs: [entry] } }), error => error.code === "unsupported-php-wasm-loading");
	for(const change of [{ library: "../../escape.so" }, { composer: "../escape" }, { namespace: "LeanFoo\\Bar" }])
		assert.throws(() => descriptor(runtime, { ...component, ...change }, base), /Invalid generated/);
	await assert.rejects(buildPhpWasmCopiedPackages({ loading: "lazy" }), /installed package's lazy descriptor/);
	await assert.rejects(buildPhpWasmCopiedPackages({ npmSettings: { ignored: true } }), /Unknown npm/);
	await assert.rejects(buildPhpWasmCopiedPackages({ composerSettings: { ignored: true } }), /Unknown Composer/);
});

test("lazy descriptors register URLs and opt-in files without startup extensions", () => {
	const a = descriptor(runtime, component, base), php = host();
	const environment = Object.freeze({ APP_SETTING: "kept" });
	php.phpArgs = { dynamicLibs: [a.lazy, a.lazy], ENV: environment };
	const libraries = a.lazy.getLibs(php);
	assert.equal(libraries.length, 2);
	assert.ok(libraries.every(library => library.ini === false));
	assert.equal(php.phpArgs.ENV.APP_SETTING, "kept");
	assert.deepEqual(environment, { APP_SETTING: "kept" });
	const files = a.lazy.getFiles(php);
	assert.equal(files.length, 3);
	assert.equal(files[0].path, `/__lean_bridge/php_wasm_lazy/${component.library}.txt`);
	assert.equal(files[0].url.href, base.registration.href);
	assert.deepEqual(a.lazy.getLibs(php), []); assert.deepEqual(a.lazy.getFiles(php), []);
	assert.equal(a.lazy.autoload, a.autoload);
	assert.deepEqual(Object.keys(a.lazy.extensions), ["getLibs", "getFiles"]);
	assert.ok(a.lazy.extensions.getLibs(host()).every(library => library.ini === false));
	const composerHost = host();
	assert.equal(a.lazy.extensions.getFiles(composerHost).length, 1);
	assert.deepEqual(a.lazy.extensions.getFiles(composerHost), []);
	assert.equal(a.lazy.getFiles(composerHost).length, 2);
	assert.throws(() => a.getLibs(php), error => error.code === "php-wasm-loading-conflict");
	assert.throws(() => a.lazy.getLibs({ ...host(), phpArgs: { sharedLibs: [a.lazy] } }), error => error.code === "unsupported-php-wasm-loading");
	assert.throws(() => a.lazy.getLibs({ ...host(), phpArgs: { sharedLibs: [a.lazy.extensions] } }), error => error.code === "unsupported-php-wasm-loading");
	assert.throws(() => a.lazy.getLibs({ ...host(), binary: Promise.resolve({}) }), error => error.code === "php-wasm-host-already-started");
});

test("different components can mix loading modes while sharing one runtime", () => {
	const a = descriptor(runtime, component, base);
	const b = descriptor(runtime, { ...component, id: "aspen@1.0.0", namespace: "LeanAspen", composer: "example/aspen", library: `php8.4-lb_aspen_${"6".repeat(16)}.so` }, base);
	for(const [first, second] of [[a, b.lazy], [b.lazy, a]])
	{
		const php = host(), libraries = [...first.getLibs(php), ...second.getLibs(php)];
		assert.equal(libraries.length, 3);
		assert.equal(libraries.filter(library => library.ini).length, 1);
		assert.equal(libraries.filter(library => library.name === runtime.library).length, 1);
		assert.equal(php.phpArgs.ENV, undefined);
	}
});
