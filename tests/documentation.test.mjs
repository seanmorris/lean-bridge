/**
 * Tests the documentation behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import { access, readFile, readdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";

import { analyzeLeanProject } from "../src/analyze/lean-project.mjs";
import { generateJavaScriptPackage } from "../src/backends/javascript/generate.mjs";
import { docPages } from "../site/registry.mjs";
import { assertManagedCiIsolation } from "./helpers/managed-ci-isolation.mjs";
import { assertNativeCiIsolation } from "./helpers/native-ci-isolation.mjs";
import {
	ConsumerSupportError,
	consumerSummaryMarkdown,
	evaluateConsumerResults,
	readConsumerSupport,
	validateConsumerSupport,
} from "../src/adoption/consumer-support.mjs";
import {
	STEADY_STATE_BOX_VALUE,
	STEADY_STATE_MEASURED_ITERATIONS,
	STEADY_STATE_OPERATION,
	STEADY_STATE_WARMUP_ITERATIONS,
	createConsumerPerformance,
} from "../src/adoption/consumer-performance.mjs";

/**
 * Require the bounded dependency step before its original acceptance step.
 *
 * @param workflow - Complete downstream workflow.
 * @param id - Acceptance step identifier.
 * @param command - Exact dependency command.
 * @param condition - Optional matching matrix condition.
 */
const assertDependencyStep = (workflow, id, command, condition) => {
	const marker = `- name: Install dependencies for ${id}\n`;
	assert.ok(workflow.includes(marker));
	const step = workflow.split(marker)[1].split("      - name:")[0];
	assert.ok(step.includes(command));
	assert.match(step, /timeout-minutes: 20/u);
	assert.doesNotMatch(step, /continue-on-error/u);
	if(condition) assert.ok(step.includes(`if: ${condition}\n`));
	else assert.doesNotMatch(step, /\bif:/u);
	assert.ok(workflow.indexOf(marker) < workflow.indexOf(`id: ${id}\n`));
};

test("the Alpha C# documentation project compiles only its own entrypoint", async () => {
	const project = await readFile("tests/fixtures/documentation/consumers/dotnet/Consumer.csproj", "utf8");
	assert.match(project, /<EnableDefaultCompileItems>false<\/EnableDefaultCompileItems>/u);
	assert.deepEqual([...project.matchAll(/<Compile Include="([^"]+)"/gu)].map(match => match[1]), ["Program.cs"]);
});

test("owned Perl transfer docs and CI require installed CPAN consumers", async () => {
	const workflow = await readFile(".github/workflows/perl-consumer.yml", "utf8");
	const step = workflow.split("- name: Verify owned Perl values and installed CPAN archives\n")[1].split("      - name:")[0];
	assert.ok(step.includes("          npm run test:owned-perl-transfers\n"));
	assert.ok(step.includes("CORPUS_PERL_CONFIGURATION: ${{ matrix.configuration }}"));
	for(const directory of ["transfers", "transfer-packaging"])
	{
		assert.ok(workflow.includes(`            build/owned-perl-${directory}/\n`));
		for(const mode of ["ordinary", "reviewed"])
			assert.ok(step.includes(`test -s build/owned-perl-${directory}/${mode}.json`));
	}
	assert.ok(step.includes("test -s build/owned-perl-transfer-packaging/documentation.json"));
	const publisher = await readFile("docs/publish/cpan.md", "utf8");
	assert.match(publisher, /"ownership": "transfer"/u);
	assert.match(publisher, /version-2\nCPAN ownership contract/u);
	const consumer = await readFile("docs/consume/perl.md", "utf8");
	assert.match(consumer, /### Consuming inputs\n/u);
	assert.match(consumer, /die "Input still open at handoff/u);
	assert.match(consumer, /siblings\. Retain any resource you need independently/u);
	const pkg = JSON.parse(await readFile("package.json", "utf8"));
	assert.ok(pkg.scripts["test:owned-perl-transfers"].includes("LEAN_BRIDGE_OWNED_NATIVE_TEST=1"));
	assert.ok(pkg.scripts["test:owned-perl-transfers"].includes("tests/owned-perl-documentation.test.mjs"));
});

test("owned JVM transfer docs and CI require installed Java and Kotlin consumers", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const step = workflow.split("- name: Compare isolated Java and Kotlin corpus consumers with fresh Lean\n")[1].split("      - name:")[0];
	assert.ok(step.includes("          npm run test:owned-jvm-transfers\n"));
	for(const directory of ["transfers", "transfer-packaging"])
	{
		assert.ok(workflow.includes(`            build/owned-jvm-${directory}/\n`));
		for(const mode of ["ordinary", "reviewed"])
			assert.ok(step.includes(`test -s build/owned-jvm-${directory}/${mode}.json`));
	}
	for(const profile of ["java", "kotlin"])
	{
		const file = profile === "java" ? "OwnedTransferExample.java" : "OwnedTransferExample.kt";
		const guide = await readFile(`docs/consume/${profile}.md`, "utf8");
		const source = await readFile(`tests/fixtures/documentation/consumers/${profile}/${file}`, "utf8");
		assert.ok(guide.includes("```" + profile + ` file=${profile}/${file}\n` + source + "```"));
		assert.match(guide, /sibling resources|Sibling resources/u);
	}
	const publisher = await readFile("docs/publish/maven.md", "utf8");
	assert.match(publisher, /"ownership": "transfer"/u);
	assert.match(publisher, /version-2 JVM contract/u);
});

test("JVM borrow guides include executable Java/Kotlin examples and whole-owner Maven contracts", async () => {
	for(const profile of ["java", "kotlin"])
	{
		const file = profile === "java" ? "OwnedBorrowExample.java" : "OwnedBorrowExample.kt";
		const guide = await readFile(`docs/consume/${profile}.md`, "utf8");
		const source = await readFile(`tests/fixtures/documentation/consumers/${profile}/${file}`, "utf8");
		assert.ok(guide.includes("```" + profile + ` file=${profile}/${file}\n` + source + "```"));
		assert.match(guide, /Borrowed results and whole owners/u);
		assert.match(guide, /copyEchoArrayResult/u);
	}
	const publisher = await readFile("docs/publish/maven.md", "utf8");
	assert.match(publisher, /"scope": "parameter"/u);
	assert.match(publisher, /"anchor": "arg0"/u);
	assert.match(publisher, /version-3/u);
});

test("PHP borrow guides explain whole roots in both transports and retain package-manager guidance", async () => {
	const consumer = await readFile("docs/php.md", "utf8");
	const publisher = await readFile("docs/publish/php.md", "utf8");
	assert.match(consumer, /### Owner-anchored results/u);
	assert.match(consumer, /\$owner = copy_value\(new Bundle\(\$ticket->get\(\)/u);
	assert.match(consumer, /\$kept = \$view->retain\(\)/u);
	assert.match(consumer, /last root expires its borrowed descendants/u);
	assert.match(consumer, /input's lifetime in native PHP or\nPHP-Wasm/u);
	assert.match(consumer, /### Callback-result lifetimes/u);
	assert.match(consumer, /\$argument = \$closure->copyArg\(0, \$payload\)/u);
	assert.match(consumer, /targets\.php-wasm\.hostCallbacks: false/u);
	assert.match(consumer, /### Methods and properties/u);
	assert.match(consumer, /Native PHP and PHP-Wasm packages can expose methods and read-only properties/u);
	assert.match(consumer, /Both transports preserve the same receiver and argument lifetimes/u);
	assert.match(publisher, /### Anchor a result to an input/u);
	assert.match(publisher, /"scope": "parameter", "anchor": "arg0"/u);
	assert.match(publisher, /"hostCallbacks": false/u);
	assert.match(publisher, /`copyArg\(\)` and `copyResult\(\)`/u);
	assert.match(publisher, /### Publish to the private HTTPS repository/u);
});

test("native and managed borrow gates install ripgrep before inspecting TAP logs", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	for(const name of ["native-consumers", "managed-consumers"])
	{
		const job = workflow.split(`\n  ${name}:\n`)[1].split(/\n {2}[a-z][a-z0-9-]*:\n/u)[0];
		const firstCheck = job.indexOf("          rg '");
		assert.ok(firstCheck > 0, name);
		const prepare = job.slice(0, firstCheck);
		const install = /^\s*(?:run: )?sudo apt-get .*install -y [^\n]*\bripgrep\b/mu;
		assert.match(prepare, install, name);
		assert.doesNotMatch(prepare.replaceAll(" ripgrep", ""), install);
	}
});

test("owned C# transfer docs and CI require offline packages and the combined consumer tools", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const step = workflow.split("- name: Compare installed NuGet corpus packages with fresh Lean results\n")[1].split("      - name:")[0];
	for(const marker of ["bootstrap-rust-ci.sh", "export LEAN_BRIDGE_PYTHON="
		, "export LEAN_BRIDGE_RUBY=", "export LEAN_BRIDGE_GEM="
		, "npm run test:owned-dotnet-transfers\n"])
		assert.ok(step.includes(marker), marker);
	assertDependencyStep(workflow, "type_corpus_dotnet", "sudo apt-get install -y python3-venv pkg-config", "matrix.profile == 'dotnet'");
	assert.ok(workflow.includes("- name: Install Ruby for the combined NuGet transfer build\n"));
	for(const directory of ["transfers", "transfer-packaging"])
	{
		assert.ok(workflow.includes(`build/owned-dotnet-${directory}/`));
		for(const mode of ["ordinary", "reviewed"])
			assert.ok(step.includes(`test -s build/owned-dotnet-${directory}/${mode}.json`));
	}
	const consumer = await readFile("docs/consume/dotnet.md", "utf8");
	const transfer = consumer.split("#### Consuming inputs\n")[1];
	assert.ok(transfer);
	const example = transfer.split("```csharp file=dotnet/owned-transfers.cs\n")[1].split("\n```")[0] + "\n";
	assert.equal(example, await readFile("tests/fixtures/documentation/consumers/dotnet/owned-transfers.cs", "utf8"));
	assert.match(transfer, /Siblings?|Sibling resources/u);
	const publisher = await readFile("docs/publish/nuget.md", "utf8");
	assert.match(publisher, /ownership: "transfer"/u);
	assert.match(publisher, /C, C\+\+, Cargo, PyPI, RubyGems, NuGet, Maven and CPAN/u);
});

test("owned Ruby documentation and CI require installed gems, companions and runtime coexistence", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const step = workflow.split("- name: Compare installed Ruby corpus packages with fresh Lean results\n")[1].split("      - name:")[0];
	assert.match(step, /bootstrap-rust-ci\.sh/u);
	assert.match(step, /export LEAN_BRIDGE_PYTHON=/u);
	assertDependencyStep(workflow, "type_corpus_ruby", "sudo apt-get install -y python3-venv pkg-config", "matrix.profile == 'ruby'");
	for(const command of ["tests/owned-ruby-runtime.test.mjs tests/owned-ruby-values.test.mjs tests/owned-ruby-layout.test.mjs tests/owned-ruby-conversions.test.mjs"
		, "tests/owned-ruby-gmp.test.mjs tests/owned-ruby-package.test.mjs tests/owned-ruby-packaging.test.mjs tests/owned-ruby-coexistence.test.mjs"])
		assert.ok(step.includes(`LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 ${command}`));
	for(const name of ["ordinary", "reviewed", "scalars-ordinary", "scalars-reviewed", "coexistence"])
		assert.ok(step.includes(`test -s build/owned-ruby-packaging/${name}.json`));
	for(const directory of ["runtime", "values", "layout", "conversions", "gmp", "loading", "packaging"])
		assert.ok(workflow.includes(`build/owned-ruby-${directory}/`));
	assert.ok(step.includes("npm run test:owned-ruby-transfers\n"));
	for(const directory of ["transfers", "transfer-packaging"])
	{
		assert.ok(workflow.includes(`build/owned-ruby-${directory}/`));
		for(const mode of ["ordinary", "reviewed"])
			assert.ok(step.includes(`test -s build/owned-ruby-${directory}/${mode}.json`));
	}
	const consumer = await readFile("docs/consume/ruby.md", "utf8");
	assert.match(consumer, /### Resource-containing values/u);
	assert.match(consumer, /\.retain/u); assert.match(consumer, /with_recovery/u);
	const transfer = consumer.split("### Transferred inputs\n")[1];
	assert.ok(transfer);
	const example = transfer.split("```ruby file=ruby/owned-transfers.rb\n")[1].split("\n```")[0] + "\n";
	assert.equal(example, await readFile("tests/fixtures/documentation/consumers/ruby/owned-transfers.rb", "utf8"));
	const borrow = consumer.split("```ruby file=ruby/owned-borrows.rb\n")[1].split("\n```")[0] + "\n";
	assert.equal(borrow, await readFile("tests/fixtures/documentation/consumers/ruby/owned-borrows.rb", "utf8"));
	assert.match(consumer, /raw resource views obtained through `get`/u);
	assert.ok(step.includes("npm run test:owned-ruby-borrows > build/owned-ruby-borrows.log 2>&1"));
	for(const [name, count] of [["pass", 7], ["fail", 0], ["skipped", 0]])
		assert.ok(step.includes(`rg '^# ${name} ${count}$' build/owned-ruby-borrows.log`));
	for(const directory of ["borrows", "borrow-packaging"])
	{
		assert.ok(workflow.includes(`build/owned-ruby-${directory}/`));
		for(const mode of ["ordinary", "reviewed"])
			assert.ok(step.includes(`test -s build/owned-ruby-${directory}/${mode}.json`));
	}
	assert.ok(step.includes("test -s build/owned-ruby-borrows/borrow-only.json"));
	const publisher = await readFile("docs/publish/rubygems.md", "utf8");
	const owned = publisher.split("## Export resource-containing values\n")[1].split("\n## ")[0];
	const configuration = JSON.parse(owned.split("```json\n")[1].split("\n```")[0]);
	assert.deepEqual(configuration.resources, ["Owned.Ticket"]);
	assert.equal(configuration.ownedAggregates.ownership, "lease");
	assert.equal(configuration.targets.rubygems.name, "owned-values");
	assert.match(owned, /isolated GMP/u);
	const author = owned.split("```lean\n")[1].split("\n```")[0];
	assert.ok(author.startsWith("namespace Owned\n")); assert.ok(author.endsWith("\nend Owned"));
	const declarations = author.slice("namespace Owned\n".length, -"\nend Owned".length).trim().split(/\n(?=(?:structure|def) )/u).map(value => value.trim());
	assert.equal(declarations.length, 6);
	const fixture = await readFile("tests/fixtures/onboarding/owned-cpp-composition/Owned.lean", "utf8");
	for(const declaration of declarations) assert.ok(fixture.includes(`${declaration}\n`));
	const compiled = JSON.parse(await readFile("tests/fixtures/onboarding/owned-cpp-composition/lean-bridge.exports.json", "utf8"));
	assert.deepEqual(configuration.ownedAggregates, compiled.ownedAggregates);
	for(const name of configuration.exports) assert.ok(compiled.exports.includes(name));
});

test("owned Python documentation and CI require installed wheels and typed lifetime checks", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const step = workflow.split("- name: Compare installed Python corpus packages with fresh Lean results\n")[1].split("      - name:")[0];
	assert.match(step, /bootstrap-rust-ci\.sh/u);
	for(const command of ["tests/owned-python-runtime.test.mjs tests/owned-python-values.test.mjs"
		, "tests/owned-python-packaging.test.mjs tests/owned-python-scalar-packaging.test.mjs"])
		assert.ok(step.includes(`LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test ${command}`));
	for(const name of ["ordinary", "reviewed", "scalars-ordinary", "scalars-reviewed"])
		assert.ok(step.includes(`test -s build/owned-python-packaging/${name}.json`));
	for(const directory of ["runtime", "values", "packaging"])
		assert.ok(workflow.includes(`build/owned-python-${directory}/`));
	assert.ok(step.includes("npm run test:owned-python-transfers\n"));
	assert.ok(step.includes("npm run test:owned-python-borrows > build/owned-python-borrows.log 2>&1\n"));
	for(const directory of ["transfers", "transfer-packaging", "borrows", "borrow-packaging"])
	{
		assert.ok(workflow.includes(`build/owned-python-${directory}/`));
		for(const mode of ["ordinary", "reviewed"])
			assert.ok(step.includes(`test -s build/owned-python-${directory}/${mode}.json`));
	}
	const consumer = await readFile("docs/consume/python.md", "utf8");
	assert.match(consumer, /### Resource-containing values/u);
	assert.match(consumer, /retain\(\)/u);
	assert.match(consumer, /with_recovery/u);
	assert.doesNotMatch(consumer, /Resources remain in the separate Alpha fixture/u);
	const transfer = consumer.split("### Transferred inputs\n")[1];
	assert.ok(transfer);
	const example = transfer.split("```python file=python/owned-transfers.py\n")[1].split("\n```")[0] + "\n";
	assert.equal(example, await readFile("tests/fixtures/documentation/consumers/python/owned-transfers.py", "utf8"));
	const publisher = await readFile("docs/publish/pypi.md", "utf8");
	const owned = publisher.split("## Export resource-containing values\n")[1].split("\n## ")[0];
	const configuration = JSON.parse(owned.split("```json\n")[1].split("\n```\n")[0]);
	assert.deepEqual(configuration.resources, ["Owned.Ticket"]);
	assert.equal(configuration.ownedAggregates.ownership, "lease");
	assert.equal(configuration.targets.pypi.name, "owned-values");
});

test("owned Cargo documentation and CI require installed packages and typed lifetime checks", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const step = workflow.split("- name: Compare isolated Cargo corpus consumers with fresh Lean\n")[1].split("      - name:")[0];
	assert.match(step, /bootstrap-rust-ci\.sh/u); assert.match(step, /export CARGO_HOME=/u);
	for(const name of ["runtime", "values", "packaging"])
		assert.ok(step.includes(`LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-rust-${name}.test.mjs`));
	for(const mode of ["ordinary", "reviewed"])
		assert.ok(step.includes(`test -s build/owned-rust-packaging/${mode}.json`));
	const consumer = await readFile("docs/consume/rust.md", "utf8");
	assert.match(consumer, /### Resource-containing values/u);
	assert.match(consumer, /borrowed\.is_closed\(\)/u);
	assert.match(consumer, /retained = value\.primary\.retain\(\)\?/u);
	assert.match(consumer, /with_recovery\(callback, value\)/u);
	assert.doesNotMatch(consumer, /resource identities are not part of the ordinary Rust source path/u);
	const publisher = await readFile("docs/publish/cargo.md", "utf8");
	const owned = publisher.split("## Export resource-containing values\n")[1].split("\n## ")[0];
	const configuration = JSON.parse(owned.split("```json\n")[1].split("\n```")[0]);
	assert.deepEqual(configuration.resources, ["Owned.Ticket"]);
	assert.equal(configuration.ownedAggregates.ownership, "lease");
	assert.equal(configuration.targets.cargo.name, "owned-values");
});

test("WIT structured CI requires installed consumers, ownership probes and executable examples", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const step = workflow.split("- name: Execute installed WIT structured callbacks and documentation\n")[1]?.split("      - name:")[0];
	assert.ok(step); assert.match(step, /LEAN_BRIDGE_WIT_STRUCTURED_CALLABLE_TEST: "1"/u);
	assert.match(step, /node --test --test-concurrency=1/u);
	for(const name of ["native-callback-alias-contract", "wit-structured-callable-contract", "wit-structured-callable-faults", "wit-structured-callables", "wit-structured-aliases", "wit-structured-documentation"])
		assert.ok(step.includes(`tests/${name}.test.mjs`));
	const upload = workflow.split("- name: Upload WIT structured callback evidence\n")[1]?.split("      - name:")[0];
	assert.ok(upload); assert.match(upload, /if-no-files-found: error/u);
	for(const name of ["wit", "wit-aliases", "wit-faults", "wit-documentation"])
	{
		assert.ok(step.includes(`test -s build/structured-callables/${name}.json`));
		assert.ok(upload.includes(`build/structured-callables/${name}.json`));
	}
	assert.equal(workflow.split("steps.structured_wit.outcome == 'success'").length, 3);
	assert.match(workflow, /steps\.structured_wit\.outcome != 'success'/u);
});

test("WIT recursive CI requires both source paths, sanitizer probes and immutable packages", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const step = workflow.split("- name: Execute recursive WIT callbacks and owned closures\n")[1]?.split("      - name:")[0];
	assert.ok(step);
	for(const command of ["test:wit-recursive-generated", "test:wit-recursive-packages"])
		assert.ok(step.includes(`npm run ${command}`));
	const upload = workflow.split("- name: Upload WIT structured callback evidence\n")[1]?.split("      - name:")[0];
	assert.ok(upload); assert.match(upload, /if-no-files-found: error/u);
	for(const name of ["wit-native", "wit-faults", "wit-packages", "wit-mixed-packages"])
	{
		assert.ok(step.includes(`test -s build/recursive-callables/${name}.json`));
		assert.ok(upload.includes(`build/recursive-callables/${name}.json`));
	}
	assert.equal(workflow.split("steps.recursive_wit.outcome == 'success'").length, 3);
	assert.match(workflow, /steps\.recursive_wit\.outcome != 'success'/u);
});

const directoryDocuments = Object.freeze([
	"src/README.md"
	, "src/abi/README.md"
	, "src/adoption/README.md"
	, "src/analyze/README.md"
	, "src/backends/README.md"
	, "src/binding-ir/README.md"
	, "src/build/README.md"
	, "src/capsule/README.md"
	, "src/cli/README.md"
	, "src/performance/README.md"
	, "src/release/README.md"
	, "src/runtime/README.md"
	, "src/wasi/README.md"
	, "acceptance/README.md"
	, "containers/README.md"
	, "docs/README.md"
	, "nix/README.md"
	, "patches/README.md"
	, "poc/README.md"
	, "schema/README.md"
	, "scripts/README.md"
	, "tests/README.md"
]);

const publicDocuments = Object.freeze([
	"README.md"
	, "CONTRIBUTING.md"
	, "docs/lean-author-guide.md"
	, "docs/javascript-typescript.md"
	, "docs/php.md"
	, "docs/dotnet-jvm-ruby.md"
	, "docs/consumers.md"
	, "docs/status.md"
	, "docs/evidence/README.md"
	, "docs/evidence/production-hardening-review-20260814.md"
	, "docs/architecture/approval.md"
	, "docs/architecture/risks.md"
	, "docs/architecture/patches.md"
	, "docs/architecture/adr/README.md"
	, ...directoryDocuments
	, ...docPages.filter(page => page.source).map(page => page.source)
]);

const codeFences = source => [...source.matchAll(/^```[^\n]*\n([\s\S]*?)^```\s*$/gm)].map(match => match[1]);

test("the packaged CLI entry point is executable", async () => {
	const entry = await stat("scripts/lean-bridge.mjs");
	assert.notEqual(entry.mode & 0o111, 0);
});

test("source and operational directories have boundary indexes", async () => {
	const sourceDirectories = (await readdir("src", { withFileTypes: true }))
		.filter(entry => entry.isDirectory())
		.map(entry => `src/${entry.name}/README.md`)
		.sort();
	const indexedSourceDirectories = directoryDocuments
		.filter(path => path.startsWith("src/") && path !== "src/README.md")
		.sort();
	assert.deepEqual(indexedSourceDirectories, sourceDirectories);
	for(const path of directoryDocuments)
	{
		const source = await readFile(path, "utf8");
		assert.match(source, /^# [^\n]+$/m, `${path} needs one title`);
		assert.match(source, /\[[^\]]+\]\([^)]+\)/, `${path} needs a canonical link`);
		assert.ok(
			(source.match(/^## [^\n]+$/gm) ?? []).length >= 3,
			`${path} needs at least three explainer sections`,
		);
		assert.ok(
			source.split("\n").filter(line => line.trim() !== "").length >= 20,
			`${path} needs a full directory explanation`,
		);
	}
});

test("versioned consumer support contract is closed and honest", async () => {
  const contract = await readConsumerSupport();
  const schema = JSON.parse(await readFile("schema/consumer-support.schema.json", "utf8"));
  assert.equal(schema.$id, "urn:lean-bridge:schema:consumer-support:v1");
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.$defs.consumer.additionalProperties, false);
  assert.deepEqual(
    contract.consumers.filter(item => item.state === "supported").map(item => item.id),
    ["node-javascript", "node-typescript", "browser-javascript", "php-native", "php-wasm", "dotnet", "jvm", "ruby", "perl", "python", "rust", "c", "cpp", "wit-wasi"],
  );
  assert.deepEqual(
    contract.consumers.filter(item => item.state === "partial").map(item => item.id),
    [],
  );
  assert.deepEqual(
    contract.consumers.filter(item => item.state === "blocked").map(item => item.id),
    [],
  );
  for(const consumer of contract.consumers)
{
    for(const path of consumer.evidence) await access(path);
}
  const open = structuredClone(contract);
  open.consumers[0].unreviewed = true;
  assert.throws(
    () => validateConsumerSupport(open),
    error => error instanceof ConsumerSupportError && error.code === "invalid-consumer-support",
  );
  const unsupported = structuredClone(contract);
  unsupported.consumers.find(item => item.id === "python").packageInstallation = false;
  assert.throws(
    () => validateConsumerSupport(unsupported),
    error => error instanceof ConsumerSupportError && error.code === "unsupported-support-claim",
  );
});

test("README support table matches every matrix state", async () => {
  const [contract, readme] = await Promise.all([readConsumerSupport(), readFile("README.md", "utf8")]);
  for(const consumer of contract.consumers)
{
    const prefix = `| ${consumer.name} | \`${consumer.state}\` |`;
    assert.ok(readme.split("\n").some(line => line.startsWith(prefix)), consumer.id);
}
  assert.equal((readme.match(/^\| .* \| `(?:supported|partial|blocked)` \|/gm) ?? []).length, contract.consumers.length);
});

const withoutCodeFences = source => {
	let closing;
	return source.split("\n").filter(line => {
		if(closing)
		{
			if(closing.test(line)) closing = undefined;
			return false;
		}
		const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/u.exec(line);
		if(!opening || opening[1][0] === "`" && opening[2].includes("`")) return true;
		closing = new RegExp(`^ {0,3}${opening[1][0]}{${opening[1].length},}[ \\t]*$`, "u");
		return false;
	}).join("\n");
};

test("public documentation has valid local links, portable paths, and plain punctuation", async () => {
  assert.equal(withoutCodeFences("[before](before.md)\n```cpp\n[&](const Value& value) {}\n```\n[after](after.md)"), "[before](before.md)\n[after](after.md)");
  assert.equal(withoutCodeFences("[before](before.md)\n~~~~text\n~~~\n[inside](not-a-link.md)\n~~~~~\n[after](after.md)"), "[before](before.md)\n[after](after.md)");
  assert.equal(withoutCodeFences("[before](before.md)\n```cpp\n[&](const Value& value) {}"), "[before](before.md)");
  for(const path of publicDocuments)
{
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(source, /—/, `${path} contains an em dash`);
    assert.doesNotMatch(source, /(?:^|[^A-Za-z0-9_])\/app(?:\/|\b)/, `${path} contains a workspace path`);
    assert.doesNotMatch(source, /\bperformance budgets?\b/i, `${path} presents performance as a budget`);
    assert.doesNotMatch(source, /https?:\/\/(?:www\.)?lean-?bridge\.dev/i, `${path} claims an unowned project domain`);
    for(const match of withoutCodeFences(source).matchAll(/\[[^\]]+\]\(([^)]+)\)/g))
{
      const target = match[1].trim().replace(/^<|>$/g, "");
      if(/^(?:https?:|mailto:|#)/.test(target)) continue;
      const local = decodeURIComponent(target.split("#")[0].split("?")[0]);
      if(local === "") continue;
      await assert.doesNotReject(access(resolve(dirname(path), local)), `${path} -> ${target}`);
}
    for(const match of source.matchAll(/`((?:tests|scripts|schema|poc|containers|acceptance)\/[^`\s]+)`/g))
{
      if(match[1] === "poc/lean-alpha" || /^poc\/[^/]+@\d/u.test(match[1])) continue; // Composer package coordinates are not repository paths.
      await assert.doesNotReject(access(resolve(match[1])), `${path} -> ${match[1]}`);
}
}
});

test("public examples contain no private ABI or generic runtime surface", async () => {
  const forbidden = /\b(?:ccall|cwrap)\b|_Lean|\bWebAssembly\b|\bgeneric\s+(?:invoke|dispatch)\b|\bownershipFlag\b|\b(?:runtime|object)Handle\b/;
  for(const path of publicDocuments)
{
    const source = await readFile(path, "utf8");
    for(const block of codeFences(source)) assert.doesNotMatch(block, forbidden, `${path} public example`);
}
});

test("generated onboarding TypeScript has no public any", async () => {
  const analysis = await analyzeLeanProject("tests/fixtures/onboarding/small", { targets: ["npm"] });
  assert.ok(analysis.bindingIr);
  const generated = generateJavaScriptPackage(analysis.bindingIr.document);
  assert.doesNotMatch(generated["index.d.ts"], /\bany\b/);
  const packageJson = JSON.parse(generated["package.json"]);
  assert.deepEqual(Object.keys(packageJson.exports), ["."]);
  assert.equal("browser" in packageJson, false);
});

test("promoted package evidence names each executable runtime path", async () => {
  const checks = [
    ["scripts/test-native-consumers.mjs", "buildPyPiPackage"]
    , ["scripts/test-native-consumers.mjs", "buildCargoPackage"]
    , ["scripts/test-native-consumers.mjs", "buildCPackage"]
    , ["scripts/test-native-consumers.mjs", "buildCppPackage"]
    , ["scripts/test-managed-registry-consumers.mjs", "PackageReference"]
    , ["src/release/nuget-package.mjs", "buildNugetPackage"]
    , ["src/release/maven-package.mjs", "buildMavenPackage"]
    , ["src/release/rubygems-package.mjs", "buildRubyGemsPackage"]
    , ["scripts/test-wasi-consumer.mjs", "componentResult"]
  ];
  for(const [path, pattern] of checks) assert.match(await readFile(path, "utf8"), new RegExp(pattern), path);
});

test("steady-state consumers share one retained Box workload", async () => {
  assert.equal(STEADY_STATE_BOX_VALUE, 73);
  assert.equal(STEADY_STATE_OPERATION, "retained Box read");
  assert.equal(STEADY_STATE_WARMUP_ITERATIONS, 10_000);
  assert.equal(STEADY_STATE_MEASURED_ITERATIONS, 100_000);
  for(const path of [
    "tests/consumer-node.test.mjs"
    , "scripts/test-browser-package-consumer.mjs"
    , "scripts/test-native-consumers.mjs"
    , "scripts/test-php-native-package-consumer.mjs"
    , "scripts/test-php-wasm-package-host.mjs"
    , "scripts/test-managed-registry-consumers.mjs"
  ]) {
    const source = await readFile(path, "utf8");
    assert.match(source, /STEADY_STATE_BOX_VALUE/, path);
    assert.match(source, /STEADY_STATE_OPERATION/, path);
    assert.match(source, /STEADY_STATE_WARMUP_ITERATIONS/, path);
    assert.match(source, /STEADY_STATE_MEASURED_ITERATIONS/, path);
  }
  const native = await readFile("scripts/test-native-consumers.mjs", "utf8");
  assert.match(native, /-DCMAKE_BUILD_TYPE=Release/);
  assert.match(native, /"cargo", \["run", "--release"/);
  assert.doesNotMatch(native, /assert\(lean_alpha_/);
  assert.doesNotMatch(native, /sum\(box\.read/);
});

test("CI result contract detects support loss", async () => {
  const contract = await readConsumerSupport();
  const results = contract.consumers.map((item, index) => ({
    schemaVersion: 2
    , consumer: item.id
    , declaredState: item.state
    , testResult: "passed"
    , packageInstallation: item.packageInstallation
    , realLeanExecution: item.realLeanExecution
    , performance: createConsumerPerformance({
      consumer: item.id
      , operation: "generated API fixture call"
      , timingMode: item.id === "wit-wasi" ? "whole-invocation" : "steady-state"
      , scope: item.id === "wit-wasi" ? "installed process and component startup" : "steady-state installed consumer"
      , iterations: 1000
      , durationNanoseconds: (index + 1) * 100000
    })
    , blocker: item.blocker
    , command: item.testCommand
  }));
  assert.equal(evaluateConsumerResults({ contract, results }).result, "passed");

  const lost = structuredClone(results);
  lost.find(item => item.consumer === "node-javascript").realLeanExecution = false;
  assert.throws(
    () => evaluateConsumerResults({ contract, results: lost }),
    error => error.code === "supported-consumer-not-executed",
  );

  const failed = structuredClone(results);
  failed.find(item => item.consumer === "php-wasm").testResult = "failed";
  assert.equal(evaluateConsumerResults({ contract, results: failed }).result, "failed");

  const unmeasured = structuredClone(results);
  unmeasured.find(item => item.consumer === "rust").performance = null;
  assert.throws(
    () => evaluateConsumerResults({ contract, results: unmeasured }),
    error => error.code === "consumer-performance-missing",
  );

  const markdown = consumerSummaryMarkdown(evaluateConsumerResults({ contract, results }));
  for(const consumer of contract.consumers) assert.match(markdown, new RegExp(`\\| ${consumer.id} \\|`));
  assert.match(markdown, /Operation \| Timing \| Performance/);
  assert.match(markdown, /ns\/call|µs\/call|ms\/call/);
  assert.match(markdown, /\/invocation/);
  assert.match(markdown, /operation, timing mode, and recorded CPU match/);
  assert.match(markdown, /## Measurement context/);
  assert.match(markdown, /Consumer \| Scope \| Platform \| Architecture \| CPU/);
});

test("dedicated CI covers every consumer with Node 22 and pinned build paths", async () => {
  const [workflow, packageDocument, perlWorkflow, toolchainBootstrap] = await Promise.all([
    readFile(".github/workflows/consumer-matrix.yml", "utf8")
    , readFile("package.json", "utf8").then(JSON.parse)
    , readFile(".github/workflows/perl-consumer.yml", "utf8")
    , readFile("scripts/bootstrap-toolchains.sh", "utf8")
  ]);
  assert.match(workflow, /^\s*push:\s*$/m);
  assert.match(workflow, /^\s*pull_request:\s*$/m);
  assert.match(workflow, /^\s*workflow_dispatch:\s*$/m);
  assert.match(workflow, /NODE_VERSION: "22"/);
  assert.match(toolchainBootstrap, /--retry 5 --retry-all-errors --retry-delay 2 --retry-max-time 300/);
  assert.match(toolchainBootstrap, /--connect-timeout 30 --max-time 600 --remove-on-error/);
  assert.equal([...toolchainBootstrap.matchAll(/download_archive "\$(?:ELAN|WASM_TOOLS|WABT)_URL"/gu)].length, 3);
  assert.match(toolchainBootstrap, /local partial="\$destination\.part"/);
  assert.match(toolchainBootstrap, /mv "\$partial" "\$destination"/);
  const nodeJob = workflow.split("  node-consumers:\n")[1].split("\n  browser-consumer:\n")[0];
  assert.match(nodeJob, /^ {4}timeout-minutes: 180$/m);
  assert.match(nodeJob, /node scripts\/check-local-npm-release\.mjs/);
  assert.match(nodeJob, /--backend nix --browsers chromium,firefox,webkit/);
  const nativeJob = workflow.split("  native-consumers:\n")[1].split("\n  managed-consumers:\n")[0];
  assert.match(nativeJob, /^ {4}timeout-minutes: 240$/m);
  const wasiJob = workflow.split("  wasi-consumer:\n")[1].split("\n  docker-engine:\n")[0];
  assert.match(wasiJob, /^ {4}timeout-minutes: 240$/m);
  assert.match(wasiJob, /npm run test:owned-wit-transfers/);
  assert.match(wasiJob, /npm run test:owned-wit-borrows/);
  const phpJob = workflow.match(/^ {2}php-consumers:\n[^]*?(?=^ {2}[a-z][a-z0-9-]*:\n)/mu)?.[0];
  assert.ok(phpJob);
  assert.match(phpJob, /^ {4}timeout-minutes: 360$/m);
  assert.doesNotMatch(phpJob, /LEAN_BRIDGE_REVIEWED_MULTI_PROFILE_TEST=1 node --test tests\/php-wasm-multi-profile\.test\.mjs/);
  const phpMultiProfileJob = workflow.match(/^ {2}php-multi-profile:\n[^]*?(?=^ {2}[a-z][a-z0-9-]*:\n)/mu)?.[0];
  assert.ok(phpMultiProfileJob);
  assert.match(phpMultiProfileJob, /^ {4}timeout-minutes: 180$/m);
  assert.match(phpMultiProfileJob, /LEAN_BRIDGE_REVIEWED_MULTI_PROFILE_TEST=1 node --test tests\/php-wasm-multi-profile\.test\.mjs/);
  assert.match(workflow, /^ {6}- php-multi-profile$/m);
  assert.match(workflow, /if: needs\.php-multi-profile\.result != 'success'/);
  const phpWasmCallbackJob = workflow.split("  php-wasm-callback-results:\n")[1].split("\n  php-consumers:\n")[0];
  assert.match(phpWasmCallbackJob, /^ {4}timeout-minutes: 180$/m);
  assert.match(phpWasmCallbackJob, /npm run test:owned-php-wasm-callback-results/);
  assert.match(phpWasmCallbackJob, /npm run test:owned-php-wasm-callback-evidence/);
  for(const variant of ["no-host", "host", "combined"])
    assert.match(phpWasmCallbackJob, new RegExp(`test -s build/owned-php-wasm-callback-results/${variant}-packages\\.json`));
  assert.match(workflow, /^ {6}- php-wasm-callback-results$/m);
  assert.match(workflow, /if: needs\.php-wasm-callback-results\.result != 'success'/);
  assert.match(workflow, /LEAN_BRIDGE_CONSUMER_PERFORMANCE_DIR: build\/consumer-ci\/performance/);
  assert.match(workflow, /npm run build:builder-image/);
  assert.match(workflow, /npm run test:builder-ownership/);
  assert.equal(packageDocument.scripts["test:builder-ownership"], "node scripts/check-builder-ownership.mjs");
  assert.match(packageDocument.scripts["test:consumer:native"], /\.\#universal-release-bundle/);
  assert.match(packageDocument.scripts["test:consumer:wasi"], /\.\#universal-release-bundle/);
  assert.match(packageDocument.scripts["test:consumer:node"], /\.\#npm-package/);
  assert.match(workflow, /LEAN_BRIDGE_LAKE_ENGINE: build\/locked-lake-engine\/bin\/lean-bridge-component-engine/);
  assert.match(workflow, /node --test tests\/component-publication\.test\.mjs/);
  assert.equal(packageDocument.scripts["test:consumer:docker-ci"], "bash scripts/test-docker-consumer-ci.sh");
  assert.match(workflow, /npm run test:consumer:docker-ci/);
  assert.match(workflow, /bootstrap-rust-ci\.sh/);
  const rustCorpusStep = workflow.split("- name: Compare isolated Cargo corpus consumers with fresh Lean")[1].split("- name:")[0];
  assert.ok(rustCorpusStep.includes('export CARGO_HOME="${CARGO_HOME:-$HOME/.cargo}"'));
  assert.ok(rustCorpusStep.indexOf("export CARGO_HOME=") < rustCorpusStep.indexOf("npm run test:type-corpus:rust"));
  assert.match(workflow, /LEAN_BRIDGE_NATIVE_RUST_TEST: "1"/);
  assert.match(workflow, /id: ordinary_rust/);
  assert.match(workflow, /steps\.ordinary_rust\.outcome != 'success'/);
  assert.equal(packageDocument.scripts["test:type-corpus:python"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=python node --test tests/type-corpus.test.mjs");
  assert.equal(packageDocument.scripts["test:type-corpus:reviewed"], "LEAN_BRIDGE_REVIEWED_CORPUS_TEST=1 node --test tests/type-corpus-reviewed.test.mjs");
  const reviewedJob = workflow.split("  reviewed-ir-admission:\n")[1].split("  nix-cache:\n")[0];
  assert.match(reviewedJob, /bootstrap-toolchains\.sh --lean-only/);
  assert.match(reviewedJob, /npm run test:type-corpus:reviewed/);
  assert.doesNotMatch(reviewedJob, /continue-on-error/);
  assert.match(reviewedJob, /name: type-corpus-reviewed-ir-\$\{\{ github\.sha \}\}/);
  assert.match(reviewedJob, /path: build\/type-corpus\/reviewed-ir\.json\n\s*if-no-files-found: error/);
  assert.match(workflow, /needs:[\s\S]*- reviewed-ir-admission/);
  for(const profiles of ["c,cpp", "dotnet", "java,kotlin", "php-native", "python", "ruby", "rust", "wit-wasi"])
  {
    assert.ok(workflow.includes(`LEAN_BRIDGE_REVIEWED_NATIVE_PROFILES=${profiles} node --test tests/type-corpus-reviewed-native.test.mjs`));
    assert.ok(workflow.includes(`test -s build/type-corpus/reviewed-native-${profiles.split(",").sort().join("-")}.json`));
  }
  assert.match(perlWorkflow, /LEAN_BRIDGE_REVIEWED_NATIVE_PROFILES=perl node --test tests\/type-corpus-reviewed-native\.test\.mjs/);
  assert.match(perlWorkflow, /test -s build\/type-corpus\/reviewed-native-perl\.json/);
  for(const profiles of ["c,cpp", "dotnet", "java,kotlin", "php-native", "php-wasm", "python", "ruby", "rust", "wit-wasi"])
  {
    assert.ok(workflow.includes(`LEAN_BRIDGE_CHAR_PROFILES=${profiles} node --test tests/native-char.test.mjs`));
    assert.ok(workflow.includes(`LEAN_BRIDGE_WORD_PROFILES=${profiles} node --test tests/native-words.test.mjs`));
  }
  // Finite specializations run in every native shard and in its downstream consumer command.
  for(const [profiles, report] of [["c,cpp", "c-cpp"], ["dotnet", "dotnet"], ["java,kotlin", "java-kotlin"], ["php-native", "php-native"], ["python", "python"], ["ruby", "ruby"], ["rust", "rust"], ["wit-wasi", "wit-wasi"]])
  {
    const command = `LEAN_BRIDGE_SPECIALIZATION_PROFILES=${profiles} node --test tests/native-specializations.test.mjs`;
    assert.ok(workflow.includes(`          ${command}\n          test -s build/native-specializations/${report}.json\n`), profiles);
    assert.ok(workflow.includes(`            build/native-specializations/${report}.json\n`), profiles);
    assert.ok(workflow.includes(`consumer_command="$consumer_command && ${command}"`) || workflow.includes(` && ${command} && `), profiles);
  }
  // Fin inside arrays, lists and options, then inside products and Except values and arrays of them, runs on both routes
  // beside the specializations in every native shard; each route requires and uploads its own report.
  for(const [profiles, report] of [["c,cpp", "c-cpp"], ["dotnet", "dotnet"], ["java,kotlin", "java-kotlin"], ["php-native", "php-native"], ["python", "python"], ["ruby", "ruby"], ["rust", "rust"], ["wit-wasi", "wit-wasi"]])
  {
    for(const [variable, test, directory] of [["FIN_CONTAINER", "native-fin-containers", "native-fin-containers"], ["FIN_PRODUCT", "native-fin-products", "native-fin-products"], ["FIN_PRODUCT_ARRAY", "native-fin-product-arrays", "native-fin-product-arrays"], ["FIN_RECORD", "native-fin-records", "native-fin-records"]])
    {
      const command = `LEAN_BRIDGE_${variable}_PROFILES=${profiles} LEAN_BRIDGE_REVIEWED_${variable}_PROFILES=${profiles} node --test tests/${test}.test.mjs`;
      assert.ok(workflow.includes(`          ${command}\n          test -s build/${directory}/${report}.json\n          test -s build/${directory}/reviewed-${report}.json\n`), `${profiles} ${test}`);
      assert.ok(workflow.includes(`            build/${directory}/${report}.json\n            build/${directory}/reviewed-${report}.json\n`), `${profiles} ${test}`);
      assert.ok(workflow.includes(`consumer_command="$consumer_command && ${command}"`) || workflow.includes(` && ${command} && `), `${profiles} ${test}`);
    }
    assert.ok(workflow.includes(`            build/native-fin-containers/reviewed-${report}.json\n            build/native-fin-products/${report}.json\n`), profiles);
  }
  // The product acceptance also runs on the second supported Python floor, into its own pair of reports.
  const python312 = "LEAN_BRIDGE_FIN_PRODUCT_REPORT=build/native-fin-products/python312.json LEAN_BRIDGE_REVIEWED_FIN_PRODUCT_REPORT=build/native-fin-products/reviewed-python312.json LEAN_BRIDGE_FIN_PRODUCT_PROFILES=python LEAN_BRIDGE_REVIEWED_FIN_PRODUCT_PROFILES=python node --test tests/native-fin-products.test.mjs";
  assert.ok(workflow.includes(`          LEAN_BRIDGE_PYTHON="\${{ steps.collection_python312.outputs.python-path }}" ${python312}\n          test -s build/native-fin-products/python312.json\n          test -s build/native-fin-products/reviewed-python312.json\n`));
  assert.ok(workflow.includes(`consumer_command="$consumer_command && LEAN_BRIDGE_PYTHON='\${{ steps.collection_python312.outputs.python-path }}' ${python312}"`));
  assert.ok(workflow.includes("            build/native-fin-products/python.json\n            build/native-fin-products/reviewed-python.json\n            build/native-fin-products/python312.json\n            build/native-fin-products/reviewed-python312.json\n"));
  // Arrays of products run on both Python floors too, each into its own pair of reports.
  const arrays312 = "LEAN_BRIDGE_FIN_PRODUCT_ARRAY_REPORT=build/native-fin-product-arrays/python312.json LEAN_BRIDGE_REVIEWED_FIN_PRODUCT_ARRAY_REPORT=build/native-fin-product-arrays/reviewed-python312.json LEAN_BRIDGE_FIN_PRODUCT_ARRAY_PROFILES=python LEAN_BRIDGE_REVIEWED_FIN_PRODUCT_ARRAY_PROFILES=python node --test tests/native-fin-product-arrays.test.mjs";
  assert.ok(workflow.includes(`          LEAN_BRIDGE_PYTHON="\${{ steps.collection_python312.outputs.python-path }}" ${arrays312}\n          test -s build/native-fin-product-arrays/python312.json\n          test -s build/native-fin-product-arrays/reviewed-python312.json\n`));
  assert.ok(workflow.includes(`consumer_command="$consumer_command && LEAN_BRIDGE_PYTHON='\${{ steps.collection_python312.outputs.python-path }}' ${arrays312}"`));
  assert.ok(workflow.includes("            build/native-fin-product-arrays/python.json\n            build/native-fin-product-arrays/reviewed-python.json\n            build/native-fin-product-arrays/python312.json\n            build/native-fin-product-arrays/reviewed-python312.json\n"));
  // Record and variant fields run on both Python floors too, each into its own pair of reports.
  const records312 = "LEAN_BRIDGE_FIN_RECORD_REPORT=build/native-fin-records/python312.json LEAN_BRIDGE_REVIEWED_FIN_RECORD_REPORT=build/native-fin-records/reviewed-python312.json LEAN_BRIDGE_FIN_RECORD_PROFILES=python LEAN_BRIDGE_REVIEWED_FIN_RECORD_PROFILES=python node --test tests/native-fin-records.test.mjs";
  assert.ok(workflow.includes(`          LEAN_BRIDGE_PYTHON="\${{ steps.collection_python312.outputs.python-path }}" ${records312}\n          test -s build/native-fin-records/python312.json\n          test -s build/native-fin-records/reviewed-python312.json\n`));
  assert.ok(workflow.includes(`consumer_command="$consumer_command && LEAN_BRIDGE_PYTHON='\${{ steps.collection_python312.outputs.python-path }}' ${records312}"`));
  assert.ok(workflow.includes("            build/native-fin-records/python.json\n            build/native-fin-records/reviewed-python.json\n            build/native-fin-records/python312.json\n            build/native-fin-records/reviewed-python312.json\n"));
  assert.ok(workflow.includes("          test -s build/native-fin/native-reviewed.json\n"));
  // Author-checked Subtype values run beside the container bounds in every native shard.
  for(const [profiles, report] of [["c,cpp", "c-cpp"], ["dotnet", "dotnet"], ["java,kotlin", "java-kotlin"], ["php-native", "php-native"], ["python", "python"], ["ruby", "ruby"], ["rust", "rust"], ["wit-wasi", "wit-wasi"]])
  {
    const command = `LEAN_BRIDGE_SUBTYPE_PROFILES=${profiles} node --test tests/native-subtype.test.mjs`;
    assert.ok(workflow.includes(`          ${command}\n          test -s build/native-subtype/${report}.json\n`), profiles);
    assert.ok(workflow.includes(`            build/native-subtype/${report}.json\n`), profiles);
    assert.ok(workflow.includes(`consumer_command="$consumer_command && ${command}"`) || workflow.includes(` && ${command} && `), profiles);
  }
  assert.ok(perlWorkflow.includes("          LEAN_BRIDGE_SPECIALIZATION_PROFILES=perl node --test tests/native-specializations.test.mjs\n          test -s build/native-specializations/perl.json\n"));
  assert.ok(perlWorkflow.includes("            build/native-specializations/perl.json\n"));
  assert.ok(perlWorkflow.includes("LEAN_BRIDGE_CHAR_PROFILES=perl node --test tests/native-char.test.mjs"));
  assert.ok(perlWorkflow.includes("LEAN_BRIDGE_WORD_PROFILES=perl node --test tests/native-words.test.mjs"));
  assert.ok(perlWorkflow.includes("LEAN_BRIDGE_PERL_CALLABLE_TEST=1 node --test tests/perl-callables.test.mjs"));
  assert.ok(perlWorkflow.includes("LEAN_BRIDGE_PERL_STRUCTURED_CALLABLE_TEST=1 node --test tests/perl-structured-callables.test.mjs"));
  assert.ok(perlWorkflow.includes("test -s build/structured-callables/perl.json"));
  assert.match(perlWorkflow, /build\/callables\/perl\.json\n\s*build\/structured-callables\/perl\.json/);
  assert.ok(perlWorkflow.includes("LEAN_BRIDGE_PERL_COMPOUND_TEST=1 node --test tests/perl-compounds.test.mjs"));
  assert.ok(perlWorkflow.includes("LEAN_BRIDGE_PERL_LIST_TEST=1 node --test tests/perl-lists.test.mjs tests/perl-list-contract.test.mjs"));
  assert.ok(perlWorkflow.includes("LEAN_BRIDGE_PERL_COLLECTION_TEST=1 node --test tests/perl-collections.test.mjs tests/perl-collection-contract.test.mjs"));
  assert.ok(perlWorkflow.includes("test -s build/collections/perl.json"));
  assert.ok(perlWorkflow.includes("LEAN_BRIDGE_PERL_ALIAS_TEST=1 node --test tests/perl-aliases.test.mjs tests/perl-alias-contract.test.mjs"));
  assert.ok(perlWorkflow.includes("test -s build/aliases/perl.json"));
  assert.match(perlWorkflow, /tests\/perl-alias-contract\.test\.mjs\n\s*LEAN_BRIDGE_PERL_FIN_TEST=1 node --test tests\/perl-fin\.test\.mjs\n/);
  assert.match(perlWorkflow, /test -s build\/aliases\/perl\.json\n\s*test -s build\/native-fin\/perl\.json\n/);
  assert.ok(perlWorkflow.includes("          LEAN_BRIDGE_FIN_CONTAINER_PROFILES=perl LEAN_BRIDGE_REVIEWED_FIN_CONTAINER_PROFILES=perl node --test tests/native-fin-containers.test.mjs tests/perl-fin-containers.test.mjs\n          test -s build/native-fin-containers/perl.json\n          test -s build/native-fin-containers/reviewed-perl.json\n"));
  assert.ok(perlWorkflow.includes("          LEAN_BRIDGE_FIN_PRODUCT_PROFILES=perl LEAN_BRIDGE_REVIEWED_FIN_PRODUCT_PROFILES=perl node --test tests/native-fin-products.test.mjs\n          test -s build/native-fin-products/perl.json\n          test -s build/native-fin-products/reviewed-perl.json\n"));
  assert.ok(perlWorkflow.includes("          LEAN_BRIDGE_FIN_PRODUCT_ARRAY_PROFILES=perl LEAN_BRIDGE_REVIEWED_FIN_PRODUCT_ARRAY_PROFILES=perl node --test tests/native-fin-product-arrays.test.mjs\n          test -s build/native-fin-product-arrays/perl.json\n          test -s build/native-fin-product-arrays/reviewed-perl.json\n"));
  assert.ok(perlWorkflow.includes("            build/native-fin-containers/perl.json\n            build/native-fin-containers/reviewed-perl.json\n            build/native-fin-products/perl.json\n            build/native-fin-products/reviewed-perl.json\n            build/native-fin-product-arrays/perl.json\n            build/native-fin-product-arrays/reviewed-perl.json\n            build/native-fin-records/perl.json\n            build/native-fin-records/reviewed-perl.json\n"));
  assert.ok(perlWorkflow.includes("          LEAN_BRIDGE_FIN_RECORD_PROFILES=perl LEAN_BRIDGE_REVIEWED_FIN_RECORD_PROFILES=perl node --test tests/native-fin-records.test.mjs\n          test -s build/native-fin-records/perl.json\n          test -s build/native-fin-records/reviewed-perl.json\n"));
  assert.ok(perlWorkflow.includes("          LEAN_BRIDGE_SUBTYPE_PROFILES=perl node --test tests/native-subtype.test.mjs\n          test -s build/native-subtype/perl.json\n"));
  assert.ok(perlWorkflow.includes("          LEAN_BRIDGE_PERL_REFINEMENT_TEST=1 node --test tests/perl-refinements.test.mjs\n          test -s build/perl-refinements/perl.json\n"));
  assert.ok(perlWorkflow.includes("LEAN_BRIDGE_PERL_VARIANT_TEST=1 node --test tests/perl-variants.test.mjs"));
  assert.ok(perlWorkflow.includes("test -s build/variants/perl.json"));
  assert.ok(perlWorkflow.includes("LEAN_BRIDGE_PERL_GRAPH_PACKAGE_TEST=1 LEAN_BRIDGE_PERL_GRAPH_COLLISION_TEST=1 LEAN_BRIDGE_PERL_GRAPH_COMPOSITION_TEST=1 LEAN_BRIDGE_PERL_GRAPH_DOCUMENTATION_TEST=1 node --test tests/perl-graph-package.test.mjs"));
  for(const report of ["perl-packages", "perl-component-collision", "perl-composition", "perl-documentation"])
  {
    assert.ok(perlWorkflow.includes(`test -s build/recursive/${report}.json`));
  }
  assert.match(perlWorkflow, /test -s build\/compounds\/perl\.json/);
  assert.match(perlWorkflow, /test -s build\/lists\/perl\.json/);
  assert.ok(workflow.includes("LEAN_BRIDGE_C_CALLABLE_TEST=1 node --test tests/c-callables.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_C_CLOSURE_THREAD_TEST=1 node --test tests/closure-thread-contract.test.mjs tests/closure-thread-installed.test.mjs"));
  assert.ok(workflow.includes("test -s build/closure-thread/installed.json"));
  assert.ok(workflow.includes("node --test tests/component-structured-callables.test.mjs"));
  assert.ok(workflow.includes("test -s build/structured-callables/npm/report.json"));
  const performanceWorkflow = await readFile(".github/workflows/performance.yml", "utf8");
  assert.ok(performanceWorkflow.includes('LEAN_BRIDGE_STRUCTURED_CALLABLE_WASM_TEST: "1"'));
  assert.ok(performanceWorkflow.includes("node --test tests/component-structured-callable-wasm.test.mjs"));
  assert.ok(performanceWorkflow.includes("test -s build/structured-callables/npm-wasm/report.json"));
  assert.ok(workflow.includes("LEAN_BRIDGE_C_STRUCTURED_CALLABLE_TEST=1 node --test tests/c-structured-callables.test.mjs"));
  assert.match(workflow, /test -s build\/structured-callables\/c\.json/);
  assert.ok(workflow.includes("LEAN_BRIDGE_CPP_CALLABLE_TEST=1 node --test tests/cpp-callables.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_CPP_STRUCTURED_CALLABLE_TEST=1 node --test tests/cpp-structured-callables.test.mjs"));
  assert.match(workflow, /test -s build\/structured-callables\/cpp\.json/);
  assert.ok(workflow.includes("LEAN_BRIDGE_DOTNET_CALLABLE_TEST=1 node --test tests/dotnet-callables.test.mjs tests/dotnet-callable-contract.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_DOTNET_STRUCTURED_CALLABLE_TEST=1 node --test tests/dotnet-structured-callables.test.mjs"));
  assert.match(workflow, /test -s build\/structured-callables\/dotnet\.json/);
  assert.ok(workflow.includes("LEAN_BRIDGE_DOTNET_RECURSIVE_CALLABLE_TEST=1 node --test tests/dotnet-recursive-callables.test.mjs"));
  assert.match(workflow, /test -s build\/recursive-callables\/dotnet\.json/);
  assert.match(workflow, /build\/callables\/dotnet\.json\n\s*build\/structured-callables\/dotnet\.json/);
  assert.ok(workflow.includes("LEAN_BRIDGE_DOTNET_COMPOUND_TEST=1 node --test tests/dotnet-compounds.test.mjs tests/dotnet-compound-contract.test.mjs"));
  assert.match(workflow, /test -s build\/compounds\/dotnet\.json/);
  assert.ok(workflow.includes("LEAN_BRIDGE_DOTNET_LIST_TEST=1 node --test tests/dotnet-lists.test.mjs tests/dotnet-list-contract.test.mjs"));
  assert.match(workflow, /test -s build\/lists\/dotnet\.json/);
  assert.ok(workflow.includes("LEAN_BRIDGE_DOTNET_ALIAS_TEST=1 node --test tests/dotnet-aliases.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_DOTNET_VARIANT_TEST=1 node --test tests/dotnet-variants.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_DOTNET_CONVERSION_TEST=1 node --test tests/dotnet-collection-conversions.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_DOTNET_COLLECTION_TEST=1 node --test tests/dotnet-collections.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_DOTNET_EQUALITY_TEST=1 node --test tests/dotnet-value-equality.test.mjs"));
  assert.match(workflow, /test -s build\/collections\/dotnet-conversions\.json/);
  assert.match(workflow, /test -s build\/collections\/dotnet\.json/);
  assert.match(workflow, /test -s build\/equality\/dotnet\.json/);
  assert.match(workflow, /test -s build\/variants\/dotnet\.json/);
  assert.match(workflow, /test -s build\/aliases\/dotnet\.json/);
  assert.match(workflow, /node --test tests\/dotnet-aliases\.test\.mjs\n\s*test -s build\/aliases\/dotnet\.json\n\s*LEAN_BRIDGE_DOTNET_FIN_TEST=1 node --test tests\/dotnet-fin\.test\.mjs\n\s*test -s build\/native-fin\/dotnet\.json\n/);
  assert.match(workflow, /consumer_command="\$consumer_command && LEAN_BRIDGE_DOTNET_FIN_TEST=1 node --test tests\/dotnet-fin\.test\.mjs"/);
  assert.match(workflow, /build\/lists\/dotnet\.json\n\s*build\/aliases\/dotnet\.json\n\s*build\/native-fin\/dotnet\.json\n\s*build\/native-fin\/dotnet-reviewed\.json\n\s*build\/native-specializations\/dotnet\.json\n\s*build\/generic-records\/dotnet\.json\n\s*build\/generic-records\/specialized-dotnet\.json\n\s*build\/native-fin-containers\/dotnet\.json\n\s*build\/native-fin-containers\/reviewed-dotnet\.json\n\s*build\/native-fin-products\/dotnet\.json\n\s*build\/native-fin-products\/reviewed-dotnet\.json\n\s*build\/native-fin-product-arrays\/dotnet\.json\n\s*build\/native-fin-product-arrays\/reviewed-dotnet\.json\n\s*build\/native-fin-records\/dotnet\.json\n\s*build\/native-fin-records\/reviewed-dotnet\.json\n\s*build\/native-subtype\/dotnet\.json\n\s*build\/variants\/dotnet\.json\n\s*build\/collections\/dotnet-conversions\.json\n\s*build\/collections\/dotnet\.json\n\s*build\/equality\/dotnet\.json\n\s*build\/recursive\/dotnet-values\.json\n\s*build\/recursive\/dotnet-conversions\.json\n\s*build\/recursive\/dotnet-native\.json\n\s*build\/recursive\/dotnet-packages\.json\n\s*build\/recursive\/dotnet-composition\.json\n\s*build\/recursive\/dotnet-reproducibility\.json\n\s*build\/recursive\/dotnet-conflicts\.json\n\s*build\/owned-dotnet-runtime\/\n\s*build\/owned-dotnet-layout\/\n\s*build\/owned-dotnet-values\/\n\s*build\/owned-dotnet-conversions\/\n\s*build\/owned-dotnet-callables\/\n\s*build\/owned-dotnet-callback-signatures\/\n\s*build\/owned-dotnet-loading\/\n\s*build\/owned-dotnet-packaging\/\n\s*build\/owned-dotnet-transfers\/\n\s*build\/owned-dotnet-transfer-packaging\/\n\s*build\/owned-dotnet-borrows\/\n\s*build\/owned-dotnet-borrow-packaging\/\n\s*build\/owned-dotnet-borrows\.log\n\s*build\/owned-dotnet-receivers\/\n\s*build\/owned-dotnet-receivers\.log\n\s*if-no-files-found: error/);
  assert.ok(workflow.includes("LEAN_BRIDGE_JVM_CALLABLE_TEST=1 node --test tests/jvm-callables.test.mjs tests/jvm-callable-contract.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_JVM_STRUCTURED_CALLABLE_TEST=1 node --test tests/jvm-structured-callables.test.mjs"));
  assert.ok(workflow.includes("          npm run test:php-recursive-callables\n"));
  for(const variant of ["recursive", "mixed"])
  {
    assert.ok(workflow.includes(`test -s build/recursive-callables/php-${variant}.json`));
    assert.ok(workflow.includes(`            build/recursive-callables/php-${variant}.json\n`));
  }
  assert.ok(workflow.includes("test -s build/structured-callables/jvm.json"));
  assert.ok(workflow.includes("LEAN_BRIDGE_JVM_COMPOUND_TEST=1 node --test tests/jvm-compounds.test.mjs tests/jvm-compound-contract.test.mjs"));
  assert.match(workflow, /test -s build\/compounds\/jvm\.json/);
  assert.ok(workflow.includes("LEAN_BRIDGE_JVM_LIST_TEST=1 node --test tests/jvm-lists.test.mjs tests/jvm-list-contract.test.mjs"));
  assert.match(workflow, /test -s build\/lists\/jvm\.json/);
  assert.ok(workflow.includes("LEAN_BRIDGE_JVM_ALIAS_TEST=1 node --test tests/jvm-aliases.test.mjs"));
  assert.match(workflow, /test -s build\/aliases\/jvm\.json/);
  assert.match(workflow, /node --test tests\/jvm-aliases\.test\.mjs\n\s*test -s build\/aliases\/jvm\.json\n\s*LEAN_BRIDGE_JVM_FIN_TEST=1 node --test tests\/jvm-fin\.test\.mjs\n\s*test -s build\/native-fin\/jvm\.json\n/);
  assert.match(workflow, /build\/aliases\/jvm\.json\n\s*build\/native-fin\/jvm\.json\n/);
  assert.match(workflow, /consumer_command="\$consumer_command && LEAN_BRIDGE_JVM_FIN_TEST=1 node --test tests\/jvm-fin\.test\.mjs"/);
  assert.ok(workflow.includes("LEAN_BRIDGE_JVM_VARIANT_TEST=1 node --test tests/jvm-variants.test.mjs"));
  assert.match(workflow, /test -s build\/variants\/jvm\.json/);
  assert.ok(workflow.includes("LEAN_BRIDGE_JVM_EQUALITY_TEST=1 node --test tests/jvm-value-equality.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_JVM_CONVERSIONS_TEST=1 node --test tests/jvm-collection-conversions.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_JVM_COLLECTION_PREFLIGHT=1 LEAN_BRIDGE_JVM_COLLECTION_PROFILES=java,kotlin node --test tests/jvm-collection-callers.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_JVM_COLLECTION_TEST=1 LEAN_BRIDGE_JVM_COLLECTION_PROFILES=java,kotlin node --test tests/jvm-collections.test.mjs"));
  assert.match(workflow, /test -s build\/equality\/jvm\.json/);
  assert.match(workflow, /test -s build\/collections\/jvm-conversions\.json/);
  assert.match(workflow, /test -s build\/collections\/jvm\.json/);
  const jvmUpload = workflow.split("- name: Upload installed Java and Kotlin corpus observations\n")[1].split("      - name:")[0];
  const jvmReports = jvmUpload.split("          path: |\n")[1].split("          if-no-files-found:")[0].trim().split("\n").map(line => line.trim());
  assert.deepEqual(jvmReports, [
    "build/type-corpus/java-kotlin.json"
    , "build/type-corpus/reviewed-native-java-kotlin.json"
    , "build/char-native/java-kotlin.json", "build/word-native/java-kotlin.json"
    , "build/callables/jvm.json", "build/structured-callables/jvm.json"
    , "build/recursive-callables/jvm-recursive.json"
    , "build/recursive-callables/jvm-mixed.json"
    , ...["runtime", "values", "layout", "kotlin", "conversions", "calls", "thread-exit", "packaging", "transfers", "transfer-packaging", "borrows"].map(name => `build/owned-jvm-${name}/`)
    , "build/owned-jvm-borrows.log"
    , "build/owned-jvm-receiver-core/", "build/owned-jvm-receivers.log"
    , "build/owned-jvm-receiver-gc/", "build/owned-jvm-receiver-gc.log"
    , ...["compounds", "lists", "aliases"].map(name => `build/${name}/jvm.json`)
    , "build/native-fin/jvm.json"
    , "build/native-fin/jvm-reviewed.json"
    , "build/native-specializations/java-kotlin.json"
    , "build/generic-records/java-kotlin.json"
    , "build/generic-records/specialized-java-kotlin.json"
    , "build/native-fin-containers/java-kotlin.json"
    , "build/native-fin-containers/reviewed-java-kotlin.json"
    , "build/native-fin-products/java-kotlin.json"
    , "build/native-fin-products/reviewed-java-kotlin.json"
    , "build/native-fin-product-arrays/java-kotlin.json"
    , "build/native-fin-product-arrays/reviewed-java-kotlin.json"
    , "build/native-fin-records/java-kotlin.json"
    , "build/native-fin-records/reviewed-java-kotlin.json"
    , "build/native-subtype/java-kotlin.json"
    , ...["variants", "equality"].map(name => `build/${name}/jvm.json`)
    , ...["jvm-values", "jvm-conversions", "jvm-native", "kotlin-values", "jvm-package-cold", "jvm-packages", "jvm-reproducibility", "jvm-composition", "jvm-conflicts"].map(name => `build/recursive/${name}.json`)
    , "build/collections/jvm-conversions.json", "build/collections/jvm.json"
  ]);
  assert.match(jvmUpload, /if-no-files-found: error/);
  assert.ok(workflow.includes("LEAN_BRIDGE_PYTHON_CALLABLE_TEST=1 node --test tests/python-callables.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_PYTHON_STRUCTURED_CALLABLE_TEST=1 node --test tests/python-structured-callables.test.mjs"));
  assert.match(workflow, /test -s build\/structured-callables\/python\.json/);
  assert.ok(workflow.includes("LEAN_BRIDGE_PYTHON_RECURSIVE_CALLABLE_TEST=1 node --test tests/python-recursive-callables.test.mjs"));
  assert.match(workflow, /test -s build\/recursive-callables\/python\.json/);
  assert.match(workflow, /build\/recursive-callables\/python\.json\n/);
  assert.ok(workflow.includes("LEAN_BRIDGE_PYTHON_COMPOUND_TEST=1 node --test tests/python-compounds.test.mjs"));
  assert.match(workflow, /test -s build\/compounds\/python\.json/);
  assert.ok(workflow.includes("LEAN_BRIDGE_PYTHON_LIST_TEST=1 node --test tests/python-lists.test.mjs"));
  assert.match(workflow, /test -s build\/lists\/python\.json/);
  assert.ok(workflow.includes("LEAN_BRIDGE_PYTHON_ALIAS_TEST=1 node --test tests/python-aliases.test.mjs"));
  assert.match(workflow, /test -s build\/aliases\/python\.json/);
  assert.match(workflow, /node --test tests\/python-aliases\.test\.mjs\n\s*test -s build\/aliases\/python\.json\n\s*LEAN_BRIDGE_PYTHON_FIN_TEST=1 node --test tests\/python-fin\.test\.mjs\n\s*test -s build\/native-fin\/python\.json\n/);
  assert.match(workflow, /consumer_command="\$consumer_command && LEAN_BRIDGE_PYTHON_FIN_TEST=1 node --test tests\/python-fin\.test\.mjs"/);
  assert.ok(workflow.includes("LEAN_BRIDGE_PYTHON_COLLECTION_TEST=1 node --test tests/python-collections.test.mjs tests/python-collection-contract.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_PYTHON_WHEEL_INSTALL_TEST=1 node --test tests/python-wheel-install.test.mjs"));
  assert.match(workflow, /test -s build\/collections\/python\.json/);
  assert.match(workflow, /test -s build\/collections\/python-docs\.json/);
  for(const version of ["4.6.0", "4.16.0"]) assert.ok(workflow.includes(`--dest build/python-typing-wheels/${version} typing_extensions==${version}`));
  for(const version of ["3.11", "3.12"]) assert.ok(workflow.includes(`python-version: "${version}"`));
  assert.match(workflow, /LEAN_BRIDGE_COLLECTION_PYTHONS:.*steps\.collection_python311\.outputs\.python-path.*steps\.collection_python312\.outputs\.python-path/);
  assert.match(workflow, /python-collection-typecheck\/bin\/python -m pip install --no-cache-dir mypy==2\.3\.1/);
  assert.match(workflow, /build\/callables\/python\.json\n\s*build\/structured-callables\/python\.json\n\s*build\/recursive-callables\/python\.json\n\s*build\/compounds\/python\.json\n\s*build\/lists\/python\.json\n\s*build\/aliases\/python\.json\n\s*build\/native-fin\/python\.json\n\s*build\/native-fin\/python-reviewed\.json\n\s*build\/native-specializations\/python\.json\n\s*build\/generic-records\/python\.json\n\s*build\/generic-records\/specialized-python\.json\n\s*build\/generic-records\/python312\.json\n\s*build\/generic-records\/specialized-python312\.json\n\s*build\/native-fin-containers\/python\.json\n\s*build\/native-fin-containers\/reviewed-python\.json\n\s*build\/native-fin-products\/python\.json\n\s*build\/native-fin-products\/reviewed-python\.json\n\s*build\/native-fin-products\/python312\.json\n\s*build\/native-fin-products\/reviewed-python312\.json\n\s*build\/native-fin-product-arrays\/python\.json\n\s*build\/native-fin-product-arrays\/reviewed-python\.json\n\s*build\/native-fin-product-arrays\/python312\.json\n\s*build\/native-fin-product-arrays\/reviewed-python312\.json\n\s*build\/native-fin-records\/python\.json\n\s*build\/native-fin-records\/reviewed-python\.json\n\s*build\/native-fin-records\/python312\.json\n\s*build\/native-fin-records\/reviewed-python312\.json\n\s*build\/native-subtype\/python\.json\n\s*build\/variants\/python\.json\n\s*build\/collections\/python\.json\n\s*build\/collections\/python-docs\.json\n\s*build\/recursive\/python-values\.json\n\s*build\/recursive\/python-conversions\.json\n\s*build\/recursive\/python-native\.json\n\s*build\/recursive\/python-packages\.json\n\s*build\/owned-python-runtime\/\n\s*build\/owned-python-values\/\n\s*build\/owned-python-transfers\/\n\s*build\/owned-python-transfer-packaging\/\n\s*build\/owned-python-borrows\/\n\s*build\/owned-python-borrow-packaging\/\n\s*build\/owned-python-borrows\.log\n\s*build\/owned-python-receivers\/\n\s*build\/owned-python-receivers\.log\n\s*build\/owned-python-packaging\/\n\s*if-no-files-found: error/);
  assert.ok(workflow.includes("LEAN_BRIDGE_RUBY_CALLABLE_TEST=1 node --test tests/ruby-callables.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_RUBY_STRUCTURED_CALLABLE_TEST=1 node --test tests/ruby-structured-callables.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_RUBY_RECURSIVE_CALLABLE_TEST=1 node --test --test-concurrency=1 tests/ruby-recursive-callables.test.mjs tests/ruby-recursive-callable-contract.test.mjs"));
  assert.ok(workflow.includes("test -s build/recursive-callables/ruby.json"));
  assert.ok(workflow.includes("            build/recursive-callables/ruby.json\n"));
  assert.match(workflow, /test -s build\/structured-callables\/ruby\.json/);
  assert.ok(workflow.includes("LEAN_BRIDGE_RUBY_COMPOUND_TEST=1 node --test tests/ruby-compounds.test.mjs tests/ruby-compound-contract.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_RUBY_LIST_TEST=1 node --test tests/ruby-lists.test.mjs tests/ruby-list-contract.test.mjs"));
  assert.match(workflow, /test -s build\/lists\/ruby\.json/);
  assert.ok(workflow.includes("LEAN_BRIDGE_RUBY_ALIAS_TEST=1 node --test tests/ruby-aliases.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_RUBY_VARIANT_TEST=1 node --test tests/ruby-variants.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_RUBY_COLLECTION_TEST=1 node --test tests/ruby-collections.test.mjs tests/ruby-collection-contract.test.mjs"));
  assert.match(workflow, /test -s build\/collections\/ruby\.json/);
  assert.match(workflow, /build\/variants\/ruby\.json\n\s*build\/collections\/ruby\.json\n\s*build\/recursive\/ruby-values\.json\n\s*build\/recursive\/ruby-conversions\.json\n\s*build\/recursive\/ruby-native\.json\n\s*build\/recursive\/ruby-packages\.json\n\s*build\/owned-ruby-runtime\/\n\s*build\/owned-ruby-values\/\n\s*build\/owned-ruby-layout\/\n\s*build\/owned-ruby-conversions\/\n\s*build\/owned-ruby-gmp\/\n\s*build\/owned-ruby-loading\/\n\s*build\/owned-ruby-transfers\/\n\s*build\/owned-ruby-transfer-packaging\/\n\s*build\/owned-ruby-borrows\/\n\s*build\/owned-ruby-borrow-packaging\/\n\s*build\/owned-ruby-borrows\.log\n\s*build\/owned-ruby-receivers\/\n\s*build\/owned-ruby-receivers\.log\n\s*build\/owned-ruby-packaging\/\n\s*if-no-files-found: error/);
  assert.match(workflow, /test -s build\/variants\/ruby\.json/);
  assert.match(workflow, /test -s build\/aliases\/ruby\.json/);
  assert.match(workflow, /node --test tests\/ruby-aliases\.test\.mjs\n\s*LEAN_BRIDGE_RUBY_FIN_TEST=1 node --test tests\/ruby-fin\.test\.mjs\n/);
  assert.match(workflow, /test -s build\/aliases\/ruby\.json\n\s*test -s build\/native-fin\/ruby\.json\n/);
  assert.match(workflow, /consumer_command="\$consumer_command && LEAN_BRIDGE_RUBY_FIN_TEST=1 node --test tests\/ruby-fin\.test\.mjs"/);
  assert.match(workflow, /test -s build\/compounds\/ruby\.json/);
  assert.ok(workflow.includes("LEAN_BRIDGE_RUST_CALLABLE_TEST=1 node --test tests/rust-callables.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_RUST_STRUCTURED_CALLABLE_TEST=1 node --test --test-concurrency=1 tests/rust-structured-callables.test.mjs tests/rust-structured-callable-contract.test.mjs"));
  assert.match(workflow, /test -s build\/structured-callables\/rust\.json/);
  assert.match(workflow, /build\/callables\/rust\.json\n\s*build\/structured-callables\/rust\.json/);
  assert.ok(workflow.includes("LEAN_BRIDGE_RUST_COMPOUND_TEST=1 node --test tests/rust-compounds.test.mjs"));
  assert.match(workflow, /test -s build\/compounds\/rust\.json/);
  assert.ok(workflow.includes("LEAN_BRIDGE_RUST_LIST_TEST=1 node --test tests/rust-lists.test.mjs"));
  assert.match(workflow, /test -s build\/lists\/rust\.json/);
  assert.ok(workflow.includes("LEAN_BRIDGE_RUST_ALIAS_TEST=1 node --test tests/rust-aliases.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_RUST_VARIANT_TEST=1 node --test tests/rust-variants.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_RUST_CONVERSION_TEST=1 node --test tests/rust-collection-conversions.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_RUST_COLLECTION_TEST=1 node --test tests/rust-collections.test.mjs"));
  assert.match(workflow, /test -s build\/collections\/rust-conversions\.json/);
  assert.match(workflow, /test -s build\/collections\/rust\.json/);
  assert.match(workflow, /test -s build\/variants\/rust\.json/);
  assert.match(workflow, /test -s build\/aliases\/rust\.json/);
  assert.match(workflow, /node --test tests\/rust-aliases\.test\.mjs\n\s*test -s build\/aliases\/rust\.json\n\s*LEAN_BRIDGE_RUST_FIN_TEST=1 node --test tests\/rust-fin\.test\.mjs\n\s*test -s build\/native-fin\/rust\.json\n/);
  assert.match(workflow, /consumer_command="\$consumer_command && LEAN_BRIDGE_RUST_FIN_TEST=1 node --test tests\/rust-fin\.test\.mjs"/);
  assert.match(workflow, /build\/word-native\/rust\.json\n\s*build\/callables\/rust\.json\n\s*build\/structured-callables\/rust\.json\n\s*build\/recursive-callables\/rust\.json\n\s*build\/owned-rust-runtime\/\n\s*build\/owned-rust-values\/\n\s*build\/owned-rust-transfers\/\n\s*build\/owned-rust-transfer-packaging\/\n\s*build\/owned-rust-borrows\/\n\s*build\/owned-rust-borrow-packaging\/\n\s*build\/owned-rust-borrows\.log\n\s*build\/owned-rust-receivers\/\n\s*build\/owned-rust-receivers\.log\n\s*build\/owned-rust-packaging\/ordinary\.json\n\s*build\/owned-rust-packaging\/reviewed\.json\n\s*build\/compounds\/rust\.json\n\s*build\/lists\/rust\.json\n\s*build\/aliases\/rust\.json\n\s*build\/native-fin\/rust\.json\n\s*build\/native-fin\/rust-reviewed\.json\n\s*build\/native-specializations\/rust\.json\n\s*build\/generic-records\/rust\.json\n\s*build\/generic-records\/specialized-rust\.json\n\s*build\/native-fin-containers\/rust\.json\n\s*build\/native-fin-containers\/reviewed-rust\.json\n\s*build\/native-fin-products\/rust\.json\n\s*build\/native-fin-products\/reviewed-rust\.json\n\s*build\/native-fin-product-arrays\/rust\.json\n\s*build\/native-fin-product-arrays\/reviewed-rust\.json\n\s*build\/native-fin-records\/rust\.json\n\s*build\/native-fin-records\/reviewed-rust\.json\n\s*build\/native-subtype\/rust\.json\n\s*build\/variants\/rust\.json\n\s*build\/collections\/rust-conversions\.json\n\s*build\/recursive\/rust-values\.json\n\s*build\/recursive\/rust-conversions\.json\n\s*build\/recursive\/rust-native\.json\n\s*build\/recursive\/rust-packages\.json\n\s*build\/collections\/rust\.json\n\s*if-no-files-found: error/);
  assert.match(workflow, /build\/word-native\/ruby\.json\n\s*build\/callables\/ruby\.json\n\s*build\/structured-callables\/ruby\.json\n\s*build\/recursive-callables\/ruby\.json\n\s*build\/compounds\/ruby\.json\n\s*build\/lists\/ruby\.json\n\s*build\/aliases\/ruby\.json\n\s*build\/native-fin\/ruby\.json\n\s*build\/native-fin\/ruby-reviewed\.json\n\s*build\/native-specializations\/ruby\.json\n\s*build\/generic-records\/ruby\.json\n\s*build\/generic-records\/specialized-ruby\.json\n\s*build\/native-fin-containers\/ruby\.json\n\s*build\/native-fin-containers\/reviewed-ruby\.json\n\s*build\/native-fin-products\/ruby\.json\n\s*build\/native-fin-products\/reviewed-ruby\.json\n\s*build\/native-fin-product-arrays\/ruby\.json\n\s*build\/native-fin-product-arrays\/reviewed-ruby\.json\n\s*build\/native-fin-records\/ruby\.json\n\s*build\/native-fin-records\/reviewed-ruby\.json\n\s*build\/native-subtype\/ruby\.json\n\s*build\/variants\/ruby\.json\n\s*build\/collections\/ruby\.json\n\s*build\/recursive\/ruby-values\.json\n\s*build\/recursive\/ruby-conversions\.json\n\s*build\/recursive\/ruby-native\.json\n\s*build\/recursive\/ruby-packages\.json\n\s*build\/owned-ruby-runtime\/\n\s*build\/owned-ruby-values\/\n\s*build\/owned-ruby-layout\/\n\s*build\/owned-ruby-conversions\/\n\s*build\/owned-ruby-gmp\/\n\s*build\/owned-ruby-loading\/\n\s*build\/owned-ruby-transfers\/\n\s*build\/owned-ruby-transfer-packaging\/\n\s*build\/owned-ruby-borrows\/\n\s*build\/owned-ruby-borrow-packaging\/\n\s*build\/owned-ruby-borrows\.log\n\s*build\/owned-ruby-receivers\/\n\s*build\/owned-ruby-receivers\.log\n\s*build\/owned-ruby-packaging\/\n\s*if-no-files-found: error/);
  assert.match(workflow, /LEAN_BRIDGE_REVIEWED_MULTI_PROFILE_TEST=1 node --test tests\/php-wasm-multi-profile\.test\.mjs/);
  for(const target of ["npm", "php-wasm"])
  {
    assert.ok(workflow.includes(`npm run test:type-corpus:reviewed-${target}`));
    assert.ok(packageDocument.scripts[`test:type-corpus:reviewed-${target}`].includes("tests/type-corpus-reviewed-wasm.test.mjs"));
  }
  for(const profiles of ["php-wasm", "browser-javascript-browser-react-browser-worker-node-javascript-node-typescript"])
    assert.ok(workflow.includes(`test -s build/type-corpus/reviewed-wasm-${profiles}.json`));
  assert.equal(packageDocument.scripts["test:type-corpus:ruby"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=ruby node --test tests/type-corpus.test.mjs");
  assert.equal(packageDocument.scripts["test:type-corpus:rust"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=rust node --test tests/type-corpus.test.mjs");
  assert.equal(packageDocument.scripts["test:type-corpus:all-native"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=c,cpp,dotnet,java,kotlin,perl,php-native,python,ruby,rust,wit-wasi node --test tests/type-corpus.test.mjs");
  assert.equal(packageDocument.scripts["test:type-corpus:wit-wasi"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=wit-wasi node --test tests/type-corpus.test.mjs");
  assert.match(workflow, /id: ordinary_wit\n\s*continue-on-error: true/);
  assert.match(workflow, /id: type_corpus_wit\n\s*continue-on-error: true/);
  assert.match(workflow, /node --test tests\/native-wit\.test\.mjs && LEAN_BRIDGE_WIT_CALLABLE_COMPONENT_TEST=1 node --test tests\/wit-callable-contract\.test\.mjs && LEAN_BRIDGE_WIT_CALLABLE_TEST=1 node --test tests\/wit-callables\.test\.mjs && LEAN_BRIDGE_WIT_COMPOUND_TEST=1 node --test tests\/wit-compounds\.test\.mjs tests\/wit-compound-contract\.test\.mjs tests\/wit-compound-conversions\.test\.mjs && LEAN_BRIDGE_WIT_LIST_TEST=1 node --test tests\/wit-lists\.test\.mjs tests\/wit-list-contract\.test\.mjs tests\/wit-list-conversions\.test\.mjs && LEAN_BRIDGE_WIT_ALIAS_TEST=1 node --test --test-concurrency=1 tests\/wit-aliases\.test\.mjs tests\/wit-alias-contract\.test\.mjs tests\/wit-alias-conversions\.test\.mjs && LEAN_BRIDGE_WIT_FIN_TEST=1 node --test tests\/wit-fin\.test\.mjs && LEAN_BRIDGE_SPECIALIZATION_PROFILES=wit-wasi node --test tests\/native-specializations\.test\.mjs && LEAN_BRIDGE_GENERIC_RECORD_PROFILES=wit-wasi node --test --test-name-pattern='relocated source-free native packages construct' tests\/generic-records\.test\.mjs && LEAN_BRIDGE_FIN_CONTAINER_PROFILES=wit-wasi LEAN_BRIDGE_REVIEWED_FIN_CONTAINER_PROFILES=wit-wasi node --test tests\/native-fin-containers\.test\.mjs && LEAN_BRIDGE_FIN_PRODUCT_PROFILES=wit-wasi LEAN_BRIDGE_REVIEWED_FIN_PRODUCT_PROFILES=wit-wasi node --test tests\/native-fin-products\.test\.mjs && LEAN_BRIDGE_FIN_PRODUCT_ARRAY_PROFILES=wit-wasi LEAN_BRIDGE_REVIEWED_FIN_PRODUCT_ARRAY_PROFILES=wit-wasi node --test tests\/native-fin-product-arrays\.test\.mjs && LEAN_BRIDGE_FIN_RECORD_PROFILES=wit-wasi LEAN_BRIDGE_REVIEWED_FIN_RECORD_PROFILES=wit-wasi node --test tests\/native-fin-records\.test\.mjs && LEAN_BRIDGE_SUBTYPE_PROFILES=wit-wasi node --test tests\/native-subtype\.test\.mjs && LEAN_BRIDGE_WIT_VARIANT_TEST=1 node --test --test-concurrency=1 tests\/wit-variants\.test\.mjs tests\/wit-variant-contract\.test\.mjs tests\/wit-variant-conversions\.test\.mjs && LEAN_BRIDGE_WIT_COLLECTION_TEST=1 node --test --test-concurrency=1 tests\/wit-collections\.test\.mjs tests\/wit-collection-contract\.test\.mjs tests\/wit-collection-conversions\.test\.mjs && LEAN_BRIDGE_WIT_GRAPH_TEST=1 node --test tests\/wit-copied-graph-conversions\.test\.mjs && LEAN_BRIDGE_WIT_GRAPH_NATIVE_TEST=1 node --test tests\/wit-copied-graph-native\.test\.mjs && LEAN_BRIDGE_WIT_GRAPH_INSTALLED_TEST=1 node --test tests\/wit-copied-graph-package\.test\.mjs && LEAN_BRIDGE_WIT_GRAPH_REPRO_TEST=1 node --test tests\/wit-copied-graph-package\.test\.mjs && LEAN_BRIDGE_WIT_HOST_TEST=1 node --test tests\/wit-host-evidence\.test\.mjs && LEAN_BRIDGE_WIT_HOST_PACKAGES_TEST=1 node --test tests\/wit-host-packages\.test\.mjs && LEAN_BRIDGE_WIT_GRAPH_COMPOSITION_TEST=1 LEAN_BRIDGE_WIT_MIXED_PACKAGES_TEST=1 node --test tests\/wit-graph-composition\.test\.mjs && npm run test:type-corpus:wit-wasi/);
  assert.match(workflow, /steps\.type_corpus_wit\.outcome != 'success'/);
  assert.match(workflow, /steps\.type_corpus_wit\.outcome == 'success'/);
  assert.match(workflow, /name: type-corpus-wit-wasi-\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /path: \|\n\s*build\/type-corpus\/wit-wasi\.json\n\s*build\/type-corpus\/reviewed-native-wit-wasi\.json\n\s*build\/char-native\/wit-wasi\.json\n\s*build\/word-native\/wit-wasi\.json\n\s*build\/callables\/wit\.json\n\s*build\/compounds\/wit\.json\n\s*build\/compounds\/wit-conversions\.json\n\s*build\/lists\/wit\.json\n\s*build\/lists\/wit-conversions\.json\n\s*build\/aliases\/wit\.json\n\s*build\/aliases\/wit-conversions\.json\n\s*build\/native-fin\/wit\.json\n\s*build\/native-fin\/wit-reviewed\.json\n\s*build\/native-specializations\/wit-wasi\.json\n\s*build\/generic-records\/wit-wasi\.json\n\s*build\/generic-records\/specialized-wit-wasi\.json\n\s*build\/native-fin-containers\/wit-wasi\.json\n\s*build\/native-fin-containers\/reviewed-wit-wasi\.json\n\s*build\/native-fin-products\/wit-wasi\.json\n\s*build\/native-fin-products\/reviewed-wit-wasi\.json\n\s*build\/native-fin-product-arrays\/wit-wasi\.json\n\s*build\/native-fin-product-arrays\/reviewed-wit-wasi\.json\n\s*build\/native-fin-records\/wit-wasi\.json\n\s*build\/native-fin-records\/reviewed-wit-wasi\.json\n\s*build\/native-subtype\/wit-wasi\.json\n\s*build\/variants\/wit\.json\n\s*build\/variants\/wit-conversions\.json\n\s*build\/collections\/wit\.json\n\s*build\/collections\/wit-conversions\.json\n\s*build\/recursive-wit\/conversions\.json\n\s*build\/recursive-wit\/native\.json\n\s*build\/recursive\/wit-packages\.json\n\s*build\/recursive\/wit-reproducibility\.json\n\s*build\/recursive-wit\/host-hash\.json\n\s*build\/recursive-wit\/host-isolation\.json\n\s*build\/recursive-wit\/composition\.json\n\s*build\/recursive-wit\/mixed-packages\.json\n\s*if-no-files-found: error/);
  assert.match(workflow, /LEAN_BRIDGE_WIT_CALLABLE_TEST=1 node --test tests\/wit-callables\.test\.mjs/);
  assert.ok(workflow.includes("test -s build/lists/wit.json"));
  assert.ok(workflow.includes("test -s build/lists/wit-conversions.json"));
  assert.equal(packageDocument.scripts["test:type-corpus:php-native"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=php-native node --test tests/type-corpus.test.mjs");
  assert.match(workflow, /id: type_corpus_php_native\n\s*continue-on-error: true/);
  assert.match(workflow, /node --test tests\/native-php\.test\.mjs && npm run test:type-corpus:php-native/);
  assert.match(workflow, /steps\.type_corpus_php_native\.outcome != 'success'/);
  assert.match(workflow, /steps\.type_corpus_php_native\.outcome }}" != success/);
  assert.match(workflow, /name: type-corpus-php-native-\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /path: \|\n\s*build\/recursive\/php-values\.json\n\s*build\/owned\/php-values\.json\n\s*build\/owned-php-runtime\/\n\s*build\/owned-php-conversions\/\n\s*build\/owned-php-calls\/\n\s*build\/owned-php-packaging\/\n\s*build\/owned-php-transfers\/\n\s*build\/owned-php-transfer-packaging\/\n\s*build\/owned-php-borrows\/\n\s*build\/owned-php-borrow-packaging\/\n\s*build\/recursive\/php-conversions\.json\n\s*build\/recursive\/php-native\.json\n\s*build\/recursive\/php-package-cold\.json\n\s*build\/recursive\/php-packages\.json\n\s*build\/recursive\/php-reproducibility\.json\n\s*build\/recursive\/php-composition\.json\n\s*build\/recursive\/php-conflicts\.json\n\s*build\/type-corpus\/php-native\.json\n\s*build\/type-corpus\/reviewed-native-php-native\.json\n\s*build\/char-native\/php-native\.json\n\s*build\/word-native\/php-native\.json\n\s*build\/callables\/php-native\.json\n\s*build\/structured-callables\/php-native\.json\n\s*build\/recursive-callables\/php-recursive\.json\n\s*build\/recursive-callables\/php-mixed\.json\n\s*build\/compounds\/php-native\.json\n\s*build\/lists\/php-native\.json\n\s*build\/aliases\/php-native\.json\n\s*build\/native-fin\/php\.json\n\s*build\/native-fin\/php-reviewed\.json\n\s*build\/native-specializations\/php-native\.json\n\s*build\/generic-records\/php-native\.json\n\s*build\/generic-records\/specialized-php-native\.json\n\s*build\/native-fin-containers\/php-native\.json\n\s*build\/native-fin-containers\/reviewed-php-native\.json\n\s*build\/native-fin-products\/php-native\.json\n\s*build\/native-fin-products\/reviewed-php-native\.json\n\s*build\/native-fin-product-arrays\/php-native\.json\n\s*build\/native-fin-product-arrays\/reviewed-php-native\.json\n\s*build\/native-fin-records\/php-native\.json\n\s*build\/native-fin-records\/reviewed-php-native\.json\n\s*build\/native-subtype\/php-native\.json\n\s*build\/variants\/php-native\.json\n\s*build\/collections\/php-native-conversions\.json\n\s*build\/equality\/php\.json\n\s*build\/collections\/php-native\.json\n\s*if-no-files-found: error/);
  assert.match(workflow, /LEAN_BRIDGE_PHP_CALLABLE_TEST=1 node --test tests\/php-callables\.test\.mjs tests\/php-callable-contract\.test\.mjs/);
  assert.match(workflow, /LEAN_BRIDGE_PHP_COMPOUND_TEST=1 node --test tests\/php-compounds\.test\.mjs tests\/php-compound-contract\.test\.mjs/);
  assert.match(workflow, /LEAN_BRIDGE_PHP_LIST_TEST=1 node --test tests\/php-lists\.test\.mjs tests\/php-list-contract\.test\.mjs/);
  assert.ok(workflow.includes("test -s build/lists/php-native.json"));
  assert.ok(workflow.includes("LEAN_BRIDGE_PHP_ALIAS_TEST=1 node --test tests/php-aliases.test.mjs tests/php-alias-contract.test.mjs"));
  assert.match(workflow, /tests\/php-alias-contract\.test\.mjs\n\s*LEAN_BRIDGE_PHP_FIN_TEST=1 node --test tests\/php-fin\.test\.mjs\n/);
  assert.match(workflow, /test -s build\/aliases\/php-native\.json\n\s*test -s build\/native-fin\/php\.json\n/);
  assert.match(workflow, /tests\/php-alias-contract\.test\.mjs && LEAN_BRIDGE_PHP_FIN_TEST=1 node --test tests\/php-fin\.test\.mjs && /);
  assert.ok(workflow.includes("test -s build/aliases/php-native.json"));
  assert.ok(workflow.includes("LEAN_BRIDGE_PHP_VARIANT_TEST=1 node --test tests/php-variants.test.mjs tests/php-variant-contract.test.mjs"));
  assert.ok(workflow.includes("test -s build/variants/php-native.json"));
  assert.ok(workflow.includes("LEAN_BRIDGE_PHP_CONVERSIONS_TEST=1 node --test tests/php-collection-conversions.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_PHP_EQUALITY_TEST=1 node --test tests/php-value-equality.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_PHP_COLLECTION_TEST=1 node --test tests/php-collections.test.mjs tests/php-collection-contract.test.mjs"));
  assert.ok(workflow.includes("test -s build/collections/php-native-conversions.json"));
  assert.ok(workflow.includes("test -s build/equality/php.json"));
  assert.ok(workflow.includes("test -s build/collections/php-native.json"));
  assert.ok(workflow.includes("LEAN_BRIDGE_PHP_WASM_LIST_TEST=1 node --test tests/php-wasm-lists.test.mjs tests/php-wasm-list-contract.test.mjs tests/php-wasm-list-zend.test.mjs"));
  assert.ok(workflow.includes("LEAN_BRIDGE_PHP_WASM_VARIANT_TEST=1 node --test --test-concurrency=1 tests/php-wasm-variants.test.mjs tests/php-wasm-variant-contract.test.mjs tests/php-wasm-variant-zend.test.mjs"));
  // Checked Fin and generic records on PHP-Wasm run after the collection gate, each with its own report.
  const phpWasmGates = [["LEAN_BRIDGE_PHP_WASM_FIN_TEST=1 node --test --test-concurrency=1 tests/php-wasm-fin.test.mjs", "build/php-wasm-fin/ordinary.json"]
    , ["LEAN_BRIDGE_PHP_WASM_GENERIC_RECORD_TEST=1 node --test --test-concurrency=1 tests/php-wasm-generic-records.test.mjs", "build/generic-records/php-wasm.json"]];
  for(const [command, report] of phpWasmGates)
  {
    assert.ok(workflow.includes(`          ${command}\n          test -s ${report}\n`), command);
    assert.ok(workflow.includes(`            ${report}\n`), report);
    assert.ok(workflow.includes(` && ${command} && `), command);
  }
  assert.ok(workflow.includes("test -s build/lists/php-wasm.json"));
  assert.ok(workflow.includes("test -s build/lists/php-wasm-zend-faults.json"));
  assert.ok(workflow.includes("LEAN_BRIDGE_PHP_WASM_COLLECTION_TEST=1 node --test --test-concurrency=1 tests/php-wasm-collections.test.mjs tests/php-wasm-collection-contract.test.mjs tests/php-wasm-collection-zend.test.mjs"));
  assert.ok(workflow.includes("test -s build/collections/php-wasm.json"));
  assert.ok(workflow.includes("test -s build/collections/php-wasm-zend-faults.json"));
  assert.match(workflow, /LEAN_BRIDGE_PHP_WASM_COMPOUND_TEST=1 node --test tests\/php-wasm-compounds\.test\.mjs tests\/php-wasm-compound-contract\.test\.mjs tests\/php-wasm-compound-zend\.test\.mjs/);
  assert.match(workflow, /test -s build\/compounds\/php-wasm\.json/);
  assert.match(workflow, /build\/callables\/php-wasm\.json\n\s*build\/structured-callables\/php-wasm\.json\n\s*build\/structured-callables\/php-wasm-zend-faults\.json\n\s*build\/recursive-callables\/php-wasm-generated\.json\n\s*build\/recursive-callables\/php-wasm-packages\.json\n\s*build\/recursive-callables\/php-wasm-mixed-packages\.json\n\s*build\/compounds\/php-wasm\.json\n\s*build\/compounds\/php-wasm-zend-faults\.json\n\s*build\/lists\/php-wasm\.json\n\s*build\/lists\/php-wasm-zend-faults\.json\n\s*build\/aliases\/php-wasm\.json\n\s*build\/aliases\/php-wasm-zend-faults\.json\n\s*build\/variants\/php-wasm\.json\n\s*build\/variants\/php-wasm-zend-faults\.json\n\s*build\/collections\/php-wasm\.json\n\s*build\/collections\/php-wasm-zend-faults\.json\n\s*build\/php-wasm-fin\/ordinary\.json\n\s*build\/generic-records\/php-wasm\.json\n\s*if-no-files-found: error/);
  assert.equal(packageDocument.scripts["test:type-corpus:php-wasm"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=php-wasm node --test tests/type-corpus.test.mjs");
  assert.match(workflow, /id: type_corpus_php_wasm\n\s*continue-on-error: true/);
  assert.match(workflow, /steps\.type_corpus_php_wasm\.outcome != 'success'/);
  assert.match(workflow, /steps\.type_corpus_php_wasm\.outcome }}" != success/);
  assert.doesNotMatch(workflow, /node --test tests\/php-wasm-multi-profile\.test\.mjs && npm run test:type-corpus:php-wasm/);
  assert.match(workflow, /--command "npm run test:consumer:php[^\n]+npm run test:type-corpus:php-wasm/);
  assert.match(workflow, /name: type-corpus-php-wasm-\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /LEAN_BRIDGE_PHP_WASM_CALLABLE_TEST=1 node --test tests\/php-wasm-callables\.test\.mjs tests\/php-wasm-callable-contract\.test\.mjs/);
  assert.match(workflow, /LEAN_BRIDGE_PHP_WASM_STRUCTURED_CALLABLE_TEST=1 node --test --test-concurrency=1 tests\/php-wasm-structured-callables\.test\.mjs tests\/php-wasm-structured-callable-zend\.test\.mjs/);
  assert.match(workflow, /test -s build\/structured-callables\/php-wasm\.json\n\s*test -s build\/structured-callables\/php-wasm-zend-faults\.json/);
  assert.match(workflow, /path: \|\n\s*build\/recursive\/php-wasm-values\.json\n\s*build\/recursive\/wasm32-transport\.json\n\s*build\/recursive\/php-wasm-zend\.json\n\s*build\/recursive\/php-wasm-zend-lean\.json\n\s*build\/recursive\/php-wasm-graph-packages\.json\n\s*build\/recursive\/php-wasm-graph-reproduction\.json\n\s*build\/recursive\/php-wasm-graph-loading\.json\n\s*build\/recursive\/php-wasm-shared-regressions\.json\n\s*build\/type-corpus\/php-wasm\.json\n\s*build\/type-corpus\/reviewed-wasm-php-wasm\.json\n\s*build\/char-native\/php-wasm\.json\n\s*build\/word-native\/php-wasm\.json\n\s*build\/callables\/php-wasm\.json\n\s*build\/structured-callables\/php-wasm\.json\n\s*build\/structured-callables\/php-wasm-zend-faults\.json\n\s*build\/recursive-callables\/php-wasm-generated\.json\n\s*build\/recursive-callables\/php-wasm-packages\.json\n\s*build\/recursive-callables\/php-wasm-mixed-packages\.json\n\s*build\/compounds\/php-wasm\.json\n\s*build\/compounds\/php-wasm-zend-faults\.json\n\s*build\/lists\/php-wasm\.json\n\s*build\/lists\/php-wasm-zend-faults\.json\n\s*build\/aliases\/php-wasm\.json\n\s*build\/aliases\/php-wasm-zend-faults\.json\n\s*build\/variants\/php-wasm\.json\n\s*build\/variants\/php-wasm-zend-faults\.json\n\s*build\/collections\/php-wasm\.json\n\s*build\/collections\/php-wasm-zend-faults\.json\n\s*build\/php-wasm-fin\/ordinary\.json\n\s*build\/generic-records\/php-wasm\.json\n\s*if-no-files-found: error/);
  assert.equal(packageDocument.scripts["test:type-corpus:java"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=java node --test tests/type-corpus.test.mjs");
  assert.equal(packageDocument.scripts["test:type-corpus:kotlin"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=kotlin node --test tests/type-corpus.test.mjs");
  assert.equal(packageDocument.scripts["test:type-corpus:jvm"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=java,kotlin node --test tests/type-corpus.test.mjs");
  assert.match(workflow, /id: ordinary_jvm\n\s*continue-on-error: true/);
  assert.match(workflow, /id: type_corpus_jvm/);
  assert.match(workflow, /node --test tests\/native-jvm\.test\.mjs && npm run test:type-corpus:jvm/);
  assert.match(workflow, /steps\.ordinary_jvm\.outcome != 'success'/);
  assert.match(workflow, /steps\.type_corpus_jvm\.outcome != 'success'/);
  assert.match(workflow, /steps\.type_corpus_jvm\.outcome }}" != success/);
  assert.match(workflow, /name: type-corpus-jvm-\$\{\{ github\.sha \}\}/);
  assert.equal(packageDocument.scripts["test:type-corpus:dotnet"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=dotnet node --test tests/type-corpus.test.mjs");
  assert.match(workflow, /id: ordinary_dotnet\n\s*continue-on-error: true/);
  assert.match(workflow, /id: type_corpus_dotnet/);
  assert.match(workflow, /node --test tests\/native-dotnet\.test\.mjs && npm run test:type-corpus:dotnet/);
  assert.match(workflow, /steps\.ordinary_dotnet\.outcome != 'success'/);
  assert.match(workflow, /steps\.type_corpus_dotnet\.outcome != 'success'/);
  assert.match(workflow, /steps\.type_corpus_dotnet\.outcome }}" != success/);
  assert.match(workflow, /name: type-corpus-dotnet-\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /path: \|\n\s*build\/type-corpus\/dotnet\.json\n\s*build\/type-corpus\/reviewed-native-dotnet\.json\n\s*build\/char-native\/dotnet\.json\n\s*build\/word-native\/dotnet\.json\n\s*build\/callables\/dotnet\.json\n\s*build\/structured-callables\/dotnet\.json\n\s*build\/recursive-callables\/dotnet\.json\n\s*build\/compounds\/dotnet\.json\n\s*build\/lists\/dotnet\.json\n\s*build\/aliases\/dotnet\.json\n\s*build\/native-fin\/dotnet\.json\n\s*build\/native-fin\/dotnet-reviewed\.json\n\s*build\/native-specializations\/dotnet\.json\n\s*build\/generic-records\/dotnet\.json\n\s*build\/generic-records\/specialized-dotnet\.json\n\s*build\/native-fin-containers\/dotnet\.json\n\s*build\/native-fin-containers\/reviewed-dotnet\.json\n\s*build\/native-fin-products\/dotnet\.json\n\s*build\/native-fin-products\/reviewed-dotnet\.json\n\s*build\/native-fin-product-arrays\/dotnet\.json\n\s*build\/native-fin-product-arrays\/reviewed-dotnet\.json\n\s*build\/native-fin-records\/dotnet\.json\n\s*build\/native-fin-records\/reviewed-dotnet\.json\n\s*build\/native-subtype\/dotnet\.json\n\s*build\/variants\/dotnet\.json\n\s*build\/collections\/dotnet-conversions\.json\n\s*build\/collections\/dotnet\.json\n\s*build\/equality\/dotnet\.json\n\s*build\/recursive\/dotnet-values\.json\n\s*build\/recursive\/dotnet-conversions\.json\n\s*build\/recursive\/dotnet-native\.json\n\s*build\/recursive\/dotnet-packages\.json\n\s*build\/recursive\/dotnet-composition\.json\n\s*build\/recursive\/dotnet-reproducibility\.json\n\s*build\/recursive\/dotnet-conflicts\.json\n\s*build\/owned-dotnet-runtime\/\n\s*build\/owned-dotnet-layout\/\n\s*build\/owned-dotnet-values\/\n\s*build\/owned-dotnet-conversions\/\n\s*build\/owned-dotnet-callables\/\n\s*build\/owned-dotnet-callback-signatures\/\n\s*build\/owned-dotnet-loading\/\n\s*build\/owned-dotnet-packaging\/\n\s*build\/owned-dotnet-transfers\/\n\s*build\/owned-dotnet-transfer-packaging\/\n\s*build\/owned-dotnet-borrows\/\n\s*build\/owned-dotnet-borrow-packaging\/\n\s*build\/owned-dotnet-borrows\.log\n\s*build\/owned-dotnet-receivers\/\n\s*build\/owned-dotnet-receivers\.log\n\s*if-no-files-found: error/);
  assert.equal(packageDocument.scripts["test:type-corpus:c"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=c node --test tests/type-corpus.test.mjs");
  assert.equal(packageDocument.scripts["test:type-corpus:cpp"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=cpp node --test tests/type-corpus.test.mjs");
  assert.equal(packageDocument.scripts["test:type-corpus:c-family"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=c,cpp node --test tests/type-corpus.test.mjs");
  assert.match(workflow, /id: ordinary_c\n\s*if: matrix.profile == 'c-family'\n\s*continue-on-error: true/);
  assert.match(workflow, /id: type_corpus_c_family/);
  assert.match(workflow, /node --test tests\/native-c-family\.test\.mjs tests\/native-c-copied\.test\.mjs && npm run test:type-corpus:c-family/);
  assert.match(workflow, /steps\.ordinary_c\.outcome != 'success'/);
  assert.match(workflow, /steps\.type_corpus_c_family\.outcome != 'success'/);
  assert.match(workflow, /steps\.type_corpus_c_family\.outcome }}" != success/);
  assert.match(workflow, /name: type-corpus-c-family-\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /path: \|\n\s*build\/type-corpus\/c-cpp\.json\n\s*build\/type-corpus\/reviewed-native-c-cpp\.json\n\s*build\/char-native\/c-cpp\.json\n\s*build\/word-native\/c-cpp\.json\n\s*build\/callables\/c\.json\n\s*build\/structured-callables\/c\.json\n\s*build\/closure-thread\/installed\.json\n\s*build\/callables\/cpp\.json\n\s*build\/structured-callables\/cpp\.json\n\s*build\/native-recursive-callables\/transport\.json\n\s*build\/owned-aggregate-native\/transport\.json\n\s*build\/owned-aggregate-native\/values\.json\n\s*build\/owned-aggregate-native\/scalars\.json\n\s*build\/owned-aggregate-native\/public-c\.json\n\s*build\/owned-aggregate-native\/public-c-scalars\.json\n\s*build\/owned-transfers\/\n\s*build\/owned-transfer-packaging\/\n\s*build\/owned-borrows\/\n\s*build\/owned-borrows-runtime\.log\n\s*build\/owned-borrows-installed\.log\n\s*build\/owned-receivers\/\n\s*build\/owned-receivers\.log\n\s*build\/owned-aggregate-native\/reviewed-public-c\.json\n\s*build\/owned-c-packaging\/\n\s*build\/owned-host-callbacks\/ordinary\.json\n\s*build\/owned-host-callbacks\/reviewed\.json\n\s*build\/owned-host-packaging\/ordinary\.json\n\s*build\/owned-host-packaging\/reviewed\.json\n\s*build\/owned-cpp-runtime\/\n\s*build\/owned-cpp-callables\/\n\s*build\/owned-cpp-packaging\/ordinary\.json\n\s*build\/owned-cpp-packaging\/reviewed\.json\n\s*build\/owned-cpp-transfers\/\n\s*build\/owned-cpp-borrows\/\n\s*build\/owned-cpp-borrow-packaging\/\n\s*build\/owned-cpp-borrows\.log\n\s*build\/owned-cpp-receivers\/\n\s*build\/owned-cpp-receivers\.log\n\s*build\/owned-cpp-transfer-packaging\/\n\s*build\/recursive-callables\/c\.json\n\s*build\/recursive-callables\/cpp\.json\n\s*build\/recursive-callables\/c-family-documentation\.json\n\s*build\/compounds\/native\.json\n\s*build\/lists\/native\.json\n\s*build\/collections\/native\.json\n\s*build\/aliases\/native\.json\n\s*build\/native-fin\/native\.json\n\s*build\/native-fin\/native-reviewed\.json\n\s*build\/native-specializations\/c-cpp\.json\n\s*build\/reviewed-specializations\/c-cpp\.json\n\s*build\/native-fin-containers\/c-cpp\.json\n\s*build\/native-fin-containers\/reviewed-c-cpp\.json\n\s*build\/native-fin-products\/c-cpp\.json\n\s*build\/native-fin-products\/reviewed-c-cpp\.json\n\s*build\/native-fin-product-arrays\/c-cpp\.json\n\s*build\/native-fin-product-arrays\/reviewed-c-cpp\.json\n\s*build\/native-fin-records\/c-cpp\.json\n\s*build\/native-fin-records\/reviewed-c-cpp\.json\n\s*build\/native-subtype\/c-cpp\.json\n\s*build\/generic-records\/c-cpp\.json\n\s*build\/generic-records\/specialized-c-cpp\.json\n\s*build\/variants\/cpp\.json\n\s*build\/variants\/c\.json\n\s*build\/recursive\/c-family\.json\n\s*if-no-files-found: error/);
  assert.match(workflow, /LEAN_BRIDGE_NATIVE_COMPOUND_TEST=1 node --test tests\/native-compounds\.test\.mjs/);
  assert.match(workflow, /LEAN_BRIDGE_NATIVE_LIST_TEST=1 node --test tests\/native-lists\.test\.mjs/);
  assert.match(workflow, /test -s build\/lists\/native\.json/);
  assert.match(workflow, /LEAN_BRIDGE_NATIVE_COLLECTION_TEST=1 node --test tests\/native-collections\.test\.mjs/);
  assert.match(workflow, /test -s build\/collections\/native\.json/);
  assert.match(workflow, /LEAN_BRIDGE_NATIVE_ALIAS_TEST=1 node --test tests\/native-aliases\.test\.mjs/);
  assert.match(workflow, /node --test tests\/native-aliases\.test\.mjs\n\s*test -s build\/aliases\/native\.json\n\s*npm run test:native-fin\n\s*test -s build\/native-fin\/native\.json\n/);
  assert.match(workflow, /consumer_command="\$consumer_command && npm run test:native-fin"/);
  assert.equal(packageDocument.scripts["test:native-fin"], "LEAN_BRIDGE_NATIVE_FIN_TEST=1 LEAN_BRIDGE_NATIVE_FIN_INSTALLED_TEST=1 node --test --test-concurrency=1 tests/native-fin.test.mjs");
  assert.match(workflow, /LEAN_BRIDGE_CPP_VARIANT_TEST=1 node --test tests\/cpp-variants\.test\.mjs/);
  assert.match(workflow, /test -s build\/variants\/cpp\.json/);
  assert.match(workflow, /LEAN_BRIDGE_C_VARIANT_TEST=1 node --test tests\/c-variants\.test\.mjs/);
  assert.match(workflow, /test -s build\/variants\/c\.json/);
  assert.match(workflow, /LEAN_BRIDGE_NATIVE_GRAPH_PACKAGE_TEST=1 node --test tests\/native-graph-package\.test\.mjs/);
  assert.match(workflow, /test -s build\/recursive\/c-family\.json/);
  assert.match(workflow, /test -s build\/aliases\/native\.json/);
  assert.match(workflow, /id: type_corpus_rust/);
  assert.match(workflow, /node --test tests\/native-rust\.test\.mjs && npm run test:type-corpus:rust/);
  assert.match(workflow, /steps\.type_corpus_rust\.outcome != 'success'/);
  assert.match(workflow, /steps\.type_corpus_rust\.outcome }}" != success/);
  assert.match(workflow, /name: type-corpus-rust-\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /path: \|\n\s*build\/type-corpus\/rust\.json\n\s*build\/type-corpus\/reviewed-native-rust\.json\n\s*build\/char-native\/rust\.json\n\s*build\/word-native\/rust\.json\n\s*build\/callables\/rust\.json\n\s*build\/structured-callables\/rust\.json\n\s*build\/recursive-callables\/rust\.json\n\s*build\/owned-rust-runtime\/\n\s*build\/owned-rust-values\/\n\s*build\/owned-rust-transfers\/\n\s*build\/owned-rust-transfer-packaging\/\n\s*build\/owned-rust-borrows\/\n\s*build\/owned-rust-borrow-packaging\/\n\s*build\/owned-rust-borrows\.log\n\s*build\/owned-rust-receivers\/\n\s*build\/owned-rust-receivers\.log\n\s*build\/owned-rust-packaging\/ordinary\.json\n\s*build\/owned-rust-packaging\/reviewed\.json\n\s*build\/compounds\/rust\.json\n\s*build\/lists\/rust\.json\n\s*build\/aliases\/rust\.json\n\s*build\/native-fin\/rust\.json\n\s*build\/native-fin\/rust-reviewed\.json\n\s*build\/native-specializations\/rust\.json\n\s*build\/generic-records\/rust\.json\n\s*build\/generic-records\/specialized-rust\.json\n\s*build\/native-fin-containers\/rust\.json\n\s*build\/native-fin-containers\/reviewed-rust\.json\n\s*build\/native-fin-products\/rust\.json\n\s*build\/native-fin-products\/reviewed-rust\.json\n\s*build\/native-fin-product-arrays\/rust\.json\n\s*build\/native-fin-product-arrays\/reviewed-rust\.json\n\s*build\/native-fin-records\/rust\.json\n\s*build\/native-fin-records\/reviewed-rust\.json\n\s*build\/native-subtype\/rust\.json\n\s*build\/variants\/rust\.json\n\s*build\/collections\/rust-conversions\.json\n\s*build\/recursive\/rust-values\.json\n\s*build\/recursive\/rust-conversions\.json\n\s*build\/recursive\/rust-native\.json\n\s*build\/recursive\/rust-packages\.json\n\s*build\/collections\/rust\.json\n\s*if-no-files-found: error/);
  assert.equal(packageDocument.scripts["test:type-corpus:node"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=node-javascript,node-typescript node --test tests/type-corpus.test.mjs");
  assert.equal(packageDocument.scripts["test:type-corpus:browser"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=browser-javascript,browser-react,browser-worker node --test tests/type-corpus.test.mjs");
  assert.equal(packageDocument.scripts["test:type-corpus:npm"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=node-javascript,node-typescript,browser-javascript,browser-react,browser-worker node --test tests/type-corpus.test.mjs");
  assert.match(workflow, /id: type_corpus_npm/);
  assert.match(workflow, /LEAN_BRIDGE_TYPE_CORPUS_BROWSERS: chromium,firefox,webkit/);
  assert.match(workflow, /npm run test:consumer:node && npm run test:type-corpus:npm/);
  assert.match(workflow, /steps\.type_corpus_npm\.outcome != 'success'/);
  assert.match(workflow, /steps\.consumer\.outcome == 'success' && steps\.type_corpus_npm\.outcome == 'success'/);
  assert.match(workflow, /name: type-corpus-npm-\$\{\{ github\.sha \}\}/);
  assert.ok(workflow.includes("          LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test tests/browser-refinements.test.mjs\n          test -s build/browser-refinements/report.json\n"));
  assert.ok(workflow.includes("          node --test tests/unlocked-component.test.mjs\n          node --test tests/scalar-fin-rejection.test.mjs\n          test -s build/scalar-fin-rejection/report.json\n"));
  assert.ok(workflow.includes("          node --test tests/scalar-fin-rejection.test.mjs\n          test -s build/scalar-fin-rejection/report.json\n          node --test tests/generic-records.test.mjs\n          test -s build/generic-records/npm.json\n"));
  assert.ok(workflow.includes("          LEAN_BRIDGE_SUBTYPE_PROFILES=c,cpp node --test tests/native-subtype.test.mjs\n          test -s build/native-subtype/c-cpp.json\n          LEAN_BRIDGE_GENERIC_RECORD_PROFILES=c,cpp node --test tests/generic-records.test.mjs\n          test -s build/generic-records/c-cpp.json\n"));
  assert.match(workflow, /node --test tests\/component-char\.test\.mjs/);
  assert.match(workflow, /node --test tests\/component-words\.test\.mjs/);
  assert.match(workflow, /node --test tests\/component-callables\.test\.mjs/);
  assert.match(workflow, /test -s build\/callables\/npm\/report\.json/);
  assert.match(workflow, /node --test tests\/component-arrays\.test\.mjs/);
  assert.match(workflow, /test -s build\/arrays\/npm\/report\.json/);
  assert.match(workflow, /node --test tests\/component-records\.test\.mjs/);
  assert.match(workflow, /test -s build\/records\/npm\/report\.json/);
  assert.match(workflow, /node --test tests\/component-compounds\.test\.mjs/);
  assert.match(workflow, /test -s build\/compounds\/npm\/report\.json/);
  assert.match(workflow, /test -s build\/compounds\/recordless\/report\.json/);
  assert.match(workflow, /path: \|\n\s*build\/type-corpus\/browser-javascript-browser-react-browser-worker-node-javascript-node-typescript\.json\n\s*build\/type-corpus\/reviewed-wasm-browser-javascript-browser-react-browser-worker-node-javascript-node-typescript\.json\n\s*build\/browser-refinements\/report\.json\n\s*build\/scalar-fin-rejection\/report\.json\n\s*build\/generic-records\/npm\.json\n\s*build\/generic-records\/specialized-npm\.json\n\s*build\/char-npm\/\n\s*build\/word-npm\/\n\s*build\/callables\/npm\/\n\s*build\/structured-callables\/npm\/\n\s*build\/arrays\/npm\/\n\s*build\/records\/npm\/\n\s*build\/compounds\/\n\s*build\/lists\/npm\/\n\s*build\/variants\/npm\/\n\s*build\/aliases\/npm\/\n\s*build\/recursive\/npm\/\n\s*if-no-files-found: error/);
  assert.match(workflow, /node --test tests\/component-lists\.test\.mjs/);
  assert.match(workflow, /test -s build\/lists\/npm\/report\.json/);
  assert.match(workflow, /node --test tests\/component-variant-runtime\.test\.mjs tests\/component-variants\.test\.mjs/);
  assert.match(workflow, /test -s build\/variants\/npm\/report\.json/);
  assert.match(workflow, /node --test tests\/component-aliases\.test\.mjs/);
  assert.match(workflow, /test -s build\/aliases\/npm\/report\.json/);
  assert.match(workflow, /id: type_corpus_python/);
  assert.match(workflow, /npm run test:type-corpus:python/);
  assert.match(workflow, /steps\.type_corpus_python\.outcome != 'success'/);
  assert.match(workflow, /steps\.type_corpus_python\.outcome }}" != success/);
  assert.match(workflow, /name: type-corpus-python-\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /path: \|\n\s*build\/type-corpus\/python\.json\n\s*build\/type-corpus\/reviewed-native-python\.json\n\s*build\/char-native\/python\.json\n\s*build\/word-native\/python\.json\n\s*build\/callables\/python\.json\n\s*build\/structured-callables\/python\.json\n\s*build\/recursive-callables\/python\.json\n\s*build\/compounds\/python\.json\n\s*build\/lists\/python\.json\n\s*build\/aliases\/python\.json\n\s*build\/native-fin\/python\.json\n\s*build\/native-fin\/python-reviewed\.json\n\s*build\/native-specializations\/python\.json\n\s*build\/generic-records\/python\.json\n\s*build\/generic-records\/specialized-python\.json\n\s*build\/generic-records\/python312\.json\n\s*build\/generic-records\/specialized-python312\.json\n\s*build\/native-fin-containers\/python\.json\n\s*build\/native-fin-containers\/reviewed-python\.json\n\s*build\/native-fin-products\/python\.json\n\s*build\/native-fin-products\/reviewed-python\.json\n\s*build\/native-fin-products\/python312\.json\n\s*build\/native-fin-products\/reviewed-python312\.json\n\s*build\/native-fin-product-arrays\/python\.json\n\s*build\/native-fin-product-arrays\/reviewed-python\.json\n\s*build\/native-fin-product-arrays\/python312\.json\n\s*build\/native-fin-product-arrays\/reviewed-python312\.json\n\s*build\/native-fin-records\/python\.json\n\s*build\/native-fin-records\/reviewed-python\.json\n\s*build\/native-fin-records\/python312\.json\n\s*build\/native-fin-records\/reviewed-python312\.json\n\s*build\/native-subtype\/python\.json\n\s*build\/variants\/python\.json\n\s*build\/collections\/python\.json\n\s*build\/collections\/python-docs\.json\n\s*build\/recursive\/python-values\.json\n\s*build\/recursive\/python-conversions\.json\n\s*build\/recursive\/python-native\.json\n\s*build\/recursive\/python-packages\.json\n\s*build\/owned-python-runtime\/\n\s*build\/owned-python-values\/\n\s*build\/owned-python-transfers\/\n\s*build\/owned-python-transfer-packaging\/\n\s*build\/owned-python-borrows\/\n\s*build\/owned-python-borrow-packaging\/\n\s*build\/owned-python-borrows\.log\n\s*build\/owned-python-receivers\/\n\s*build\/owned-python-receivers\.log\n\s*build\/owned-python-packaging\/\n\s*if-no-files-found: error/);
  assert.match(workflow, /LEAN_BRIDGE_PYTHON_VARIANT_TEST=1 node --test tests\/python-variants\.test\.mjs/);
  assert.match(workflow, /test -s build\/variants\/python\.json/);
  assert.match(workflow, /id: type_corpus_ruby/);
  assert.match(workflow, /npm run test:type-corpus:ruby/);
  assert.match(workflow, /steps\.type_corpus_ruby\.outcome != 'success'/);
  assert.match(workflow, /steps\.type_corpus_ruby\.outcome }}" != success/);
  assert.match(workflow, /name: type-corpus-ruby-\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /path: \|\n\s*build\/type-corpus\/ruby\.json\n\s*build\/type-corpus\/reviewed-native-ruby\.json\n\s*build\/char-native\/ruby\.json\n\s*build\/word-native\/ruby\.json\n\s*build\/callables\/ruby\.json\n\s*build\/structured-callables\/ruby\.json\n\s*build\/recursive-callables\/ruby\.json\n\s*build\/compounds\/ruby\.json\n\s*build\/lists\/ruby\.json\n\s*build\/aliases\/ruby\.json\n\s*build\/native-fin\/ruby\.json\n\s*build\/native-fin\/ruby-reviewed\.json\n\s*build\/native-specializations\/ruby\.json\n\s*build\/generic-records\/ruby\.json\n\s*build\/generic-records\/specialized-ruby\.json\n\s*build\/native-fin-containers\/ruby\.json\n\s*build\/native-fin-containers\/reviewed-ruby\.json\n\s*build\/native-fin-products\/ruby\.json\n\s*build\/native-fin-products\/reviewed-ruby\.json\n\s*build\/native-fin-product-arrays\/ruby\.json\n\s*build\/native-fin-product-arrays\/reviewed-ruby\.json\n\s*build\/native-fin-records\/ruby\.json\n\s*build\/native-fin-records\/reviewed-ruby\.json\n\s*build\/native-subtype\/ruby\.json\n\s*build\/variants\/ruby\.json\n\s*build\/collections\/ruby\.json\n\s*build\/recursive\/ruby-values\.json\n\s*build\/recursive\/ruby-conversions\.json\n\s*build\/recursive\/ruby-native\.json\n\s*build\/recursive\/ruby-packages\.json\n\s*build\/owned-ruby-runtime\/\n\s*build\/owned-ruby-values\/\n\s*build\/owned-ruby-layout\/\n\s*build\/owned-ruby-conversions\/\n\s*build\/owned-ruby-gmp\/\n\s*build\/owned-ruby-loading\/\n\s*build\/owned-ruby-transfers\/\n\s*build\/owned-ruby-transfer-packaging\/\n\s*build\/owned-ruby-borrows\/\n\s*build\/owned-ruby-borrow-packaging\/\n\s*build\/owned-ruby-borrows\.log\n\s*build\/owned-ruby-receivers\/\n\s*build\/owned-ruby-receivers\.log\n\s*build\/owned-ruby-packaging\/\n\s*if-no-files-found: error/);
  assert.match(workflow, /LEAN_BRIDGE_NATIVE_PHP_TEST: "1"/);
  assert.match(workflow, /id: ordinary_php/);
  assert.match(workflow, /LEAN_BRIDGE_PHP_WASM_ZEND_TEST: "1"/);
  assert.match(workflow, /id: copied_zend/);
  assert.match(workflow, /steps\.copied_zend\.outcome != 'success'/);
  const ordinaryPhpWasm = workflow.split("id: ordinary_php_wasm\n")[1].split("      - name:")[0];
  assert.match(ordinaryPhpWasm, /LEAN_BRIDGE_PHP_WASM_ORDINARY_TEST: "1"/);
  assert.match(ordinaryPhpWasm, /LEAN_BRIDGE_PHP_WASM_BROWSER_TEST: "1"/);
  assertDependencyStep(workflow, "ordinary_php_wasm", "npx playwright install --with-deps chromium");
  assert.match(ordinaryPhpWasm, /node --test tests\/php-wasm-ordinary\.test\.mjs/);
  assert.match(workflow, /steps\.ordinary_php_wasm\.outcome != 'success'/);
  assert.match(workflow, /steps\.ordinary_php\.outcome != 'success'/);
  assert.match(workflow, /php-cli php-common composer/);
  assert.match(packageDocument.scripts["test:consumer:browser"], /\.\#npm-package/);
  assert.match(packageDocument.scripts["test:consumer:php-native"], /\.\#php-native-package/);
  assert.match(packageDocument.scripts["test:consumer:managed"], /\.\#nuget-package/);
  assert.match(packageDocument.scripts["test:consumer:managed"], /\.\#maven-package/);
  assert.match(packageDocument.scripts["test:consumer:managed"], /\.\#rubygems-package/);
  assert.match(workflow, /GITHUB_STEP_SUMMARY|consumer-ci\.mjs summary/);
  assert.match(workflow, /pattern: consumer-results-\*-\$\{\{ github\.sha \}\}/);
  assert.doesNotMatch(workflow, /consumer-(?:results|support-report)[^\n]*github\.run_attempt/);
  assert.equal((workflow.match(/^\s*overwrite: true$/gm) ?? []).length, 17);
  assert.match(workflow, /uses: \.\/\.github\/workflows\/perl-consumer\.yml/);
  assert.match(workflow, /needs:[\s\S]*- perl-consumer/);
  assert.match(perlWorkflow, /node-version: "22"/);
  assert.match(perlWorkflow, /npm ci --ignore-scripts/);
  assert.match(perlWorkflow, /bootstrap-toolchains\.sh --lean-only/);
  assert.match(perlWorkflow, /npm run test:consumer:perl/);
  assert.equal(packageDocument.scripts["test:type-corpus:perl"], "LEAN_BRIDGE_TYPE_CORPUS_PROFILES=perl node --test tests/type-corpus.test.mjs");
  assert.match(perlWorkflow, /npm run test:type-corpus:perl/);
  assert.match(perlWorkflow, /LEAN_BRIDGE_CORPUS_PERL="\$PWD\/\.toolchains\/perl\/\$CORPUS_PERL_CONFIGURATION\/bin\/perl"/);
  assert.match(perlWorkflow, /name: type-corpus-perl-\$\{\{ matrix\.configuration \}\}-\$\{\{ github\.sha \}\}/);
  assert.match(perlWorkflow, /path: \|\n\s*build\/type-corpus\/perl\.json\n\s*build\/type-corpus\/reviewed-native-perl\.json\n\s*build\/char-native\/perl\.json\n\s*build\/word-native\/perl\.json\n\s*build\/callables\/perl\.json\n\s*build\/structured-callables\/perl\.json\n\s*build\/recursive-callables\/perl\.json\n\s*build\/compounds\/perl\.json\n\s*build\/lists\/perl\.json\n\s*build\/collections\/perl\.json\n\s*build\/aliases\/perl\.json\n\s*build\/native-fin\/perl\.json\n\s*build\/native-fin\/perl-reviewed\.json\n\s*build\/native-specializations\/perl\.json\n\s*build\/generic-records\/perl\.json\n\s*build\/generic-records\/specialized-perl\.json\n\s*build\/native-fin-containers\/perl\.json\n\s*build\/native-fin-containers\/reviewed-perl\.json\n\s*build\/native-fin-products\/perl\.json\n\s*build\/native-fin-products\/reviewed-perl\.json\n\s*build\/native-fin-product-arrays\/perl\.json\n\s*build\/native-fin-product-arrays\/reviewed-perl\.json\n\s*build\/native-fin-records\/perl\.json\n\s*build\/native-fin-records\/reviewed-perl\.json\n\s*build\/native-subtype\/perl\.json\n\s*build\/perl-refinements\/perl\.json\n\s*build\/variants\/perl\.json\n\s*build\/recursive\/perl-values\.json\n\s*build\/recursive\/perl-conversions\.json\n\s*build\/recursive\/perl-native\.json\n\s*build\/recursive\/perl-packages\.json\n\s*build\/recursive\/perl-component-collision\.json\n\s*build\/recursive\/perl-composition\.json\n\s*build\/recursive\/perl-documentation\.json\n\s*build\/owned-perl-runtime\/\n\s*build\/owned-perl-conversions\/\n\s*build\/owned-perl-calls\/\n\s*build\/owned-perl-scalars\/\n\s*build\/owned-perl-loader\/\n\s*build\/owned-perl-package\/\n\s*build\/owned-perl-transfers\/\n\s*build\/owned-perl-transfer-packaging\/\n\s*build\/owned-perl-borrows\/\n\s*build\/owned-perl-borrow-packaging\/\n\s*if-no-files-found: error/);
  assert.match(perlWorkflow, /export LEAN_BRIDGE_OWNED_NATIVE_TEST=1/);
  for(const name of ["runtime", "values", "conversions", "xs", "scalars", "loader", "package", "coexistence"])
    assert.ok(perlWorkflow.includes("tests/owned-perl-" + name + ".test.mjs"), name);
  assert.ok(perlWorkflow.includes("npm run test:owned-perl-transfers"));
  assert.ok(packageDocument.scripts["test:owned-perl-transfers"].includes("tests/owned-perl-documentation.test.mjs"));
  for(const report of ["ordinary", "reviewed", "callbacks-ordinary", "callbacks-reviewed", "coexistence", "documentation"])
    assert.ok(perlWorkflow.includes("test -s build/owned-perl-package/" + report + ".json"), report);
  assert.ok(perlWorkflow.includes("LEAN_BRIDGE_PERL_RECURSIVE_CALLABLE_TEST=1 node --test --test-concurrency=1 tests/perl-recursive-callables.test.mjs tests/perl-recursive-callable-contract.test.mjs"));
  assert.match(perlWorkflow, /test -s build\/recursive-callables\/perl\.json/);
  assert.match(perlWorkflow, /needs\.perl\.result == 'success'/);
  assert.match(perlWorkflow, /nix run \.#perl-build-engine/);
  assert.match(perlWorkflow, /nix shell --inputs-from \. nixpkgs#perl/);
  const consumerWorkflows = `${workflow}\n${perlWorkflow}`;
  const contract = await readConsumerSupport();
  const managed = assertManagedCiIsolation(workflow);
  const native = assertNativeCiIsolation(workflow, JSON.parse(await readFile("tests/fixtures/ci/native-acceptance-before-isolation.json")));
  for(const consumer of contract.consumers)
{
    if(!managed.profiles.includes(consumer.id) && !native.selectedConsumers.includes(consumer.id))
      assert.match(consumerWorkflows, new RegExp(`(?:--consumer |consumer in [^\\n]*)${consumer.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    if(["python", "rust", "c", "cpp", "dotnet", "jvm", "ruby"].includes(consumer.id))
{
      assert.match(workflow, /--performance "build\/consumer-ci\/performance\/\$consumer\.json"/);
} else
{
      assert.match(consumerWorkflows, new RegExp(`--performance [^\\n]*${consumer.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.json`));
}
}
});

test("Python consumers run the exact wheel compatibility preflight before pip", async () => {
	const [guide, packageDocument] = await Promise.all([
		readFile("docs/consume/python.md", "utf8")
		, readFile("package.json", "utf8").then(JSON.parse)
	]);
	assert.equal(packageDocument.scripts["preflight:python-wheel"], "node src/release/python-wheel-preflight.mjs");
	assert.match(guide, /node \.\/python-wheel-preflight\.mjs/);
	assert.match(guide, /glibc 2\.38 or newer/);
	assert.match(guide, /Python 3\.11 or newer/);
	assert.match(guide, /Do not rename, retag, or unpack the (?:wheel|archive)/);
});
