/**
 * Independent iterative Tarjan benchmark and Kosaraju correctness reference.
 *
 * @file
 */

/**
 * Materialize sorted member lists and unique edges between representative IDs.
 *
 * @param {object} request Generic CSR graph.
 * @param {Uint32Array} labels Minimum-vertex component representatives.
 * @returns {object} Canonical public partition result.
 */
export const summarizePartition = (request, labels) => {
	const groups = new Map();
	for(let vertex = 0; vertex < request.vertexCount; vertex += 1)
	{
		const root = labels[vertex];
		if(!groups.has(root)) groups.set(root, []);
		groups.get(root).push(vertex);
	}
	const components = [...groups.values()].map(vertices => Uint32Array.from(vertices));
	const outgoing = new Map();
	for(const root of groups.keys()) outgoing.set(root, new Set());
	for(let source = 0; source < request.vertexCount; source += 1)
		for(let edge = request.offsets[source]; edge < request.offsets[source + 1]; edge += 1)
		{
			const from = labels[source];
			const to = labels[request.targets[edge]];
			if(from !== to) outgoing.get(from).add(to);
		}
	const pairs = [];
	for(const [from, targets] of outgoing)
		for(const to of [...targets].sort((left, right) => left - right)) pairs.push(from, to);
	return {
		labels, componentCount: components.length, components
		, condensation: Uint32Array.from(pairs), usedFallback: false
	};
};

/**
 * Prepare a typed-array, explicit-stack Tarjan search without recursive JS calls.
 *
 * @param {object} request Valid generic CSR graph.
 * @returns {() => object} Synchronous search, with setup excluded from timing.
 */
export const prepareJavascriptGraph = request => {
	const vertexCount = request.vertexCount;
	const offsets = request.offsets.slice();
	const targets = request.targets.slice();
	const graph = { vertexCount, offsets, targets };
	return () => {
		const index = new Int32Array(vertexCount).fill(-1);
		const low = new Uint32Array(vertexCount);
		const active = new Uint8Array(vertexCount);
		const members = new Uint32Array(vertexCount);
		const frames = new Uint32Array(vertexCount);
		const cursors = new Uint32Array(vertexCount);
		const labels = new Uint32Array(vertexCount);
		let clock = 0;
		let memberCount = 0;
		let depth = 0;
		const discover = vertex => {
			index[vertex] = clock;
			low[vertex] = clock++;
			active[vertex] = 1;
			members[memberCount++] = vertex;
			frames[depth] = vertex;
			cursors[depth++] = offsets[vertex];
		};
		for(let start = 0; start < vertexCount; start += 1)
		{
			if(index[start] !== -1) continue;
			discover(start);
			while(depth > 0)
			{
				const vertex = frames[depth - 1];
				if(cursors[depth - 1] < offsets[vertex + 1])
				{
					const next = targets[cursors[depth - 1]++];
					if(index[next] === -1) discover(next);
					else if(active[next]) low[vertex] = Math.min(low[vertex], index[next]);
					continue;
				}
				depth -= 1;
				if(low[vertex] === index[vertex])
				{
					const end = memberCount;
					let root = vertex;
					let member;
					do
					{
						member = members[--memberCount];
						active[member] = 0;
						root = Math.min(root, member);
					}
					while(member !== vertex);
					for(let position = memberCount; position < end; position += 1) labels[members[position]] = root;
				}
				if(depth > 0)
				{
					const parent = frames[depth - 1];
					low[parent] = Math.min(low[parent], low[vertex]);
				}
			}
		}
		return summarizePartition(graph, labels);
	};
};

/**
 * Find SCCs independently using finishing order and a reversed graph.
 *
 * @param {object} request Generic CSR graph.
 * @returns {Uint32Array} Canonical minimum-vertex labels.
 */
export const kosarajuLabels = request => {
	const { vertexCount, offsets, targets } = request;
	const visited = new Uint8Array(vertexCount);
	const frames = new Uint32Array(vertexCount);
	const cursors = new Uint32Array(vertexCount);
	const finished = new Uint32Array(vertexCount);
	let finishedCount = 0;
	for(let start = 0; start < vertexCount; start += 1)
	{
		if(visited[start]) continue;
		visited[start] = 1;
		let depth = 1;
		frames[0] = start; cursors[0] = offsets[start];
		while(depth > 0)
		{
			const vertex = frames[depth - 1];
			if(cursors[depth - 1] < offsets[vertex + 1])
			{
				const next = targets[cursors[depth - 1]++];
				if(visited[next]) continue;
				visited[next] = 1;
				frames[depth] = next; cursors[depth++] = offsets[next];
			}
			else
			{ finished[finishedCount++] = vertex; depth -= 1; }
		}
	}
	const reverseOffsets = new Uint32Array(vertexCount + 1);
	for(const target of targets) reverseOffsets[target + 1] += 1;
	for(let vertex = 1; vertex <= vertexCount; vertex += 1) reverseOffsets[vertex] += reverseOffsets[vertex - 1];
	const reverseTargets = new Uint32Array(targets.length);
	const positions = reverseOffsets.slice();
	for(let source = 0; source < vertexCount; source += 1)
		for(let edge = offsets[source]; edge < offsets[source + 1]; edge += 1)
			reverseTargets[positions[targets[edge]]++] = source;
	const labels = new Uint32Array(vertexCount).fill(vertexCount);
	for(let position = finishedCount - 1; position >= 0; position -= 1)
	{
		const start = finished[position];
		if(labels[start] !== vertexCount) continue;
		const component = [start];
		labels[start] = start;
		let root = start;
		for(let head = 0; head < component.length; head += 1)
		{
			const vertex = component[head];
			root = Math.min(root, vertex);
			for(let edge = reverseOffsets[vertex]; edge < reverseOffsets[vertex + 1]; edge += 1)
			{
				const next = reverseTargets[edge];
				if(labels[next] !== vertexCount) continue;
				labels[next] = start;
				component.push(next);
			}
		}
		for(const vertex of component) labels[vertex] = root;
	}
	return labels;
};
