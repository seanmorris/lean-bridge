/**
 * Preserve the two reader workflows and the documentation addresses they replace.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { docPages, documentationGroups } from "./registry.mjs";
import { compileDocumentationPage } from "../scripts/generate-site-content.mjs";
import compatibility from "../tests/fixtures/documentation/workflow-compatibility.json" with { type: "json" };
import bookmarks from "../tests/fixtures/documentation/workflow-bookmarks.json" with { type: "json" };

const compiled = new Map();
const readPage = page => {
	if(!compiled.has(page.route)) compiled.set(page.route, readFile(page.source, "utf8")
		.then(source => compileDocumentationPage(source, page, { revision: "0".repeat(40) })));
	return compiled.get(page.route);
};

test("two workflows own target guides while bridge release procedures belong to contributors", () => {
	assert.deepEqual(documentationGroups, ["Start", "Build and publish", "Use a package", "Concepts", "Reference", "Contributing"]);
	assert.ok(docPages.every(page => documentationGroups.includes(page.group)));
	for(const page of docPages.filter(page => page.id.startsWith("publish-") && !page.legacy))
		assert.equal(page.group, "Build and publish", page.id);
	for(const id of ["contributing-sandbox", "contributing-production", "contributing-author-setup"])
		assert.equal(docPages.find(page => page.id === id).group, "Contributing");
	assert.equal(docPages.find(page => page.id === "runtimes").group, "Reference");
	assert.deepEqual(docPages.filter(page => page.section === "Target languages").map(page => page.navTitle), [
		"JavaScript and TypeScript", "Python", "Rust", "C", "C++", "C# / .NET"
		, "Java and Kotlin", "Ruby", "Perl", "PHP", "WIT / WASI"
	]);
});

test("source intake describes new and existing libraries without widening target capabilities", async () => {
	const hub = await readFile("docs/lean-author-guide.md", "utf8");
	for(const link of ["lean/first-component.md", "lean/existing-package.md", "publishing.md", "consume.md"])
		assert.ok(hub.includes(`](${link}`), link);
	const exports = await readFile("docs/lean/export-decisions.md", "utf8");
	assert.match(exports, /produce unsupported diagnostics in this profile/);
	assert.match(exports, /## Native Perl exports/);
	assert.match(exports, /\[locked Lake dependencies\]\(\.\.\/publish\/cpan\.md#build-with-locked-lake-dependencies\)/);
	assert.match(exports, /Open generics, dependent signatures, recursive copied structures, asynchronous operations, and retained host callbacks require further work/);
	const existing = await readFile("docs/lean/existing-package.md", "utf8");
	assert.match(existing, /### Generate the public entry module/);
	assert.match(existing, /engine runs declared generators against captured inputs/);
	assert.match(existing, /uses the pinned Nix or Docker engine to compile fresh Lean interfaces/);
	assert.match(existing, /Missing backends and compiler errors never fall back to source-scanned signatures/);
	assert.match(existing, /metadata\/lake-entry-exports\.json/);
	const targets = await readFile("docs/publishing.md", "utf8");
	assert.match(targets, /Repeat `--target` to build from one captured source tree/);
	assert.match(targets, /CLI target `php-native` or `php-wasm`/);
	assert.match(targets, /JavaScript-Wasm for npm, and separately for PHP-Wasm/);
	assert.match(targets, /\[pip \/ PyPI\]\(publish\/pypi\.md\) \| An ordinary Lake project with pure copied primitives, arrays and acyclic records; CLI target `pypi`/);
	assert.match(targets, /\[Maven\]\(publish\/maven\.md\) \| An ordinary Lake project with copied primitives, arrays, acyclic records, options, results, products and synchronous primitive callables; CLI target `maven`/);
	assert.match(targets, /\[RubyGems\]\(publish\/rubygems\.md\) \| An ordinary Lake project with pure copied primitives, arrays and acyclic records; CLI target `rubygems`/);
	assert.match(targets, /\[NuGet\]\(publish\/nuget\.md\) \| An ordinary Lake project with copied primitives, arrays, acyclic records, options, results, products and synchronous primitive callables; CLI target `nuget`/);
	assert.match(targets, /\[Component and archive distribution\]\(publish\/wit-wasi\.md\) \| An ordinary Lake project with pure copied primitives, arrays and acyclic records; CLI target `wit-wasi`/);
	assert.match(targets, /Lean compiles once per required ABI/);
	assert.match(targets, /does not require Lean Bridge's internal deployment-profile approvals/);
});

test("general author pages include every target language and conversion reference", async () => {
	const inventory = JSON.parse(await readFile("docs/type-surface.v1.json", "utf8"));
	const { typeGuideProfiles } = await import("../scripts/generate-type-docs.mjs");
	const existing = await readFile("docs/lean/existing-package.md", "utf8");
	const exports = await readFile("docs/lean/export-decisions.md", "utf8");
	const setup = await readFile("docs/lean/setup.md", "utf8");
	for(const profile of inventory.profiles)
	{
		const guide = Object.entries(typeGuideProfiles).find(([, profiles]) => profiles.includes(profile.id));
		assert.ok(guide, `Missing conversion guide for ${profile.id}`);
		const relative = `../${guide[0].slice("docs/".length)}`;
		assert.ok(exports.includes(`](${relative}#type-conversions)`), profile.id);
		assert.ok(existing.includes(`](${relative})`), profile.id);
	}
	for(const page of docPages.filter(page => page.section === "Target languages"))
	{
		const relative = `../${page.source.slice("docs/".length)}`;
		assert.ok(setup.includes(`](${relative}`), page.id);
	}
	assert.match(existing, /## Configure exports/);
	assert.doesNotMatch(existing, /lean-bridge\.native\.json|Migrate the Perl-only configuration/);
	assert.match(exports, /## Choose value and callable semantics/);
	assert.match(exports, /## Check each consumer representation/);
});

test("every moved guide preserves its headings and forwards to the intended canonical section", async () => {
	for(const migration of compatibility)
	{
		const oldPage = docPages.find(page => page.route === migration.route);
		const newPage = docPages.find(page => page.route === migration.target);
		assert.equal(oldPage.legacy, true, migration.id);
		assert.ok(newPage && !newPage.legacy, migration.target);
		const old = await readPage(oldPage), current = await readPage(newPage);
		for(const [depth, id, target] of migration.headings)
		{
			assert.ok(old.metadata.headings.some(heading => heading.id === id && heading.depth === depth), `${migration.id}#${id}`);
			assert.ok(current.metadata.headings.some(heading => heading.id === target), `${migration.target}#${target}`);
			assert.ok(old.links.some(link => new URL(link, `https://docs.invalid${migration.route}`).pathname === migration.target
				&& new URL(link, `https://docs.invalid${migration.route}`).hash === `#${target}`), `${migration.id}: link to ${target}`);
		}
	}
});

test("established guide routes and section bookmarks survive the content reorganization", async () => {
	for(const bookmark of bookmarks)
	{
		const page = docPages.find(entry => entry.route === bookmark.route);
		assert.ok(page, bookmark.route);
		const result = await readPage(page);
		for(const id of bookmark.headings)
			assert.ok(result.metadata.headings.some(heading => heading.id === id), `${bookmark.route}#${id}`);
	}
});

test("the PHP author page retains both package managers without duplicating its recipe", async () => {
	const author = await readFile("docs/publish/php.md", "utf8");
	for(const text of ["Native PHP with Composer", "PHP-Wasm with npm", "build-php-native-package.mjs", "npm pack", "Recover"])
		assert.ok(author.includes(text), text);
	const npm = await readFile("docs/publish/npm.md", "utf8");
	const section = npm.split("## Publish the PHP-Wasm profile\n")[1].split("## Recover a failed upload")[0];
	assert.ok(section.includes("php.md#php-wasm-with-npm"));
	assert.doesNotMatch(section, /```/);
});
