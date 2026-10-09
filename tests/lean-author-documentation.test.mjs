/**
 * Keep the author tutorial's source, theorem metadata, and local commands executable.
 *
 * @file
 */

import assert from "node:assert/strict";
import "./helpers/author-refinement-docs-source-history-tests.mjs";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { packageReference } from "../scripts/generate-reference-docs.mjs";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
import { validateExportConfiguration } from "../src/analyze/export-configuration.mjs";
import { componentNpmIdentity } from "../src/release/component-package-receipt.mjs";
import { checkedRecordContracts } from "./helpers/checked-record-fixture.mjs";
import { checkedRecordPromotionReferences } from "./helpers/checked-record-promotion-references.mjs";
import { callbackFinPromotionReferences } from "./helpers/callback-fin-promotion-references.mjs";

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
	assert.deepEqual(Object.keys(configuration.package).sort(), ["authors", "description", "homepage", "license", "licenseFiles", "repository"]);
	for(const name of ["npm", "PyPI", "Cargo", "NuGet", "Maven", "RubyGems", "CPAN", "Composer", "native PHP", "PHP-Wasm", "C, C++, WIT/WASI"])
		assert.ok(metadata.includes(name), name);
	assert.match(metadata, /sourceIdentity.exportConfigurationSource/);
	assert.match(metadata, /Shared-runtime packages keep their own metadata/);
	for(const field of ["License-Expression", "License-File", "spdx_expression", "x_spdx_expression", "licenseFiles"])
		assert.ok(source.includes(field), field);
	assert.match(source, /Version-one inventories remain readable/);
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
	assert.match(existing, /C, C\+\+, Rust, Python, Ruby, C#, Java, Kotlin and Perl packages support \[explicit input transfers\]/);
	assert.match(existing, /WIT\/WASI\]\(\.\.\/consume\/wit-wasi\.md#consuming-inputs\)/);
	assert.match(existing, /JavaScript\/TypeScript\]\(\.\.\/javascript-typescript\.md#consuming-inputs\)/);
	assert.match(existing, /Ordinary configuration and reviewed APIs preserve those decisions through compiler analysis/);
	assert.match(existing, /not memory allocation inside Lean/);
	const wit = await readFile("docs/publish/wit-wasi.md", "utf8");
	const owned = JSON.parse(fences(wit.split("## Export resource-containing values\n")[1]).find(block => block.language === "json").source);
	const transferred = JSON.parse(fences(wit.split("### Transfer input ownership\n")[1]).find(block => block.language === "json").source);
	owned.exports.push("Owned.retainTicket"); Object.assign(owned, transferred);
	validateExportConfiguration(owned);
	assert.deepEqual(owned.contracts["Owned.retainTicket"].parameters, [{ ownership: "transfer", lifetime: { scope: "call", anchor: null } }]);
	const diagnostics = await readFile("docs/lean/diagnostics.md", "utf8");
	for(const code of ["export-contract-mismatch", "unused-export-contract", "contracts-require-elaboration"])
		assert.ok(diagnostics.includes(`\`${code}\``));
});

test("checked-record guidance uses the tested payload and per-site constructor contract", async () => {
	const document = await readFile("docs/lean/existing-package.md", "utf8");
	const section = document.split("### Export a record with proof fields\n")[1].split("### Export a checked Subtype\n")[0];
	const blocks = fences(section);
	const configuration = JSON.parse(blocks.find(block => block.language === "json").source);
	validateExportConfiguration(configuration);
	assert.deepEqual(configuration.modules, ["CheckedRecords"]);
	assert.deepEqual(configuration.exports, ["CheckedRecords.width"]);
	assert.deepEqual(configuration.contracts, { "CheckedRecords.width": checkedRecordContracts()["CheckedRecords.width"] });
	const example = blocks.find(block => block.language === "lean").source;
	const source = await readFile("tests/fixtures/onboarding/checked-records/CheckedRecords.lean", "utf8");
	for(const declaration of example.trim().split("\n\n")) assert.ok(source.includes(declaration), declaration);
	assert.match(section, /checked-records-20261008\/receipt\.json/);
	assert.match(section, /ordinary-source and reviewed C\/C\+\+ and Node JavaScript packages/);
	assert.match(section, /Separate ordinary-source result-only packages also pass/);
	assert.match(section, /Browser execution remains pending/);
	assert.doesNotMatch(section, /Installed-package acceptance for this mapping is pending|do not establish installed C\/C\+\+/);
	assert.match(section, /exact names, order and types/);
	assert.match(section, /result already has its proofs/);
	assert.match(section, /private ABI 8/);
	assert.match(section, /Configuration contracts cannot override a review/);
	assert.match(await readFile("docs/lean/export-decisions.md", "utf8"), /existing-package.md#export-a-record-with-proof-fields/);
});

test("the checked-record author table agrees with all six retained installed selections", async () => {
	const document = await readFile("docs/lean/existing-package.md", "utf8");
	const row = document.split("\n").find(line => line.startsWith("| Record with erased proof fields"));
	assert.equal(row, "| Record with erased proof fields and a checked input constructor | Node installed; browser pending | C/C++ installed; other hosts rejected | Rejected | Rejected | C/C++ and Node installed; browser pending; other targets rejected |");
	const references = await checkedRecordPromotionReferences();
	assert.deepEqual(references.map(item => [item.host, item.route]), [
		["c-cpp", "ordinary"], ["c-cpp", "reviewed"], ["c-cpp", "result-only"]
		, ["npm", "ordinary"], ["npm", "reviewed"], ["npm", "result-only"]
	]);
	const inventory = JSON.parse(await readFile("docs/type-surface.v1.json"));
	for(const reference of references) for(const profile of reference.profiles) for(const position of reference.positions)
	{
		const observation = inventory.observations.find(item => item.id === `checked-record-${profile}-${reference.sourcePath}-${position}`);
		assert.equal(observation?.stages.installedExecution.state, "passed");
		assert.ok(observation.stages.installedExecution.evidence.includes(reference.id));
	}
});

test("the author table names structural Fin hosts from retained family and route scopes", async () => {
	const document = await readFile("docs/lean/existing-package.md", "utf8");
	const rows = new Map(document.split("\n").filter(line => line.startsWith("| ")).map(line => {
		const [site, ...cells] = line.split("|").slice(1, -1).map(cell => cell.trim());
		return [site, cells];
	}));
	for(const [path, profiles] of [
		["fin-python-ruby-20261008/receipt-v2.json", ["python", "ruby"]]
		, ["fin-rust-20261008/receipt-v2.json", ["rust"]]
		, ["fin-dotnet-hosted-20261008/receipt.json", ["dotnet"]]
	]) {
		assert.ok(document.includes(`../evidence/${path}`));
		const receipt = JSON.parse(await readFile(`docs/evidence/${path}`));
		assert.deepEqual(receipt.scope.profiles, profiles);
		assert.deepEqual(receipt.scope.sourcePaths, ["ordinary-source", "reviewed-ir"]);
		assert.deepEqual(receipt.scope.families, ["product", "product-array", "record"]);
	}
	for(const site of ["`Fin n` inside pairs and `Except`", "`Fin n` inside `Array` of pairs and `Except`"])
		assert.equal(rows.get(site)[1], "C/C++, Python, Ruby, Rust and .NET installed; others pending");
	const wit = JSON.parse(await readFile("docs/evidence/fin-wit-records-20261008/receipt.json"));
	assert.deepEqual(wit.scope.profiles, ["wit-wasi"]); assert.equal(wit.scope.family, "record");
	assert.deepEqual(wit.scope.sourcePaths, ["ordinary-source", "reviewed-ir"]);
	assert.equal(rows.get("`Fin n` in record or variant fields")[1], "C/C++, Python, Ruby, Rust, .NET and WIT/WASI installed; Java/Kotlin and native PHP pending");
	assert.match(document, /Direct WIT product exports, Java\/Kotlin and native PHP products\/fields still need their own installed acceptance/);
});

test("callback guidance separates installed browser and reviewed directions from remaining host replies", async () => {
	const document = await readFile("docs/lean/existing-package.md", "utf8");
	const references = await callbackFinPromotionReferences();
	const browser = references.find(item => item.id === "browser-callback-fin-ordinary-installed");
	assert.deepEqual(browser.profiles, ["browser-javascript", "browser-react", "browser-worker"]);
	assert.equal(browser.sourcePath, "ordinary-source");
	const reviewed = references.filter(item => item.sourcePath === "reviewed-ir");
	assert.deepEqual(reviewed.map(item => item.id), ["reviewed-callback-fin-c-cpp-installed", "reviewed-callback-fin-npm-r1-installed", "reviewed-callback-fin-npm-r2-installed"]);
	assert.match(reviewed[0].scope, /Native host-produced refined replies are not covered/);
	assert.match(reviewed[2].scope, /scalar Fin 3 host-produced callback reply/);
	assert.match(document, /Node and browser installed/);
	assert.match(document, /C\/C\+\+ execute closure inputs, Lean-produced results and arguments sent to host callbacks/);
	assert.match(document, /Node R2 fixture additionally checks a host-produced `Fin 3` reply/);
	assert.match(document, /Reviewed browser execution, native host-produced replies, `Fin 0` and wider bounds need separate reviewed acceptance/);
	assert.doesNotMatch(document, /browser profiles are not yet audited for refined callbacks|Native callbacks with refined signatures are not yet supported|Fresh-Lean and installed reviewed callback acceptance are pending/);
	const replies = JSON.parse(await readFile("docs/evidence/native-fin-replies-20261008/receipt.json"));
	assert.equal(replies.scope.sourcePath, "ordinary-source"); assert.equal(replies.scope.reviewedContracts, false);
	assert.deepEqual(replies.scope.installedChecks, { c: 81, cpp: 74 });
	assert.match(document, /executes 81 C checks and 74 C\+\+ checks/);
	assert.match(document, /Reviewed host replies and other native hosts remain pending/);
});

test("CPAN guidance distinguishes scalar and container four-ABI relocation from reviewed Subtype", async () => {
	const document = await readFile("docs/lean/existing-package.md", "utf8");
	const receipt = JSON.parse(await readFile("docs/evidence/perl-refinements-hosted-20261009/receipt.json"));
	assert.equal(receipt.configurations.length, 4); assert.equal(receipt.scope.supportPromotion, false);
	assert.match(receipt.scope.reproduction, /none moves the installed tree/);
	const moved = JSON.parse(await readFile("docs/evidence/perl-relocated-hosted-20261009/receipt.json"));
	assert.equal(moved.revision, "93c60a0487d0b2acc0b6d562cd72a3876738a666");
	assert.deepEqual(moved.configurations.map(item => item.conclusion), ["success", "success", "success", "success"]);
	assert.match(moved.scope.relocation, /unchanged consumer.pl reruns once/u);
	assert.match(document, /Four-ABI CPAN acceptance.*perl-refinements-20261009\.md/u);
	assert.match(document, /Installed, both source routes on four ABIs/u);
	assert.match(document, /Installed on four ABIs; ordinary source/u);
	assert.match(document, /Separate scalar checks.*perl-scalar-20261009\.md.*top-level `Fin` on the same four configurations.*installed-tree relocation and entry counts for `mirror`, `impossible` and `label`/u);
	assert.match(document, /\| `Fin n` parameter or result \| Installed \| Installed \| Installed, both source routes on four ABIs \|/u);
	assert.match(document, /C\/C\+\+ and Node installed; other profiles pending/u);
	assert.doesNotMatch(document, /Executed; relocation retest pending|Both routes executed; relocation retest pending|Four ABIs executed; relocation retest pending|their installed acceptance is not yet recorded/u);
	const publisher = await readFile("docs/publish/cpan.md", "utf8");
	assert.ok(publisher.includes("checked top-level Subtype constructors"));
	assert.ok(publisher.includes("../evidence/perl-refinements-20261009.md"));
	assert.match(publisher, /Retained host callbacks remain unsupported/u);
	assert.doesNotMatch(publisher, /Declaring a transfer, retained host callback, anchored borrow or checked refinement constructor currently fails/u);
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
