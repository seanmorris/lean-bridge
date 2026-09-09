/**
 * Own a workbench's browser resources without changing the compiled algorithm API.
 *
 * @file
 */

import { attachBrowserBenchmark } from "./browser-benchmark.mjs";

/**
 * Create an independently disposable controller lifetime, including late Wasm handles.
 *
 * @param root React-owned workbench scaffold, or the standalone page's main element.
 * @param options Snapshot persistence and initialization failure reporting.
 * @param options.remember Store a cloned, handle-free input snapshot on unmount.
 * @param options.fail Report initialization errors while the route is still mounted.
 */
export const createWorkbenchScope = (root, { remember = () => {}, fail = () => {} } = {}) => {
	const document = root.ownerDocument;
	const window = document.defaultView;
	const listeners = [];
	const cleanups = new Set();
	const handles = new WeakSet();
	const frames = new Set();
	const timers = new Set();
	const hideListeners = new Set();
	let snapshot;
	let active = true;
	const cancelled = () => new DOMException("The workbench was unmounted", "AbortError");
	const own = value => {
		if(!value || typeof value.dispose !== "function" || handles.has(value)) return value;
		handles.add(value);
		const release = value.dispose.bind(value);
		let disposed = false;
		const dispose = () => {
			if(disposed) return;
			disposed = true;
			cleanups.delete(dispose);
			release();
		};
		value.dispose = dispose;
		if(active) cleanups.add(dispose);
		else dispose();
		return value;
	};
	const scope = {
		/** Whether this controller may still update its page. */
		get active() { return active; }
		, root
		, remember: read => { snapshot = read; }
		, fail: error => { if(active) fail(error); }
		, onDispose: callback => {
			if(active) cleanups.add(callback);
			else callback();
		}
		, listen: (target, type, callback, options) => {
			if(!active) return;
			const guarded = event => { if(active) callback(event); };
			target.addEventListener(type, guarded, options);
			// A replaced tile/card must not be retained by its cleanup registration.
			listeners.push([new WeakRef(target), type, new WeakRef(guarded), options]);
			if(listeners.length % 512 === 0)
			{
				let retained = 0;
				for(const entry of listeners) if(entry[0].deref() && entry[2].deref()) listeners[retained++] = entry;
				listeners.length = retained;
			}
			if(target === window && type === "pagehide") hideListeners.add(callback);
		}
		, requestAnimationFrame: callback => {
			if(!active) return 0;
			const id = window.requestAnimationFrame(time => {
				frames.delete(id);
				if(active) callback(time);
			});
			frames.add(id);
			return id;
		}
		, cancelAnimationFrame: id => { frames.delete(id); window.cancelAnimationFrame(id); }
		, setTimeout: (callback, delay) => {
			if(!active) return 0;
			const id = window.setTimeout(() => {
				timers.delete(id);
				if(active) callback();
			}, delay);
			timers.add(id);
			return id;
		}
		, clearTimeout: id => { timers.delete(id); window.clearTimeout(id); }
		, resizeObserver: callback => {
			const observer = new window.ResizeObserver((...args) => { if(active) callback(...args); });
			scope.onDispose(() => observer.disconnect());
			return observer;
		}
		, benchmark: options => own(attachBrowserBenchmark(options))
		, runtime: module => Object.fromEntries(Object.entries(module).map(([name, value]) => [name
			, typeof value !== "function" ? value : (...args) => {
				if(!active) throw cancelled();
				const result = value(...args);
				if(result && typeof result.then === "function") return result.then(prepared => {
					own(prepared);
					if(!active) throw cancelled();
					return prepared;
				}, error => {
					if(active) fail(error);
					throw error;
				});
				return own(result);
			}
		]))
		, dispose: () => {
			if(!active) return;
			const errors = [];
			const releaseSafely = release => {
				try
				{ release(); }
				catch(error)
				{ errors.push(error); }
			};
			// Save only input/model data, before the controller's pagehide tears it down.
			if(snapshot) releaseSafely(() => remember(structuredClone(snapshot())));
			active = false;
			for(const callback of hideListeners) releaseSafely(() => callback({ persisted: false }));
			for(const [targetRef, type, callbackRef, options] of listeners)
			{
				const target = targetRef.deref();
				const callback = callbackRef.deref();
				if(target && callback) target.removeEventListener(type, callback, options);
			}
			for(const id of frames) window.cancelAnimationFrame(id);
			for(const id of timers) window.clearTimeout(id);
			for(const release of cleanups) releaseSafely(release);
			for(const element of root.querySelectorAll("*"))
			{
				// Pointer IDs are recorded at the workbench boundary, not guessed here.
				for(const id of pointers) if(element.hasPointerCapture?.(id)) element.releasePointerCapture(id);
			}
			listeners.length = 0;
			hideListeners.clear();
			cleanups.clear();
			frames.clear();
			timers.clear();
			pointers.clear();
			if(errors.length) throw new AggregateError(errors, "Workbench cleanup failed");
		}
	};
	const pointers = new Set();
	scope.listen(root, "pointerdown", event => pointers.add(event.pointerId), true);
	scope.listen(window, "pointerup", event => pointers.delete(event.pointerId));
	scope.listen(window, "pointercancel", event => pointers.delete(event.pointerId));
	return scope;
};
