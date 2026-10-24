/**
 * Authenticate the original feature-admission sources and retained inputs.
 * Do not regenerate historical packages in these small metadata checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { bytesAtProducer, sourceAtProducer } from "./producer-source.mjs";
import { sha256 } from "./source-history-digest.mjs";

const admissions = [
	{
		name: "JavaScript borrowed results"
		, producer: "3701d0880be3195b249ed17caac6975dea7283f6"
		, constant: "javaScriptBorrowAdmissionProducer"
		, test: "tests/owned-javascript-borrow-package.test.mjs"
		, receipts: ["owned-javascript-transfers-20260930"]
		, modules: {
			"src/backends/native/owned-value-adapters.mjs": ["generateOwnedNativeValueAdapters"]
			, "src/backends/javascript/owned-wasm-component.mjs": ["generateOwnedWasmComponent"]
			, "tests/helpers/owned-javascript-wasm-native.mjs": ["ownedJavaScriptWasmNativeProbe"]
		}
	}
	, {
		name: "PHP-Wasm borrowed results"
		, producer: "49555c6612107ef8e6a3f8f7576312a5c32da894"
		, constant: "phpWasmBorrowAdmissionProducer"
		, test: "tests/owned-php-wasm-borrows.test.mjs"
		, receipts: ["owned-php-wasm-transfers-20260930", "owned-php-wasm-integration-20260928"]
		, modules: {
			"src/backends/native/owned-value-adapters.mjs": ["generateOwnedNativeValueAdapters"]
			, "src/backends/php/owned-zend-extension.mjs": ["generateOwnedPhpZendExtension"]
			, "src/backends/php/owned-zend-php.mjs": ["generateOwnedPhpZendPhp"]
		}
	}
	, {
		name: "WIT callback results"
		, producer: "c960596253f5b4c902820ba5ff2131aeb8bd5727"
		, constant: "witCallbackAdmissionProducer"
		, test: "tests/wit-owned-callback-results.test.mjs"
		, receipts: ["wit-owned-borrows-20261001", "wit-owned-receivers-20261001"]
		, modules: {
			"src/backends/wit/owned-package.mjs": ["generateOwnedWitPackage"]
			, "src/backends/wit/owned-host-evidence.mjs": ["guardOwnedWitHostSource"]
			, "src/build/native-graph-model.mjs": ["createCompiledNativeModel"]
			, "src/build/owned-wit-artifacts.mjs": ["ownedWitValueContract"]
			, "src/release/owned-wasi.mjs": ["ownedWitReadme"]
		}
	}
];

for(const admission of admissions)
	test(`${admission.name} bind compatibility checks to their admission producer`, async () => {
		execFileSync("git", ["merge-base", "--is-ancestor", admission.producer, "HEAD"]);
		const current = await readFile(admission.test, "utf8");
		assert.ok(current.includes(`const ${admission.constant} = "${admission.producer}";`));
		assert.ok(current.includes(`moduleAtProducerWithSourceReads(${admission.constant}, path)`));
		const original = sourceAtProducer(admission.producer, admission.test);
		for(const name of admission.receipts)
		{
			assert.ok(original.includes(name), name);
			const path = `docs/evidence/${name}.json`;
			assert.equal(sha256(await readFile(path)), sha256(bytesAtProducer(admission.producer, path)), path);
		}
		for(const [path, exports] of Object.entries(admission.modules))
		{
			assert.ok(current.includes(`"${path}"`), path);
			const source = sourceAtProducer(admission.producer, path);
			for(const name of exports)
				assert.match(source, new RegExp(`export (?:const|function) ${name}\\b`, "u"), `${path}:${name}`);
		}
	});
