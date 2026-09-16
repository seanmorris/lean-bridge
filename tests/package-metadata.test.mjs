/**
 * Package declarations are bounded data tied to the exact captured source.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { validateExportConfiguration, assertExportConfigurationCapabilities } from "../src/analyze/export-configuration.mjs";
import { cargoPackageMetadata, compiledPackageMetadata, composerPackageMetadata, cpanPackageMetadata, metadataXml
	, npmPackageMetadata, pythonPackageMetadata, verifyPackageMetadataSource } from "../src/analyze/package-metadata.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";
import { packageMetadataFixture } from "./helpers/package-metadata.mjs";

test("shared package metadata is optional, closed and schema-checked", async () => {
	for(const metadata of [{}, packageMetadataFixture("shop"), { authors: [{ name: "Independent library team" }] }])
	{
		const configuration = { schemaVersion: 1, package: metadata };
		assert.equal(validateExportConfiguration(configuration), configuration);
		await assertJsonSchema("lean-export-configuration", configuration);
		if(Object.keys(metadata).length) assert.throws(() => assertExportConfigurationCapabilities(configuration, { target: "unsupported" }), /does not yet implement package/);
	}
});

test("metadata rejects header injection, malformed text, credentials and undeclared fields", async () => {
	for(const metadata of [
		null, [], { name: "not a coordinate" }, { license: "MIT" }
		, { description: "" }, { description: " padded" }
		, { description: "newline\nHeader: value" }
		, { description: "null\u0000" }, { description: "c1\u0085" }
		, { description: "a".repeat(513) }, { authors: [] }
		, { authors: Array.from({ length: 33 }, (_, i) => ({ name: String(i) })) }
		, { authors: [{ name: "A" }, { name: "A" }] }, { authors: ["A"] }
		, { authors: [{}] }, { authors: [{ name: "A", role: "owner" }] }
		, { authors: [{ name: "A", email: "A <a@example.org>" }] }
		, { homepage: "javascript:alert(1)" }, { homepage: "http://example.org" }
		, { homepage: "https://user:secret@example.org" }
		, { homepage: "https:/example.org" }
		, { homepage: "https:///example.org" }
		, { homepage: "https://example.org?" }
		, { homepage: "https://example.org#" }
		, { repository: "https://example.org/repo?token=secret" }
		, { repository: "https://example.org/repo#main" }
		, { repository: "https://example.org\\repo" }
		, { authors: [{ name: "A", url: "file:///tmp/repo" }] }
	]) {
		const configuration = { schemaVersion: 1, package: metadata };
		assert.throws(() => validateExportConfiguration(configuration), { code: "invalid-export-configuration" });
		await assert.rejects(assertJsonSchema("lean-export-configuration", configuration));
	}
	// JSON Schema counts Unicode characters; the compiler also bounds UTF-8 bytes.
	for(const description of ["é".repeat(257), "\ud800", "line\u2028break", "line\u2029break", "invalid\ufffe", "invalid\uffff"])
		assert.throws(() => validateExportConfiguration({ schemaVersion: 1, package: { description } }));
});

test("compiled metadata survives without a source directory and rejects resealed changes", () => {
	const configuration = { schemaVersion: 1, package: packageMetadataFixture("library") };
	const source = JSON.stringify(configuration, null, 2) + "\n";
	const identity = { exportConfigurationSource: source, exportConfigurationSha256: sha256(canonicalJson(configuration)) };
	const inputs = [{ path: "lean-bridge.exports.json", bytes: Buffer.byteLength(source), sha256: sha256(source) }];
	assert.deepEqual(verifyPackageMetadataSource(identity, inputs), configuration.package);
	assert.deepEqual(compiledPackageMetadata(identity), configuration.package);
	const changed = { ...configuration, package: { ...configuration.package, description: "Different author declaration" } };
	for(const bad of [
		{ ...identity, exportConfigurationSource: source.trim() }
		, { ...identity, exportConfigurationSource: null }
		, { ...identity, exportConfigurationSha256: "0".repeat(64) }
		, { exportConfigurationSource: JSON.stringify(changed), exportConfigurationSha256: sha256(canonicalJson(changed)) }
	]) assert.throws(() => verifyPackageMetadataSource(bad, inputs), /differs/);
	assert.throws(() => verifyPackageMetadataSource(identity, []), /differs/);
	assert.deepEqual(verifyPackageMetadataSource({ exportConfigurationSource: null, exportConfigurationSha256: sha256(canonicalJson({ schemaVersion: 1 })) }, []), {});
});

test("ecosystem projections preserve author data and escape generated syntax", () => {
	const metadata = packageMetadataFixture("shop");
	assert.deepEqual(npmPackageMetadata(metadata).author, metadata.authors[0]);
	assert.deepEqual(npmPackageMetadata(metadata).contributors, metadata.authors.slice(1));
	assert.equal(composerPackageMetadata(metadata).authors[0].homepage, metadata.authors[0].url);
	assert.equal(composerPackageMetadata(metadata).support.source, metadata.repository);
	assert.deepEqual(cpanPackageMetadata(metadata).author, metadata.authors.map(({ name, email }) => `${name}${email ? ` <${email}>` : ""}`));
	assert.ok(cargoPackageMetadata(metadata).includes(`description = ${JSON.stringify(metadata.description)}`));
	assert.ok(pythonPackageMetadata(metadata).includes(`Summary: ${metadata.description}\n`));
	assert.equal(metadataXml('<&>"\''), "&lt;&amp;&gt;&quot;&apos;");
	for(const project of [npmPackageMetadata, composerPackageMetadata, cpanPackageMetadata]) assert.deepEqual(project({}), {});
});
