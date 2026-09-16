/**
 * Keep the author tutorial's source, theorem metadata, and local commands executable.
 *
 * @file
 */

import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { packageReference } from "../scripts/generate-reference-docs.mjs";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
import { validateExportConfiguration } from "../src/analyze/export-configuration.mjs";
import { componentNpmIdentity } from "../src/release/component-package-receipt.mjs";

const fixture = "tests/fixtures/documentation/lean-author";
const documents = [
	"docs/lean-author-guide.md", "docs/lean/setup.md"
	, "docs/lean/first-component.md", "docs/lean/proofs-and-assurance.md"
	, "docs/lean/export-decisions.md", "docs/lean/diagnostics.md"
	, "docs/lean/existing-package.md"
];
const fences = source => [...source.matchAll(/^```([^\n]*)\n([\s\S]*?)^```\s*$/gm)]
	.map(match => ({ language: match[1], source: match[2] }));

test("shared publisher metadata is documented for every ordinary package format", async () => {
	const source = await readFile("docs/publishing.md", "utf8");
	const metadata = source.split("## Declare package metadata\n")[1].split("## Retain library and dependency licenses\n")[0];
	const configuration = JSON.parse(fences(metadata).find(block => block.language === "json").source);
	validateExportConfiguration(configuration);
	assert.deepEqual(Object.keys(configuration.package).sort(), ["authors", "description", "homepage", "repository"]);
	for(const name of ["npm", "PyPI", "Cargo", "NuGet", "Maven", "RubyGems", "CPAN", "Composer", "native PHP", "PHP-Wasm", "C, C++, WIT/WASI"])
		assert.ok(metadata.includes(name), name);
	assert.match(metadata, /sourceIdentity.exportConfigurationSource/);
	assert.match(metadata, /Shared-runtime packages keep their own metadata/);
	assert.match(source, /`package` does not accept a `license` field yet/);
	assert.match(await readFile("docs/lean/existing-package.md", "utf8"), /publishing.md#declare-package-metadata/);
});

test("the npm author guide uses validated shared settings without renaming the Lean component", async () => {
	const source = await readFile("docs/publish/npm.md", "utf8");
	const settings = JSON.parse(fences(source.split("### Choose the npm name and version\n")[1]).find(block => block.language === "json").source);
	validateExportConfiguration(settings);
	assert.deepEqual(componentNpmIdentity({ name: "onboarding-small", version: "1.0.0" }, settings.targets.npm), {
		name: "@your-org/your-component", version: "0.1.0"
		, coordinate: "@your-org/your-component@0.1.0"
	});
	assert.match(source, /package assembly reads them from the sealed build bundle/i);
	assert.match(source, /receipt records both identities; use `lean-bridge verify`/);
});

test("author setup starts with a prepared CLI and keeps checkout-only runtime work separate", async () => {
	const [setup, hub, tutorial, diagnostics, publishing, manifest] = await Promise.all([
		"docs/lean/setup.md", "docs/lean-author-guide.md"
		, "docs/lean/first-component.md", "docs/lean/diagnostics.md"
		, "docs/publish/npm.md", "config/cli-package.v1.json"
	].map(path => readFile(path, "utf8")));
	const [prepared, checkout] = setup.split("## Install the local CLI\n");
	assert.ok(checkout, "Keep the contributor setup and its existing anchor");
	assert.match(prepared, /^## Install a prepared CLI$/m);
	const configuration = JSON.parse(manifest);
	const archiveName = `${configuration.name.replace(/^@/, "").replace("/", "-")}-${configuration.version}.tgz`;
	assert.ok(prepared.includes(`/absolute/path/to/${archiveName}`));
	assert.match(prepared, /sha256sum "\$LEAN_BRIDGE_CLI_ARCHIVE"/);
	assert.match(prepared, /package\/cli-package-inventory\.json/);
	assert.match(prepared, /runtimeIncluded: true/);
	const commands = fences(prepared).map(block => block.source).join("\n");
	assert.match(commands, /npm install --prefix "\$LEAN_BRIDGE_WORK\/cli" --offline --ignore-scripts --no-audit --no-fund "\$LEAN_BRIDGE_CLI_ARCHIVE"/);
	assert.match(commands, /export PATH="\$LEAN_BRIDGE_WORK\/cli\/node_modules\/\.bin:\$PATH"/);
	assert.doesNotMatch(commands, /LEAN_BRIDGE_CHECKOUT|LEAN_BRIDGE_RUNTIME_ROOT|npm run bootstrap/);
	assert.doesNotMatch(checkout, /^```/m);
	assert.match(await readFile("docs/contributing/author-toolchain.md", "utf8"), /export LEAN_BRIDGE_RUNTIME_ROOT=/);
	assert.match(hub, /prepared CLI archive/);
	assert.match(tutorial, /only the checkout-based setup needs `LEAN_BRIDGE_RUNTIME_ROOT`/);
	assert.ok(publishing.includes("../lean/setup.md#install-a-prepared-cli"));
	assert.ok(diagnostics.includes("setup.md#install-a-prepared-cli"));
	assert.doesNotMatch(diagnostics, /publish\/production-release\.md/);
});

test("the first component's copyable files exactly match the author fixture", async () => {
	const content = await readFile("docs/lean/first-component.md", "utf8");
	const blocks = fences(content);
	for(const [language, file] of [["toml", "lakefile.toml"], ["gitignore", ".gitignore"], ["lean", "OnboardingSmall.lean"], ["json", "package.json"]])
		assert.equal(blocks.find(block => block.language === language).source, await readFile(`${fixture}/${file}`, "utf8"));
	assert.equal(blocks.find(block => block.language === "text").source, await readFile(`${fixture}/lean-toolchain`, "utf8"));
	const proof = fences(await readFile("docs/lean/proofs-and-assurance.md", "utf8")).find(block => block.language === "lean").source;
	assert.ok((await readFile(`${fixture}/OnboardingSmall.lean`, "utf8")).includes(proof.trimEnd()));
});

test("shared author selections and the CPAN example match executable configurations", async () => {
	const source = await readFile("docs/lean/existing-package.md", "utf8");
	for(const file of ["docs/lean/existing-package.md", "docs/publish/cpan.md", "docs/lean/diagnostics.md", "docs/architecture/cross-language-authoring.md"])
		assert.doesNotMatch(await readFile(file, "utf8"), /lean-bridge\.native\.json|migrate-the-perl-only-configuration|migration instructions/);
	const selected = JSON.parse(fences(source).find(block => block.language === "json").source);
	const fixtureSelection = JSON.parse(await readFile("tests/fixtures/export-selection/lean-bridge.exports.json", "utf8"));
	assert.deepEqual(selected, { schemaVersion: fixtureSelection.schemaVersion, modules: fixtureSelection.modules, exports: fixtureSelection.exports });
	const cpan = await readFile("docs/publish/cpan.md", "utf8");
	assert.deepEqual(JSON.parse(fences(cpan).find(block => block.language === "json").source),
		JSON.parse(await readFile("tests/fixtures/perl/ordinary/lean-bridge.exports.json", "utf8")));
});

test("export contract examples validate and distinguish implemented decisions from pending behavior", async () => {
	const existing = await readFile("docs/lean/existing-package.md", "utf8");
	const native = await readFile("docs/publish/cpan.md", "utf8");
	const shared = JSON.parse(fences(existing.split("### Declare export contracts\n")[1]).find(block => block.language === "json").source);
	const closure = JSON.parse(fences(native.split("### Export a specialized closure\n")[1]).find(block => block.language === "json").source);
	for(const config of [shared, closure]) validateExportConfiguration(config);
	assert.equal(shared.contracts["Library.echoWord"].result.refinement, "reject");
	assert.deepEqual(closure.contracts["Library.makeWordAdder"].result, { ownership: "lease", lifetime: { scope: "explicit", anchor: null } });
	assert.match(existing, /after specialization and configured closure arity/);
	assert.match(existing, /Current adapters reject those choices/);
	assert.match(existing, /not memory allocation inside Lean/);
	const diagnostics = await readFile("docs/lean/diagnostics.md", "utf8");
	for(const code of ["export-contract-mismatch", "unused-export-contract", "contracts-require-elaboration"])
		assert.ok(diagnostics.includes(`\`${code}\``));
});

test("the installed-package example uses npm and a runnable JavaScript file", async () => {
	const content = await readFile("docs/lean/first-component.md", "utf8");
	const section = content.split("## Call the installed package\n")[1];
	const blocks = fences(section);
	assert.equal(blocks.find(block => block.language === "js").source,
		await readFile("tests/fixtures/documentation/lean-author-consumer/index.mjs", "utf8"));
	const commands = blocks.filter(block => block.language === "sh").map(block => block.source).join("\n");
	assert.doesNotMatch(commands, /--input-type|\bnode\s+-e\b|execFileSync/);
	assert.match(commands, /require\(process\.env\.LEAN_BRIDGE_RECEIPT\)\.runtime\.archive/);
	assert.match(commands, /require\(process\.env\.LEAN_BRIDGE_RECEIPT\)\.package\.archive/);
	assert.match(commands, /^npm install --ignore-scripts --no-audit --no-fund \\$/m);
	assert.match(commands, /"\$LEAN_BRIDGE_PACKAGE_DIR\/\$LEAN_BRIDGE_RUNTIME_FILE"/);
	assert.match(commands, /"\$LEAN_BRIDGE_PACKAGE_DIR\/\$LEAN_BRIDGE_COMPONENT_FILE"/);
	assert.match(commands, /^node index\.mjs$/m);
	assert.equal(blocks.find(block => block.language === "text").source, "123n\ntrue\nfalse\n");
});

test("the documented compiler API keeps theorem references separate from assurance claims", async () => {
	const { ir } = await packageReference(fixture);
	assert.deepEqual(ir.declarations.map(item => item.id), ["lean:OnboardingSmall.add", "lean:OnboardingSmall.isEmpty"]);
	assert.deepEqual(ir.assurance, []);
	assert.ok(ir.declarations.every(item => item.assurance.length === 0));
	const add = ir.declarations.find(item => item.id === "lean:OnboardingSmall.add");
	const theorems = add.source.extensions["lean-lang.org/theorem-references"];
	assert.deepEqual(theorems, ["OnboardingSmall.add_commutative"]);
	const source = await readFile("docs/lean/proofs-and-assurance.md", "utf8");
	const documented = JSON.parse(fences(source).find(block => block.language === "json").source);
	assert.deepEqual(documented, { declaration: "OnboardingSmall.add", theoremCandidates: theorems });
	assert.match(source, /source\.extensions/);
	assert.match(source, /assurance arrays stay empty/);
	const generated = generateJavaScriptPackage(ir);
	assert.doesNotMatch(generated["index.d.ts"], /\bany\b|export.*add_commutative/);
	assert.match(generated["index.d.ts"], /add\(arg0: bigint, arg1: bigint\): bigint/);
	assert.match(generated["index.d.ts"], /isEmpty\(arg0: string\): boolean/);
});

test("author pages use portable local links, explicit dry runs, and public examples", async () => {
	for(const path of documents)
	{
		const source = await readFile(path, "utf8");
		assert.doesNotMatch(source, /—|(?:^|[^A-Za-z0-9_])\/app(?:\/|\b)/);
		for(const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g))
		{
			const target = match[1].split("#")[0];
			if(target && !/^(https?:|mailto:)/.test(target)) await access(resolve(dirname(path), target));
		}
		for(const block of fences(source))
		{
			assert.doesNotMatch(block.source, /\b(?:ccall|cwrap|WebAssembly)\b|_Lean|\b(?:runtime|object)Handle\b/);
			if(/lean-bridge publish/.test(block.source)) assert.match(block.source, /--dry-run/);
		}
	}
});

test("the author hub preserves the existing bookmarked sections", async () => {
	const source = await readFile("docs/lean-author-guide.md", "utf8");
	for(const heading of ["Prerequisites", "Create a plain Lake project", "Analyze, build, and perform a dry run", "Current export rules", "Adapter questions", "Exit codes", "Common failures"])
		assert.ok(source.includes(`## ${heading}\n`));
});
