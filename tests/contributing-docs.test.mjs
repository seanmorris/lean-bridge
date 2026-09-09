/**
 * Keep contributor procedures separate from package author and recipient guides.
 *
 * @file
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { docPages } from "../site/registry.mjs";

test("Contributing owns six canonical guides and keeps the established audience order", () => {
	assert.deepEqual([...new Set(docPages.map(page => page.group))],
		["Start", "Author", "Consume", "Publish", "Contributing", "Concepts", "Reference"]);
	assert.deepEqual(docPages.filter(page => page.group === "Contributing").map(page => [page.route, page.source]), [
		["/docs/contributing/", "CONTRIBUTING.md"]
		, ["/docs/contributing/documentation/", "site/README.md"]
		, ["/docs/contributing/demos/", "demos/README.md"]
		, ["/docs/contributing/testing/", "docs/contributing/testing.md"]
		, ["/docs/contributing/release-pipeline/", "src/release/README.md"]
		, ["/docs/contributing/github-pages/", "docs/contributing/github-pages.md"]
	]);
	assert.equal(docPages.filter(page => !page.legacy).length, 46);
	assert.ok(docPages.filter(page => page.group === "Contributing").every(page => !page.legacy));
});

test("maintainer builds and acceptance checks have one contributor destination", async () => {
	const testing = await readFile("docs/contributing/testing.md", "utf8");
	for(const heading of [
		"Build the example artifacts as a maintainer"
		, "Managed packages"
		, "Native PHP package"
		, "WASI package", "Author acceptance", "JavaScript and browser acceptance"
		, "Consumer acceptance", "Release tooling checks"
	]) assert.ok(testing.includes(`## ${heading}\n`), heading);
	for(const command of [
		"check-lean-author-tutorial.mjs"
		, "check-component-browser-consumer.mjs"
		, "test:consumer:native"
		, "test:consumer:managed"
		, "test:php-release"
		, "test:release-rehearsal"
		, "test:release-authorization"
		, "test:publication-attestation"
		, "test:registry-transaction"
		, "tests/npm-registry-adapter.test.mjs"
		, "test:release-receipt"
	]) assert.ok(testing.includes(command), command);
	for(const page of docPages.filter(page => page.consumerIds?.length))
	{
		const source = await readFile(page.source, "utf8");
		assert.match(source, /contributing\/testing\.md#/u, `${page.id}: contributor checks are linked`);
		assert.doesNotMatch(source, /npm run (?:acceptance:docs:|test:consumer:)/u,
			`${page.id}: checkout-only runners stay in Contributing`);
	}
});

test("Publishing retains operational checks and links contributor-owned policy and deployment", async () => {
	const [overview, sandbox, production, pipeline] = await Promise.all([
		"docs/publishing.md"
		, "docs/publish/sandbox-release.md"
		, "docs/publish/production-release.md"
		, "src/release/README.md"
	].map(file => readFile(file, "utf8")));
	assert.ok(overview.includes("contributing/github-pages.md"));
	assert.ok(overview.includes("publish/nix.md"), "Signed Nix packages remain in Publishing");
	assert.ok(sandbox.includes("npm run release:rehearse"));
	assert.ok(sandbox.includes("contributing/testing.md#release-tooling-checks"));
	assert.doesNotMatch(sandbox, /npm run test:release-/u);
	for(const command of ["deployment:check", "verify:release-authorization", "verify:release-receipt"])
		assert.ok(production.includes(`npm run ${command}`), command);
	assert.ok(production.includes("release/README.md#project-release-approval-policy"));
	for(const role of ["release owner", "runtime owner", "security owner"])
		assert.ok(pipeline.toLowerCase().includes(role), role);
	assert.ok(pipeline.includes("createCliHandlers"));
	for(const page of docPages.filter(page => page.group === "Publish" && !page.legacy))
	{
		assert.doesNotMatch(await readFile(page.source, "utf8"), /npm run test:(?:consumer:|php-release)/u,
			`${page.id}: repository-wide fixture checks link to Contributing`);
	}
});
