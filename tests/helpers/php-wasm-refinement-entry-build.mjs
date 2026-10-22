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
import { sha256 } from "../../src/capsule/node.mjs";
import { instrumentSubtypeCEntries, validateSubtypeEntrySelection } from "./php-wasm-subtype-entry-c.mjs";

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
	const { recordRoot, runner } = options;
	assert.equal(typeof recordRoot, "string"); assert.ok(runner?.capture);
	const compiled = [], commands = [], counts = new Map();
	let selected = null, linked = false;
	const select = entries => {
		assert.equal(selected, null, "entry selection is bound once");
		validateSubtypeEntrySelection(entries); selected = structuredClone(entries);
		for(const item of selected) counts.set(item.symbol, 0);
		return structuredClone(selected);
	};
	const capture = async request => {
		const args = [...request.args];
		if(basename(request.command) === "emcc" && args.includes("-c"))
		{
			assert.ok(selected, "entry selection precedes C compilation");
			const originalPath = args[args.indexOf("-c") + 1], original = await readFile(originalPath, "utf8");
			const { source, receipt } = instrumentSubtypeCEntries(original, selected);
			const name = `${compiled.length + 1}-${basename(originalPath)}`;
			const probePath = join(recordRoot, "c-probes", name);
			await save(recordRoot, `c-inputs/${name}`, original);
			await save(recordRoot, `c-probes/${name}`, source);
			for(const item of receipt.insertions.filter(item => item.kind !== "preamble"))
				counts.set(item.symbol, counts.get(item.symbol) + 1);
			args[args.indexOf("-c") + 1] = probePath;
			args.push("-iquote", dirname(originalPath)
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
			for(const [symbol, count] of counts) assert.equal(count, 1, `${symbol}: exactly one marked definition required`);
			for(const item of compiled)
			{
				assert.equal(sha256(await readFile(item.originalPath)), item.originalSha256);
				assert.equal(sha256(await readFile(item.probePath)), item.probeSha256);
				assert.deepEqual(identity(await readFile(item.objectPath)), item.object);
				assert.ok(args.includes(item.objectPath));
			}
			commands.push({ command: request.command, originalArgs: request.args, probeArgs: args });
			linked = true;
		}
		return runner.capture(request);
	};
	const snapshot = () => {
		assert.ok(selected && linked, "completed entry-observer link required");
		return {
			schemaVersion: 1, scope: "separate-instrumented-probe"
			, selected: structuredClone(selected)
			, definitionCounts: Object.fromEntries(counts)
			, compiled: structuredClone(compiled), commands: structuredClone(commands)
		};
	};
	return Object.freeze({ select, capture, snapshot });
};
