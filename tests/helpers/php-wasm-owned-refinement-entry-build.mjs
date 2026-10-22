/**
 * Build and package one separately instrumented owned PHP-Wasm entry probe.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildPhpWasmCopiedComponent } from "../../src/build/php-wasm-copied-component.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { buildPhpWasmCopiedPackages } from "../../src/release/php-wasm-copied-package.mjs";
import { writePhpWasmPackageSet } from "../../src/release/package-set-assembly.mjs";
import { createPhpWasmRefinementEntryBuildObserver } from "./php-wasm-refinement-entry-build.mjs";
import { phpWasmOwnedRefinementEntrySelection } from "./php-wasm-owned-refinement-entry-selection.mjs";

const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
const save = async (root, path, bytes) => {
	await mkdir(dirname(join(root, path)), { recursive: true });
	await writeFile(join(root, path), bytes, { flag: "wx" });
};

/**
 * Compile from a disposable instrumented author source and retain every probe input.
 * Generated owned headers are overlaid only for the separate measurement binary.
 *
 * @param options - Exact author, toolchain, runtime, package and record roots.
 */
export const buildPhpWasmOwnedRefinementEntryProbe = async options => {
	const {
		projectRoot
		, outputRoot
		, recordRoot
		, leanPrefix
		, runtimeRoot
		, emsdkRoot
		, phpSource
		, sourceProbe, settings, signal, checkModel, runner = processBuildRunner
	} = options;
	await mkdir(recordRoot); await save(recordRoot, "source-probe.json", canonicalJson(sourceProbe));
	const observer = createPhpWasmRefinementEntryBuildObserver({
		recordRoot, runner, headerInputs: ["owned-values-codec.h", "owned-leases.h"]
	});
	let model;
	try
	{
		const component = await buildPhpWasmCopiedComponent({
			projectRoot, outputRoot: join(outputRoot, "php-wasm/component")
			, runtimeRoot, leanPrefix, emsdkRoot, phpSource, signal
			, hostCallbacks: false, transferredInputs: true, runner: observer
			, validateModel: value => {
				model = value;
				assert.ok(model.ownedGraph?.inputTransfers);
				assert.equal(model.ownedGraph.hostCallbacks, undefined);
				const selection = phpWasmOwnedRefinementEntrySelection(model, sourceProbe.entries);
				observer.select(selection.selected); checkModel?.(model);
			}
		});
		const packages = await buildPhpWasmCopiedPackages({
			componentRoot: component.root, runtimeRoot
			, outputRoot: join(outputRoot, "packages/php-wasm"), leanPrefix
			, npmSettings: settings.npm, composerSettings: settings.composer
		});
		const receipt = await writePhpWasmPackageSet({
			root: outputRoot, model, report: packages.report, signal
		});
		const library = identity(await readFile(join(component.root, component.receipt.library)));
		assert.deepEqual(library, component.receipt.wasmLibrary);
		const observation = {
			...observer.snapshot(), modelSha256: sha256(canonicalJson(model))
			, component: component.receipt, library
			, packageSetSha256: sha256(canonicalJson(receipt))
		};
		await save(recordRoot, "observation.json", canonicalJson(observation));
		await save(recordRoot, "model.json", canonicalJson(model));
		return { model, receipt, packageSet: packages.report, observation };
	}
	finally
	{ await save(recordRoot, "commands.json", canonicalJson(observer.transcript())); }
};
