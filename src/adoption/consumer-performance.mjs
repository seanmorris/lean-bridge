import { mkdir, writeFile } from "node:fs/promises";
import { arch, cpus, platform } from "node:os";
import { join, resolve } from "node:path";

export const STEADY_STATE_BOX_VALUE = 73;
export const STEADY_STATE_OPERATION = "retained Box read";
export const STEADY_STATE_WARMUP_ITERATIONS = 10_000;
export const STEADY_STATE_MEASURED_ITERATIONS = 100_000;

/**
 * Normalizes one downstream timing observation and records its per-operation duration plus host execution context.
 *
 * @param root0 - Named inputs and dependency overrides used to create consumer performance.
 * @param root0.consumer - Consumer identity or generated consumer module whose observed behavior is recorded or verified.
 * @param root0.operation - Human-readable operation name whose duration was measured.
 * @param root0.timingMode - Closed timing mode defining the operation boundary represented by the duration.
 * @param root0.scope - Measurement boundary describing whether timing covers one call or a larger invocation.
 * @param root0.iterations - Number of completed operation repetitions represented by the measurement.
 * @param root0.durationNanoseconds - Observed total duration in nanoseconds for the recorded consumer operation.
 */
export const createConsumerPerformance = ({
	consumer
	, operation
	, timingMode
	, scope
	, iterations
	, durationNanoseconds
}) => Object.freeze({
	schemaVersion: 2
	, consumer
	, operation
	, timingMode
	, scope
	, iterations
	, durationNanoseconds
	, nanosecondsPerOperation: durationNanoseconds / iterations
	, environment: Object.freeze({
		platform: platform()
		, architecture: arch()
		, cpu: cpus()[0]?.model ?? "unknown"
	})
});

/**
 * Writes consumer performance in deterministic form with the metadata required by the documented consumer acceptance workflow.
 *
 * @param values - Consumer performance records serialized with canonical field ordering.
 */
export const writeConsumerPerformance = async values => {
	const performance = createConsumerPerformance(values);
	const directory = process.env.LEAN_BRIDGE_CONSUMER_PERFORMANCE_DIR;
	if(!directory) return performance;
	const root = resolve(directory);
	await mkdir(root, { recursive: true });
	await writeFile(join(root, `${performance.consumer}.json`), `${JSON.stringify(performance, null, 2)}\n`);
	return performance;
};
