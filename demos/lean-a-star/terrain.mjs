/**
 * Converts editable weighted terrain into generic graph requests for Lean search.
 *
 * @file
 */

/** Terrain values are the cost of entering a tile; zero denotes a wall. */
export const TERRAIN = Object.freeze({ wall: 0, floor: 1, forest: 4, water: 9 });

/**
 * Hash a human-readable seed into a reproducible unsigned generator state.
 *
 * @param seed Text identifying a terrain layout.
 */
export const hashSeed = seed => {
	let value = 2166136261;
	for(const character of String(seed)) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
	return value >>> 0;
};

/**
 * Generate weighted regions and broken walls with a guaranteed floor route.
 *
 * @param seed Text identifying the terrain layout.
 * @param columns Number of columns in the map.
 * @param rows Number of rows in the map.
 */
export const createTerrain = (seed = "1135cafe", columns = 33, rows = 21) => {
	if(!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 7 || rows < 7)
		throw new RangeError("Terrain needs at least seven rows and columns");
	let state = hashSeed(seed);
	const random = () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
		return state / 0x1_0000_0000;
	};
	const cells = new Uint8Array(columns * rows).fill(TERRAIN.floor);
	for(let patch = 0; patch < 12; patch += 1)
	{
		const centerX = random() * columns;
		const centerY = random() * rows;
		const radiusX = 2 + random() * 5;
		const radiusY = 2 + random() * 4;
		for(let y = 0; y < rows; y += 1)
			for(let x = 0; x < columns; x += 1)
				if(((x - centerX) / radiusX) ** 2 + ((y - centerY) / radiusY) ** 2 < 1)
					cells[y * columns + x] = TERRAIN.forest;
	}
	let river = Math.round(columns * (.45 + random() * .15));
	for(let y = 0; y < rows; y += 1)
	{
		river = Math.min(columns - 5, Math.max(4, river + Math.floor(random() * 3) - 1));
		for(let offset = -1; offset <= 1 + Math.floor(random() * 2); offset += 1)
			cells[y * columns + river + offset] = TERRAIN.water;
	}
	for(let ridge = 0; ridge < 18; ridge += 1)
	{
		const vertical = random() < .65;
		const x = 1 + Math.floor(random() * (columns - 2));
		const y = 1 + Math.floor(random() * (rows - 2));
		const length = 2 + Math.floor(random() * 5);
		for(let step = 0; step < length; step += 1)
		{
			const nextX = x + (vertical ? 0 : step);
			const nextY = y + (vertical ? step : 0);
			if(nextX < columns - 1 && nextY < rows - 1)
				cells[nextY * columns + nextX] = TERRAIN.wall;
		}
	}
	const startX = 2;
	const startY = Math.floor(rows * .7);
	const targetX = columns - 3;
	const targetY = Math.max(2, Math.floor(rows * .22));
	let x = startX;
	let y = startY;
	cells[y * columns + x] = TERRAIN.floor;
	const waypointX = Math.floor(columns * (.4 + random() * .2));
	const waypointY = random() < .65
		? Math.max(1, targetY - 2 - Math.floor(random() * 2))
		: Math.min(rows - 2, startY + 2 + Math.floor(random() * 2));
	for(const [endX, endY] of [[waypointX, waypointY], [targetX, targetY]])
		while(x !== endX || y !== endY)
		{
			if(x < endX && (y === endY || random() < .68)) x += 1;
			else y += y < endY ? 1 : -1;
			cells[y * columns + x] = TERRAIN.floor;
		}
	return {
		columns, rows, cells, start: startY * columns + startX
		, target: targetY * columns + targetX, seed: String(seed)
	};
};

/**
 * Build CSR edges and a consistent Manhattan lower bound for one terrain map.
 *
 * @param terrain Tile costs, dimensions, and endpoint indices.
 * @param strength Percentage of the Manhattan lower bound, from zero to one hundred.
 */
export const buildSearchRequest = (terrain, strength = 100) => {
	if(!Number.isInteger(strength) || strength < 0 || strength > 100)
		throw new RangeError("Heuristic strength must be an integer between 0 and 100");
	const { columns, rows, cells, start, target } = terrain;
	const vertexCount = columns * rows;
	const offsets = new Uint32Array(vertexCount + 1);
	const targets = [];
	const weights = [];
	const heuristic = new Uint32Array(vertexCount);
	const targetX = target % columns;
	const targetY = Math.floor(target / columns);
	for(let vertex = 0; vertex < vertexCount; vertex += 1)
	{
		const x = vertex % columns;
		const y = Math.floor(vertex / columns);
		heuristic[vertex] = Math.floor((Math.abs(targetX - x) + Math.abs(targetY - y)) * strength / 100);
		offsets[vertex] = targets.length;
		if(cells[vertex] === TERRAIN.wall) continue;
		const neighbors = [];
		if(x + 1 < columns) neighbors.push(vertex + 1);
		if(y > 0) neighbors.push(vertex - columns);
		if(y + 1 < rows) neighbors.push(vertex + columns);
		if(x > 0) neighbors.push(vertex - 1);
		for(const neighbor of neighbors)
			if(cells[neighbor] !== TERRAIN.wall)
			{
				targets.push(neighbor);
				weights.push(cells[neighbor]);
			}
	}
	offsets[vertexCount] = targets.length;
	return {
		vertexCount, offsets, targets: Uint32Array.from(targets)
		, weights: Uint32Array.from(weights), heuristic, start, target
	};
};
