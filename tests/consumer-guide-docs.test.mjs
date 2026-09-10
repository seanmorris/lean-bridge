/**
 * Check language coverage and the exact runnable source published in consumer guides.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import test from "node:test";
import { docPages } from "../site/registry.mjs";
import { readConsumerSupport } from "../src/adoption/consumer-support.mjs";
import { publicationDestinationFor } from "../src/release/publish-manifest.mjs";
import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import { generatePythonBindingPackage } from "../src/backends/python/generate.mjs";
import { generateRustBindingPackage } from "../src/backends/rust/generate.mjs";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { generateCppBindingPackage } from "../src/backends/cpp/generate.mjs";
import { generateDotnetBindingPackage } from "../src/backends/dotnet/generate.mjs";
import { generateJvmBindingPackage } from "../src/backends/jvm/generate.mjs";
import { generateRubyBindingPackage } from "../src/backends/ruby/generate.mjs";
import { generatePhpBindingPackage } from "../src/backends/php/generate.mjs";

const fixtureRoot = resolve("tests/fixtures/documentation/consumers");
const guides = docPages.filter(page => page.consumerIds?.length);

/**
 * Read the three-column conversion table without including another guide section.
 *
 * @param source - Canonical Markdown for one consumer guide.
 */
function conversionTable(source)
{
	const section = source.split("### Type conversions\n")[1]?.split(/^### /mu)[0];
	assert.ok(section, "The guide must include a Type conversions section");
	const rows = section.split("\n").filter(line => line.startsWith("| "));
	assert.ok(rows.length >= 7, "Document a header, separator, and the five shared value types");
	const cells = rows.slice(2).map(line => line.slice(2, -2).split(" | "));
	for(const row of cells) assert.equal(row.length, 3, "Conversion tables must retain three columns");
	return { section, rows: new Map(cells.map(([lean, host, rules]) => [lean, { host, rules }])) };
}

/**
 * Recursively list the tutorial files whose contents must appear in a guide.
 *
 * @param directory Directory containing runnable tutorial files.
 */
async function fixtureFiles(directory)
{
	const result = [];
	for(const entry of await readdir(directory, { withFileTypes: true }))
	{
		const path = join(directory, entry.name);
		if(entry.isDirectory()) result.push(...await fixtureFiles(path));
		else result.push(path);
	}
	return result;
}

test("every supported consumer has a discoverable language guide", async () => {
	const contract = await readConsumerSupport();
	const known = new Set(contract.consumers.map(consumer => consumer.id));
	for(const guide of guides)
	{
		assert.equal(guide.legacy, undefined, guide.id);
		for(const id of guide.consumerIds) assert.ok(known.has(id), `${guide.id}: unknown consumer ${id}`);
	}
	for(const consumer of contract.consumers.filter(entry => entry.state === "supported"))
		assert.ok(guides.some(guide => guide.consumerIds.includes(consumer.id)), consumer.id);
	assert.deepEqual(guides.filter(guide => guide.consumerIds.includes("jvm")).map(guide => guide.id), ["java", "kotlin"]);
	assert.deepEqual(guides.find(guide => guide.id === "javascript-typescript").consumerIds, ["node-javascript", "node-typescript", "browser-javascript"]);
	const landing = await readFile("docs/consume.md", "utf8");
	for(const guide of guides) assert.ok(landing.includes(`(${guide.source.slice(5)})`), guide.id);
});

test("each consumer guide documents type conversions within prepared-package use", async () => {
	for(const guide of guides)
	{
		const source = await readFile(guide.source, "utf8");
		assert.ok(source.indexOf("### Type conversions\n") < source.indexOf("## Start from a raw Lean package"), guide.id);
		const { rows } = conversionTable(source);
		for(const lean of ["Bool", "UInt32", "String", "ByteArray"])
			assert.ok(rows.has(`\`${lean}\``), `${guide.id}: ${lean}`);
		if(guide.id !== "javascript-typescript")
		{
			for(const lean of ["Array UInt32", "Payload", "Box"])
				assert.ok(rows.has(`\`${lean}\``), `${guide.id}: ${lean}`);
			assert.match(source, /callback|callable/u, guide.id);
		}
	}
});

test("Alpha conversion tables match the generated public Payload field types", async () => {
	const fields = "enabled|count|label|bytes|values";
	const python = generatePythonBindingPackage(alpha.bindingIr)["lean_alpha/__init__.pyi"];
	const rust = generateRustBindingPackage(alpha.bindingIr)["src/lib.rs"];
	const c = generateCBindingPackage(alpha.bindingIr)["include/lean_alpha.h"];
	const cpp = generateCppBindingPackage(alpha.bindingIr)["include/lean_alpha.hpp"];
	const dotnet = generateDotnetBindingPackage(alpha.bindingIr)["src/LeanBridge.Alpha/Alpha.cs"];
	const java = generateJvmBindingPackage(alpha.bindingIr)["src/main/java/org/leanbridge/alpha/Payload.java"];
	const ruby = generateRubyBindingPackage(alpha.bindingIr)["sig/lean_bridge/alpha.rbs"];
	const php = generatePhpBindingPackage(alpha.bindingIr)["src/Payload.php"];
	const namedFirst = (source, expression) => new Map([...source.matchAll(expression)].map(([, name, type]) => [name, type]));
	const typedFirst = (source, expression) => new Map([...source.matchAll(expression)].map(([, type, name]) => [name.toLowerCase(), type.replace(/^\\/u, "")]));
	const jvmFields = typedFirst(java, new RegExp(`([a-zA-Z\\[\\]]+) (${fields})(?=[,)])`, "gu"));
	const kotlinTypes = { boolean: "Boolean", long: "Long", String: "String", "byte[]": "ByteArray", "long[]": "LongArray" };
	const targets = {
		python: namedFirst(python, new RegExp(`^    (${fields}): (.+)$`, "gmu"))
		, rust: namedFirst(rust, new RegExp(`^    pub (${fields}): (.+),$`, "gmu"))
		, c: typedFirst(c, new RegExp(`^  (.+) (${fields});$`, "gmu"))
		, cpp: typedFirst(cpp, new RegExp(`^  (.+) (${fields});$`, "gmu"))
		, dotnet: typedFirst(dotnet, /^ {4}public (.+) (Enabled|Count|Label|Bytes|Values) \{ get; \}$/gmu)
		, java: jvmFields
		, kotlin: new Map([...jvmFields].map(([name, type]) => [name, kotlinTypes[type]]))
		, ruby: namedFirst(ruby, new RegExp(`^      attr_reader (${fields}): (.+)$`, "gmu"))
		, "php-native": typedFirst(php, new RegExp(`^    public (.+) \\$(${fields});$`, "gmu"))
		, "php-wasm": typedFirst(php, new RegExp(`^    public (.+) \\$(${fields});$`, "gmu"))
	};
	const leanNames = { bool: "Bool", uint32: "UInt32", string: "String", bytes: "ByteArray" };
	for(const [target, generated] of Object.entries(targets))
	{
		const { rows } = conversionTable(await readFile(`docs/consume/${target}.md`, "utf8"));
		const payload = alpha.bindingIr.types.find(type => type.name === "Payload");
		assert.equal(generated.size, payload.fields.length, `${target}: extract all generated fields`);
		for(const field of payload.fields)
		{
			const lean = field.type.kind === "primitive" ? leanNames[field.type.name] : `Array ${leanNames[field.type.arguments[0].name]}`;
			const host = generated.get(field.name);
			assert.ok(host, `${target}: generated type for ${field.name}`);
			const displayed = target === "ruby" && host === "bool" ? "`true` or `false`"
				: target === "ruby" && host === "Array[Integer]" ? "`Array` of `Integer`" : `\`${host}\``;
			assert.ok(rows.get(`\`${lean}\``)?.host.includes(displayed), `${target}: ${lean} must document ${host}`);
		}
	}
});

test("the PHP overview exposes conversions without requiring a transport guide", async () => {
	const source = await readFile("docs/php.md", "utf8");
	const overview = conversionTable(source);
	assert.ok(source.indexOf("### Type conversions\n") < source.indexOf("### Verify the native release\n"));
	for(const profile of ["php-native", "php-wasm"])
	{
		const detailed = conversionTable(await readFile(`docs/consume/${profile}.md`, "utf8"));
		assert.deepEqual([...overview.rows.keys()], [...detailed.rows.keys()], profile);
		for(const lean of ["Bool", "UInt32", "String", "ByteArray", "Array UInt32", "Payload", "Box"])
			assert.equal(overview.rows.get(`\`${lean}\``).host, detailed.rows.get(`\`${lean}\``).host, `${profile}: ${lean}`);
		assert.ok(overview.section.includes(`(consume/${profile}.md#type-conversions)`), profile);
	}
	const range = overview.rows.get("`UInt32`").rules;
	assert.match(range, /Native PHP: `0\.\.4294967295` with 64-bit/u);
	assert.match(range, /PHP-Wasm: `0\.\.2147483647` with 32-bit signed/u);
	assert.match(overview.section, /result above `PHP_INT_MAX`/u);
});

test("conversion tables distinguish full-width integers and executable WASI support", async () => {
	const javascript = conversionTable(await readFile("docs/javascript-typescript.md", "utf8"));
	const scalarReference = await readFile("docs/reference/types.md", "utf8");
	const leanNames = { unit: "Unit", bool: "Bool", nat: "Nat", int: "Int", float32: "Float32", float64: "Float", string: "String", bytes: "ByteArray" };
	const scalars = [...scalarReference.matchAll(/^\| `([a-z0-9]+)` \| `([^`]+)` \|/gmu)];
	assert.equal(javascript.rows.size, scalars.length);
	for(const [, primitive, host] of scalars)
	{
		const lean = leanNames[primitive] ?? primitive.replace(/^uint/u, "UInt").replace(/^int/u, "Int");
		assert.ok(javascript.rows.get(`\`${lean}\``)?.host.includes(`\`${host}\``), `${lean}: ${host}`);
	}
	assert.match(javascript.section, /16 MiB/u);
	const phpNative = conversionTable(await readFile("docs/consume/php-native.md", "utf8"));
	const phpWasm = conversionTable(await readFile("docs/consume/php-wasm.md", "utf8"));
	assert.match(phpNative.rows.get("`UInt32`").rules, /4294967295/u);
	assert.match(phpWasm.rows.get("`UInt32`").rules, /32-bit signed.*2147483647/u);
	assert.match(phpWasm.section, /result above `PHP_INT_MAX`/u);
	const wasi = conversionTable(await readFile("docs/consume/wit-wasi.md", "utf8"));
	assert.match(wasi.rows.get("`UInt32`").rules, /Executable input and result/u);
	for(const lean of ["Bool", "String", "ByteArray", "Array UInt32"])
		assert.match(wasi.rows.get(`\`${lean}\``).rules, /not exposed by the executable adapter/u);
});

test("consumer guides put prepared release use before source-package preparation", async () => {
	const pages = [...guides, ...docPages.filter(page => ["consume", "receive-package", "php"].includes(page.id))];
	for(const page of pages)
	{
		const source = await readFile(page.source, "utf8");
		assert.deepEqual([...source.matchAll(/^## (.+)$/gmu)].map(match => match[1]),
			[page.id === "receive-package" ? "Check the release files" : "Use a prepared release", "Start from a raw Lean package"], page.id);
		const boundary = source.indexOf("## Start from a raw Lean package");
		const prepared = source.slice(0, boundary);
		assert.doesNotMatch(prepared, /lean-bridge (?:analyze|build|publish)|lean\/setup\.md|lean\/first-component\.md/u,
			`${page.id}: source preparation is not an installation prerequisite`);
		for(const match of source.matchAll(/^```[a-z0-9]+ file=([^\s]+)/gmu))
			assert.ok(match.index < boundary, `${page.id}: ${match[1]} belongs to prepared-package consumption`);
		assert.match(source.slice(boundary), /\]\([^)]*(?:lean\/setup|publish\/local-handoff|contributing\/testing|publish\/npm|consume)\.md(?:#|\))/u,
			`${page.id}: source path links to the applicable build workflow`);
	}
});

test("the prepared release guide uses its chosen title and preserves its existing route", async () => {
	const guide = docPages.find(page => page.id === "receive-package");
	assert.equal(guide.title, "Use a prepared release");
	assert.equal(guide.route, "/docs/consume/receive-package/");
	assert.equal(guide.source, "docs/consume/receive-package.md");
	assert.match(await readFile(guide.source, "utf8"), /^# Use a prepared release\n/u);
	for(const path of new Set(["README.md", ...docPages.map(page => page.source)]))
		assert.doesNotMatch(await readFile(path, "utf8"), /\[(?:Receive|Verify) a package\]|^# (?:Receive a Lean|Verify a) package$/mu, path);
});

test("JavaScript uses automatic runtime loading and Python installs with its own package tools", async () => {
	const javascript = await readFile("docs/javascript-typescript.md", "utf8");
	const registry = javascript.split("### Install from a registry\n")[1].split("### Install a local archive release\n")[0];
	assert.match(registry, /npm install --save-exact/u);
	assert.match(registry, /npm resolves the declared runtime dependency/u);
	assert.doesNotMatch(registry, /LEAN_BRIDGE_RUNTIME_ARCHIVE/u);
	assert.match(javascript, /Application code imports only the component's public API/u);
	for(const [, snippet] of javascript.matchAll(/^```(?:js|ts|tsx)[^\n]*\n([\s\S]*?)^```/gmu))
		assert.doesNotMatch(snippet, /(?:from|import\()\s*["']@lean-bridge\/runtime/u);
	const python = await readFile("docs/consume/python.md", "utf8");
	const install = python.split("### Install the wheel\n")[1].split("### Call Lean\n")[0];
	assert.match(install, /python3 -m venv/u);
	assert.match(install, /python -m pip install/u);
	assert.doesNotMatch(install, /\bnode\b|preflight|lean-bridge build/u);
	assert.match(python, /optional diagnostic needs Node\.js 22/u);
});

test("the runtime reference reproduces the versioned profiles and links to every guide", async () => {
	const contract = await readConsumerSupport();
	const source = await readFile("docs/consumers.md", "utf8");
	const rows = source.split("\n").filter(line => /^\| .* \| `(?:supported|partial|blocked)` \|/u.test(line));
	assert.equal(rows.length, contract.consumers.length);
	for(const consumer of contract.consumers)
	{
		const row = rows.find(line => line.startsWith(`| ${consumer.name} |`));
		assert.ok(row?.includes(`| \`${consumer.state}\` | ${consumer.scope} |`), consumer.id);
		for(const guide of guides.filter(entry => entry.consumerIds.includes(consumer.id)))
			assert.ok(row.includes(`(${guide.source.slice(5)})`) || row.includes(`(${guide.source.slice(5)}#`), guide.id);
	}
});

test("published runnable snippets exactly match every public documentation fixture", async () => {
	const referenced = new Set();
	for(const guide of guides)
	{
		const source = await readFile(guide.source, "utf8");
		const matches = [...source.matchAll(/^```[a-z0-9]+ file=([^\s]+)\n([\s\S]*?)^```/gmu)];
		assert.ok(matches.length > 0, `${guide.id}: complete executable files`);
		for(const [, relative, snippet] of matches)
		{
			const path = resolve(fixtureRoot, relative);
			assert.ok(path.startsWith(fixtureRoot + sep), `${guide.id}: fixture remains inside its source root`);
			assert.equal(snippet, await readFile(path, "utf8"), `${guide.id}: ${relative} differs from executed source`);
			referenced.add(path);
		}
		for(const [, shell] of source.matchAll(/^```sh[^\n]*\n([\s\S]*?)^```/gmu))
			assert.doesNotMatch(shell, /\\\\[ \t]*$/mu, `${guide.id}: shell continuation needs one backslash`);
		assert.match(source, /[Ee]xpected output|[Pp]rints|[Dd]isplays/u, guide.id);
		assert.match(source, /[Cc]leanup|[Ll]ifetime|[Oo]wnership|[Rr]eleases/u, guide.id);
		assert.match(source, /[Tt]roubleshoot|[Dd]iagnos|[Ee]rrors/u, guide.id);
	}
	assert.deepEqual([...referenced].sort(), (await fixtureFiles(fixtureRoot)).sort());
});

test("superseded guides remain compatibility pages outside primary navigation", async () => {
	const legacy = docPages.filter(page => page.legacy);
	assert.deepEqual(legacy.map(page => page.id), ["javascript", "typescript", "browser", "react", "browser-workers", "dotnet-jvm-ruby", "publish-pages", "release-pipeline"]);
	for(const page of legacy)
	{
		const source = await readFile(page.source, "utf8");
		assert.doesNotMatch(source, /^```/mu, "Compatibility pages link to runnable guides instead of duplicating them");
		assert.ok((source.match(/^## /gmu) ?? []).length >= 4);
	}
});

test("each package ecosystem has a visible publishing recipe linked from its consumers", async () => {
	const overview = await readFile("docs/publishing.md", "utf8");
	const index = await readFile("docs/README.md", "utf8");
	const recipes = [
		["npm", ["npm"], "build-npm-package.mjs", ["javascript-typescript", "php-wasm"]]
		, ["pypi", ["pypi"], "build-pypi-package.mjs", ["python"]]
		, ["cargo", ["cargo"], "build-cargo-package.mjs", ["rust"]]
		, ["nuget", ["nuget"], "build-nuget-package.mjs", ["dotnet"]]
		, ["maven", ["maven"], "build-maven-package.mjs", ["java", "kotlin"]]
		, ["rubygems", ["rubygems"], "build-rubygems-package.mjs", ["ruby"]]
		, ["composer", [], "build-php-native-package.mjs", ["php-native"]]
		, ["archives", ["c", "cpp", "wit-wasi"], "build-c-family-package.mjs", ["c", "cpp", "wit-wasi"]]
	];
	for(const [slug, targets, builder, consumers] of recipes)
	{
		const guide = docPages.find(page => page.id === `publish-${slug}`);
		assert.equal(guide?.route, `/docs/publish/${slug}/`, slug);
		assert.equal(guide.group, "Publish", slug);
		assert.equal(guide.legacy, undefined, slug);
		assert.equal(guide.source, `docs/publish/${slug}.md`, slug);
		assert.ok(overview.includes(`(publish/${slug}.md)`), slug);
		assert.ok(index.includes(`(publish/${slug}.md)`), slug);
		const source = await readFile(guide.source, "utf8");
		assert.ok(source.includes(builder), `${slug}: use the real package builder`);
		assert.match(source, /^```sh\n/mu, `${slug}: provide executable commands`);
		assert.match(source, /https:\/\//u, `${slug}: link registry references`);
		assert.match(source, /[Vv]erif|[Cc]ompare/u, `${slug}: check the uploaded artifact`);
		assert.match(source, /[Rr]ecover|[Rr]etry/u, `${slug}: explain interrupted uploads`);
		assert.match(source, /[Aa]pprov|[Aa]uthoriz/u, `${slug}: identify the release approval`);
		for(const target of targets)
		{
			const destination = publicationDestinationFor(target);
			assert.ok(overview.includes(`\`${target}\``), `${slug}: document the real target ID`);
			assert.equal(destination.operation, slug === "archives" ? "retain" : "publish");
		}
		for(const id of consumers)
		{
			const consumer = docPages.find(page => page.id === id);
			assert.ok((await readFile(consumer.source, "utf8")).includes(`publish/${slug}.md`), `${id}: publisher link`);
		}
	}
	for(const target of ["composer", "php-native", "php-wasm", "nix"])
		assert.throws(() => publicationDestinationFor(target), { code: "unsupported-publication-target" });
	assert.match(overview, /Only npm has an installed adapter/u);
	assert.match(overview, /does not produce Lean Bridge's signed transaction or completion receipt/u);
});

test("signed Nix publication covers the closure and consumer trust without inventing a registry target", async () => {
	const guide = docPages.find(page => page.id === "publish-nix");
	assert.equal(guide?.route, "/docs/publish/nix/");
	assert.equal(guide.group, "Publish");
	assert.equal(guide.legacy, undefined);
	const source = await readFile(guide.source, "utf8");
	for(const term of ["universal-release-bundle", "store sign", "--recursive", "--key-file", "copy", "trusted-public-keys", "substituters", "store verify"])
		assert.ok(source.includes(term), `Nix guide: ${term}`);
	assert.ok(source.includes("--option trusted-public-keys"), "Signer audits select the intended key");
	assert.ok(source.includes("--option secret-key-files ''"), "Signer audits exclude implicitly trusted signing keys");
	assert.ok(source.includes("--max-jobs 0 --builders ''"), "The pinned substitution check cannot fall back to a build");
	assert.match(source, /[Rr]otat/u, "Signing-key rotation is part of publication");
	assert.match(source, /https:\/\/nix\.dev\/manual/u, "Nix commands cite their official reference");
	assert.match(source, /[Pp]rivate|[Ss]ecret/u, "Signing-key storage is explained");
	for(const file of ["docs/publishing.md", "docs/README.md", "docs/consume.md", "docs/consume/receive-package.md", "src/release/README.md", "nix/README.md"])
		assert.ok((await readFile(file, "utf8")).includes("publish/nix.md"), file);
	assert.throws(() => publicationDestinationFor("nix"), { code: "unsupported-publication-target" });
});
