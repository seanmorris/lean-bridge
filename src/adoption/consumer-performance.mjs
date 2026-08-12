import { mkdir, writeFile } from "node:fs/promises";
import { arch, cpus, platform } from "node:os";
import { join, resolve } from "node:path";

export const STEADY_STATE_BOX_VALUE = 73;
export const STEADY_STATE_OPERATION = "retained Box read";
export const STEADY_STATE_WARMUP_ITERATIONS = 10_000;
export const STEADY_STATE_MEASURED_ITERATIONS = 100_000;

export const createConsumerPerformance = ({
  consumer,
  operation,
  timingMode,
  scope,
  iterations,
  durationNanoseconds,
}) => Object.freeze({
  schemaVersion: 2,
  consumer,
  operation,
  timingMode,
  scope,
  iterations,
  durationNanoseconds,
  nanosecondsPerOperation: durationNanoseconds / iterations,
  environment: Object.freeze({
    platform: platform(),
    architecture: arch(),
    cpu: cpus()[0]?.model ?? "unknown",
  }),
});

export const writeConsumerPerformance = async values => {
  const performance = createConsumerPerformance(values);
  const directory = process.env.LEAN_BRIDGE_CONSUMER_PERFORMANCE_DIR;
  if (!directory) return performance;
  const root = resolve(directory);
  await mkdir(root, { recursive: true });
  await writeFile(join(root, `${performance.consumer}.json`), `${JSON.stringify(performance, null, 2)}\n`);
  return performance;
};
