/**
 * Exact example coordinates and the horizontal-segment construction.
 *
 * @file
 */

import { generateConstructions } from "./constructions.mjs";

const simple = generateConstructions(20);
export const PRESETS = Object.freeze([
	...simple
	, { id: "compound", name: "33 × 65 · compound comparison"
		, width: 33, height: 65, rank: 0, order: 10, kind: "compound"
		, squares: [...simple[0].squares, [0, 32, 33]] }
].map(preset => Object.freeze({ ...preset, squares: Object.freeze(preset.squares.map(square => Object.freeze([...square]))) })));

/**
 * Construct a Smith diagram without merging disconnected segments at equal heights.
 *
 * @param {{width: number, height: number, squares: readonly (readonly number[])[]}} preset Original exact coordinates.
 * @param scale Integer enlargement, equivalent to increasing the battery voltage.
 */
export function createScene(preset = PRESETS[0], scale = 1)
{
	const tiles = preset.squares.map(([x, y, side], id) => ({ id, x: x * scale, y: y * scale, side: side * scale, top: -1, bottom: -1 }));
	const width = preset.width * scale, height = preset.height * scale;
	const segments = tiles.flatMap(tile => [
		{ y: tile.y, left: tile.x, right: tile.x + tile.side }
		, { y: tile.y + tile.side, left: tile.x, right: tile.x + tile.side }
	]).sort((a, b) => a.y - b.y || a.left - b.left);
	const joined = [];
	for(const segment of segments)
	{
		const last = joined.at(-1);
		if(last && last.y === segment.y && segment.left <= last.right) last.right = Math.max(last.right, segment.right);
		else joined.push({ ...segment });
	}
	const nodes = joined.map((segment, id) => ({ ...segment, id, potential: height - segment.y, label: id === 0 ? "+" : id === joined.length - 1 ? "−" : String.fromCharCode(64 + id) }));
	for(const tile of tiles)
	{
		tile.top = nodes.findIndex(node => node.y === tile.y && node.left <= tile.x && tile.x + tile.side <= node.right);
		tile.bottom = nodes.findIndex(node => node.y === tile.y + tile.side && node.left <= tile.x && tile.x + tile.side <= node.right);
	}
	return { width, height, tiles, nodes };
}

/**
 * Keep the original circuit terminals when a square is deliberately changed.
 *
 * @param scene Original scene with fixed seams.
 * @param {number | null} tileId Selected tile to enlarge, or null for the unchanged construction.
 */
export function certificateInput(scene, tileId = null)
{
	return { width: scene.width, height: scene.height
		, levels: Uint32Array.from(scene.nodes.map(node => node.potential))
		, squares: Uint32Array.from(scene.tiles.flatMap(tile => [tile.x, tile.y, tile.side + (tile.id === tileId ? 1 : 0), tile.top, tile.bottom])) };
}

/**
 * Produce the paper's noncrossing wire inside each square, joined to seam midpoints.
 *
 * @param scene Exact tile and seam coordinates.
 * @param tile One square, hence one wire.
 */
export function wirePoints(scene, tile)
{
	const top = scene.nodes[tile.top], bottom = scene.nodes[tile.bottom];
	const center = tile.x + tile.side / 2, inset = tile.side * .27;
	return [
		[(top.left + top.right) / 2, top.y]
		, [center, tile.y + inset]
		, [center, tile.y + tile.side - inset]
		, [(bottom.left + bottom.right) / 2, bottom.y]
	];
}

/**
 * Space junctions evenly, keeping every wire's fan inside its junction's row.
 * A long edge must not fan across a neighboring junction's shorter edge.
 *
 * @param {ReturnType<typeof createScene>} scene Exact horizontal-segment network.
 */
export function circuitLayout(scene)
{
	const row = 316 / (scene.nodes.length - 1), inset = Math.min(24, row * .24);
	const nodes = scene.nodes.map(node => ({
		x: 52 + (node.left + node.right) / 2 / scene.width * 294
		, y: 48 + node.id * row
	}));
	const wires = scene.tiles.map(square => {
		const x = 52 + (square.x + square.side / 2) / scene.width * 294;
		const top = nodes[square.top], bottom = nodes[square.bottom];
		return { x, labelY: (top.y + bottom.y) / 2
			, points: [
				[top.x, top.y], [x, top.y + inset]
				, [x, bottom.y - inset], [bottom.x, bottom.y]
			]
		};
	});
	return { nodes, wires };
}

/**
 * A geometric explanation of simplicity, independent of the Lean classification.
 *
 * @param scene Valid disjoint tiling to inspect.
 */
export function findCompoundPart(scene)
{
	for(let mask = 1; mask < 2 ** scene.tiles.length - 1; mask++)
	{
		const part = scene.tiles.filter((_, id) => mask & 2 ** id);
		if(part.length < 2) continue;
		const left = Math.min(...part.map(s => s.x)), top = Math.min(...part.map(s => s.y));
		const right = Math.max(...part.map(s => s.x + s.side)), bottom = Math.max(...part.map(s => s.y + s.side));
		if(part.reduce((area, s) => area + s.side ** 2, 0) === (right - left) * (bottom - top))
			return { left, top, width: right - left, height: bottom - top, ids: part.map(s => s.id) };
	}
	return null;
}
