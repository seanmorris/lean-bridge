/** @file */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve } from "node:path";
import test from "node:test";
import ts from "typescript";
import { registerRetainedContractTests, retainedContractScope } from "./helpers/retained-contract-tests.mjs";
import { coreContractEvidenceDirectoryReferences, trackedEvidenceDirectories }
	from "../scripts/core-contract-evidence.mjs";

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
//
// Which modules reference a retained family is decided by the same oracle the
// Core planner uses to materialize evidence, coreContractEvidenceDirectoryReferences,
// applied to every module of a lane's static closure except the source-history
// layers, which reach their families only through Git and the milestone readers.
// A handful of helpers name a family without opening it at module level; they
// are bound here by module and family, and a module-level read in one of them
// fails the lane.
const evidenceDirectories = () => trackedEvidenceDirectories(resolve("."));
const sourceHistoryModule = path => /-source-history(?:-tests)?[.]mjs$/u.test(path);
const referenceOnlyHelpers = Object.freeze({
	node: Object.freeze([
		{
			module: "tests/helpers/callback-subtype-hosted-evidence-sources.mjs"
			, families: [
				"callback-subtype-browser-20261022"
				, "callback-subtype-dotnet-20261022"
				, "callback-subtype-jvm-20261022"
				, "callback-subtype-languages-20261022"
				, "callback-subtype-native-20261022"
				, "callback-subtype-perl-20261022"
				, "callback-subtype-php-native-20261022"
				, "callback-subtype-wit-wasi-20261022"
			]
		}
		, {
			module: "tests/helpers/php-wasm-entry-build-input-supplement.mjs"
			, families: [
				"callback-refinements-php-wasm-20261023"
				, "php-wasm-entry-diagnostic-nominal-full-20261025"
				, "php-wasm-entry-hosted-20261025"
			]
		}
		, {
			module: "tests/helpers/php-wasm-entry-source-supplement.mjs"
			, families: [
				"php-wasm-entry-diagnostic-nominal-full-20261025"
				, "php-wasm-entry-hosted-20261025"
			]
		}
		, {
			module: "tests/helpers/php-wasm-refinement-entry-hosted-replay.mjs"
			, families: ["callback-refinements-php-wasm-20261023"]
		}
	])
	, native: Object.freeze([
		{
			module: "tests/helpers/native-fin-reply-evidence.mjs"
			, families: ["native-fin-replies-20261008"]
		}
	])
});
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
// Every native consumer entrypoint registers exactly these loaders, in this
// order; the lane proves each one stays outside the static closure.
const nativeRetainedLoaders = Object.freeze({
	"tests/native-fin-records.test.mjs": Object.freeze([
		"./helpers/fin-nominal-refusal-archive-tests.mjs"
		, "./helpers/fin-record-alias-archive-tests.mjs"
		, "./helpers/fin-alias-closure-history-tests.mjs"
		, "./helpers/fin-nominal-refusal-history-tests.mjs"
		, "./helpers/native-fin-records-source-history-tests.mjs"
		, "./helpers/fin-record-evidence-tests.mjs"
		, "./helpers/native-fin-promotion-tests.mjs"
		, "./helpers/fin-record-wit-format-source-history-tests.mjs"
		, "./helpers/fin-wit-record-evidence-tests.mjs"
		, "./helpers/native-fin-diagnostic-source-history-tests.mjs"
		, "./helpers/native-fin-nix-boundary-history-tests.mjs"
		, "./helpers/native-fin-diagnostic-php-wasm-tests.mjs"
		, "./helpers/native-fin-diagnostic-callback-tests.mjs"
		, "./helpers/native-fin-diagnostic-ci-tests.mjs"
		, "./helpers/native-fin-diagnostic-evidence-tests.mjs"
		, "./helpers/fin-record-review-omission-history-tests.mjs"
	])
	, "tests/native-fin-record-zero.test.mjs": Object.freeze([
		"./helpers/fin-record-zero-archive-tests.mjs"
		, "./helpers/fin-record-zero-ci-history-tests.mjs"
	])
	, "tests/native-fin-callbacks.test.mjs": Object.freeze([
		"./helpers/native-fin-callback-evidence-tests.mjs"
		, "./helpers/native-fin-callback-archive-source-history-tests.mjs"
		, "./helpers/callback-code-ci-repair-source-history-tests.mjs"
		, "./helpers/native-fin-callback-admission-source-history-tests.mjs"
		, "./helpers/native-fin-reply-evidence-tests.mjs"
		, "./helpers/native-fin-reply-archive-source-history-tests.mjs"
		, "./helpers/native-fin-reply-promotion-tests.mjs"
		, "./helpers/native-fin-reply-promotion-source-history-tests.mjs"
		, "./helpers/native-fin-reply-source-history-tests.mjs"
		, "./helpers/native-reply-symbol-fix-source-history-tests.mjs"
		, "./helpers/native-fin-reply-review-tests.mjs"
		, "./helpers/native-reply-review-source-history-tests.mjs"
		, "./helpers/native-fin-reply-refusal-evidence-tests.mjs"
		, "./helpers/native-reply-refusal-source-history-tests.mjs"
	])
	, "tests/native-subtype.test.mjs": Object.freeze([
		"./helpers/subtype-alias-position-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-wit-archive-source-history-tests.mjs"
		, "./helpers/callback-refinements-php-wasm-hosted-archive-source-history-tests.mjs"
		, "./helpers/subtype-xs-archive-source-history-tests.mjs"
		, "./helpers/checked-record-admission-source-history-tests.mjs"
		, "./helpers/structural-subtype-runtime-history-tests.mjs"
		, "./helpers/nominal-subtype-conversion-history-tests.mjs"
		, "./helpers/nominal-subtype-native-history-tests.mjs"
		, "./helpers/subtype-result-history-tests.mjs"
		, "./helpers/nominal-subtype-author-history-tests.mjs"
		, "./helpers/component-refinement-mirror-history-tests.mjs"
		, "./helpers/nominal-subtype-selection-history-tests.mjs"
		, "./helpers/generic-subtype-composition-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-hosted-archivers-source-history-tests.mjs"
		, "./helpers/nested-checked-record-regression-contract-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-hosted-failure-repair-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-foundation-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-native-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-native-evidence-tests.mjs"
		, "./helpers/dependent-checked-record-native-archive-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-perl-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-perl-evidence-tests.mjs"
		, "./helpers/dependent-checked-record-perl-archive-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-python-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-python-evidence-tests.mjs"
		, "./helpers/dependent-checked-record-python-archive-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-ruby-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-type-surface-gap-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-php-wasm-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-php-wasm-evidence-tests.mjs"
		, "./helpers/dependent-checked-record-php-wasm-archive-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-promotion-artifact-identity-hardening-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-wit-retained-pkg-config-repair-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-wit-pkg-config-space-repair-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-jvm-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-jvm-evidence-tests.mjs"
		, "./helpers/dependent-checked-record-jvm-archive-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-dotnet-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-dotnet-evidence-tests.mjs"
		, "./helpers/dependent-checked-record-dotnet-archive-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-php-evidence-tests.mjs"
		, "./helpers/dependent-checked-record-php-archive-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-browser-path-diagnostic-repair-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-browser-diagnostic-repair-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-browser-evidence-tests.mjs"
		, "./helpers/dependent-checked-record-browser-archive-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-wit-export-count-repair-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-wit-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-wit-evidence-tests.mjs"
		, "./helpers/php-wasm-refinement-entry-installed-source-history-tests.mjs"
		, "./helpers/callback-subtype-managed-consumer-repair-source-history-tests.mjs"
		, "./helpers/php-wasm-indexed-refinement-entry-source-history-tests.mjs"
		, "./helpers/php-wasm-owned-refinement-entry-source-history-tests.mjs"
		, "./helpers/wit-consumer-root-repair-source-history-tests.mjs"
		, "./helpers/callback-subtype-php-wasm-profile-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-php-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-rust-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-hosted-archive-preparation-source-history-tests.mjs"
		, "./helpers/zero-payload-native-control-contract-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-archive-selection-repair-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-ruby-evidence-tests.mjs"
		, "./helpers/dependent-checked-record-ruby-archive-source-history-tests.mjs"
		, "./helpers/dependent-checked-record-rust-evidence-tests.mjs"
		, "./helpers/dependent-checked-record-rust-archive-source-history-tests.mjs"
		, "./helpers/dependent-generic-subtype-source-history-tests.mjs"
		, "./helpers/dependent-generic-subtype-ci-source-history-tests.mjs"
	])
});
// One loader per native entrypoint whose own closure opens a retained family;
// re-importing it eagerly must trip the oracle, not only the loader inventory.
const nativeFamilyLoaders = Object.freeze([
	{ parent: "tests/native-fin-records.test.mjs"
		, module: "./helpers/fin-record-evidence-tests.mjs" }
	, { parent: "tests/native-fin-record-zero.test.mjs"
		, module: "./helpers/fin-record-zero-archive-tests.mjs" }
	, { parent: "tests/native-fin-callbacks.test.mjs"
		, module: "./helpers/native-fin-callback-evidence-tests.mjs" }
	, { parent: "tests/native-subtype.test.mjs"
		, module: "./helpers/dependent-checked-record-native-evidence-tests.mjs" }
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
const referenceCache = new Map();
const moduleReadCalls
	= /^(?:readFile|readFileSync|readdir|readdirSync|existsSync|statSync|stat|access|open|execFileSync|spawnSync|execFile|spawn)$/u;

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
 * Retained families each non-history module of a closure references, as the
 * Core planner would select them.
 *
 * @param closure - Static module closure.
 * @param directories - Tracked top-level evidence directory names.
 */
const retainedReferences = (closure, directories) => {
	const references = new Map();
	for(const [path, source] of closure)
	{
		if(sourceHistoryModule(path)) continue;
		const key = `${path}\u0000${source}`;
		if(!referenceCache.has(key))
			referenceCache.set(key, [...coreContractEvidenceDirectoryReferences(
				source, path, directories)].sort());
		const families = referenceCache.get(key);
		if(families.length > 0) references.set(path, families);
	}
	return references;
};

/**
 * Module-level statements that read the worktree or await, outside any
 * function body. A reference-only helper must have none.
 *
 * @param source - Module text.
 * @param path - Repository-relative module path.
 */
const moduleLevelReads = (source, path) => {
	const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true
		, ts.ScriptKind.JS);
	const found = [];
	const visit = node => {
		if(ts.isFunctionLike(node)) return;
		if(ts.isAwaitExpression(node)) found.push("await");
		if(ts.isCallExpression(node))
		{
			const callee = node.expression;
			const name = ts.isIdentifier(callee) ? callee.text
				: ts.isPropertyAccessExpression(callee) ? callee.name.text : "";
			if(moduleReadCalls.test(name)) found.push(name);
		}
		ts.forEachChild(node, visit);
	};
	for(const statement of file.statements)
		if(!ts.isImportDeclaration(statement)) visit(statement);
	return found;
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
 * Assert that a deferred lane's static closure references retained families
 * only through the bound reference-only helpers, none of which reads at
 * module level.
 *
 * @param closure - Static module closure of the lane's whole-file entries.
 * @param helpers - Reference-only helpers bound to their families.
 * @param directories - Tracked top-level evidence directory names.
 */
const assertRetainedReferences = (closure, helpers, directories) => {
	const expected = [...helpers].map(helper => [helper.module
		, [...helper.families].sort()]).sort(([first], [second]) =>
		first.localeCompare(second));
	const actual = [...retainedReferences(closure, directories)]
		.sort(([first], [second]) => first.localeCompare(second));
	assert.deepEqual(actual, expected);
	for(const helper of helpers)
	{
		assert.ok(closure.has(helper.module), helper.module);
		assert.deepEqual(moduleLevelReads(closure.get(helper.module)
			, helper.module), [], helper.module);
	}
};

/**
 * Assert that every retained loader stays registered through
 * registerRetainedContractTests and outside the static closure.
 *
 * @param closure - Static module closure of the lane's whole-file entries.
 * @param loaders - Retained loaders that must remain outside the closure.
 */
const assertLoadersDeferred = (closure, loaders) => {
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
 * Assert that a native entrypoint registers exactly its bound loaders, in order.
 *
 * @param parent - Native entrypoint path.
 * @param source - Entrypoint source.
 */
const registeredLoaders = (parent, source) => {
	const start = source.indexOf("await registerRetainedContractTests([");
	const end = source.indexOf("]);", start);
	assert.ok(start >= 0 && end > start, parent);
	const modules = [...source.slice(start, end).matchAll(
		/\(\) => import\("([.][.]?\/[^"\r\n]+)"\)/gu
	)].map(match => match[1]);
	assert.deepEqual(modules, [...nativeRetainedLoaders[parent]], parent);
	return modules.map(module => ({ parent, module }));
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
	const directories = evidenceDirectories();
	const closure = await staticModuleClosure(entries);
	assert.ok(closure.size > 1000);
	assertRetainedReferences(closure, referenceOnlyHelpers.node, directories);
	assertLoadersDeferred(closure, deferredRetainedLoaders);
	for(const loader of deferredRetainedLoaders)
	{
		const target = resolveSpecifier(loader.parent, loader.module);
		const retained = await staticModuleClosure([target]);
		const families = [...retainedReferences(retained, directories).values()].flat();
		if(loader.family !== undefined)
			assert.ok(families.includes(loader.family), `${loader.module}: ${loader.family}`);
		const parent = closure.get(loader.parent);
		const eager = new Map([[loader.parent, `import "${loader.module}";\n${parent}`]]);
		const eagerClosure = await staticModuleClosure(entries, eager);
		await assert.rejects(async () => assertLoadersDeferred(eagerClosure, deferredRetainedLoaders)
			, { name: "AssertionError" }, `eager ${loader.module}`);
		if(loader.family !== undefined)
			await assert.rejects(async () => assertRetainedReferences(
				eagerClosure, referenceOnlyHelpers.node, directories)
			, { name: "AssertionError" }, `eager reference ${loader.module}`);
		const dropped = new Map([[loader.parent
			, parent.replace(`() => import("${loader.module}")`, "() => Promise.resolve()")]]);
		assert.notEqual(dropped.get(loader.parent), parent);
		await assert.rejects(async () => assertLoadersDeferred(
			await staticModuleClosure(entries, dropped), deferredRetainedLoaders)
		, { name: "AssertionError" }, `dropped ${loader.module}`);
	}
});

test("native consumer entrypoints keep every retained test behind the deferred boundary", async () => {
	const entries = Object.keys(nativeRetainedLoaders);
	const directories = evidenceDirectories();
	const closure = await staticModuleClosure(entries);
	assert.ok(closure.size > 500);
	const loaders = entries.flatMap(parent =>
		registeredLoaders(parent, closure.get(parent)));
	assert.equal(loaders.length, 98);
	assertRetainedReferences(closure, referenceOnlyHelpers.native, directories);
	assertLoadersDeferred(closure, loaders);
	assertNativeCurrentClosure(closure);
	for(const loader of loaders)
		await readFile(resolveSpecifier(loader.parent, loader.module), "utf8");

	// Re-importing a family loader eagerly must trip the oracle itself, not
	// only the loader inventory; dropping any first loader must trip the
	// inventory; renaming a loader must trip the exact identity binding.
	for(const parent of entries)
	{
		const source = closure.get(parent);
		const family = nativeFamilyLoaders.find(item => item.parent === parent).module;
		assert.ok(loaders.some(loader =>
			loader.parent === parent && loader.module === family), family);
		const eagerClosure = await staticModuleClosure(entries
			, new Map([[parent, `import "${family}";\n${source}`]]));
		await assert.rejects(async () => assertRetainedReferences(
			eagerClosure, referenceOnlyHelpers.native, directories)
		, { name: "AssertionError" }, `eager reference ${family}`);
		await assert.rejects(async () => assertLoadersDeferred(eagerClosure, loaders)
			, { name: "AssertionError" }, `eager ${family}`);
		const [first] = nativeRetainedLoaders[parent];
		const dropped = source.replace(`() => import("${first}")`
			, "() => Promise.resolve()");
		assert.notEqual(dropped, source);
		await assert.rejects(async () => assertLoadersDeferred(
			await staticModuleClosure(entries, new Map([[parent, dropped]])), loaders)
		, { name: "AssertionError" }, `dropped ${first}`);
		assert.throws(() => registeredLoaders(parent, dropped)
			, { name: "AssertionError" }, `identity ${first}`);
		const renamed = source.replace(`() => import("${first}")`
			, `() => import("${first.replace(/[.]mjs$/u, "-renamed.mjs")}")`);
		assert.throws(() => registeredLoaders(parent, renamed)
			, { name: "AssertionError" }, `renamed ${first}`);
	}

	// The reference-only binding is exact in both directions, and a helper
	// that starts reading at module level is refused.
	const [helper] = referenceOnlyHelpers.native;
	assert.throws(() => assertRetainedReferences(closure, [], directories)
		, { name: "AssertionError" });
	assert.throws(() => assertRetainedReferences(closure, [helper
		, { module: "tests/helpers/fin-record-model.mjs", families: ["unknown-20261106"] }
	], directories), { name: "AssertionError" });
	const reading = new Map(closure);
	reading.set(helper.module, `${closure.get(helper.module)}\nconst eager = readFileSync("docs/evidence/${helper.families[0]}/receipt.json");\n`);
	assert.throws(() => assertRetainedReferences(reading, referenceOnlyHelpers.native
		, directories), { name: "AssertionError" });

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
