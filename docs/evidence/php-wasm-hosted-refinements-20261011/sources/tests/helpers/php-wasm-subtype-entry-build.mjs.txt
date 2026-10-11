/**
 * Build separately identified PHP-Wasm entry probes without production compiler hooks.
 * Original generated C and its instrumented copy have distinct recorded identities.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { compileCopiedPhpModel } from "../../src/backends/php/copied-model.mjs";
import { buildPhpWasmCopiedComponent } from "../../src/build/php-wasm-copied-component.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { buildPhpWasmCopiedPackages } from "../../src/release/php-wasm-copied-package.mjs";
import { writePhpWasmPackageSet } from "../../src/release/package-set-assembly.mjs";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";
import { phpWasmSubtypeReview } from "./php-wasm-subtype-fixture.mjs";
import { instrumentSubtypeCEntries, validateSubtypeEntrySelection } from "./php-wasm-subtype-entry-c.mjs";

const constructors = ["checkedWord", "checkedEven", "checkedSmall", "checkedPayload", "checkedBounded", "checkedByte", "normalizedEven"];
const sources = ["shout", "half", "scale", "head", "pad", "join", "clamp", "mix", "byte", "echo"];
const control = "\nnamespace Subtypes\n@[noinline, export lb_probe_source_unrestricted]\ndef unrestricted (value : Nat) : Nat := value\nend Subtypes\n";
const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
const save = async (root, path, bytes) => {
	await mkdir(dirname(join(root, path)), { recursive: true });
	await writeFile(join(root, path), bytes, { flag: "wx" });
};

/**
 * Add explicit probe symbol names without changing any Lean definition body or signature.
 *
 * @param original - Exact original twelve-export Lean fixture source.
 */
export const subtypeEntryProbeSource = original => {
	assert.equal(typeof original, "string"); assert.doesNotMatch(original, /lb_probe_|def unrestricted\b/u);
	const edits = [], entries = [];
	for(const [kind, names] of [["constructor", constructors], ["source", sources]])
	for(const name of names)
	{
		const pattern = new RegExp(`^(?:@\\[noinline\\] )?def ${name}\\b`, "gmu"), matches = [...original.matchAll(pattern)];
		assert.equal(matches.length, 1, `one source definition for ${name}`);
		const symbol = `lb_probe_${kind}_${name}`;
		edits.push({ offset: matches[0].index, previous: matches[0][0], current: `@[noinline, export ${symbol}]\ndef ${name}` });
		// Lean erases echo's type argument and calls its reduced worker, bypassing its exported wrapper.
		entries.push({ symbol: name === "echo" ? "l_Subtypes_echo___redArg" : symbol, kind, label: `Subtypes.${name}` });
	}
	edits.sort((left, right) => right.offset - left.offset);
	let source = original;
	for(const edit of edits) source = source.slice(0, edit.offset) + edit.current + source.slice(edit.offset + edit.previous.length);
	source += control;
	entries.push({ symbol: "lb_probe_source_unrestricted", kind: "source", label: "Subtypes.unrestricted" });
	let restored = source.slice(0, -control.length);
	for(const edit of [...edits].reverse())
	{
		assert.equal(restored.slice(edit.offset, edit.offset + edit.current.length), edit.current);
		restored = restored.slice(0, edit.offset) + edit.previous + restored.slice(edit.offset + edit.current.length);
	}
	assert.equal(restored, original);
	return { source, entries, edits, originalSha256: sha256(original), probeSha256: sha256(source), appendedControl: control };
};

/** Independent review retains its constructor decisions and adds only the unrefined control. */
export const subtypeEntryProbeReview = () => {
	const review = phpWasmSubtypeReview();
	const extra = corpusReviewedIr({ id: "subtypes" }, [{ name: "Subtypes.unrestricted", parameters: ["nat"], result: "nat" }]).declarations[0];
	extra.parameters[0].name = "arg0";
	review.declarations.push(extra);
	return review;
};

/**
 * Select actual generated C wrapper, validator, adapter and separately named Lean entries.
 *
 * @param model - Fresh ordinary or independently reconciled reviewed wasm32 model.
 * @param entries - Explicit Lean function-entry selection from the probe source.
 */
export const subtypeEntryProbeSelection = (model, entries) => {
	assert.equal(model.pointerBits, 32); assert.equal(model.exports.length, 13);
	const projection = compileCopiedPhpModel(model.bindingIr, { integerBits: 32, structuredCallables: true, lists: true, variants: true });
	const selected = structuredClone(entries);
	for(const fn of projection.surface.functions) selected.push({ symbol: fn.name, kind: "public", label: fn.declaration.name });
	for(const item of model.exports)
	{
		selected.push({ symbol: item.symbol, kind: "adapter", label: item.name });
		item.refinements?.parameters.forEach((refinement, index) => {
			if(refinement?.kind === "subtype") selected.push({ symbol: `${item.symbol}_refinement_${index}`, kind: "validator", label: `${item.name}:${index}` });
		});
	}
	validateSubtypeEntrySelection(selected); assert.equal(selected.length, 55);
	return selected;
};

/**
 * Build a probe component and ordinary package-set receipt, plus separate C-input provenance.
 * The package receipt authenticates the probe artifacts, not an unmodified release build.
 * Records live outside the disposable author root and never enter the consumer's handoff.
 *
 * @param options - Explicit roots, pinned tools, package coordinates and probe source selection.
 */
export const buildSubtypeEntryProbe = async options => {
	const { projectRoot, outputRoot, recordRoot, leanPrefix, runtimeRoot, emsdkRoot, phpSource, sourceProbe, settings, signal, runner = processBuildRunner } = options;
	await mkdir(recordRoot);
	await save(recordRoot, "source-probe.json", canonicalJson(sourceProbe));
	const compiled = [], commands = [];
	let model, selected;
	const counts = new Map();
	const instrumentedRunner = { capture: async request => {
		const args = [...request.args];
		if(basename(request.command) === "emcc" && args.includes("-c"))
		{
			assert.ok(model && selected);
			const originalPath = args[args.indexOf("-c") + 1], original = await readFile(originalPath, "utf8");
			const { source, receipt } = instrumentSubtypeCEntries(original, selected);
			const name = `${compiled.length + 1}-${basename(originalPath)}`;
			const probePath = join(recordRoot, "c-probes", name);
			await save(recordRoot, `c-inputs/${name}`, original); await save(recordRoot, `c-probes/${name}`, source);
			for(const item of receipt.insertions.filter(item => item.kind !== "preamble")) counts.set(item.symbol, counts.get(item.symbol) + 1);
			args[args.indexOf("-c") + 1] = probePath;
			args.push("-iquote", dirname(originalPath), `-ffile-prefix-map=${resolve(recordRoot)}=/build/php-wasm-subtype-entry-probe`);
			const command = { command: request.command, originalArgs: request.args, probeArgs: args };
			commands.push(command);
			const result = await runner.capture({ ...request, args });
			const objectPath = args[args.indexOf("-o") + 1];
			compiled.push({ name, originalPath, probePath, objectPath, ...receipt, object: identity(await readFile(objectPath)) });
			return result;
		}
		if(basename(request.command) === "emcc" && args.includes("-sSIDE_MODULE=2"))
		{
			assert.equal(compiled.length, 7);
			for(const [symbol, count] of counts) assert.equal(count, 1, `${symbol}: exactly one marked definition required`);
			for(const item of compiled)
			{
				assert.equal(sha256(await readFile(item.originalPath)), item.originalSha256);
				assert.equal(sha256(await readFile(item.probePath)), item.probeSha256);
				assert.deepEqual(identity(await readFile(item.objectPath)), item.object);
				assert.ok(args.includes(item.objectPath));
			}
			commands.push({ command: request.command, originalArgs: request.args, probeArgs: args });
		}
		return runner.capture(request);
	} };
	try
	{
		const component = await buildPhpWasmCopiedComponent({
			projectRoot, outputRoot: join(outputRoot, "php-wasm/component")
			, runtimeRoot, leanPrefix, emsdkRoot, phpSource, signal
			, runner: instrumentedRunner
			, validateModel: value => {
				model = value; selected = subtypeEntryProbeSelection(model, sourceProbe.entries);
				for(const item of selected) counts.set(item.symbol, 0);
			}
		});
		const packages = await buildPhpWasmCopiedPackages({
			componentRoot: component.root, runtimeRoot
			, outputRoot: join(outputRoot, "packages/php-wasm"), leanPrefix
			, npmSettings: settings.npm, composerSettings: settings.composer });
		const receipt = await writePhpWasmPackageSet({ root: outputRoot, model, report: packages.report, signal });
		const library = identity(await readFile(join(component.root, component.receipt.library)));
		assert.deepEqual(library, component.receipt.wasmLibrary);
		const observation = { schemaVersion: 1
			, scope: "separate-instrumented-probe", selected
			, definitionCounts: Object.fromEntries(counts), compiled, commands
			, modelSha256: sha256(canonicalJson(model))
			, component: component.receipt, library
			, packageSetSha256: sha256(canonicalJson(receipt)) };
		await save(recordRoot, "observation.json", canonicalJson(observation));
		await save(recordRoot, "model.json", canonicalJson(model));
		return { model, receipt, packageSet: packages.report, observation };
	}
	finally
	{ await save(recordRoot, "commands.json", canonicalJson({ commands, compiled })); }
};
