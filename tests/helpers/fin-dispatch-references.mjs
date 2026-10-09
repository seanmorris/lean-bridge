/**
 * Bind the scalar Fin entry-counter promotion (VO #1425) to its five accepted local archives. Every archive is
 * first authenticated by its own strict reader, then exposed as exactly twelve host, caller and source-route
 * selections. Each retains its original revision and command, receipt and report digests, check count,
 * measured rows, instrument and local environment, limited to the scalar mirror, impossible and label calls.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertPhpDispatchArchive, phpDispatchArchiveDirectory, phpDispatchSources } from "./php-fin-dispatch-evidence.mjs";
import { assertWitDispatchArchive, witDispatchArchiveDirectory, witDispatchSources } from "./wit-fin-dispatch-evidence.mjs";
import { assertRubyDispatchArchive, rubyDispatchArchiveDirectory, rubyDispatchSources } from "./ruby-fin-dispatch-evidence.mjs";
import { assertDotnetDispatchArchive, dotnetDispatchArchiveDirectory, dotnetDispatchSources } from "./dotnet-fin-dispatch-evidence.mjs";
import { assertJvmDispatchArchive, jvmDispatchArchiveDirectory, jvmDispatchSources } from "./jvm-fin-dispatch-evidence.mjs";

export const finDispatchScope = "Installed top-level scalar Fin calls of mirror, impossible and label only; no container, product, field, callback, other platform or hosted claim";
const native = ["lb_b703515a10173a97c2e27e46", "lb_1d7e0c72a4d6e1cde32466e4", "lb_9afacce322a81504ba9eb75b"];
const wit = ["lb_b59f358d1c9475f24bd43985", "lb_5597f18ac5ddcf489aa03c3d", "lb_97e49b166fad657a61e68249"];
const sources = ["l_NativeFin_mirror", "l_NativeFin_impossible", "l_NativeFin_label"];

/**
 * The exact statuses each probe printed, row by row; native PHP spells its error code before the parameter.
 *
 * @param rejected - Spelling of a rejection at one parameter and bound.
 */
const statusesWith = rejected => Object.freeze(["ok", rejected("arg0<10"), rejected("arg0<10"), rejected("arg0<0"), rejected("arg1<4"), "ok:6", "ok:slot:8", rejected("arg0<10"), rejected("arg0<0"), rejected("arg1<4"), "ok:0", "ok:slot:5"]);
const plainStatuses = statusesWith(site => `rejected:${site}`), phpStatuses = statusesWith(site => `rejected:1:${site}`);

/** The five archives, with what each must contain; environments are pinned from each original record. */
export const finDispatchArchives = Object.freeze([
	{
		host: "php-native"
		, sourceMap: phpDispatchSources
		, statuses: phpStatuses
		, directory: phpDispatchArchiveDirectory
		, assertArchive: assertPhpDispatchArchive
		, receiptSha256: "be5a5e2ae6397eb4c148957818fc5047a20a279b246e2e50c50f1116fce18b72"
		, revision: "592609416c71b2a52d72c5ad00d31b2440b88732"
		, gate: "LEAN_BRIDGE_PHP_FIN_TEST=1"
		, test: "tests/php-fin.test.mjs"
		, reports: {
			"ordinary-source": ["php.json", "6111649002d7111c814f2c9b237f618727eb36f665fc313b1bb2f6630ededf5b"]
			, "reviewed-ir": ["php-reviewed.json", "9a3df65fdbf46b8ad4cebb0bb8220857cd745cfd3f9b6deea35db7ed6e686f62"]
		}
		, callers: {
			"php-native": { checks: 2028, consumerSha256: "1783e3d8fb8d8e28df55b0abb371fc93977adb16e16af5d2774ef84a3d8e102c", probeSha256: "560f67fef54a7de86605cc99507be9892b60eb1c5c62790168f93fec2640f344" }
		}
		, sources: 5
		, instrument: "LD_PRELOAD"
		, adapters: native
		, environment: "Local PHP 8.2.33 (NTS) through FFI with Composer 2.5.5 and a glibc 2.36 package floor on x86_64 Linux"
	}
	, {
		host: "wit-wasi"
		, sourceMap: witDispatchSources
		, statuses: plainStatuses
		, directory: witDispatchArchiveDirectory
		, assertArchive: assertWitDispatchArchive
		, receiptSha256: "07cb48bcd702790614854fe0592a550810dbd643088fd2b0ab2b27c5d61ebb0e"
		, revision: "dac615e032e47ee604782257522563277a3eb985"
		, gate: "LEAN_BRIDGE_WIT_FIN_TEST=1"
		, test: "tests/wit-fin.test.mjs"
		, reports: {
			"ordinary-source": ["wit.json", "dff385d9fb5348a424aba0b1bad16b633b71216ab4d6dd647c1f6d0ca0730bb5"]
			, "reviewed-ir": ["wit-reviewed.json", "ab71f60816b5e5c58cb9480642491fc05c8bd660ba68250dd3be6758a095102b"]
		}
		, callers: {
			"wit-wasi": { checks: 2027, consumerSha256: "f73d7d497e9c3649cf8db213c80992fcf49ecab1ba04655175d324d6c327532a", probeSha256: "0b7e94310b4f6546649648cd2c6d3437d01ded29c1122216192a82ca22baf582" }
		}
		, sources: 10
		, instrument: "LD_PRELOAD"
		, adapters: wit
		, environment: "Local Wasmtime 42.0.1 C API, wasm-tools 1.245.1 and a glibc 2.36 package floor on x86_64 Linux; no other Wasmtime, wasm-tools or glibc floor is established"
	}
	, {
		host: "ruby"
		, sourceMap: rubyDispatchSources
		, statuses: plainStatuses
		, directory: rubyDispatchArchiveDirectory
		, assertArchive: assertRubyDispatchArchive
		, receiptSha256: "b15f2952fcaf6e3e467a31c0faa244eeb80fd9b0498ce6fb11389691ab6f4938"
		, revision: "c3bfecb21af56fcc3d4648d305a577730499a516"
		, gate: "LEAN_BRIDGE_RUBY_FIN_TEST=1"
		, test: "tests/ruby-fin.test.mjs"
		, reports: {
			"ordinary-source": ["ruby.json", "9c3a6f0d01142f510ea2f821b6519d58107d220fb214711bc6711e9a620357fd"]
			, "reviewed-ir": ["ruby-reviewed.json", "97934b8677a90c7f9ea14eebbed22078efd4d584222db241fa97fdaee20e35a6"]
		}
		, callers: {
			ruby: { checks: 2029, consumerSha256: "40d6b24387d8e90fe082af78953519874c4a1201db68707edc98eabf736522f4", probeSha256: "1738c5f6495587f6eed85ed3bd59932ced2d5adae41ca0bb201c21440a9de5cb" }
		}
		, sources: 9
		, instrument: "gdb-breakpoints"
		, adapters: native
		, environment: "Local Ruby 3.3.12, GDB 13.1, ptrace and a glibc 2.36 package floor on x86_64 Linux"
	}
	, {
		host: "dotnet"
		, sourceMap: dotnetDispatchSources
		, statuses: plainStatuses
		, directory: dotnetDispatchArchiveDirectory
		, assertArchive: assertDotnetDispatchArchive
		, receiptSha256: "4961f9576c023c6eece18f76c60b5dea3b05ea1c7300c6583d388b8009308252"
		, revision: "75a51146adad19a4fb0f253be66bf980e5fbd965"
		, gate: "LEAN_BRIDGE_DOTNET_FIN_TEST=1"
		, test: "tests/dotnet-fin.test.mjs"
		, reports: {
			"ordinary-source": ["dotnet.json", "09d07a8ea5b9fe8f4a465f321fc77beba1457f0d0871e0c91013dcedbc0ebaf7"]
			, "reviewed-ir": ["dotnet-reviewed.json", "c401d6c12c99ba205aac261d4a72704bee0248e5a4f311577f4a26e5c0572926"]
		}
		, callers: {
			dotnet: { checks: 2022, consumerSha256: "458bc71a4a12a0f68c930113be8df89764fab78d33c4017b1568fa766278ef76", probeSha256: "3509e5ac85f8e599b016cd4bbc879995eaa0fd1716b0a61b687cd10b42b77524" }
		}
		, sources: 9
		, instrument: "gdb-breakpoints"
		, adapters: native
		, environment: "Local .NET SDK 8.0.424 with Microsoft.NETCore.App 8.0.30, GNU gdb 13.1 with Yama ptrace_scope 0 and a glibc 2.36 package floor on x86_64 Linux; no other runtime, debugger, ptrace policy or glibc floor is established"
	}
	, {
		host: "jvm"
		, sourceMap: jvmDispatchSources
		, statuses: plainStatuses
		, directory: jvmDispatchArchiveDirectory
		, assertArchive: assertJvmDispatchArchive
		, receiptSha256: "6219484380f4326792e919340188f818fb96de958ff19624e6cad9494e6707db"
		, revision: "40fa8a8339d36b576747ee4029c6e11115b316fd"
		, gate: "LEAN_BRIDGE_JVM_FIN_TEST=1"
		, test: "tests/jvm-fin.test.mjs"
		, reports: {
			"ordinary-source": ["jvm.json", "38642919540fd1e1a124ab0a9d921dc6e543dc05e9e46a6412184119a21e7d23"]
			, "reviewed-ir": ["jvm-reviewed.json", "7560fa9a28337aa3743abe177318f7decf8231504e0076d965a75fcd999caebb"]
		}
		, callers: {
			java: { checks: 2023, consumerSha256: "3dce1114c690c84cb6d313fd973b66d27e5a910e677ef94fa829464f53598c14", probeSha256: "2e2bbb1c6398ad4cc597ec43baa8bbef156e733eb170774f91ea07cf24344a02" }
			, kotlin: { checks: 2022, consumerSha256: "0da35207cc3d54eda693c509a88cbfdeb69d5e1ad3d7ca5eb1c0be64d9040368", probeSha256: "4a81a3c84ba3f21d60dd9588856731645ed562039a6471e34664c665c0e5beb2" }
		}
		, sources: 12
		, instrument: "gdb-breakpoints-extracted-root"
		, adapters: native
		, environment: "Local OpenJDK 22.0.2 runtime and javac, Kotlin 2.2.0 compiling with JAVA_HOME at that JDK 22 (the original version capture ran on the default JRE 21.0.12), GNU gdb 13.1 with Yama ptrace_scope 0 and a glibc 2.36 package floor on x86_64 Linux; no other runtime, compiler, debugger, ptrace policy or glibc floor is established"
	}
].map(archive => Object.freeze(archive)));

/** The twelve selections in their fixed order: host archive, then caller, then ordinary before reviewed. */
export const finDispatchSelectionIds = Object.freeze(finDispatchArchives.flatMap(archive => Object.keys(archive.callers).flatMap(caller =>
	Object.keys(archive.reports).map(route => `fin-dispatch-${caller}-${route === "reviewed-ir" ? "reviewed" : "ordinary"}-installed`))));

const zero = [0, 0, 0, 0, 0, 0], one = [1, 0, 1, 1, 0, 1];
/** The cumulative counts every selection measured, row by row. */
export const finDispatchCounts = Object.freeze([zero, zero, zero, zero, zero, [1, 0, 0, 1, 0, 0], one, one, one, one, [2, 0, 1, 2, 0, 1], [2, 0, 2, 2, 0, 2]]);
const steps = ["start", "invalid-mirror-bound", "invalid-mirror-huge", "invalid-impossible-zero", "invalid-label-late", "valid-mirror", "valid-label", "recovery-invalid-mirror", "recovery-invalid-impossible", "recovery-invalid-label", "recovery-valid-mirror", "recovery-valid-label"];

/**
 * Independently recount one selection's rows: rejected steps change no column, successful steps enter exactly
 * their own source and adapter once, and neither Fin 0 column ever moves.
 *
 * @param rows - One selection's measured rows.
 */
export const assertFinDispatchRows = rows => {
	assert.deepEqual(rows.map(row => row[0]), steps);
	assert.deepEqual(rows.map(row => row[2]), finDispatchCounts);
	const own = { mirror: [0, 3], label: [2, 5] };
	for(let index = 1; index < rows.length; index++)
	{
		const [step, status, counts] = rows[index], delta = counts.map((count, column) => count - rows[index - 1][2][column]);
		assert.equal(status.startsWith("rejected:"), step.includes("invalid"), step);
		const entered = step.includes("invalid") ? [] : own[step.split("-").at(-1)];
		assert.deepEqual(delta, zero.map((_, column) => entered.includes(column) ? 1 : 0), step);
		assert.equal(counts[1] + counts[4], 0, `${step}: Fin 0 never enters`);
	}
};

/**
 * Require exactly the twelve expected selections, each matching its archive's pinned identity and the
 * scalar-only local scope, with independently recounted rows.
 *
 * @param references - Selections from finDispatchReferences, or a changed copy in a control.
 */
export const assertFinDispatchReferences = references => {
	assert.deepEqual(references.map(reference => reference.id), finDispatchSelectionIds, "exactly the twelve selections in order");
	// Java and Kotlin are distinct callers with their own consumer and probe.
	const jvm = finDispatchArchives.find(archive => archive.host === "jvm").callers;
	assert.notEqual(jvm.java.consumerSha256, jvm.kotlin.consumerSha256); assert.notEqual(jvm.java.probeSha256, jvm.kotlin.probeSha256);
	for(const reference of references)
	{
		const archive = finDispatchArchives.find(item => item.host === reference.host);
		assert.ok(archive, reference.id);
		const route = reference.id.endsWith("-reviewed-installed") ? "reviewed-ir" : "ordinary-source";
		assert.equal(reference.id, `fin-dispatch-${reference.caller}-${route === "reviewed-ir" ? "reviewed" : "ordinary"}-installed`);
		assert.ok(Object.hasOwn(archive.callers, reference.caller), `${reference.id}: caller belongs to ${archive.host}`);
		assert.equal(reference.sourcePath, route, reference.id);
		assert.deepEqual([reference.execution, reference.hostedCi, reference.scope], ["local", false, finDispatchScope], reference.id);
		assert.equal(reference.revision, archive.revision, reference.id);
		assert.deepEqual(reference.receipt, { path: `${archive.directory}/receipt.json`, sha256: archive.receiptSha256 }, reference.id);
		assert.deepEqual(reference.report, { path: `${archive.directory}/${archive.reports[route][0]}`, sha256: archive.reports[route][1] }, reference.id);
		assert.equal(reference.command, `env -u FORCE_COLOR NO_COLOR=1 ${archive.gate} LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 ${archive.host === "wit-wasi" ? "LEAN_BRIDGE_WASMTIME_C_API=/app/.toolchains/wasmtime42 " : ""}taskset -c 3 node --test --test-concurrency=1 --test-reporter=tap ${archive.test}`, reference.id);
		assert.equal(Object.keys(reference.sources).length, archive.sources, `${reference.id}: producer source count`);
		assert.deepEqual(reference.sources, archive.sourceMap, `${reference.id}: exact producer sources`);
		const caller = archive.callers[reference.caller];
		assert.deepEqual([reference.checks, reference.consumerSha256, reference.probeSha256], [caller.checks, caller.consumerSha256, caller.probeSha256], `${reference.id}: caller identity`);
		assert.deepEqual(reference.rows.map(row => row[1]), archive.statuses, `${reference.id}: exact statuses`);
		assert.equal(reference.instrument, archive.instrument, reference.id);
		assert.equal(reference.environment, archive.environment, reference.id);
		assert.deepEqual(reference.columns, [...sources, ...archive.adapters], reference.id);
		assertFinDispatchRows(reference.rows);
	}
};

/**
 * Authenticate all five archives through their strict readers, including the current sources at their
 * producer digests, and return the twelve frozen selections.
 *
 * @param read - Repository-relative byte reader.
 */
export const finDispatchReferences = async (read = path => readFile(path)) => {
	const references = [];
	for(const archive of finDispatchArchives)
	{
		const receiptPath = `${archive.directory}/receipt.json`, receiptBytes = await read(receiptPath);
		assert.equal(sha256(receiptBytes), archive.receiptSha256, receiptPath);
		const receipt = JSON.parse(receiptBytes);
		await archive.assertArchive(receipt, read);
		assert.deepEqual([receipt.execution, receipt.scope.hostedCi, receipt.scope.otherHosts], ["local", false, false], receiptPath);
		const queue = JSON.parse(await read(`${archive.directory}/queue.json`));
		assert.equal(queue.revision, receipt.revision); assert.deepEqual(queue.sources, archive.sourceMap, receiptPath);
		if(archive.host === "php-native")
		{
			// The PHP receipt has no environment sentence; derive it from the original queue instead.
			assert.match(queue.versions.php, /^PHP 8\.2\.33 \(cli\) .*\(NTS\)$/u); assert.match(queue.versions.composer, /^Composer version 2\.5\.5 /u);
			assert.equal(queue.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, "2.36");
		}
		else assert.equal(receipt.scope.environment, archive.environment, receiptPath);
		for(const [route, [name, digest]] of Object.entries(archive.reports))
		{
			const path = `${archive.directory}/${name}`, bytes = await read(path);
			const artifact = receipt.artifacts.find(item => item.path === path);
			assert.ok(artifact, path); assert.equal(sha256(bytes), artifact.sha256, path); assert.equal(artifact.sha256, digest, path);
			const report = JSON.parse(bytes);
			assert.deepEqual(report.reports.map(item => item.profile), Object.keys(archive.callers), path);
			for(const item of report.reports)
			{
				assert.equal(item.path, route, path);
				references.push(Object.freeze({
					id: `fin-dispatch-${item.profile}-${route === "reviewed-ir" ? "reviewed" : "ordinary"}-installed`
					, host: archive.host
					, caller: item.profile
					, sourcePath: route
					, execution: receipt.execution
					, hostedCi: receipt.scope.hostedCi
					, scope: finDispatchScope
					, revision: queue.revision
					, command: queue.command
					, sources: queue.sources
					, receipt: { path: receiptPath, sha256: archive.receiptSha256 }
					, report: { path, sha256: artifact.sha256 }
					, checks: item.checks ?? item.observation.checks
					, consumerSha256: item.consumerSha256 ?? item.wit.sourceSha256
					, probeSha256: item.dispatch.probeSha256
					, instrument: item.dispatch.instrument ?? item.dispatch.interposer
					, columns: item.dispatch.columns
					, rows: item.dispatch.observed
					, environment: archive.environment
				}));
			}
		}
	}
	// Reports group callers by route; selections are ordered by caller, then route.
	references.sort((a, b) => finDispatchSelectionIds.indexOf(a.id) - finDispatchSelectionIds.indexOf(b.id));
	assertFinDispatchReferences(references);
	return references;
};
