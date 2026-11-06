/** @file */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import test from "node:test";
import ts from "typescript";
import { registerRetainedContractTests, retainedContractScope } from "./helpers/retained-contract-tests.mjs";

const workflowJob = (source, job) => source.split(`\n  ${job}:\n`)[1]?.split(/\n {2}[a-z][a-z0-9-]*:\n/u)[0];

test("retained contracts are required by default and reject an unknown policy", async () => {
	assert.equal(retainedContractScope({}), "required");
	assert.throws(() => retainedContractScope({ LEAN_BRIDGE_RETAINED_CONTRACTS: "optional" })
		, /must be one of: required, deferred/u);
	await assert.rejects(registerRetainedContractTests([null], {}), /loaders must be functions/u);
});

test("required retained contracts load every suite in order", async () => {
	const loaded = [];
	const result = await registerRetainedContractTests([
		async () => { loaded.push("history"); }
		, async () => { loaded.push("evidence"); }
	], { LEAN_BRIDGE_RETAINED_CONTRACTS: "required" });
	assert.deepEqual(loaded, ["history", "evidence"]);
	assert.deepEqual(result, { scope: "required", registered: 2 });
});

test("deferred retained contracts do not load archive suites", async () => {
	let loaded = false;
	const result = await registerRetainedContractTests([
		async () => { loaded = true; }
	], { LEAN_BRIDGE_RETAINED_CONTRACTS: "deferred" });
	assert.equal(loaded, false);
	assert.deepEqual(result, { scope: "deferred", registered: 0 });
});

test("sparse consumers defer retained contracts while Core requires them", async () => {
	const [consumers, perl, quality] = await Promise.all([
		readFile(".github/workflows/consumer-matrix.yml", "utf8")
		, readFile(".github/workflows/perl-consumer.yml", "utf8")
		, readFile(".github/workflows/quality.yml", "utf8")
	]);
	for(const job of ["node-consumers", "php-consumers", "native-consumers", "managed-consumers", "wasi-consumer"])
	{
		const source = workflowJob(consumers, job);
		assert.ok(source, job);
		assert.equal(source.match(/LEAN_BRIDGE_RETAINED_CONTRACTS: deferred/gu)?.length, 1, job);
	}
	assert.equal(workflowJob(perl, "perl").match(/LEAN_BRIDGE_RETAINED_CONTRACTS: deferred/gu)?.length, 1);
	assert.equal(workflowJob(quality, "contract").match(/LEAN_BRIDGE_RETAINED_CONTRACTS: required/gu)?.length, 1);
});

// Retained-evidence readers open an archived family from the worktree. A
// sparse consumer lane that reaches one of them through a static import fails
// with ENOENT before any current-behavior test runs (run 42177405137 job
// 127767402756), so every reader must sit behind a retained-contract loader.
const retainedReaderShapes = Object.freeze([
	/^const directory = "docs\/evidence\/([A-Za-z0-9_-]+)";$/gmu
	, /readFile\(\s*["'`]docs\/evidence\/([A-Za-z0-9_-]+)\//gu
	, /^export const [A-Za-z]+ = "docs\/evidence\/([A-Za-z0-9_-]+)\/[^"]+";$/gmu
	, /^const [A-Za-z]+\n?\s*= "docs\/evidence\/([A-Za-z0-9_-]+)\/[^"]+";$/gmu
]);
// Loaders without a family are exact-history suites: they read their inputs
// through Git and the milestone readers, never from the worktree.
const deferredRetainedLoaders = Object.freeze([
	{ parent: "tests/helpers/reviewed-fin-wasm-installed-tests.mjs"
		, module: "./reviewed-fin-wasm-archived-identity-tests.mjs"
		, family: "reviewed-fin-npm-20261007" }
	, { parent: "tests/helpers/reviewed-fin-wasm-installed-tests.mjs"
		, module: "./reviewed-fin-wasm-evidence-tests.mjs"
		, family: "reviewed-fin-npm-20261007" }
	, { parent: "tests/helpers/reviewed-fin-wasm-installed-tests.mjs"
		, module: "./reviewed-fin-promotion-tests.mjs"
		, family: "reviewed-fin-hosts-20261007" }
	, { parent: "tests/generic-records-browser.test.mjs"
		, module: "./helpers/generic-record-browser-source-history-tests.mjs" }
	, { parent: "tests/generic-records-browser.test.mjs"
		, module: "./helpers/generic-record-browser-evidence-tests.mjs"
		, family: "generic-record-browser-20261008" }
	, { parent: "tests/generic-records-browser.test.mjs"
		, module: "./helpers/generic-record-browser-archive-source-history-tests.mjs" }
	, { parent: "tests/generic-records-browser.test.mjs"
		, module: "./helpers/browser-generic-promotion-source-history-tests.mjs"
		, family: "generic-record-browser-20261008" }
	, { parent: "tests/generic-records.test.mjs"
		, module: "./helpers/browser-install-source-history-tests.mjs" }
]);
const nativeDeferredParents = Object.freeze([
	{ parent: "tests/native-fin-records.test.mjs", loaders: 16 }
	, { parent: "tests/native-fin-record-zero.test.mjs", loaders: 2 }
	, { parent: "tests/native-fin-callbacks.test.mjs", loaders: 14 }
	, { parent: "tests/native-subtype.test.mjs", loaders: 66 }
]);
const nativeEagerCurrentModules = Object.freeze([
	{ parent: "tests/native-fin-records.test.mjs"
		, module: "tests/helpers/fin-nominal-refusals-tests.mjs" }
	, { parent: "tests/native-fin-records.test.mjs"
		, module: "tests/helpers/native-fin-diagnostic-tests.mjs" }
	, { parent: "tests/helpers/native-fin-diagnostic-tests.mjs"
		, module: "tests/helpers/native-fin-nix-boundary-tests.mjs" }
	, { parent: "tests/native-fin-callbacks.test.mjs"
		, module: "tests/helpers/native-fin-reply-promotion-current-tests.mjs" }
	, { parent: "tests/native-fin-callbacks.test.mjs"
		, module: "tests/helpers/native-fin-reply-review-current-tests.mjs" }
]);
const resolveSpecifier = (from, specifier) => normalize(join(dirname(from)
	, extname(specifier) === "" ? `${specifier}.mjs` : specifier));
const specifierCache = new Map();

/**
 * Relative specifiers that load eagerly: import declarations and re-exports.
 * Dynamic `import()` calls, strings and comments never contribute.
 *
 * @param source - Module text.
 * @param path - Repository-relative module path.
 */
const staticSpecifiers = (source, path) => {
	const key = `${path}\u0000${source}`;
	if(specifierCache.has(key)) return specifierCache.get(key);
	const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true
		, ts.ScriptKind.JS);
	const found = [];
	for(const statement of file.statements)
		if((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement))
			&& statement.moduleSpecifier
			&& ts.isStringLiteralLike(statement.moduleSpecifier)
			&& /^\.\.?\//u.test(statement.moduleSpecifier.text))
			found.push(statement.moduleSpecifier.text);
	specifierCache.set(key, found);
	return found;
};

/**
 * Every module a lane loads eagerly from its whole-file test entries.
 *
 * @param entries - Repository-relative test entry paths.
 * @param overrides - Module sources substituted for the worktree's files.
 */
const staticModuleClosure = async (entries, overrides = new Map()) => {
	const closure = new Map();
	const queue = [...entries];
	while(queue.length > 0)
	{
		const path = queue.shift();
		if(closure.has(path)) continue;
		const source = overrides.has(path) ? overrides.get(path)
			: await readFile(path, "utf8");
		closure.set(path, source);
		for(const specifier of staticSpecifiers(source, path))
			queue.push(resolveSpecifier(path, specifier));
	}
	return closure;
};

/**
 * Test files one job runs whole, without a test-name pattern.
 *
 * @param job - Workflow job source.
 */
const wholeFileTestEntries = job => {
	const entries = new Set();
	for(const line of job.replace(/\\\n\s*/gu, " ").split("\n"))
	{
		if(!/\bnode --test\b/u.test(line) || line.includes("--test-name-pattern")
			|| line.includes("consumer-ci.mjs")) continue;
		for(const match of line.matchAll(/tests\/[A-Za-z0-9_.-]+\.test\.mjs/gu))
			entries.add(match[0]);
	}
	return [...entries].sort();
};

/**
 * Assert that a deferred lane's static closure opens no retained family and
 * that every retained reader stays reachable only through a loader.
 *
 * @param closure - Static module closure of the lane's whole-file entries.
 * @param loaders - Retained loaders that must remain outside the closure.
 * @param readerPath - Which modules can execute retained-reader assertions.
 */
const assertDeferredLaneClosure = (
	closure, loaders = deferredRetainedLoaders, readerPath = () => true
) => {
	const readers = [];
	for(const [path, source] of closure)
	{
		if(!readerPath(path)) continue;
		for(const shape of retainedReaderShapes)
			for(const match of source.matchAll(shape))
				readers.push(`${path} -> docs/evidence/${match[1]}`);
	}
	assert.deepEqual(readers, []);
	for(const loader of loaders)
	{
		const parent = closure.get(loader.parent);
		assert.equal(typeof parent, "string", loader.parent);
		const registration = parent.indexOf("await registerRetainedContractTests([");
		const entry = parent.indexOf(`() => import("${loader.module}")`);
		assert.ok(registration >= 0 && entry > registration
			, `${loader.parent}: ${loader.module}`);
		assert.equal(parent.includes(`import "${loader.module}";`), false
			, `${loader.parent}: ${loader.module}`);
		assert.equal(closure.has(resolveSpecifier(loader.parent, loader.module))
			, false, loader.module);
	}
};

/**
 * Splitting mixed current/history modules must not make a deferred lane green
 * by silently removing the current half of its contract.
 *
 * @param closure - Static module closure of native consumer entrypoints.
 */
const assertNativeCurrentClosure = closure => {
	for(const { module } of nativeEagerCurrentModules)
		assert.ok(closure.has(module), `current ${module}`);
};

test("the Node and browser consumer lane reaches no retained-evidence reader under deferred scope", async () => {
	const consumers = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const job = workflowJob(consumers, "node-consumers");
	assert.match(job, /LEAN_BRIDGE_RETAINED_CONTRACTS: deferred/u);
	const entries = wholeFileTestEntries(job);
	for(const entry of ["tests/generic-records.test.mjs", "tests/generic-records-browser.test.mjs"])
		assert.ok(entries.includes(entry), entry);
	const closure = await staticModuleClosure(entries);
	assert.ok(closure.size > 1000);
	assertDeferredLaneClosure(closure);
	for(const loader of deferredRetainedLoaders)
	{
		const target = resolveSpecifier(loader.parent, loader.module);
		const retained = await staticModuleClosure([target]);
		const families = [...retained.values()].flatMap(source =>
			retainedReaderShapes.flatMap(shape => [...source.matchAll(shape)].map(match => match[1])));
		if(loader.family === undefined) assert.deepEqual(families, [], loader.module);
		else assert.ok(families.includes(loader.family), `${loader.module}: ${loader.family}`);
		const parent = closure.get(loader.parent);
		const eager = new Map([[loader.parent, `import "${loader.module}";\n${parent}`]]);
		await assert.rejects(async () => assertDeferredLaneClosure(
			await staticModuleClosure(entries, eager)), { name: "AssertionError" }, `eager ${loader.module}`);
		const dropped = new Map([[loader.parent
			, parent.replace(`() => import("${loader.module}")`, "() => Promise.resolve()")]]);
		assert.notEqual(dropped.get(loader.parent), parent);
		await assert.rejects(async () => assertDeferredLaneClosure(
			await staticModuleClosure(entries, dropped)), { name: "AssertionError" }, `dropped ${loader.module}`);
	}
});

test("native consumer entrypoints keep every retained test behind the deferred boundary", async () => {
	const loaders = [];
	for(const { parent, loaders: expected } of nativeDeferredParents)
	{
		const source = await readFile(parent, "utf8");
		const start = source.indexOf("await registerRetainedContractTests([");
		const end = source.indexOf("]);", start);
		assert.ok(start >= 0 && end > start, parent);
		const modules = [...source.slice(start, end).matchAll(
			/\(\) => import\("([.][.]?\/[^"\r\n]+)"\)/gu
		)].map(match => match[1]);
		assert.equal(modules.length, expected, parent);
		loaders.push(...modules.map(module => ({ parent, module })));
	}
	const entries = nativeDeferredParents.map(item => item.parent);
	const closure = await staticModuleClosure(entries);
	const testReader = path => /(?:-tests|[.]test)[.]mjs$/u.test(path);
	assert.ok(closure.size > 500);
	assertDeferredLaneClosure(closure, loaders, testReader);
	assertNativeCurrentClosure(closure);

	// One eager-import and one dropped-loader mutation per entrypoint prevent
	// both the closure assertion and the registration inventory from going
	// vacuous without repeating the complete graph walk for all 98 loaders.
	for(const { parent } of nativeDeferredParents)
	{
		const loader = loaders.find(item => item.parent === parent);
		const source = closure.get(parent);
		const eager = new Map([[parent
			, `import "${loader.module}";\n${source}`]]);
		await assert.rejects(async () => assertDeferredLaneClosure(
			await staticModuleClosure(entries, eager), loaders, testReader
		), { name: "AssertionError" }, `eager ${parent}`);
		const dropped = new Map([[parent
			, source.replace(
			`() => import("${loader.module}")`, "() => Promise.resolve()")]]);
		assert.notEqual(dropped.get(parent), source);
		await assert.rejects(async () => assertDeferredLaneClosure(
			await staticModuleClosure(entries, dropped), loaders, testReader
		), { name: "AssertionError" }, `dropped ${parent}`);
	}

	// The inverse mutation catches an over-broad deferral repair: each named
	// current module must remain eager even when all retained readers are absent.
	for(const { parent, module } of nativeEagerCurrentModules)
	{
		const source = closure.get(parent);
		const relative = `./${module.slice(dirname(parent).length + 1)}`;
		const omitted = new Map([[parent
			, source.replace(`import "${relative}";`, "")]]);
		assert.notEqual(omitted.get(parent), source, `${parent}: ${relative}`);
		await assert.rejects(async () => assertNativeCurrentClosure(
			await staticModuleClosure(entries, omitted)
		), { name: "AssertionError" }, `omitted current ${module}`);
	}
});
