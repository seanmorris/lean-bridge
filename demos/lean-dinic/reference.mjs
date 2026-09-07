/**
 * Independent BigInt Edmonds–Karp oracle and typed-array JavaScript Dinic baseline.
 *
 * @file
 */

/**
 * Build a CSR request from ordered [source, target, capacity] triples.
 *
 * @param {number} vertexCount Number of vertices.
 * @param {number[][]} edges Directed capacity triples.
 * @param {number} source Source vertex.
 * @param {number} sink Sink vertex.
 */
export const fromEdges = (vertexCount, edges, source = 0, sink = vertexCount - 1) => {
	const rows = Array.from({ length: vertexCount }, () => []);
	for(const edge of edges) rows[edge[0]].push(edge);
	const offsets = new Uint32Array(vertexCount + 1);
	const targets = new Uint32Array(edges.length);
	const capacities = new Uint32Array(edges.length);
	let index = 0;
	for(let vertex = 0; vertex < vertexCount; vertex++)
	{
		for(const [, target, capacity] of rows[vertex])
		{ targets[index] = target; capacities[index++] = capacity; }
		offsets[vertex + 1] = index;
	}
	return { vertexCount, source, sink, offsets, targets, capacities };
};

/**
 * Find maximum flow with a separate arbitrary-precision augmenting-path implementation.
 *
 * @param {object} root0 Network configuration.
 * @param {number} root0.vertexCount Number of vertices.
 * @param {number} root0.source Source vertex.
 * @param {number} root0.sink Sink vertex.
 * @param {Uint32Array} root0.offsets CSR row boundaries.
 * @param {Uint32Array} root0.targets CSR destination vertices.
 * @param {Uint32Array} root0.capacities Original edge capacities.
 */
export const solveOracle = ({ vertexCount, source, sink, offsets, targets, capacities }) => {
	const rows = Array.from({ length: vertexCount }, () => []);
	const originals = [];
	for(let vertex = 0; vertex < vertexCount; vertex++)
		for(let index = offsets[vertex]; index < offsets[vertex + 1]; index++)
		{
			const forward = { target: targets[index], residual: BigInt(capacities[index]), reverse: null };
			const reverse = { target: vertex, residual: 0n, reverse: forward };
			forward.reverse = reverse;
			rows[vertex].push(forward); rows[forward.target].push(reverse); originals.push(forward);
		}
	let value = 0n;
	let seen;
	while(true)
	{
		seen = new Uint8Array(vertexCount);
		const parent = Array(vertexCount);
		const queue = [source];
		seen[source] = 1;
		for(let head = 0; head < queue.length; head++)
			for(const edge of rows[queue[head]])
				if(edge.residual > 0n && !seen[edge.target])
				{
					seen[edge.target] = 1;
					parent[edge.target] = edge;
					queue.push(edge.target);
				}
		if(!seen[sink]) break;
		let amount = null;
		for(let vertex = sink; vertex !== source; vertex = parent[vertex].reverse.target)
			if(amount === null || parent[vertex].residual < amount) amount = parent[vertex].residual;
		for(let vertex = sink; vertex !== source; vertex = parent[vertex].reverse.target)
		{
			parent[vertex].residual -= amount;
			parent[vertex].reverse.residual += amount;
		}
		value += amount;
	}
	return { value: Number(value), cutCapacity: Number(value)
		, flows: Uint32Array.from(originals, (edge, index) => Number(BigInt(capacities[index]) - edge.residual))
		, sourceSide: Uint32Array.from(seen)
	};
};

/**
 * Check every returned edge and vertex with exact arithmetic and an independent optimum.
 *
 * @param {object} request Generic capacitated CSR network.
 * @param {object} result Flow, cut, and exact total returned by a solver.
 * @param {number} [expectedValue] Independently computed maximum throughput.
 */
export const verifyResult = (request, result, expectedValue) => {
	const { vertexCount, source, sink, offsets, targets, capacities } = request;
	if(result.flows.length !== targets.length || result.sourceSide.length !== vertexCount)
		throw new Error("Incorrect result dimensions");
	if(!Number.isSafeInteger(result.value) || result.value < 0
		|| !Number.isSafeInteger(result.cutCapacity) || result.cutCapacity < 0)
		throw new Error("Flow totals must be exact nonnegative integers");
	if(result.sourceSide[source] !== 1 || result.sourceSide[sink] !== 0)
		throw new Error("Cut does not separate source from sink");
	const balances = Array(vertexCount).fill(0n);
	let cut = 0n;
	for(let vertex = 0; vertex < vertexCount; vertex++)
	{
		if(result.sourceSide[vertex] !== 0 && result.sourceSide[vertex] !== 1)
			throw new Error("Invalid cut membership flag");
		for(let index = offsets[vertex]; index < offsets[vertex + 1]; index++)
		{
			if(!Number.isSafeInteger(result.flows[index]) || result.flows[index] < 0)
				throw new Error("Edge flow must be an exact nonnegative integer");
			if(result.flows[index] > capacities[index]) throw new Error("Flow exceeds edge capacity");
			const amount = BigInt(result.flows[index]);
			balances[vertex] += amount; balances[targets[index]] -= amount;
			if(result.sourceSide[vertex] && !result.sourceSide[targets[index]]) cut += BigInt(capacities[index]);
		}
	}
	for(let vertex = 0; vertex < vertexCount; vertex++)
	{
		const expected = vertex === source ? BigInt(result.value) : vertex === sink ? -BigInt(result.value) : 0n;
		if(balances[vertex] !== expected) throw new Error("Flow violates vertex conservation");
	}
	if(cut !== BigInt(result.cutCapacity) || cut !== BigInt(result.value))
		throw new Error("Flow does not match the returned cut capacity");
	if(expectedValue !== undefined && result.value !== expectedValue)
		throw new Error("Flow differs from the independent optimum");
	return true;
};

/**
 * Enumerate all separating cuts for a tiny graph, independent of any flow algorithm.
 *
 * @param {object} root0 Network configuration.
 * @param {number} root0.vertexCount Number of vertices.
 * @param {number} root0.source Source vertex.
 * @param {number} root0.sink Sink vertex.
 * @param {Uint32Array} root0.offsets CSR row boundaries.
 * @param {Uint32Array} root0.targets CSR destination vertices.
 * @param {Uint32Array} root0.capacities Original edge capacities.
 */
export const exhaustiveCutValue = ({ vertexCount, source, sink, offsets, targets, capacities }) => {
	if(vertexCount > 20) throw new RangeError("Exhaustive cuts are only for tiny graphs");
	let best = Infinity;
	for(let mask = 0; mask < 2 ** vertexCount; mask++)
	{
		if(!(mask & 2 ** source) || mask & 2 ** sink) continue;
		let cost = 0;
		for(let vertex = 0; vertex < vertexCount; vertex++)
			if(mask & 2 ** vertex)
				for(let index = offsets[vertex]; index < offsets[vertex + 1]; index++)
					if(!(mask & 2 ** targets[index])) cost += capacities[index];
		best = Math.min(best, cost);
	}
	return best;
};

/**
 * Prepare a matched iterative typed-array Dinic solver with freshly owned output per call.
 *
 * @param {object} root0 Network configuration.
 * @param {number} root0.vertexCount Number of vertices.
 * @param {number} root0.source Source vertex.
 * @param {number} root0.sink Sink vertex.
 * @param {Uint32Array} root0.offsets CSR row boundaries.
 * @param {Uint32Array} root0.targets CSR destination vertices.
 * @param {Uint32Array} root0.capacities Original edge capacities.
 */
export const prepareJavascript = ({ vertexCount: count, source, sink, offsets, targets, capacities }) => {
	const originals = capacities.slice();
	const edgeCount = targets.length;
	const degree = new Uint32Array(count);
	for(let vertex = 0; vertex < count; vertex++)
		for(let edge = offsets[vertex]; edge < offsets[vertex + 1]; edge++)
		{ degree[vertex]++; degree[targets[edge]]++; }
	const starts = new Uint32Array(count + 1);
	for(let vertex = 0; vertex < count; vertex++) starts[vertex + 1] = starts[vertex] + degree[vertex];
	const positions = starts.slice(0, count);
	const arcs = new Uint32Array(edgeCount * 2);
	const to = new Uint32Array(edgeCount * 2);
	const initial = new Uint32Array(edgeCount * 2);
	for(let vertex = 0; vertex < count; vertex++)
		for(let edge = offsets[vertex]; edge < offsets[vertex + 1]; edge++)
		{
			const arc = edge * 2;
			arcs[positions[vertex]++] = arc; arcs[positions[targets[edge]]++] = arc + 1;
			to[arc] = targets[edge]; to[arc + 1] = vertex; initial[arc] = originals[edge];
		}
	return () => {
		const residual = initial.slice();
		const levels = new Int32Array(count);
		const cursor = new Uint32Array(count);
		const queue = new Uint32Array(count);
		const path = new Uint32Array(count);
		const limits = new Float64Array(count);
		let value = 0;
		let phaseCount = 0;
		let augmentationCount = 0;
		while(true)
		{
			levels.fill(-1); levels[source] = 0; queue[0] = source;
			let tail = 1;
			for(let head = 0; head < tail; head++)
			{
				const vertex = queue[head];
				for(let index = starts[vertex]; index < starts[vertex + 1]; index++)
				{
					const arc = arcs[index];
					if(residual[arc] && levels[to[arc]] < 0)
					{ levels[to[arc]] = levels[vertex] + 1; queue[tail++] = to[arc]; }
				}
			}
			if(levels[sink] < 0) break;
			phaseCount++; cursor.set(starts.subarray(0, count));
			while(true)
			{
				let vertex = source;
				let depth = 0;
				let amount = 0xffff_ffff;
				while(vertex !== sink)
				{
					const position = cursor[vertex];
					if(position < starts[vertex + 1])
					{
						const arc = arcs[position];
						if(residual[arc] && levels[to[arc]] === levels[vertex] + 1)
						{
							path[depth] = arc; limits[depth++] = amount;
							amount = Math.min(amount, residual[arc]); vertex = to[arc];
						}
						else cursor[vertex]++;
					}
					else if(depth)
					{
						const arc = path[--depth];
						vertex = to[arc ^ 1]; amount = limits[depth]; cursor[vertex]++;
					}
					else
					{ amount = 0; break; }
				}
				if(!amount) break;
				for(let index = 0; index < depth; index++)
				{ residual[path[index]] -= amount; residual[path[index] ^ 1] += amount; }
				value += amount; augmentationCount++;
			}
		}
		return {
			value
			, cutCapacity: value
			, phaseCount
			, augmentationCount
			, usedFallback: false
			, flows: Uint32Array.from(originals, (capacity, edge) => capacity - residual[edge * 2])
			, sourceSide: Uint32Array.from(levels, level => level >= 0 ? 1 : 0)
		};
	};
};
