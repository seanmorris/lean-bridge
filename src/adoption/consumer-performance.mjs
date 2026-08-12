import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export const createConsumerPerformance = ({
  consumer,
  operation,
  scope,
  iterations,
  durationNanoseconds,
}) => Object.freeze({
  schemaVersion: 1,
  consumer,
  operation,
  scope,
  iterations,
  durationNanoseconds,
  nanosecondsPerOperation: durationNanoseconds / iterations,
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
