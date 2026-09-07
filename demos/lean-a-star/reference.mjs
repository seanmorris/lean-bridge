/**
 * Independent typed-array JavaScript A* and Bellman–Ford reference searches.
 *
 * @file
 */

/**
 * Prepare an independent binary-heap A* using f, descending g, then vertex ties.
 *
 * @param {object} request Valid generic CSR search request.
 * @returns {() => object} Synchronous search with independently owned graph inputs.
 */
export const prepareJavascriptSearch = request => {
	const { vertexCount, start, target } = request;
	const offsets = request.offsets.slice();
	const targets = request.targets.slice();
	const weights = request.weights.slice();
	const heuristic = request.heuristic.slice();
	return () => {
		const distance = new Float64Array(vertexCount).fill(Infinity);
		const previous = new Uint32Array(vertexCount).fill(vertexCount);
		const closed = new Uint8Array(vertexCount);
		const expanded = new Uint32Array(vertexCount);
		const heapVertex = new Uint32Array(targets.length + 1);
		const heapDistance = new Float64Array(targets.length + 1);
		const heapPriority = new Float64Array(targets.length + 1);
		let heapSize = 0;
		let expandedCount = 0;
		const precedes = (f, g, vertex, index) => f < heapPriority[index]
			|| f === heapPriority[index] && (g > heapDistance[index]
				|| g === heapDistance[index] && vertex < heapVertex[index]);
		const push = (vertex, g) => {
			const f = g + heuristic[vertex];
			let index = heapSize++;
			while(index > 0)
			{
				const parent = (index - 1) >>> 1;
				if(!precedes(f, g, vertex, parent)) break;
				heapVertex[index] = heapVertex[parent];
				heapDistance[index] = heapDistance[parent];
				heapPriority[index] = heapPriority[parent];
				index = parent;
			}
			heapVertex[index] = vertex;
			heapDistance[index] = g;
			heapPriority[index] = f;
		};
		distance[start] = 0;
		push(start, 0);
		while(heapSize > 0)
		{
			const vertex = heapVertex[0];
			const g = heapDistance[0];
			heapSize -= 1;
			if(heapSize > 0)
			{
				const lastVertex = heapVertex[heapSize];
				const lastG = heapDistance[heapSize];
				const lastF = heapPriority[heapSize];
				let index = 0;
				while(index * 2 + 1 < heapSize)
				{
					let child = index * 2 + 1;
					const right = child + 1;
					if(right < heapSize && precedes(heapPriority[right], heapDistance[right], heapVertex[right], child))
						child = right;
					if(!precedes(heapPriority[child], heapDistance[child], heapVertex[child], heapSize)) break;
					heapVertex[index] = heapVertex[child];
					heapDistance[index] = heapDistance[child];
					heapPriority[index] = heapPriority[child];
					index = child;
				}
				heapVertex[index] = lastVertex;
				heapDistance[index] = lastG;
				heapPriority[index] = lastF;
			}
			if(closed[vertex] || g !== distance[vertex]) continue;
			closed[vertex] = 1;
			expanded[expandedCount++] = vertex;
			if(vertex === target)
			{
				let length = 1;
				for(let node = target; node !== start; node = previous[node]) length += 1;
				const path = new Uint32Array(length);
				let node = target;
				for(let index = length - 1; index >= 0; index -= 1)
				{ path[index] = node; node = previous[node]; }
				return { kind: "path", path, cost: g, expanded: expanded.slice(0, expandedCount), usedFallback: false };
			}
			for(let index = offsets[vertex]; index < offsets[vertex + 1]; index += 1)
			{
				const next = targets[index];
				const cost = g + weights[index];
				if(closed[next] || cost >= distance[next]) continue;
				distance[next] = cost;
				previous[next] = vertex;
				push(next, cost);
			}
		}
		return {
			kind: "unreachable", path: new Uint32Array(), cost: 0
			, expanded: expanded.slice(0, expandedCount), usedFallback: false
		};
	};
};

/**
 * Compute shortest distances by repeated full edge relaxation, without a heap.
 *
 * @param {object} request Generic CSR graph and starting vertex.
 * @returns {Float64Array} Distances, with Infinity for unreachable vertices.
 */
export const bellmanFord = request => {
	const { vertexCount, offsets, targets, weights, start } = request;
	const distance = new Float64Array(vertexCount).fill(Infinity);
	distance[start] = 0;
	for(let pass = 1; pass < vertexCount; pass += 1)
	{
		let changed = false;
		for(let source = 0; source < vertexCount; source += 1)
			for(let index = offsets[source]; index < offsets[source + 1]; index += 1)
			{
				const candidate = distance[source] + weights[index];
				if(candidate >= distance[targets[index]]) continue;
				distance[targets[index]] = candidate;
				changed = true;
			}
		if(!changed) break;
	}
	return distance;
};
