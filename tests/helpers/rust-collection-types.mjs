/**
 * Compile independent valid and invalid Rust collection callers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { captureRustCompiler } from "./type-corpus-rust.mjs";

/**
 * Check the public caller without executing an algorithm, then reject bad programs.
 *
 * @param options - Prepared Cargo consumer and its isolated compiler environment.
 * @param options.root - Consumer project with a collections-api dependency.
 * @param options.cargo - Absolute Cargo executable.
 * @param options.environment - Explicit offline compiler environment.
 */
export const checkRustCollectionTypes = async ({ root, cargo, environment }) => {
	const source = await readFile("tests/fixtures/collection-consumers/rust.rs", "utf8");
	await saveLakeFile(root, "src/main.rs", source);
	await runCopied(cargo, ["check", "--locked", "--offline", "--bin", "collection-consumer"], root, environment);
	const invalid = await readFile("tests/fixtures/collection-consumers/rust-invalid.json", "utf8"), rejected = [];
	for(const { name, statement, code } of JSON.parse(invalid))
	{
		const source = `use collections_api as api; fn main() { ${statement} }\n`;
		await saveLakeFile(root, `src/bin/${name}.rs`, source);
		const result = await captureRustCompiler(cargo, ["check", "--locked", "--offline", "--bin", name, "--message-format=json"], root, environment);
		assert.equal(result.code, 101, result.stderr);
		const diagnostics = result.stdout.trim().split("\n").map(line => JSON.parse(line)).filter(message => message.reason === "compiler-message" && message.message.level === "error");
		assert.ok(diagnostics.length > 0, name);
		for(const { message } of diagnostics)
		{
			assert.equal(message.code?.code, code, message.rendered);
			const primary = message.spans.filter(span => span.is_primary).map(span => {
				while(span.expansion?.span) span = span.expansion.span;
				return span;
			});
			assert.ok(primary.length > 0 && primary.every(span => span.file_name === `src/bin/${name}.rs`), message.rendered);
		}
		rejected.push({ name, code, sourceSha256: sha256(source), diagnostics: diagnostics.length });
	}
	return { checked: true, executed: false, consumerSha256: sha256(source), rejectionSourceSha256: sha256(invalid), rejected };
};
