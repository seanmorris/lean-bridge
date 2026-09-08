/**
 * Shared controller for the proof-demo browser benchmarks.
 *
 * @file
 */

const requireElement = (root, selector) => {
	const element = root.querySelector(selector);
	if(!element) throw new Error(`Benchmark is missing ${selector}`);
	return element;
};

const svgElement = (name, attributes = {}) => {
	const node = globalThis.document.createElementNS("http://www.w3.org/2000/svg", name);
	for(const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
	return node;
};

const frame = () => new Promise(globalThis.requestAnimationFrame);
const percentile = (sorted, fraction) => sorted[Math.min(sorted.length - 1,
	Math.max(0, Math.ceil(sorted.length * fraction) - 1))];

/**
 * Measure an asynchronous operation in an adaptive batch and return per-operation latency.
 *
 * @template T
 * @param {() => Promise<T>} operation Operation to measure.
 * @param {number} minimumMs Minimum accumulated interval before accepting a measurement.
 * @returns {Promise<{milliseconds: number, result: T}>} Batched measurement.
 */
export const measureAsyncBenchmark = async (operation, minimumMs = 12) => {
	let repetitions = 1;
	while(true)
	{
		let result;
		const started = performance.now();
		for(let index = 0; index < repetitions; index += 1) result = await operation();
		const elapsed = performance.now() - started;
		if(elapsed >= minimumMs || repetitions >= 4096)
		{
			return { milliseconds: elapsed / repetitions, result };
		}
		repetitions *= 2;
	}
};

/**
 * Measure a synchronous operation in an adaptive batch and return per-operation latency.
 *
 * @template T
 * @param {() => T} operation Operation to measure.
 * @param {number} minimumMs Minimum accumulated interval before accepting a measurement.
 * @returns {{milliseconds: number, result: T}} Batched measurement.
 */
export const measureSyncBenchmark = (operation, minimumMs = 12) => {
	let repetitions = 1;
	while(true)
	{
		let result;
		const started = performance.now();
		for(let index = 0; index < repetitions; index += 1) result = operation();
		const elapsed = performance.now() - started;
		if(elapsed >= minimumMs || repetitions >= 4096)
		{
			return { milliseconds: elapsed / repetitions, result };
		}
		repetitions *= 2;
	}
};

/**
 * Attach an automatically starting, prewarmed benchmark to a rendered benchmark section.
 *
 * @param root0 Configuration.
 * @param root0.root Benchmark section element.
 * @param root0.prepare Promise-returning runtime preparation function.
 * @param root0.sample One checked Lean-versus-JavaScript sample.
 * @param root0.summarize Summary formatter for completed samples.
 * @param root0.trialCount Number of measured samples.
 * @param root0.warmupCount Number of excluded warm-up samples.
 * @returns {{cancel: () => void, run: () => Promise<void>}} Benchmark controls.
 */
export const attachBrowserBenchmark = ({
	root, prepare, sample, summarize, trialCount = 100, warmupCount = 5
}) => {
	const elements = {
		cancel: requireElement(root, "[data-benchmark-cancel]")
		, histogram: requireElement(root, "[data-benchmark-histogram]")
		, javascript: requireElement(root, "[data-benchmark-js]")
		, lean: requireElement(root, "[data-benchmark-lean]")
		, p95: requireElement(root, "[data-benchmark-p95]")
		, progress: requireElement(root, "[data-benchmark-progress]")
		, ratio: requireElement(root, "[data-benchmark-ratio]")
		, rerun: requireElement(root, "[data-benchmark-run]")
		, summary: requireElement(root, "[data-benchmark-summary]")
	};
	let revision = 0;
	let startedOnce = false;
	let histogramValues = [];
	let preparation;
	const prepareOnce = () => {
		if(!preparation)
		{
			const pending = Promise.resolve().then(prepare).finally(() => {
				if(preparation === pending) preparation = undefined;
			});
			preparation = pending;
		}
		return preparation;
	};

	const drawHistogram = values => {
		histogramValues = values;
		elements.histogram.replaceChildren();
		const chartWidth = Math.max(320, Math.round(elements.histogram.clientWidth));
		elements.histogram.setAttribute("viewBox", `0 0 ${chartWidth} 200`);
		const minimum = Math.floor(Math.min(...values) * 2) / 2;
		let maximum = Math.ceil(Math.max(...values) * 2) / 2;
		if(maximum <= minimum) maximum = minimum + .5;
		const binCount = 10;
		const bins = new Uint32Array(binCount);
		for(const value of values)
		{
			const position = Math.floor((value - minimum) / (maximum - minimum) * binCount);
			bins[Math.min(binCount - 1, Math.max(0, position))] += 1;
		}
		const peak = Math.max(...bins);
		const left = 18;
		const width = chartWidth - left * 2;
		const baseline = 171;
		for(let index = 0; index < binCount; index += 1)
		{
			const barWidth = width / binCount - 3;
			const height = bins[index] / peak * 152;
			const x = left + index * width / binCount;
			elements.histogram.append(svgElement("rect", {
				class: "benchmark-bar", height, width: barWidth, x, y: baseline - height
			}));
			const label = svgElement("text", {
				class: "benchmark-bar-label"
				, "text-anchor": "middle"
				, x: x + barWidth / 2
				, y: 192
			});
			label.textContent = (minimum + index * (maximum - minimum) / binCount).toFixed(1);
			elements.histogram.append(label);
		}
		const sorted = [...values].sort((leftValue, rightValue) => leftValue - rightValue);
		const median = percentile(sorted, .5);
		const medianX = left + (median - minimum) / (maximum - minimum) * width;
		elements.histogram.append(svgElement("line", {
			class: "benchmark-median-line"
			, x1: medianX
			, x2: medianX
			, y1: 12
			, y2: baseline
		}));
		elements.histogram.setAttribute("aria-label",
			`Histogram of ${trialCount} checked Lean samples. Median ${median.toFixed(2)} milliseconds.`);
	};

	let resizeFrame = 0;
	new globalThis.ResizeObserver(() => {
		if(histogramValues.length === 0 || resizeFrame) return;
		resizeFrame = globalThis.requestAnimationFrame(() => {
			resizeFrame = 0;
			drawHistogram(histogramValues);
		});
	}).observe(elements.histogram);

	const cancel = () => {
		startedOnce = true;
		revision += 1;
		elements.rerun.disabled = false;
		elements.cancel.disabled = true;
		elements.progress.textContent = "Cancelled";
	};

	const run = async () => {
		startedOnce = true;
		const current = ++revision;
		elements.rerun.disabled = true;
		elements.cancel.disabled = false;
		try
		{
			await prepareOnce();
			if(current !== revision) return;
			const started = performance.now();
			for(let index = 0; index < warmupCount; index += 1)
			{
				if(current !== revision) return;
				elements.progress.textContent = `Warming up ${index + 1} / ${warmupCount}`;
				await sample(index, true);
				if(current !== revision) return;
				await frame();
			}
			const samples = [];
			for(let index = 0; index < trialCount; index += 1)
			{
				if(current !== revision) return;
				const result = await sample(index, false);
				if(current !== revision) return;
				if(!Number.isFinite(result.leanMs) || result.leanMs < 0
					|| !Number.isFinite(result.javascriptMs) || result.javascriptMs < 0)
					throw new Error("Benchmark sample must contain finite, nonnegative timings");
				samples.push(result);
				elements.progress.textContent = `${index + 1} / ${trialCount} compared`;
				if(index % 2 === 1) await frame();
			}
			if(current !== revision) return;
			const leanTimes = samples.map(result => result.leanMs).sort((left, right) => left - right);
			const javascriptTimes = samples.map(result => result.javascriptMs)
				.sort((left, right) => left - right);
			const leanMedian = percentile(leanTimes, .5);
			const leanP95 = percentile(leanTimes, .95);
			const javascriptMedian = percentile(javascriptTimes, .5);
			const ratios = samples
				.filter(result => result.javascriptMs > 0)
				.map(result => result.leanMs / result.javascriptMs)
				.sort((left, right) => left - right);
			const ratio = ratios.length > 0 ? percentile(ratios, .5) : Number.NaN;
			elements.lean.textContent = `${leanMedian.toFixed(2)} ms`;
			elements.p95.textContent = `${leanP95.toFixed(2)} ms`;
			elements.javascript.textContent = `${javascriptMedian.toFixed(2)} ms`;
			elements.ratio.textContent = Number.isFinite(ratio) ? `${ratio.toFixed(1)}×` : "Timer floor";
			elements.summary.textContent = summarize({
				javascriptMedian, leanMedian, leanP95, ratio, samples, trialCount
			});
			elements.progress.textContent = `Completed in ${((performance.now() - started) / 1000).toFixed(1)} s`;
			drawHistogram(leanTimes);
			elements.rerun.disabled = false;
			elements.cancel.disabled = true;
		}
		catch(error)
		{
			if(current !== revision) return;
			elements.progress.textContent = "Benchmark failed";
			elements.summary.textContent = error instanceof Error ? error.message : String(error);
			elements.rerun.disabled = false;
			elements.cancel.disabled = true;
			console.error(error);
		}
	};

	elements.rerun.addEventListener("click", run);
	elements.cancel.addEventListener("click", cancel);
	globalThis.addEventListener?.("pagehide", () => {
		cancel();
		preparation = undefined;
	});
	elements.cancel.disabled = true;
	if("IntersectionObserver" in globalThis)
	{
		const observer = new globalThis.IntersectionObserver(entries => {
			if(!startedOnce && entries.some(entry => entry.isIntersecting))
			{
				observer.disconnect();
				void run();
			}
		}, { rootMargin: "160px 0px", threshold: .05 });
		observer.observe(root);
	}
	else void run();
	return { cancel, run };
};
