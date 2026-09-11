/**
 * Keep named language guides ahead of incidental mentions in search results.
 *
 * @file
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { docPages } from "./registry.mjs";
import { searchDocumentation } from "./search.mjs";

test("language searches rank the primary guide ahead of body and partial-name matches", async () => {
	const entries = await Promise.all(docPages.filter(page => !page.legacy).map(async page => ({
		...page, searchText: await readFile(page.source, "utf8")
	})));
	for(const [query, expected] of [
		["Java", "java"]
		, ["C", "c"]
		, ["C++", "cpp"]
		, ["C#", "dotnet"]
		, [".NET", "dotnet"]
		, ["C#/.NET", "dotnet"], ["C# / .NET", "dotnet"], ["Python", "python"]
		, ["Rust", "rust"], ["Kotlin", "kotlin"], ["Ruby", "ruby"]
		, ...["JavaScript", "JS", "TypeScript", "TS", "Browser", "Browser JavaScript", "React", "worker", "Workers", "Browser Workers", "Node.js"]
			.map(query => [query, "javascript-typescript"])
		, ...["npm", "PyPI", "Cargo", "NuGet", "Maven", "RubyGems", "CPAN", "Nix"].map(query => [query, `publish-${query.toLowerCase()}`])
		, ["Composer", "publish-php"], ["Packagist", "publish-php"]
		, ["PHP", "php"], ["PHP-Wasm", "php"], ["Native PHP", "php"], ["Perl", "perl"]
		, ["Publish Python", "publish-pypi"], ["Publish PHP", "publish-php"]
		, ["Contributing", "contributing"]
		, ["Site development", "contributing-documentation"]
		, ["Demo testing", "contributing-demos"]
		, ["Acceptance tests", "contributing-testing"]
		, ["Signer integration", "contributing-release-pipeline"]
		, ["GitHub Pages", "contributing-pages"]
	]){
		const results = searchDocumentation(entries, query);
		assert.equal(results[0]?.id, expected, query);
		assert.ok(results.length <= 6);
		assert.ok(results.every(entry => !entry.legacy));
	}
});

test("combined guides rank their aliases without hiding distinct language names", () => {
	const entries = [
		{ title: "Overview", searchText: "JavaScript TypeScript React Workers Java" }
		, { title: "JavaScript and browser apps", searchText: "Use the package", searchAliases: ["JavaScript", "JS", "TypeScript", "TS", "Browser", "React", "Workers"] }
		, { title: "Java", searchText: "Use the JVM package" }
	];
	for(const query of ["JavaScript", "JS", "typescript", "TS", "browser", "react", "worker", "workers", "type"])
		assert.equal(searchDocumentation(entries, query)[0], entries[1], query);
	assert.equal(searchDocumentation(entries, "java")[0], entries[2]);
	assert.deepEqual(entries[1].searchAliases, ["JavaScript", "JS", "TypeScript", "TS", "Browser", "React", "Workers"]);
});

test("title matches beat body matches and preserve index order within each rank", () => {
	const entries = [
		{ title: "Installation", searchText: "Learn about Python packages" }
		, { title: "Python deployment", searchText: "Deploy the package" }
		, { title: "Use Python", searchText: "Call the component" }
		, { title: "Python", searchText: "Get started" }
		, { title: "Another guide", searchText: "Python is supported" }
	];
	assert.deepEqual(searchDocumentation(entries, "  pYtHoN "), [entries[3], entries[1], entries[2], entries[0], entries[4]]);
	assert.deepEqual(searchDocumentation(entries, "Python", 2), [entries[3], entries[1]]);
	assert.equal(entries[0].title, "Installation", "Ranking must not reorder the shared index");
	assert.deepEqual(searchDocumentation(entries, " \n "), []);
	assert.deepEqual(searchDocumentation(entries, "no matching text"), []);
	assert.deepEqual(searchDocumentation([], "Python"), []);
});
