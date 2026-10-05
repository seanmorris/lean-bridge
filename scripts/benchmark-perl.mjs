/**
 * Warmed installed Perl API and direct-C calls into the same compiled Lean artifact.
 *
 * @file
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeTypeKey } from "../src/build/native-model.mjs";

/**
 * Measure public conversion, callback and call overhead with fixed warmup.
 *
 * @param root0 - Named inputs for this native build or packaging operation.
 * @param root0.nativeRoot - Directory holding the exact compiled Lean component.
 * @param root0.runtimeRoot - Verified process-wide native runtime directory.
 * @param root0.prefix - Relative path prefix or installed Perl library location.
 * @param root0.outputRoot - New output directory; existing output must not be overwritten.
 * @param root0.perl - Perl executable whose Config determines the XS ABI.
 * @param root0.leanPrefix - Pinned Lean installation containing the compiler and matching headers.
 * @param root0.cc - Upstream C compiler executable.
 */
export async function benchmarkPerl({ nativeRoot, runtimeRoot, prefix, outputRoot, perl = "perl", leanPrefix, cc = "cc" })
{
	const output = resolve(outputRoot); await mkdir(output, { recursive: true });
	const model = JSON.parse(await readFile(join(nativeRoot, "model.json"), "utf8"));
	const receipt = JSON.parse(await readFile(join(nativeRoot, "native-component.json"), "utf8"));
	const find = name => model.exports.find(item => item.name === `Workshop.${name}`);
	const callback = find("withCallback").parameters[1].type;
	const binary = join(output, "direct-c");
	const runtimeLib = resolve(runtimeRoot, "lib");
	const args = ["-O2"
		, "-g0"
		, "-I"
		, resolve(nativeRoot)
		, "-I"
		, resolve(runtimeRoot, "include")
		, "-I"
		, resolve(leanPrefix, "include")
		, `-DLB_ADD=${find("add").symbol}`
		, `-DLB_BYTES=${find("echoBytes").symbol}`
		, `-DLB_CALLBACK=${find("withCallback").symbol}`
		, `-DLB_CALLBACK_WRAP=lb_t${nativeTypeKey(callback)}_wrap`
		, `-DLB_INITIALIZER=${receipt.initializer}`
		, resolve("tests/fixtures/perl/benchmark.c")
		, resolve(nativeRoot, receipt.library)
		, "-L"
		, runtimeLib
		, "-llean_bridge_native"
		, "-lleanshared"
		, `-Wl,-rpath,${runtimeLib}`
		, `-Wl,-rpath,${resolve(nativeRoot)}`
		, "-o"
		, binary];
	await processBuildRunner.capture({ command: cc, args });
	const native = JSON.parse((await processBuildRunner.capture({ command: binary, args: [] })).stdout);
	const host = JSON.parse((await processBuildRunner.capture({ command: perl
		, args: [resolve("tests/fixtures/perl/benchmark.pl")]
		, env: { ...process.env, PERL5LIB: join(resolve(prefix), "lib/perl5") } })).stdout);
	const startupSamples = [];
	let bindingRuntimeIdentity;
	for(let sample = 0; sample < 5; ++sample)
	{
		const start = process.hrtime.bigint();
		const imported = await processBuildRunner.capture({
			command: perl
			, args: ["-MLeanBridge::Workshop", "-e", "print LeanBridge::Runtime::_identity()"]
			, env: { ...process.env, PERL5LIB: join(resolve(prefix), "lib/perl5") }
		});
		startupSamples.push(Number(process.hrtime.bigint() - start) / 1e6);
		bindingRuntimeIdentity = imported.stdout;
	}
	const report = { schemaVersion: 1
		, consumer: "perl"
		, methodology: "9 warmed samples; median ns/call; direct C invokes the same Lean shared library; setup excluded"
		, nativeLibrarySha256: sha256(await readFile(join(nativeRoot, receipt.library)))
		, runtimeIdentity: receipt.runtimeIdentity
		, bindingRuntimeIdentity
		, startup: {
			methodology: "5 fresh Perl processes; includes process launch, import, artifact hashing and runtime initialization; OS page cache is not cleared"
			, samplesMs: startupSamples
			, medianMs: [...startupSamples].sort((a, b) => a - b)[2]
		}
		, cases: Object.fromEntries(Object.keys(host).map(name => [name, { perl: host[name], directC: native[name], relativeCost: host[name].medianNs / native[name].medianNs }])) };
	await writeFile(join(output, "benchmark.json"), canonicalJson(report));
	return report;
}

if(process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
{
	const root = resolve(process.argv[2] ?? "build/perl-consumer");
	console.log(await benchmarkPerl({ nativeRoot: join(root, "native")
		, runtimeRoot: join(root, "runtime")
		, prefix: join(root, "installed")
		, outputRoot: join(root, "benchmark")
		, perl: process.env.LEAN_BRIDGE_TEST_PERL ?? "perl"
		, leanPrefix: process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2" }));
}
