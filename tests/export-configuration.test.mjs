/**
 * Shared author choices are deterministic, read-only and never silently ignored.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { assertExportConfigurationCapabilities, exportConfigurationFile, exportTargets
	, readExportConfiguration, validateExportConfiguration } from "../src/analyze/export-configuration.mjs";
import { analyzeLeanProject } from "../src/analyze/lean-project.mjs";
import { prepareComponentBuildPlan } from "../src/build/component-plan.mjs";
import { buildNativeProject } from "../src/build/native-project.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { componentNpmIdentity, parseNpmPackageCoordinate } from "../src/release/component-package-receipt.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";

const fixture = resolve("tests/fixtures/export-selection");
const workspace = async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-export-config-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	await cp(fixture, directory, { recursive: true });
	return directory;
};
const configure = (directory, value) => writeFile(join(directory, exportConfigurationFile), JSON.stringify(value));

test("shared export configuration and schema accept the same structural choices", async () => {
	const targets = Object.fromEntries(exportTargets.map(target => {
		const settings = target === "cpan"
			? { module: "LeanBridge::Demo", version: "0.001_02" }
			: { name: "demo", version: "1.0.0" };
		return [target, settings];
	}));
	const examples = [
		{ schemaVersion: 1 }
		, JSON.parse(await readFile(join(fixture, exportConfigurationFile), "utf8"))
		, { schemaVersion: 1, resources: [], arities: {} }
		, { schemaVersion: 1, exports: ["Library.callback"], arities: { "Library.callback": 1 }, resources: ["Library.Counter"] }
		, { schemaVersion: 1, targets }
		, ...["@example/tools", "@example/_tools", "@example/.tools", "a..b"].map(name => ({
			schemaVersion: 1, targets: { npm: { name, version: "2.3.4-beta.1" } }
		}))
	];
	for(const value of examples)
	{
		assert.equal(validateExportConfiguration(value), value);
		await assertJsonSchema("lean-export-configuration", value);
	}
	const invalid = [null, [], {}, { schemaVersion: 2 }
		, { schemaVersion: 1, cpanVersion: "0.001" }
		, { schemaVersion: 1, exports: [] }
		, { schemaVersion: 1, modules: [] }
		, { schemaVersion: 1, exports: ["Bad;code"] }
		, { schemaVersion: 1, modules: ["Demo", "Demo"] }
		, { schemaVersion: 1, resources: [null] }
		, { schemaVersion: 1, arities: { run: 33 } }
		, { schemaVersion: 1, arities: { run: -1 } }
		, { schemaVersion: 1, arities: { run: 0.5 } }
		, { schemaVersion: 1, targets: { perl: {} } }
		, { schemaVersion: 1, targets: { unknown: {} } }
		, { schemaVersion: 1, targets: { npm: { registryToken: "secret" } } }
		, { schemaVersion: 1, targets: { cpan: { module: "LeanBridge::Bad;code" } } }
		, { schemaVersion: 1, targets: { cpan: { version: "1.2.3" } } }
		, ...["UPPER", "_private", ".private", "--option", "../escape"
			, "@scope/../escape"
			, "@scope/..", "@../name", "a b", "a%20b", "name\n"
			, "@lean-bridge/runtime", "node_modules", "favicon.ico"
			, "x".repeat(215), null]
			.map(name => ({ schemaVersion: 1, targets: { npm: { name } } }))
		, ...["latest", "^1.2.3", "1.2", "01.2.3", "1.2.3-01", "1.2.3-beta..1", "1.2.3+", "1.2.3+build.007", "1.2.3\n", "v1.2.3", null]
			.map(version => ({ schemaVersion: 1, targets: { npm: { version } } }))];
	for(const value of invalid)
	{
		assert.throws(() => validateExportConfiguration(value), { code: "invalid-export-configuration" });
		await assert.rejects(() => assertJsonSchema("lean-export-configuration", value));
	}
	assert.throws(() => validateExportConfiguration({ schemaVersion: 1, exports: ["run"], arities: { other: 1 } }), /selected export/);
});

test("npm projection settings keep the Lean identity and validate exact coordinates", async t => {
	const component = { name: "lean-library", version: "1.0.0", id: "lean-library@1.0.0" };
	assert.deepEqual(componentNpmIdentity(component), { name: "lean-library", version: "1.0.0", coordinate: component.id });
	assert.equal(componentNpmIdentity(component, { name: "@scope/library" }).coordinate, "@scope/library@1.0.0");
	assert.equal(componentNpmIdentity(component, { version: "2.0.0" }).coordinate, "lean-library@2.0.0");
	assert.deepEqual(parseNpmPackageCoordinate("@scope/_library@2.3.4-beta.1"), {
		name: "@scope/_library", version: "2.3.4-beta.1"
		, coordinate: "@scope/_library@2.3.4-beta.1"
	});
	for(const coordinate of ["1.0.0", "library", "library@latest", "@scope/library", "@scope/library@", "library@9007199254740992.0.0"])
		assert.throws(() => parseNpmPackageCoordinate(coordinate), TypeError);
	assert.equal(component.id, "lean-library@1.0.0");
	const directory = await workspace(t);
	const original = await analyzeLeanProject(directory);
	await configure(directory, { schemaVersion: 1, exports: ["First.bump"], targets: { npm: { name: "@scope/_library", version: "2.3.4-beta.1" } } });
	for(const targets of [[], ["npm"], ["javascript"]])
	{
		const plan = await prepareComponentBuildPlan({ projectRoot: directory, engineRoot: process.cwd(), targets });
		assert.deepEqual(plan.document.component, original.bindingIr.document.component);
		assert.notEqual(plan.document.source.treeSha256, original.sourceTreeSha256);
	}
});

test("absent configuration preserves defaults without creating a file", async t => {
	const directory = await workspace(t);
	await rm(join(directory, exportConfigurationFile));
	const before = await readdir(directory);
	const record = await readExportConfiguration(directory);
	assert.deepEqual(record.configuration, { schemaVersion: 1 });
	assert.equal(record.path, null);
	assert.equal(record.sourceSha256, null);
	assert.deepEqual(await readdir(directory), before);
});

test("configuration has canonical and exact source identities and immutable values", async t => {
	const directory = await workspace(t);
	const before = await readFile(join(directory, exportConfigurationFile));
	const first = await readExportConfiguration(directory);
	assert.equal(first.sourceSha256, sha256(before));
	assert.equal(first.sha256, sha256(canonicalJson(first.configuration)));
	assert.throws(() => first.configuration.exports.push("Second.bump"));
	await configure(directory, { targets: first.configuration.targets, exports: ["First.bump"], modules: ["Selections"], schemaVersion: 1 });
	const second = await readExportConfiguration(directory);
	assert.equal(second.sha256, first.sha256);
	assert.notEqual(second.sourceSha256, first.sourceSha256);
});

test("old Perl configuration is rejected even beside a shared configuration", async t => {
	const directory = await workspace(t);
	await writeFile(join(directory, "lean-bridge.native.json"), "invalid old content is not parsed");
	for(const operation of [() => readExportConfiguration(directory)
		, () => analyzeLeanProject(directory)
		, () => buildNativeProject({ projectRoot: directory, outputRoot: join(directory, "output") })])
		await assert.rejects(operation, error => error.code === "legacy-export-configuration"
			&& /targets\.cpan\.module/.test(error.message) && /targets\.cpan\.version/.test(error.message));
	await assert.rejects(() => access(join(directory, "output")), { code: "ENOENT" });
	await rm(join(directory, exportConfigurationFile));
	await assert.rejects(() => readExportConfiguration(directory), { code: "legacy-export-configuration" });
});

test("malformed, oversized, symlink and cancelled reads fail closed", async t => {
	const directory = await workspace(t);
	const path = join(directory, exportConfigurationFile);
	await writeFile(path, "{");
	await assert.rejects(() => readExportConfiguration(directory), { code: "invalid-export-configuration" });
	await writeFile(path, " ".repeat(1024 * 1024 + 1));
	await assert.rejects(() => readExportConfiguration(directory), /at most 1 MiB/);
	await rm(path);
	await symlink(join(fixture, exportConfigurationFile), path);
	await assert.rejects(() => readExportConfiguration(directory), /regular file/);
	await assert.rejects(() => readExportConfiguration(directory, { signal: AbortSignal.abort() }), { name: "AbortError" });
});

test("configured source exports exclude unrelated collisions and unsupported signatures", async () => {
	const analysis = await analyzeLeanProject(fixture);
	assert.deepEqual(analysis.proposedExports, ["lean:First.bump"]);
	assert.deepEqual(analysis.adapterHints, []);
	assert.deepEqual(analysis.exportCandidates.map(item => item.declaration), ["First.bump"]);
	assert.ok(analysis.declarations.some(item => item.name === "Second.bump"), "discovery still reports unselected source declarations");
	const record = await readExportConfiguration(fixture);
	assert.equal(analysis.inputs.find(input => input.path === exportConfigurationFile).sha256, record.sourceSha256);
	await assertJsonSchema("project-analysis", analysis);
	const plan = await prepareComponentBuildPlan({ projectRoot: fixture, engineRoot: process.cwd(), targets: ["npm"] });
	assert.deepEqual(plan.document.bindingIr.declarations, ["lean:First.bump"]);
	assert.ok(plan.document.source.inputs.some(input => input.path === exportConfigurationFile));
});

test("build planning rejects configuration changes between validation and analysis", async t => {
	const directory = await workspace(t);
	const original = { schemaVersion: 1, exports: ["First.bump"] };
	for(const [before, after] of [
		[original, { ...original, resources: ["Library.Counter"] }]
		, [original, { schemaVersion: 1, exports: ["Second.bump"] }]
		, [null, original]
		, [original, null]
	]) {
		if(before === null) await rm(join(directory, exportConfigurationFile));
		else await configure(directory, before);
		await assert.rejects(() => prepareComponentBuildPlan({
			projectRoot: directory, engineRoot: process.cwd(), targets: ["npm"]
			, analyze: async root => {
				if(after === null) await rm(join(directory, exportConfigurationFile));
				else await configure(directory, after);
				return analyzeLeanProject(root);
			}
		}), { code: "export-configuration-drift" });
	}
});

test("missing modules, exports, non-callables and conflicting selections fail", async t => {
	const directory = await workspace(t);
	for(const [selection, code] of [
		[{ modules: ["Missing"] }, "unknown-export-module"]
		, [{ exports: ["First.missing"] }, "unknown-export-declaration"]
		, [{ modules: ["Extra"], exports: ["First.bump"] }, "unknown-export-declaration"]
		, [{ exports: ["First.reflexive"] }, "invalid-export-declaration"]
	]) {
		await configure(directory, { schemaVersion: 1, ...selection });
		await assert.rejects(() => analyzeLeanProject(directory), { code });
	}
	await configure(directory, { schemaVersion: 1, modules: ["Extra"] });
	assert.deepEqual((await analyzeLeanProject(directory)).proposedExports, ["lean:extra"]);
});

test("configured changes cannot be silently ignored by a compiler or reviewed IR", async t => {
	const directory = await workspace(t);
	for(const settings of [{ resources: ["Library.Counter"] }, { arities: { "First.bump": 0 } }])
	{
		await configure(directory, { schemaVersion: 1, exports: ["First.bump"], ...settings });
		await assert.rejects(() => prepareComponentBuildPlan({ projectRoot: directory, engineRoot: process.cwd(), targets: ["npm"] }), { code: "unsupported-export-configuration" });
	}
	const record = await readExportConfiguration(fixture);
	assert.doesNotThrow(() => assertExportConfigurationCapabilities(record.configuration, { target: "npm" }));
	assert.doesNotThrow(() => assertExportConfigurationCapabilities(record.configuration, { target: "cpan", targetFields: ["module", "version"] }));
	await configure(directory, { schemaVersion: 1, exports: ["First.bump"] });
	const analysis = await analyzeLeanProject(directory);
	await writeFile(join(directory, "reviewed.binding-ir.json"), canonicalJson(analysis.bindingIr.document));
	await assert.rejects(() => analyzeLeanProject(directory), { code: "export-configuration-reviewed-ir" });
	await assert.rejects(() => buildNativeProject({ projectRoot: directory, targets: ["cpan", "pypi"] }), { code: "unsupported-native-targets" });
});
