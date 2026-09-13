/**
 * Independent raster, subset, and adjacency checks for compiled differential tests.
 *
 * @file
 */

/**
 * Check the same finite predicates using JavaScript-owned arrays and sets.
 *
 * @param request Exact integer geometry and assigned junctions.
 */
export const checkReference = request => {
	const { width, height, levels, squares } = request;
	const tiles = Array.from({ length: squares.length / 5 }, (_, i) => [...squares.slice(i * 5, i * 5 + 5)]);
	const cells = new Uint16Array(width * height);
	let tiling = tiles.length > 0;
	const balances = Array.from(levels, () => ({ incoming: 0, outgoing: 0 }));
	let electrical = levels.length >= 2 && levels[0] === height && levels.at(-1) === 0;
	const adjacent = Array.from(levels, () => new Set());
	adjacent[0].add(levels.length - 1); adjacent.at(-1).add(0);
	for(const [x, y, side, top, bottom] of tiles)
	{
		if(!side || x + side > width || y + side > height) tiling = false;
		for(let row = y; row < Math.min(height, y + side); row++)
			for(let col = x; col < Math.min(width, x + side); col++) cells[row * width + col]++;
		electrical &&= top < levels.length && bottom < levels.length
			&& levels[top] === Math.max(0, height - y) && levels[bottom] === Math.max(0, height - y - side) && levels[top] === levels[bottom] + side;
		if(balances[top]) balances[top].outgoing += side;
		if(balances[bottom]) balances[bottom].incoming += side;
		if(adjacent[top] && adjacent[bottom])
		{ adjacent[top].add(bottom); adjacent[bottom].add(top); }
	}
	tiling &&= cells.every(count => count === 1);
	electrical &&= balances[0].incoming === 0 && balances[0].outgoing === width && balances.at(-1).incoming === width && balances.at(-1).outgoing === 0 && balances.slice(1, -1).every(b => b.incoming === b.outgoing);
	let simple = true;
	for(let mask = 1; mask < 2 ** tiles.length - 1 && simple; mask++)
	{
		const selected = tiles.filter((_, index) => mask & 2 ** index);
		if(selected.length < 2) continue;
		const left = Math.min(...selected.map(s => s[0])), top = Math.min(...selected.map(s => s[1]));
		const right = Math.max(...selected.map(s => s[0] + s[2])), bottom = Math.max(...selected.map(s => s[1] + s[2]));
		if(selected.reduce((sum, s) => sum + s[2] ** 2, 0) === (right - left) * (bottom - top)) simple = false;
	}
	let threeConnected = levels.length >= 4;
	for(let a = 0; a <= levels.length && threeConnected; a++)
		for(let b = a; b <= levels.length && threeConnected; b++)
		{
			const remaining = Array.from(levels.keys()).filter(v => v !== a && v !== b);
			const seen = new Set([remaining[0]]);
			for(const v of seen) for(const next of adjacent[v]) if(next !== a && next !== b) seen.add(next);
			threeConnected &&= remaining.every(v => seen.has(v));
		}
	return { tiling, electrical, simple, perfect: tiles.length > 1 && new Set(tiles.map(s => s[2])).size === tiles.length, threeConnected, balances };
};
