/**
 * Retain editable capacities and selection in memory between React route visits.
 *
 * @file
 */

import { createNetwork, WIDEN_CAPACITY, WIDEN_EDGE_ID } from "./network.mjs";

/**
 * Copy the small presentation network without sharing mutable caller data.
 *
 * @param network Nodes, links, and source/sink terminals to copy.
 */
export const copyNetwork = network => ({ ...network, nodes: network.nodes.map(node => ({ ...node })), edges: network.edges.map(edge => ({ ...edge })) });

/** Create a session with no browser, storage, or compiled-runtime dependencies. */
export const createNetworkSession = () => {
	let network = createNetwork();
	let selected = WIDEN_EDGE_ID;
	let revision = 0;
	let hasEdits = false;
	let motionPaused = null;
	let baseline;
	const listeners = new Set();
	const notify = () => { for(const listener of listeners) listener(); };
	const select = id => {
		if(!network.edges.some(edge => edge.id === id)) throw new RangeError("Unknown network edge");
		if(selected === id) return;
		selected = id;
		notify();
	};
	const setCapacity = value => {
		const number = Number(value);
		const capacity = Math.min(20, Math.max(0, Number.isFinite(number) ? Math.round(number) : 0));
		const edge = network.edges.find(item => item.id === selected);
		if(edge.capacity === capacity) return;
		network = { ...network, edges: network.edges.map(item => item.id === selected ? { ...item, capacity } : item) };
		revision++;
		hasEdits = true;
		notify();
	};
	return {
		getSnapshot: () => ({ network: copyNetwork(network), selected, revision, hasEdits, motionPaused, baseline: baseline && { ...baseline } })
		, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); }
		, select, setCapacity
		, widen: () => { select(WIDEN_EDGE_ID); setCapacity(WIDEN_CAPACITY); }
		, pauseMotion: paused => { motionPaused = Boolean(paused); notify(); }
		, acceptBaseline: (value, cut) => {
			if(baseline || hasEdits) return;
			baseline = { value, cut };
			notify();
		}
		, reset: () => {
			network = createNetwork();
			selected = WIDEN_EDGE_ID;
			baseline = undefined;
			hasEdits = false;
			revision++;
			notify();
		}
	};
};

let browserSession;

/** Obtain page-memory state only after client mounting; a full reload starts fresh. */
export const getBrowserNetworkSession = () => browserSession ??= createNetworkSession();
