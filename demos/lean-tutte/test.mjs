/**
 * Compiled acceptance, deliberate corruption, and independently computed predicates.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createChecker } from "./runtime.mjs";
import { certificateInput, circuitLayout, createScene, PRESETS, wirePoints } from "./scenario.mjs";
import { availableScales, decodeTablecode, generateConstructions } from "./constructions.mjs";
import { checkReference } from "./reference.mjs";
import { interactiveSource, comparatorChallenge, verifyProofAudit } from "../shared/proof-services.mjs";
import { readFile } from "node:fs/promises";

const check = await createChecker();
test("all displayed constructions and scales agree with independent checks", () => {
	for(const preset of PRESETS) for(const scale of availableScales(preset))
	{
		const input = certificateInput(createScene(preset, scale));
		const result = check(input);
		assert.deepEqual(result, checkReference(input));
		assert.ok(result.tiling && result.electrical && result.perfect);
		assert.equal(result.simple, preset.id !== "compound");
		assert.equal(result.threeConnected, result.simple);
	}
});

test("the catalogue generates the first 20 distinct primitive constructions in numeric order", () => {
	const all = generateConstructions(30), first = generateConstructions();
	assert.equal(first.length, 20);
	assert.equal(PRESETS.length, 21);
	assert.deepEqual(generateConstructions(10), first.slice(0, 10));
	assert.deepEqual(first, all.slice(0, 20));
	assert.deepEqual(first, PRESETS.filter(item => item.kind === "simple"));
	assert.deepEqual([9, 10, 11].map(order => first.filter(item => item.order === order).length), [2, 6, 12]);
	assert.deepEqual([9, 10, 11].map(order => all.filter(item => item.order === order).length), [2, 6, 22]);
	assert.deepEqual(all.map(item => [item.order, item.width, item.height]),
		all.map(item => [item.order, item.width, item.height]).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]));
	const signatures = new Set();
	const gcd = (a, b) => b ? gcd(b, a % b) : a;
	for(const construction of all)
	{
		assert.equal(construction.squares.map(s => s[2]).reduce(gcd), 1, "Catalogue units are primitive, not scaled duplicates");
		const variants = [];
		for(const transpose of [false, true]) for(const flipX of [false, true]) for(const flipY of [false, true])
		{
			const width = transpose ? construction.height : construction.width;
			const height = transpose ? construction.width : construction.height;
			const squares = construction.squares.map(([a, b, side]) => {
				const x = transpose ? b : a, y = transpose ? a : b;
				return [flipX ? width - x - side : x, flipY ? height - y - side : y, side];
			}).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
			variants.push(JSON.stringify([width, height, squares]));
		}
		const signature = variants.sort()[0];
		assert.ok(!signatures.has(signature), "Rotations and reflections are not separate constructions");
		signatures.add(signature);
		const result = check(certificateInput(createScene(construction)));
		assert.ok(result.tiling && result.electrical && result.simple && result.perfect && result.threeConnected, construction.name);
	}
	first[0].squares[0][0] = 999;
	assert.equal(generateConstructions()[0].squares[0][0], 0, "Generated calls own their coordinates");
	assert.throws(() => { PRESETS[0].squares[0][0] = 999; }, TypeError);
});

test("tablecode reconstruction rejects malformed, overlapping, and incomplete inputs", () => {
	assert.deepEqual(decodeTablecode([2, 2, 1, 1, 1]), { width: 2, height: 1, squares: [[0, 0, 1], [1, 0, 1]] });
	for(const invalid of [
		[], [1, 0, 1, 1], [1, 257, 1, 1], [1, 1, 1, 0], [1, 1, 1, 1.5]
		, [2, 2, 2, 2], [1, 1, 1, 2], [1, 2, 2, 1], [3, 3, 3, 1, 2, 2]
		, [13, 4, 4, ...new Array(13).fill(1)]])
		assert.throws(() => decodeTablecode(invalid));
	for(const count of [0, -1, 1.5, 31, NaN, Infinity]) assert.throws(() => generateConstructions(count));
	assert.deepEqual(availableScales(PRESETS[0]), [1, 2, 3]);
	assert.deepEqual(availableScales(PRESETS[4]), [1, 2]);
	assert.deepEqual(availableScales(PRESETS[19]), [1]);
});

test("both generated drawings keep nonincident wires from crossing", () => {
	const orient = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
	for(const preset of [...generateConstructions(30), PRESETS.at(-1)])
	{
		const scene = createScene(preset);
		for(const paths of [scene.tiles.map(tile => wirePoints(scene, tile)), circuitLayout(scene).wires.map(wire => wire.points)])
			for(let first = 0; first < paths.length; first++) for(let second = first + 1; second < paths.length; second++)
				for(let i = 1; i < paths[first].length; i++) for(let j = 1; j < paths[second].length; j++)
				{
					const [a, b] = [paths[first][i - 1], paths[first][i]], [c, d] = [paths[second][j - 1], paths[second][j]];
					const crosses = orient(a, b, c) * orient(a, b, d) < -1e-8 && orient(c, d, a) * orient(c, d, b) < -1e-8;
					assert.equal(crosses, false, `${preset.name}: wires ${first + 1} and ${second + 1}`);
				}
	}
});

test("enlarging any displayed square fails geometry and electrical checks", () => {
	for(const preset of PRESETS)
	{
		const scene = createScene(preset);
		for(const tile of scene.tiles)
		{
			const input = certificateInput(scene, tile.id), result = check(input);
			assert.deepEqual(result, checkReference(input));
			assert.equal(result.tiling, false);
			assert.equal(result.electrical, false);
		}
	}
});

test("equal sizes, holes, overlaps, wrong terminals, and bad indices are not accepted", () => {
	for(const change of [
		input => { input.squares[2] = 0; }
		, input => { input.squares[0]++; }
		, input => { input.squares[4] = 25; }
		, input => { input.levels[1]++; }
		, input => { input.width++; }
		, input => { input.squares.set(input.squares.slice(0, 5), 5); }
	]) {
		const input = certificateInput(createScene()); change(input);
		const result = check(input);
		assert.deepEqual(result, checkReference(input));
		assert.ok(!result.tiling || !result.electrical);
	}
	const repeated = certificateInput(createScene({ width: 2, height: 1, squares: [[0, 0, 1], [1, 0, 1]] }));
	assert.equal(check(repeated).perfect, false);
	assert.equal(check(repeated).tiling, true);
});

test("disconnected seams at the same height stay separate", () => {
	const scene = createScene({ width: 5, height: 3, squares: [[0, 0, 1], [3, 0, 1], [0, 1, 1], [3, 1, 1]] });
	assert.equal(scene.nodes.filter(node => node.y === 1).length, 2);
});

test("all four-vertex simple graphs agree on the augmented connectivity check", () => {
	const pairs = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
	for(let mask = 0; mask < 64; mask++)
	{
		const selected = pairs.filter((_, i) => mask & 2 ** i);
		const input = { width: 2, height: 3, levels: Uint32Array.of(3, 2, 1, 0)
			, squares: Uint32Array.from((selected.length ? selected : [[0, 0]]).flatMap(([a, b]) => [0, 0, 1, a, b])) };
		assert.deepEqual(check(input), checkReference(input));
	}
	assert.equal(check(certificateInput(createScene({ width: 1, height: 1, squares: [[0, 0, 1]] }))).perfect, false);
});

test("adapter bounds, ownership, and repeated calls", () => {
	const input = certificateInput(createScene()), before = structuredClone(input), first = check(input);
	first.balances[0].outgoing = 999;
	assert.equal(check(input).balances[0].outgoing, 33);
	assert.deepEqual(input, before);
	for(let i = 0; i < 30; i++) assert.equal(check(input).tiling, true);
	for(const invalid of [{ ...input, width: 0 }, { ...input, height: 257 }, { ...input, levels: [32, 0] }, { ...input, squares: new Uint32Array(4) }, { ...input, squares: new Uint32Array(65) }, { ...input, squares: Uint32Array.of(0, 0, 257, 0, 1) }])
		assert.throws(() => check(invalid));
});

test("the displayed proof and both checker bundles retain real named theorems", async () => {
	const config = { core: "TutteCore.lean", proof: "Tutte.lean", dependencies: [], namespace: "LeanTutte", comparator: "exported_certificate", theorems: ["LeanTutte.exported_certificate"] };
	const sources = new Map(await Promise.all([config.core, config.proof].map(async name => [name, await readFile(new URL(name, import.meta.url), "utf8")])));
	const audit = JSON.parse(await readFile(new URL("runtime/proof-audit.json", import.meta.url), "utf8"));
	await verifyProofAudit(config, sources, audit);
	assert.match(interactiveSource(config, sources), /#print axioms LeanTutte.exported_certificate/u);
	assert.match(comparatorChallenge(config, sources), /theorem exported_certificate/u);
	assert.ok(audit.theorems.includes("threeConnectedCheck_sound"));
});
