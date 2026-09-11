/**
 * Keep the author tutorial's source, theorem metadata, and local commands executable.
 *
 * @file
 */

import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { analyzeLeanProject } from "../src/analyze/lean-project.mjs";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";

const fixture = "tests/fixtures/documentation/lean-author";
const documents = [
	"docs/lean-author-guide.md", "docs/lean/setup.md"
	, "docs/lean/first-component.md", "docs/lean/proofs-and-assurance.md"
	, "docs/lean/export-decisions.md", "docs/lean/diagnostics.md"
	, "docs/lean/existing-package.md"
];
const fences = source => [...source.matchAll(/^```([^\n]*)\n([\s\S]*?)^```\s*$/gm)]
	.map(match => ({ language: match[1], source: match[2] }));

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

test("the author example exports two functions and records its theorem without promoting assurance", async () => {
	const analysis = await analyzeLeanProject(fixture, { targets: ["npm"] });
	assert.deepEqual(analysis.proposedExports, ["lean:OnboardingSmall.add", "lean:OnboardingSmall.isEmpty"]);
	assert.deepEqual(analysis.adapterHints.filter(item => item.required), []);
	const claims = analysis.bindingIr.document.assurance;
	const add = claims.find(item => item.subject === "lean:OnboardingSmall.add");
	assert.equal(add.state, "unverified");
	assert.deepEqual(add.theorems, ["OnboardingSmall.add_commutative"]);
	assert.deepEqual(claims.find(item => item.subject === "lean:OnboardingSmall.isEmpty").theorems, []);
	const source = await readFile("docs/lean/proofs-and-assurance.md", "utf8");
	const documented = JSON.parse(fences(source).find(block => block.language === "json").source);
	assert.deepEqual(documented, { subject: add.subject, state: add.state, theorems: add.theorems });
	const generated = generateJavaScriptPackage(analysis.bindingIr.document);
	assert.doesNotMatch(generated["index.d.ts"], /\bany\b|export.*add_commutative/);
	assert.match(generated["index.d.ts"], /add\(left: bigint, right: bigint\): bigint/);
	assert.match(generated["index.d.ts"], /isEmpty\(value: string\): boolean/);
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
