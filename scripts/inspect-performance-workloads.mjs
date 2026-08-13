#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import {
	hashPerformanceWorkloadManifest,
	materializePerformanceWorkload,
	validatePerformanceWorkloads,
} from "../src/performance/workloads.mjs";

const manifest = JSON.parse(await readFile(
	new URL("../poc/performance/workloads.v1.json", import.meta.url),
	"utf8",
));
validatePerformanceWorkloads(manifest);
const workloads = manifest.workloads.map(workload => {
  const materialized = materializePerformanceWorkload(manifest, workload, { verify: false });
  return {
    id: workload.id
    , tier: workload.tier
    , points: materialized.initialPoints.length
    , operations: materialized.trace.length
    , contentSha256: materialized.contentSha256
    , resultSha256: materialized.resultSha256
  };
});
process.stdout.write(`${JSON.stringify({
	schemaVersion: 1
	, manifestSha256: hashPerformanceWorkloadManifest(manifest)
	, workloads
}, null, 2)}\n`);
