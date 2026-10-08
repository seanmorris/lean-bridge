/**
 * Bind structural Fin promotion to the Rust, hosted .NET and local WIT originals.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { assertFinRustExecution, assertFinRustReport } from "./fin-rust-evidence.mjs";
import { assertFinDotnetExecution, assertFinDotnetReport } from "./fin-dotnet-hosted-evidence.mjs";
import { assertFinWitRecordExecution, assertFinWitRecordReport } from "./fin-wit-record-evidence.mjs";

export const finNativeBatchReceipts = [
	{ profile: "rust", path: "docs/evidence/fin-rust-20261008/receipt-v2.json"
		, sha256: "d9cbfdde08a69d7c6e77e9ebb16cfd42b5322ff38a96efaa694f8d1e31471b7a"
		, execution: "local", count: 6
		, revision: "78a4d3da45754f3e425faafdadc9e959cee65bc5" }
	, { profile: "dotnet"
		, path: "docs/evidence/fin-dotnet-hosted-20261008/receipt.json"
		, sha256: "12f88711ff9cba2950e7133d62b6274e87e6df14d40591af130fdb5355732124"
		, execution: "hosted", count: 6
		, revision: "f9d5ce96eb04ec800209c6a6863092b3bdea6e85" }
	, { profile: "wit-wasi"
		, path: "docs/evidence/fin-wit-records-20261008/receipt.json"
		, sha256: "d4a42fa144f5432cf731f5a3b81ea0dc9514c6464955b18d7bc8ba6287974779"
		, execution: "local", count: 2
		, revision: "738d41764dcaa3f689a628ea18f7c292b2f2e8bd" }
];

export const finNativeBatchEnvironment = {
	rust: "Local Rust 1.90.0 and cargo 1.90.0 were measured by the runner, as were Node 22.23.3, Lean 4.32.2 and host glibc 2.36. The configured package floor is 2.36. The consumer compiles offline with cargo; compilerFreePath excludes Lean and producer tools, not the Rust compiler."
	, dotnet: "Successful hosted .NET job 113176414688 in run 37736101772 at f9d5ce9 used installed SDK 8.0.424; its log prints Lean 4.32.2 and the setup-node 22.23.3 cache path. Declared package floor 2.38 comes from the default with no override in the job log. Host glibc was not measured. The consumer restores offline and builds with the .NET SDK. Other jobs of that run failed; this is not a whole-run pass."
	, "wit-wasi": "Local runner measured Node 22.23.2, Lean 4.32.2, wasm-tools 1.245.1 and host glibc 2.36; configured package floor is 2.36. The receipt pins the Wasmtime library bytes but its version was not queried. The C host caller still compiles with the system compiler. The earlier hosted WIT failure remains separate from these repaired local passes."
};

const readOriginal = async reference => {
	const bytes = await readFile(reference.path);
	assert.equal(bytes.length, reference.bytes); assert.equal(sha256(bytes), reference.sha256, reference.path);
	return bytes;
};
const fileFor = family => `tests/native-fin-${family === "product-array" ? "product-arrays" : family + "s"}.test.mjs`;

/** Authenticate all fourteen original selections without borrowing their environments or positions. */
export const finNativeBatchPromotionReferences = async () => {
	const references = [];
	for(const expected of finNativeBatchReceipts)
	{
		const bytes = await readFile(expected.path);
		assert.equal(sha256(bytes), expected.sha256, expected.path);
		const receipt = JSON.parse(bytes), artifacts = new Map(), sources = new Map();
		assert.equal(receipt.revision, expected.revision); assert.equal(receipt.execution, expected.execution);
		assert.equal(receipt.runs.length, expected.count);
		for(const file of receipt.artifacts) artifacts.set(file.path, await readOriginal(file));
		for(const file of receipt.sourceFiles)
		{
			const source = beforeFinRefinementSource(file.path, await readFile(file.path), file.sha256);
			assert.equal(sha256(source), file.sha256, file.path); sources.set(file.path, source);
		}
		const readSource = async path => { assert.ok(sources.has(path), path); return sources.get(path); };
		const text = reference => { assert.ok(artifacts.has(reference.path)); return artifacts.get(reference.path).toString(); };
		const named = name => receipt.artifacts.find(item => item.path.endsWith("/" + name));
		let queue;
		if(expected.profile === "rust")
		{
			queue = text(receipt.runtime.queue);
			assertFinRustExecution(queue, text(receipt.runtime.tap));
		}
		else if(expected.profile === "dotnet")
			assertFinDotnetExecution(JSON.parse(text(receipt.provenance.job)), JSON.parse(text(receipt.provenance.artifact)), text(receipt.provenance.log));
		else
		{
			queue = text(named("execution.queue"));
			assertFinWitRecordExecution(queue, text(named("execution.tap")));
		}
		const reportPaths = new Set(receipt.runs.map(run => run.report.path));
		const executionFiles = receipt.artifacts.filter(file => !reportPaths.has(file.path));
		for(const run of receipt.runs)
		{
			const report = JSON.parse(text(run.report));
			const family = expected.profile === "wit-wasi" ? "record" : run.family;
			const reviewed = ["reviewed", "reviewed-ir"].includes(run.route);
			const sourcePath = reviewed ? "reviewed-ir" : "ordinary-source";
			const variable = family.replaceAll("-", "_").toUpperCase();
			let command;
			if(expected.profile === "rust")
			{
				await assertFinRustReport(report, run, readSource);
				const line = queue.split("\n").find(line => line.startsWith(`start ${family}-${run.route} `));
				const pattern = line.split(" pattern=")[1].split(" LEAN_BRIDGE_")[0];
				const selection = `LEAN_BRIDGE_${reviewed ? "REVIEWED_" : ""}FIN_${variable}`;
				command = `LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 LEAN_BRIDGE_CARGO=/app/.toolchains/rust-1.90.0/bin/cargo LEAN_BRIDGE_RUSTC=/app/.toolchains/rust-1.90.0/bin/rustc LEAN_BRIDGE_LEAN_PREFIX=/app/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2 LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 ${selection}_PROFILES=rust ${selection}_REPORT=/app/${run.report.originalPath} taskset -c 3 node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern='${pattern}' ${fileFor(family)}`;
			}
			else if(expected.profile === "dotnet")
			{
				await assertFinDotnetReport(report, run, readSource);
				command = `LEAN_BRIDGE_FIN_${variable}_PROFILES=dotnet LEAN_BRIDGE_REVIEWED_FIN_${variable}_PROFILES=dotnet node --test ${fileFor(family)}`;
				assert.ok(text(receipt.provenance.log).includes(command));
			}
			else
			{
				await assertFinWitRecordReport(report, run, readSource);
				const line = queue.split("\n").find(line => line.startsWith(`start ${run.id} `));
				const pattern = line.split(" pattern=")[1].split(" report=")[0];
				const selection = `LEAN_BRIDGE_${reviewed ? "REVIEWED_" : ""}FIN_RECORD`;
				command = `LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 LEAN_BRIDGE_LEAN_PREFIX=/app/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2 LEAN_BRIDGE_WASM_TOOLS=/app/.toolchains/wasm-tools/bin/wasm-tools LEAN_BRIDGE_WASMTIME_C_API=/app/.toolchains/wasmtime42 LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 ${selection}_PROFILES=wit-wasi ${selection}_REPORT=/app/${run.report.originalPath} taskset -c 3 node --test --test-concurrency=1 --test-name-pattern='${pattern}' tests/native-fin-records.test.mjs`;
			}
			references.push({ id: `fin-batch-${expected.profile}-${family}-${reviewed ? "reviewed" : "ordinary"}-installed`
				, profile: expected.profile, family, sourcePath, revision: receipt.revision
				, execution: expected.execution, receiptPath: expected.path
				, checks: report.reports[0].checks, report: run.report
				, executionFiles, command
				, environment: finNativeBatchEnvironment[expected.profile]
				, artifacts: Object.entries(report.archives).map(([path, sha256]) => ({ path, sha256 })) });
		}
	}
	assert.equal(references.length, 14);
	return references;
};
