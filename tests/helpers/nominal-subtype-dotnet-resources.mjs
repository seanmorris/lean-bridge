/**
 * Wait between expensive C# producer phases without relaxing resource floors.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, statfs } from "node:fs/promises";
import { loadavg } from "node:os";
import { setTimeout } from "node:timers/promises";

const sampleResources = async root => {
	const disk = await statfs(root), memory = await readFile("/proc/meminfo", "utf8");
	return { freeBytes: disk.bavail * disk.bsize
		, availableBytes: Number(memory.match(/^MemAvailable:\s+(\d+) kB$/mu)?.[1]) * 1024
		, load: loadavg()[0] };
};

/**
 * Keep disk/memory floors strict; wait at most five minutes for load below the
 * configured ceiling (six by default).
 * Injected readers and timers are only used by isolated policy controls.
 *
 * @param root - Task-owned output directory on the producer filesystem.
 * @param options - Optional diagnostics and isolated-test dependencies.
 * @param options.sample - Actual resource reader unless explicitly testing policy.
 * @param options.pause - Actual asynchronous timer unless explicitly testing policy.
 * @param options.notify - Producer diagnostic sink.
 * @param options.maxLoad - Exclusive host-load ceiling for this producer run.
 */
export const waitNominalSubtypeDotnetResources = async (root, { sample = sampleResources, pause = setTimeout, notify = () => {}, maxLoad = 6 } = {}) => {
	assert.ok(Number.isFinite(maxLoad) && maxLoad > 0, "C# producer requires a positive finite host-load ceiling");
	const observations = [];
	for(let attempt = 0; attempt <= 20; attempt++)
	{
		const current = await sample(root); observations.push(current);
		assert.ok(current.freeBytes >= 2 * 1024 ** 3, "C# producer requires 2 GiB free disk");
		assert.ok(current.availableBytes >= 2 * 1024 ** 3, "C# producer requires 2 GiB available memory");
		assert.ok(Number.isFinite(current.load) && current.load >= 0, "C# producer requires a valid host load reading");
		if(current.load < maxLoad) return { observations, waits: attempt };
		assert.ok(attempt < 20, `C# producer host load remained at or above ${maxLoad} for five minutes`);
		notify(`Waiting for host load below ${maxLoad} before the next C# phase: ${current.load}`);
		await pause(15_000);
	}
	throw new Error("C# producer exhausted its bounded resource wait");
};
