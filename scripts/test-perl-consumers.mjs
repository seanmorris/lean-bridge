/**
 * Execute the pinned threaded/nonthreaded Perl acceptance matrix.
 *
 * @file
 */
import { resolve } from "node:path";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { cpus } from "node:os";
import { pathToFileURL } from "node:url";
import { buildPerlToolchain } from "./build-perl-toolchains.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";

export const perlConfigurations = Object.freeze(["5.36.3", "5.38.2"].flatMap(version =>
	[true, false].map(threaded => Object.freeze({ version, threaded
		, label: `${version}-${threaded ? "threaded" : "unthreaded"}` }))));

/**
 * Select the complete local matrix or exactly one pinned CI configuration.
 *
 * @param argv - CLI arguments following the script name.
 */
export function selectPerlConfigurations(argv)
{
	if(argv.length === 0) return perlConfigurations;
	const selected = perlConfigurations.find(item => item.label === argv[1]);
	if(argv.length !== 2 || argv[0] !== "--configuration" || !selected)
		throw new Error(`Usage: test-perl-consumers.mjs [--configuration ${perlConfigurations.map(item => item.label).join("|")}]`);
	return [selected];
}

/**
 * Run each selected ABI suite and retain performance only after its full acceptance passes.
 *
 * @param options - Suite selection, output paths and test dependencies.
 * @param options.argv - Optional single-configuration CLI selection.
 * @param options.outputRoot - Directory for configuration-specific acceptance and benchmark files.
 * @param options.performanceDirectory - Directory for the complete matrix's performance observation.
 * @param options.buildToolchain - Builder for the selected checksummed Perl interpreter.
 * @param options.runner - Process runner that executes the unchanged native acceptance suite.
 * @param options.stdout - Destination for progress and test output.
 * @param options.stderr - Destination for failed-suite diagnostics.
 */
export async function runPerlConsumers({
	argv = []
	, outputRoot = "build/consumer-ci/perl"
	, performanceDirectory = process.env.LEAN_BRIDGE_CONSUMER_PERFORMANCE_DIR ?? "build/consumer-ci/performance"
	, buildToolchain = buildPerlToolchain, runner = processBuildRunner
	, stdout = process.stdout, stderr = process.stderr
} = {}) {
	const configurations = selectPerlConfigurations(argv);
	const aggregate = resolve(performanceDirectory, "perl.json");
	await rm(aggregate, { force: true });
	let passed = true;
	for(const { version, threaded, label } of configurations)
	{
		stdout.write(`Perl ${label}\n`);
		const directory = resolve(outputRoot, label);
		try
		{
			await mkdir(directory, { recursive: true });
			for(const name of ["benchmark.json", "acceptance.json", "perl.json"])
				await rm(resolve(directory, name), { force: true });
			const perl = await buildToolchain({ outputRoot: ".toolchains/perl", version, threaded });
			const result = await runner.capture({
				command: process.execPath
				, args: ["--test", "tests/perl-native.test.mjs"]
				, env: {
					...process.env
					, LEAN_BRIDGE_PERL_NATIVE_TEST: "1"
					, LEAN_BRIDGE_TEST_PERL: perl
					, LEAN_BRIDGE_PERL_BENCHMARK_DIR: directory
				}
			});
			stdout.write(result.stdout);
			const report = JSON.parse(await readFile(resolve(directory, "benchmark.json"), "utf8"));
			const acceptance = JSON.parse(await readFile(resolve(directory, "acceptance.json"), "utf8"));
			const scalar = report.cases?.scalar?.perl;
			if(report.schemaVersion !== 1 || report.consumer !== "perl" || acceptance.schemaVersion !== 1
				|| !/^[a-f0-9]{64}$/.test(report.nativeLibrarySha256)
				|| acceptance.nativeLibrarySha256 !== report.nativeLibrarySha256
				|| acceptance.perl !== perl || !Number.isSafeInteger(scalar?.iterations) || scalar.iterations <= 0
				|| !Number.isFinite(scalar.medianNs) || scalar.medianNs <= 0
				|| !Number.isFinite(scalar.medianNs * scalar.iterations))
				throw new Error(`Perl ${label}: missing or invalid acceptance/benchmark evidence`);
			await writeFile(resolve(directory, "perl.json"), JSON.stringify({
				schemaVersion: 2
				, consumer: "perl"
				, timingMode: "steady-state"
				, operation: "Generated XS call to Lean UInt32 addition"
				, scope: `Perl ${version} ${threaded ? "threaded" : "unthreaded"}; median of 9 warmed installed-API samples; runtime startup excluded`
				, iterations: scalar.iterations
				, durationNanoseconds: scalar.medianNs * scalar.iterations
				, nanosecondsPerOperation: scalar.medianNs
				, environment: { platform: process.platform, architecture: process.arch, cpu: cpus()[0]?.model ?? "unknown CPU" }
			}, null, 2) + "\n");
		} catch(error)
		{
			stderr.write(`${error.message}\n${JSON.stringify(error.details)}\n`);
			passed = false;
		}
	}
	if(passed && configurations.length === perlConfigurations.length)
	{
		await mkdir(performanceDirectory, { recursive: true });
		await copyFile(resolve(outputRoot, "5.38.2-threaded/perl.json"), aggregate);
	}
	return passed;
}

if(process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
{
	if(!await runPerlConsumers({ argv: process.argv.slice(2) })) process.exitCode = 1;
}
