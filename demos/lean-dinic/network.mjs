/**
 * Editable capacity network and stable edge-to-CSR mapping for the flow demo.
 *
 * @file
 */

export const WIDEN_EDGE_ID = "c-sink";
export const WIDEN_CAPACITY = 9;

/**
 * Create an independent copy of the nine-unit bottleneck example.
 *
 * @returns {object} Nodes, stable directed edge IDs, and source/sink indices.
 */
export const createNetwork = () => ({
	source: 0, sink: 5
	, nodes: [
		{ id: "source", name: "Source", x: 81, y: 230 }
		, { id: "a", name: "Relay A", x: 288, y: 129 }
		, { id: "b", name: "Relay B", x: 288, y: 331 }
		, { id: "c", name: "Relay C", x: 612, y: 129 }
		, { id: "d", name: "Relay D", x: 612, y: 331 }
		, { id: "sink", name: "Sink", x: 819, y: 230 }
	]
	, edges: [
		{ id: "source-a", source: 0, target: 1, capacity: 8, labelAt: 0.52 }
		, { id: "source-b", source: 0, target: 2, capacity: 6, labelAt: 0.52 }
		, { id: "a-c", source: 1, target: 3, capacity: 6, labelAt: 0.5 }
		, { id: "a-d", source: 1, target: 4, capacity: 4, labelAt: 0.35 }
		, { id: "b-c", source: 2, target: 3, capacity: 5, labelAt: 0.35 }
		, { id: "b-d", source: 2, target: 4, capacity: 4, labelAt: 0.5 }
		, { id: "c-sink", source: 3, target: 5, capacity: 4, labelAt: 0.48 }
		, { id: "d-sink", source: 4, target: 5, capacity: 5, labelAt: 0.48 }
	]
});

/**
 * Pack outgoing links into CSR while retaining stable UI edge IDs.
 *
 * @param {object} network Directed network with numeric vertex indices.
 * @returns {object} Runtime request, edge IDs in CSR order, and ID-to-index map.
 */
export const buildGraphRequest = network => {
	const edges = network.nodes.flatMap((_, source) => network.edges.filter(edge => edge.source === source));
	const offsets = new Uint32Array(network.nodes.length + 1);
	for(const edge of edges) offsets[edge.source + 1]++;
	for(let index = 1; index < offsets.length; index++) offsets[index] += offsets[index - 1];
	const edgeIds = edges.map(edge => edge.id);
	return {
		request: {
			vertexCount: network.nodes.length, source: network.source, sink: network.sink
			, offsets
			, targets: Uint32Array.from(edges, edge => edge.target)
			, capacities: Uint32Array.from(edges, edge => edge.capacity)
		}
		, edgeIds
		, edgeIndex: new Map(edgeIds.map((id, index) => [id, index]))
	};
};
