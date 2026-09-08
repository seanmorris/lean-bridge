/**
 * Keep editable scene inputs in memory without retaining a browser or Wasm handle.
 *
 * @file
 */

import { explanationScene, seededScene, placeBody, advanceScene } from "./scenario.mjs";

/** Create an isolated scene session for a route mount or a test. */
export const createSceneSession = () => {
	let snapshot = {
		bodies: explanationScene(), revision: 0, axis: 0, selected: 0, allLinks: true
		, seed: "1141", count: 12, seedEdited: false
		, seedNote: "The example uses six boxes. Enter a seed to reproduce a generated scene."
		, hint: "Drag A toward B. Dashed means candidate; solid means overlap."
	};
	const listeners = new Set();
	const update = (patch, changed = false) => {
		snapshot = { ...snapshot, ...patch, revision: snapshot.revision + Number(changed) };
		for(const listener of listeners) listener();
	};
	return {
		getSnapshot: () => snapshot
		, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); }
		, update
		, select: id => {
			if(snapshot.bodies[id]) update({ selected: id, allLinks: false });
		}
		, move: (id, x, y) => {
			if(!snapshot.bodies[id]) return;
			const bodies = snapshot.bodies.map(body => ({ ...body }));
			placeBody(bodies[id], x, y);
			update({ bodies }, true);
		}
		, advance: seconds => {
			const bodies = snapshot.bodies.map(body => ({ ...body }));
			advanceScene(bodies, seconds);
			update({ bodies }, true);
		}
		, generate: () => {
			let seed = Number(snapshot.seed) >>> 0;
			if(!snapshot.seedEdited) seed = (seed + 1) >>> 0;
			const { count } = snapshot;
			update({
				bodies: seededScene(seed, count), selected: 0, allLinks: count <= 6
				, seed: String(seed), seedEdited: false
				, seedNote: `Seed ${seed} · ${count} boxes. Enter a seed, then choose New scene to reproduce it.`
				, hint: "Select a box to focus its pairs, or show all links. Drag any box to change the scene."
			}, true);
		}
		, reset: () => update({
			bodies: explanationScene(), axis: 0, selected: 0, allLinks: true
			, seedNote: "The example uses six boxes. Enter a seed to reproduce a generated scene."
			, hint: "Drag A toward B. Dashed means candidate; solid means overlap."
		}, true)
	};
};

let browserSession;

/** Reuse only input data across client routes; server renders stay isolated. */
export const getBrowserSceneSession = () => typeof globalThis.window === "undefined"
	? createSceneSession() : browserSession ??= createSceneSession();
