/**
 * Observe separately instrumented PHP-Wasm compiler inputs without changing the
 * production compiler. Original and probe C units, object identities and exact
 * compile/link arguments remain independently reconstructible.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildPhpWasmCopiedComponent } from "../../src/build/php-wasm-copied-component.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { buildPhpWasmCopiedPackages } from "../../src/release/php-wasm-copied-package.mjs";
import { writePhpWasmPackageSet } from "../../src/release/package-set-assembly.mjs";
import { instrumentSubtypeCEntries, validateSubtypeEntrySelection } from "./php-wasm-subtype-entry-c.mjs";
import { phpWasmRefinementEntrySelection } from "./php-wasm-refinement-entry-selection.mjs";

const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
const save = async (root, path, bytes) => {
	await mkdir(dirname(join(root, path)), { recursive: true });
	await writeFile(join(root, path), bytes, { flag: "wx" });
};

/**
 * Wrap one process runner and instrument only Emscripten component compilation.
 *
 * @param options - Retained record root and underlying process runner.
 */
export const createPhpWasmRefinementEntryBuildObserver = options => {
	const {
		recordRoot, runner, headerInputs = []
		, instrumentEntries = instrumentSubtypeCEntries
		, validateEntries = validateSubtypeEntrySelection
	} = options;
	assert.equal(typeof recordRoot, "string"); assert.ok(runner?.capture);
	assert.equal(typeof instrumentEntries, "function");
	assert.equal(typeof validateEntries, "function");
	assert.ok(Array.isArray(headerInputs));
	assert.equal(new Set(headerInputs).size, headerInputs.length);
	for(const path of headerInputs)
		assert.match(path, /^[A-Za-z_][A-Za-z0-9_.-]*(?:\/[A-Za-z_][A-Za-z0-9_.-]*)*$/u);
	const compiled = [], headers = [], commands = [];
	const counts = new Map(), forms = new Map(), markers = new Map();
	let selected = null, linked = false, headerProbeRoot = null;
	const select = entries => {
		assert.equal(selected, null, "entry selection is bound once");
		validateEntries(entries); selected = structuredClone(entries);
		for(const item of selected)
		{
			counts.set(item.symbol, 0); forms.set(item.symbol, new Set());
			markers.set(item.symbol, 0);
		}
		return structuredClone(selected);
	};
	const recordDefinitions = receipt => {
		const definitions = receipt.definitions ?? receipt.insertions
			.filter(item => item.kind !== "preamble")
			.map(item => ({ ...item, form: "function" }));
		for(const item of definitions)
		{
			assert.ok(counts.has(item.symbol));
			counts.set(item.symbol, counts.get(item.symbol) + 1);
			forms.get(item.symbol).add(item.form);
		}
		for(const item of receipt.insertions.filter(item => item.kind !== "preamble"))
		{
			assert.ok(markers.has(item.symbol));
			markers.set(item.symbol, markers.get(item.symbol) + 1);
		}
	};
	const instrumentHeaders = async args => {
		if(!headerInputs.length) return null;
		if(headers.length) return headerProbeRoot;
		const roots = args.flatMap((item, index) => item === "-I" ? [args[index + 1]] : []);
		const matches = [];
		for(const root of roots)
		{
			try
			{
				await Promise.all(headerInputs.map(path => readFile(join(root, path))));
				matches.push(root);
			}
			catch(error)
			{ if(error.code !== "ENOENT") throw error; }
		}
		assert.equal(matches.length, 1, "one closed generated header root required");
		const originalRoot = matches[0], probeRoot = join(recordRoot, "header-probes");
		headerProbeRoot = probeRoot;
		for(const path of headerInputs)
		{
			const originalPath = join(originalRoot, path), original = await readFile(originalPath, "utf8");
			const { source, receipt } = instrumentEntries(original, selected);
			await save(recordRoot, `header-inputs/${path}`, original);
			await save(recordRoot, `header-probes/${path}`, source);
			recordDefinitions(receipt);
			headers.push({ path, originalPath, probePath: join(probeRoot, path), ...receipt });
		}
		return probeRoot;
	};
	const capture = async request => {
		const args = [...request.args];
		if(basename(request.command) === "emcc" && args.includes("-c"))
		{
			assert.ok(selected, "entry selection precedes C compilation");
			const headerRoot = await instrumentHeaders(args);
			const originalPath = args[args.indexOf("-c") + 1], original = await readFile(originalPath, "utf8");
			const { source, receipt } = instrumentEntries(original, selected);
			const name = `${compiled.length + 1}-${basename(originalPath)}`;
			const probePath = join(recordRoot, "c-probes", name);
			await save(recordRoot, `c-inputs/${name}`, original);
			await save(recordRoot, `c-probes/${name}`, source);
			recordDefinitions(receipt);
			args[args.indexOf("-c") + 1] = probePath;
			args.push(...headerRoot ? ["-iquote", headerRoot] : []
				, "-iquote", dirname(originalPath)
				, `-ffile-prefix-map=${resolve(recordRoot)}=/build/php-wasm-refinement-entry-probe`);
			const command = { command: request.command, originalArgs: request.args, probeArgs: args };
			commands.push(command);
			const result = await runner.capture({ ...request, args });
			const objectPath = args[args.indexOf("-o") + 1];
			compiled.push({ name, originalPath, probePath, objectPath
				, ...receipt, object: identity(await readFile(objectPath)) });
			return result;
		}
		if(basename(request.command) === "emcc" && args.includes("-sSIDE_MODULE=2"))
		{
			assert.ok(selected && compiled.length > 0); assert.equal(linked, false);
			for(const item of selected)
			{
				const { symbol, kind } = item, count = counts.get(symbol);
				assert.equal(count, 1, `${symbol}: exactly one compiled definition required`);
				assert.equal(forms.get(symbol).size, 1, `${symbol}: one compiled form required`);
				const form = [...forms.get(symbol)][0];
				assert.ok(["function", "global"].includes(form));
				if(form === "function")
					assert.equal(markers.get(symbol), 1
						, `${symbol}: exactly one marked definition required`);
				else
				{
					assert.ok(["constructor", "source"].includes(kind)
						, `${symbol}: only authored entries may be module-initialized`);
					assert.equal(markers.get(symbol), 0
						, `${symbol}: a module-initialized value has no call marker`);
				}
			}
			for(const item of compiled)
			{
				assert.equal(sha256(await readFile(item.originalPath)), item.originalSha256);
				assert.equal(sha256(await readFile(item.probePath)), item.probeSha256);
				assert.deepEqual(identity(await readFile(item.objectPath)), item.object);
				assert.ok(args.includes(item.objectPath));
			}
			for(const item of headers)
			{
				assert.equal(sha256(await readFile(item.originalPath)), item.originalSha256);
				assert.equal(sha256(await readFile(item.probePath)), item.probeSha256);
			}
			commands.push({ command: request.command, originalArgs: request.args, probeArgs: args });
			linked = true;
		}
		return runner.capture(request);
	};
	const transcript = () => ({
		selected: selected === null ? null : structuredClone(selected)
		, definitionCounts: Object.fromEntries(counts)
		, compiled: structuredClone(compiled), headers: structuredClone(headers)
		, commands: structuredClone(commands)
		, linked
		, ...[...forms.values()].some(value => value.has("global")) ? {
			globalDefinitions: selected.filter(item => forms.get(item.symbol).has("global"))
		} : {}
	});
	const snapshot = () => {
		assert.ok(selected && linked, "completed entry-observer link required");
		assert.equal(headers.length, headerInputs.length, "every selected generated header is retained");
		return {
			schemaVersion: 1, scope: "separate-instrumented-probe"
			, ...transcript()
		};
	};
	return Object.freeze({ select, capture, transcript, snapshot });
};

/**
 * Compile and package one separately identified nominal/recursive graph probe.
 * The caller writes `sourceProbe.source` into its disposable author project first.
 *
 * @param options - Exact author, toolchain, runtime, package and record roots.
 */
export const buildPhpWasmRefinementEntryProbe = async options => {
	const {
		projectRoot, outputRoot, recordRoot, leanPrefix, runtimeRoot
		, emsdkRoot, phpSource
		, sourceProbe, settings, signal, checkModel, runner = processBuildRunner
		, selectEntries = phpWasmRefinementEntrySelection
		, instrumentEntries = instrumentSubtypeCEntries
		, validateEntries = validateSubtypeEntrySelection
	} = options;
	await mkdir(recordRoot); await save(recordRoot, "source-probe.json", canonicalJson(sourceProbe));
	assert.equal(typeof selectEntries, "function");
	const observer = createPhpWasmRefinementEntryBuildObserver({
		recordRoot, runner, instrumentEntries, validateEntries
	});
	let model;
	try
	{
		const component = await buildPhpWasmCopiedComponent({
			projectRoot, outputRoot: join(outputRoot, "php-wasm/component")
			, runtimeRoot, leanPrefix, emsdkRoot, phpSource, signal
			, runner: observer
			, validateModel: value => {
				model = value;
				const selected = selectEntries(model, sourceProbe.entries).selected;
				observer.select(selected); checkModel?.(model);
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
		const observed = observer.snapshot();
		assert.deepEqual(observed.globalDefinitions ?? [], sourceProbe.entries
			.filter(item => sourceProbe.entryForms[item.symbol] === "global"));
		const observation = {
			...observed, modelSha256: sha256(canonicalJson(model))
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
