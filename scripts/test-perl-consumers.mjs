/**
 * Execute the pinned threaded/nonthreaded Perl acceptance matrix.
 *
 * @file
 */
import { resolve } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { cpus } from "node:os";
import { buildPerlToolchain } from "./build-perl-toolchains.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";

for(const version of ["5.36.3", "5.38.2"])
{
	for(const threaded of [true, false])
	{
		const label = `${version}-${threaded ? "threaded" : "unthreaded"}`;
		process.stdout.write(`Perl ${label}\n`);
		const perl = await buildPerlToolchain({ outputRoot: ".toolchains/perl", version, threaded });
		try
		{
			const result = await processBuildRunner.capture({
				command: process.execPath
				, args: ["--test", "tests/perl-native.test.mjs"]
				, env: {
					...process.env
					, LEAN_BRIDGE_PERL_NATIVE_TEST: "1"
					, LEAN_BRIDGE_TEST_PERL: perl
					, LEAN_BRIDGE_PERL_BENCHMARK_DIR: resolve("build/consumer-ci/perl", label)
				}
			});
			process.stdout.write(result.stdout);
		} catch(error)
		{
			process.stderr.write(`${error.message}\n${JSON.stringify(error.details)}\n`);
			process.exitCode = 1;
		}
	}
}

if(!process.exitCode)
{
	const report = JSON.parse(await readFile("build/consumer-ci/perl/5.38.2-threaded/benchmark.json", "utf8"));
	const scalar = report.cases.scalar.perl;
	const directory = process.env.LEAN_BRIDGE_CONSUMER_PERFORMANCE_DIR ?? "build/consumer-ci/performance";
	await mkdir(directory, { recursive: true });
	await writeFile(resolve(directory, "perl.json"), JSON.stringify({
		schemaVersion: 2
		, consumer: "perl"
		, timingMode: "steady-state"
		, operation: "Generated XS call to Lean UInt32 addition"
		, scope: "Perl 5.38.2 threaded; median of 9 warmed installed-API samples; runtime startup excluded"
		, iterations: scalar.iterations
		, durationNanoseconds: scalar.medianNs * scalar.iterations
		, nanosecondsPerOperation: scalar.medianNs
		, environment: { platform: process.platform, architecture: process.arch, cpu: cpus()[0]?.model ?? "unknown CPU" }
	}, null, 2) + "\n");
}
