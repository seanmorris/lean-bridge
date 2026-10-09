/**
 * Check nominal Rust record identities against the installed crate.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { captureCorpusCompiler } from "./type-corpus-compiler.mjs";

const rejections = [
	["alias", "E0308", "let input = api::NatBoxAgain { value: 1u32.into(), count: 0u32.into() }; let _ = api::bump(&input);"]
	, ["field", "E0308", 'let _ = api::NatBox { value: "wrong".to_owned(), count: 0u32.into() };']
	, ["missing", "E0063", "let _ = api::NatBox { value: 1u32.into() };"]];

/**
 * Require the expected type error in the caller, not a failed dependency build.
 *
 * @param result - Complete Cargo JSON diagnostics and exit status.
 * @param file - Independently authored invalid caller path.
 * @param expected - Rust diagnostic required for this invalid call.
 */
export const genericRecordRustDiagnostics = (result, file, expected) => {
	assert.equal(result.code, 101, result.stderr);
	const errors = result.stdout.trim().split("\n").filter(Boolean).map(line => JSON.parse(line))
		.filter(message => message.reason === "compiler-message" && message.message.level === "error");
	assert.ok(errors.length > 0, "Expected structured Rust type errors");
	return errors.map(({ message }) => {
		assert.equal(message.code?.code, expected);
		const primary = message.spans.filter(span => span.is_primary);
		assert.ok(primary.length && primary.every(span => span.file_name === file), "The invalid caller must own every primary error span");
		return { code: expected, file, line: primary[0].line_start, column: primary[0].column_start };
	});
};

/**
 * Compile invalid public calls offline, then repeat the valid installed program.
 *
 * @param options - Installed consumer root and absolute compiler selection.
 * @param options.consumer - Consumer handoff root, with the author removed.
 * @param options.environment - Selected Cargo and rustc executables.
 * @param options.specialized - Include the specialization and namespace controls.
 * @param observation - Successful public consumer execution.
 */
export const checkGenericRecordRustTypes = async ({ consumer, environment, specialized }, observation) => {
	const root = join(consumer, "rust"), manifestPath = join(root, "Cargo.toml");
	const manifest = await readFile(manifestPath, "utf8");
	const extra = specialized ? [
		["namespace", "E0308", "let input = api::RightBox { value: 1u32.into(), count: 0u32.into() }; let _ = api::echo_left(&input);"]
		, ["specialized-list", "E0308", "let input = Some(vec![api::NatBoxAgain { value: 1u32.into(), count: 0u32.into() }]); let _ = api::echo_optional_boxes(&input);"]
		, ["specialized-option", "E0308", "let _ = api::echo_optional_nat(&Some(String::from(\"wrong\"))); "]
	] : [];
	const sources = [...rejections, ...extra].map(([name, code, body]) => ({ name, code, file: `invalid-${name}.rs`, source: `use genericrecords as api;\nfn main() { ${body} }\n` }));
	await saveLakeFile(root, "Cargo.toml", manifest + sources.map(item => `\n[[bin]]\nname="invalid-${item.name}"\npath="${item.file}"\n`).join(""));
	const compile = { ...copiedCleanEnvironment
		, PATH: "/usr/bin:/bin"
		, RUSTC: environment.LEAN_BRIDGE_RUSTC
		, CARGO_HOME: join(root, "cargo-home")
		, CARGO_NET_OFFLINE: "true" };
	const rejected = [];
	for(const item of sources)
	{
		await saveLakeFile(root, item.file, item.source);
		const result = await captureCorpusCompiler(environment.LEAN_BRIDGE_CARGO, ["check", "--offline", "--bin", `invalid-${item.name}`, "--message-format=json"], root, compile);
		const diagnostics = genericRecordRustDiagnostics(result, item.file, item.code);
		rejected.push({ case: item.name, sourceSha256: sha256(item.source), diagnostics });
	}
	const repeated = await runCopied(observation.command, [], root);
	assert.equal(repeated.stderr, "");
	assert.equal(repeated.stdout, `generic-records-ok:${observation.checks}\n`);
	return { rejected, repeatExecutionAfterTypeRejection: true };
};
