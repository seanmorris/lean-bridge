/**
 * Provides the pure maze and grid adapter for the generic union-find module.
 *
 * @file
 */

export const WIDTH = 31;
export const HEIGHT = 21;
export const SITE_COUNT = WIDTH * HEIGHT;
export const INLET = SITE_COUNT;
export const OUTLET = SITE_COUNT + 1;
export const GRAPH_COUNT = SITE_COUNT + 2;

/**
 * Creates a deterministic unsigned 32-bit random source from a seed.
 *
 * @param {number} seed Initial random state.
 */
export const makeRandom = seed => {
	let value = seed >>> 0;
	return () => {
		value ^= value << 13;
		value ^= value >>> 17;
		value ^= value << 5;
		return value >>> 0;
	};
};

/**
 * Builds a seeded permutation containing every non-wall site once.
 *
 * @param {number} seed Random state used to shuffle the available sites.
 * @param {Uint8Array} walls Permanent-wall flags.
 */
export const activationOrder = (seed, walls = new Uint8Array(SITE_COUNT)) => {
	if(walls.length !== SITE_COUNT) throw new RangeError(`walls must contain ${SITE_COUNT} sites`);
	const order = Uint32Array.from({ length: SITE_COUNT }, (_, index) => index)
		.filter(site => !walls[site]);
	const next = makeRandom(seed || 1);
	for(let index = order.length - 1; index > 0; index -= 1)
	{
		const target = next() % (index + 1);
		[order[index], order[target]] = [order[target], order[index]];
	}
	return order;
};

/**
 * Generates a connected maze, then braids it with extra passages and boundary entries.
 *
 * @param {number} seed Maze-generation seed.
 */
export const mazeWalls = seed => {
	const walls = new Uint8Array(SITE_COUNT);
	walls.fill(1);
	const next = makeRandom(seed || 1);
	const logicalRows = Math.floor((HEIGHT - 1) / 2);
	const logicalColumns = Math.floor((WIDTH - 1) / 2);
	const logicalCount = logicalRows * logicalColumns;
	const visited = new Uint8Array(logicalCount);
	const toSite = logical => {
		const row = Math.floor(logical / logicalColumns);
		const column = logical % logicalColumns;
		return (row * 2 + 1) * WIDTH + column * 2 + 1;
	};
	const start = next() % logicalCount;
	const stack = [start];
	visited[start] = 1;
	walls[toSite(start)] = 0;
	while(stack.length)
	{
		const current = stack.at(-1);
		const row = Math.floor(current / logicalColumns);
		const column = current % logicalColumns;
		const neighbors = [];
		if(row > 0 && !visited[current - logicalColumns]) neighbors.push(current - logicalColumns);
		if(row + 1 < logicalRows && !visited[current + logicalColumns]) neighbors.push(current + logicalColumns);
		if(column > 0 && !visited[current - 1]) neighbors.push(current - 1);
		if(column + 1 < logicalColumns && !visited[current + 1]) neighbors.push(current + 1);
		if(!neighbors.length)
		{ stack.pop(); continue; }
		const target = neighbors[next() % neighbors.length];
		const sourceSite = toSite(current);
		const targetSite = toSite(target);
		walls[targetSite] = 0;
		walls[(sourceSite + targetSite) / 2] = 0;
		visited[target] = 1;
		stack.push(target);
	}

	const braidCandidates = [];
	for(let row = 1; row < HEIGHT - 1; row += 1)
	{
		for(let column = 1; column < WIDTH - 1; column += 1)
		{
			if(row % 2 === column % 2 || !walls[row * WIDTH + column]) continue;
			braidCandidates.push(row * WIDTH + column);
		}
	}
	for(let index = braidCandidates.length - 1; index > 0; index -= 1)
	{
		const target = next() % (index + 1);
		[braidCandidates[index], braidCandidates[target]] = [braidCandidates[target], braidCandidates[index]];
	}
	for(let index = 0; index < Math.floor(braidCandidates.length * .42); index += 1)
	{
		walls[braidCandidates[index]] = 0;
	}

	const entryColumns = new Set();
	while(entryColumns.size < 3) entryColumns.add((next() % logicalColumns) * 2 + 1);
	for(const column of entryColumns) walls[column] = 0;
	const exitColumns = new Set();
	while(exitColumns.size < 3) exitColumns.add((next() % logicalColumns) * 2 + 1);
	for(const column of exitColumns) walls[(HEIGHT - 1) * WIDTH + column] = 0;
	return walls;
};

/**
 * Converts an activation-order prefix into site flags.
 *
 * @param {Uint32Array} order Seeded passage order.
 * @param {number} count Number of passages to activate.
 */
export const activeFromPrefix = (order, count) => {
	const active = new Uint8Array(SITE_COUNT);
	for(let index = 0; index < count; index += 1) active[order[index]] = 1;
	return active;
};

/**
 * Converts open neighboring passages into generic endpoint pairs.
 *
 * @param {Uint8Array} active Open-passage flags.
 * @param {Uint8Array} walls Permanent-wall flags.
 * @param {boolean} withBoundaries Whether to include inlet and outlet vertices.
 */
export const linksForActive = (active, walls = new Uint8Array(SITE_COUNT), withBoundaries = false) => {
	if(active.length !== SITE_COUNT) throw new RangeError(`active must contain ${SITE_COUNT} sites`);
	if(walls.length !== SITE_COUNT) throw new RangeError(`walls must contain ${SITE_COUNT} sites`);
	const links = [];
	for(let site = 0; site < SITE_COUNT; site += 1)
	{
		if(!active[site] || walls[site]) continue;
		const column = site % WIDTH;
		if(column + 1 < WIDTH && active[site + 1] && !walls[site + 1]) links.push(site, site + 1);
		if(site + WIDTH < SITE_COUNT && active[site + WIDTH] && !walls[site + WIDTH]) links.push(site, site + WIDTH);
		if(withBoundaries && site < WIDTH) links.push(INLET, site);
		if(withBoundaries && site >= SITE_COUNT - WIDTH) links.push(OUTLET, site);
	}
	return Uint32Array.from(links);
};

/**
 * Computes shortest open-passage distance from any inlet cell.
 *
 * @param {Uint8Array} active Open-passage flags.
 * @param {Uint8Array} walls Maze-wall flags.
 */
export const inletDistances = (active, walls = new Uint8Array(SITE_COUNT)) => {
	if(active.length !== SITE_COUNT || walls.length !== SITE_COUNT)
	{
		throw new RangeError("maze dimensions do not match the grid");
	}
	const distances = new Int32Array(SITE_COUNT);
	distances.fill(-1);
	const queue = new Uint32Array(SITE_COUNT);
	let head = 0;
	let tail = 0;
	for(let site = 0; site < WIDTH; site += 1)
	{
		if(!active[site] || walls[site]) continue;
		distances[site] = 0;
		queue[tail++] = site;
	}
	while(head < tail)
	{
		const site = queue[head++];
		const row = Math.floor(site / WIDTH);
		const column = site % WIDTH;
		const neighbors = [];
		if(row > 0) neighbors.push(site - WIDTH);
		if(row + 1 < HEIGHT) neighbors.push(site + WIDTH);
		if(column > 0) neighbors.push(site - 1);
		if(column + 1 < WIDTH) neighbors.push(site + 1);
		for(const target of neighbors)
		{
			if(distances[target] >= 0 || !active[target] || walls[target]) continue;
			distances[target] = distances[site] + 1;
			queue[tail++] = target;
		}
	}
	return distances;
};

/**
 * Derives display facts from a checked generic partition.
 *
 * @param {Uint8Array} active Open-passage flags.
 * @param {Uint32Array} representatives Representatives returned by Lean.
 * @param {Uint8Array} walls Permanent-wall flags.
 */
export const analyzePartition = (active, representatives, walls = new Uint8Array(SITE_COUNT)) => {
	if(active.length !== SITE_COUNT || representatives.length < SITE_COUNT || walls.length !== SITE_COUNT)
	{
		throw new RangeError("partition dimensions do not match the grid");
	}
	const topRoots = new Set();
	const bottomRoots = new Set();
	const minimumSite = new Map();
	let activeCount = 0;
	for(let site = 0; site < SITE_COUNT; site += 1)
	{
		if(!active[site] || walls[site]) continue;
		activeCount += 1;
		const root = representatives[site];
		const previous = minimumSite.get(root);
		if(previous === undefined || site < previous) minimumSite.set(root, site);
		if(site < WIDTH) topRoots.add(root);
		if(site >= SITE_COUNT - WIDTH) bottomRoots.add(root);
	}
	const spanningRoots = new Set([...topRoots].filter(root => bottomRoots.has(root)));
	const spans = representatives.length >= GRAPH_COUNT
		? representatives[INLET] === representatives[OUTLET]
		: spanningRoots.size > 0;
	return { activeCount, bottomRoots, componentCount: minimumSite.size, minimumSite, spanningRoots, spans, topRoots };
};
