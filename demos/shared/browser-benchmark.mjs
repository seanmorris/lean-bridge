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
 * @param root0.canRun Whether the owning demo has settled; call refresh when it changes.
 * @param root0.trialCount Number of measured samples.
 * @param root0.warmupCount Number of excluded warm-up samples.
 * @returns {{cancel: () => void, run: () => Promise<void>, refresh: () => void, dispose: () => void}} Benchmark controls.
 */
export const attachBrowserBenchmark = ({
	root
	, prepare
	, sample
	, summarize
	, canRun = () => true
	, trialCount = 100
	, warmupCount = 5
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
	let disposed = false;
	let lifetime = 0;
	let visibilityObserver;
	let fallbackVisibility;
	let inView = false;
	let eligibilityRevision = 0;
	let eligible = false;
	let wake;
	const runnable = () => inView && !globalThis.document.hidden && canRun();
	const releaseWaiter = () => { const resolve = wake; wake = undefined; resolve?.(); };
	const frames = new Map();
	const frame = () => new Promise(resolve => {
		const handle = globalThis.requestAnimationFrame(() => {
			frames.delete(handle);
			resolve();
		});
		frames.set(handle, resolve);
	});
	const releaseFrames = () => {
		for(const [handle, resolve] of frames)
		{
			globalThis.cancelAnimationFrame?.(handle);
			resolve();
		}
		frames.clear();
	};
	let preparation;
	const prepareOnce = () => {
		if(!preparation)
		{
			const current = lifetime;
			const pending = Promise.resolve().then(() => {
				if(!disposed && current === lifetime) return prepare();
			}).finally(() => {
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
	const resizeObserver = new globalThis.ResizeObserver(() => {
		if(disposed || histogramValues.length === 0 || resizeFrame) return;
		resizeFrame = globalThis.requestAnimationFrame(() => {
			resizeFrame = 0;
			if(!disposed) drawHistogram(histogramValues);
		});
	});
	resizeObserver.observe(elements.histogram);

	const cancel = () => {
		if(disposed) return;
		startedOnce = true;
		revision += 1;
		releaseWaiter();
		releaseFrames();
		elements.rerun.disabled = false;
		elements.cancel.disabled = true;
		elements.progress.textContent = "Cancelled";
	};
	const waitUntilRunnable = async current => {
		while(!disposed && current === revision && !runnable())
		{
			elements.progress.textContent = !inView ? "Waiting to enter view"
				: globalThis.document.hidden ? "Waiting for this tab" : "Waiting for demo to settle";
			await new Promise(resolve => { wake = resolve; });
		}
		return !disposed && current === revision;
	};

	const run = async () => {
		if(disposed) return;
		startedOnce = true;
		const current = ++revision;
		releaseWaiter();
		releaseFrames();
		elements.rerun.disabled = true;
		elements.cancel.disabled = false;
		try
		{
			if(!await waitUntilRunnable(current) || current !== revision) return;
			await prepareOnce();
			if(current !== revision) return;
			const started = performance.now();
			const samples = [];
			let warmed = 0;
			let uninterrupted = eligibilityRevision;
			while(samples.length < trialCount)
			{
				if(!await waitUntilRunnable(current) || current !== revision) return;
				if(uninterrupted !== eligibilityRevision)
				{
					// Resume with fresh warmups and one uninterrupted measurement set.
					uninterrupted = eligibilityRevision;
					warmed = 0;
					samples.length = 0;
				}
				const warmup = warmed < warmupCount;
				const index = warmup ? warmed : samples.length;
				if(warmup) elements.progress.textContent = `Warming up ${index + 1} / ${warmupCount}`;
				const result = await sample(index, warmup);
				if(current !== revision) return;
				if(uninterrupted !== eligibilityRevision || !runnable()) continue;
				if(warmup)
				{
					warmed++;
					await frame();
					continue;
				}
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
	const refresh = () => {
		if(disposed) return;
		const next = runnable();
		if(eligible && !next) eligibilityRevision++;
		eligible = next;
		releaseWaiter();
		if(!startedOnce && inView && !globalThis.document.hidden) void run();
	};

	elements.rerun.addEventListener("click", run);
	elements.cancel.addEventListener("click", cancel);
	const hide = () => {
		lifetime++;
		cancel();
		preparation = undefined;
		releaseFrames();
	};
	globalThis.addEventListener?.("pagehide", hide);
	globalThis.document.addEventListener?.("visibilitychange", refresh);
	elements.cancel.disabled = true;
	if(typeof globalThis.IntersectionObserver === "function")
	{
		visibilityObserver = new globalThis.IntersectionObserver(entries => {
			inView = entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= .05);
			refresh();
		}, { rootMargin: "0px", threshold: .05 });
		visibilityObserver.observe(root);
	}
	else
	{
		fallbackVisibility = () => {
			const bounds = root.getBoundingClientRect();
			const width = Math.max(0, Math.min(bounds.right, globalThis.innerWidth) - Math.max(bounds.left, 0));
			const height = Math.max(0, Math.min(bounds.bottom, globalThis.innerHeight) - Math.max(bounds.top, 0));
			inView = bounds.width > 0 && bounds.height > 0 && width * height / (bounds.width * bounds.height) >= .05;
			refresh();
		};
		globalThis.addEventListener("scroll", fallbackVisibility, { passive: true });
		globalThis.addEventListener("resize", fallbackVisibility);
		fallbackVisibility();
	}
	const dispose = () => {
		if(disposed) return;
		hide();
		disposed = true;
		elements.rerun.removeEventListener?.("click", run);
		elements.cancel.removeEventListener?.("click", cancel);
		globalThis.removeEventListener?.("pagehide", hide);
		globalThis.document.removeEventListener?.("visibilitychange", refresh);
		if(fallbackVisibility)
		{
			globalThis.removeEventListener("scroll", fallbackVisibility);
			globalThis.removeEventListener("resize", fallbackVisibility);
		}
		resizeObserver.disconnect();
		visibilityObserver?.disconnect();
		if(resizeFrame) globalThis.cancelAnimationFrame?.(resizeFrame);
		resizeFrame = 0;
	};
	return { cancel, run, refresh, dispose };
};
