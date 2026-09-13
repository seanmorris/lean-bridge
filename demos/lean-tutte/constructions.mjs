/**
 * Reconstruct exact tilings from low-order Bouwkamp tablecodes.
 *
 * Mathematical data: David Moews, https://djm.cc/simple-perfect-rects-to-16.txt
 * These are the complete order 9–11 entries, sorted numerically by order,
 * width, then height. Coordinates are generated here, not stored separately.
 * The decoder is an independent implementation, not Moews's GPL graph program.
 *
 * @file
 */

export const MAX_DIMENSION = 256;

// Each record is [square count, width, height, ...square sides in tablecode order].
const codes = [
	[9, 33, 32, 18, 15, 7, 8, 14, 4, 10, 1, 9]
	, [9, 69, 61, 36, 33, 5, 28, 25, 9, 2, 7, 16]
	, [10, 57, 55, 30, 27, 3, 11, 13, 25, 8, 17, 2, 15]
	, [10, 65, 47, 25, 17, 23, 11, 6, 5, 24, 22, 3, 19]
	, [10, 105, 104, 60, 45, 19, 26, 44, 16, 12, 7, 33, 28]
	, [10, 111, 98, 57, 54, 3, 7, 44, 41, 15, 4, 11, 26]
	, [10, 115, 94, 60, 55, 16, 39, 34, 15, 11, 4, 23, 19]
	, [10, 130, 79, 45, 44, 41, 3, 38, 12, 35, 34, 11, 23]
	, [11, 97, 96, 56, 41, 17, 24, 40, 14, 2, 12, 7, 31, 26]
	, [11, 98, 86, 51, 47, 8, 39, 35, 11, 5, 1, 7, 6, 24]
	, [11, 98, 95, 50, 48, 7, 19, 22, 45, 5, 12, 28, 3, 25]
	, [11, 112, 81, 43, 29, 40, 19, 10, 9, 1, 41, 38, 5, 33]
	, [11, 177, 176, 99, 78, 21, 57, 77, 43, 16, 41, 34, 9, 25]
	, [11, 185, 151, 95, 90, 5, 24, 61, 56, 25, 19, 6, 37, 31]
	, [11, 185, 168, 100, 85, 43, 42, 68, 32, 1, 41, 4, 40, 36]
	, [11, 185, 183, 105, 80, 33, 47, 78, 27, 19, 14, 5, 56, 51]
	, [11, 187, 166, 99, 88, 10, 78, 1, 9, 67, 25, 8, 17, 42]
	, [11, 191, 162, 97, 94, 26, 68, 65, 32, 9, 17, 33, 8, 25]
	, [11, 191, 177, 102, 89, 40, 49, 75, 27, 48, 19, 10, 39, 29]
	, [11, 194, 159, 100, 94, 29, 65, 59, 25, 16, 9, 7, 36, 34]
	, [11, 194, 183, 102, 92, 31, 23, 38, 81, 21, 8, 15, 60, 53]
	, [11, 195, 191, 105, 90, 15, 31, 44, 86, 34, 18, 13, 57, 52]
	, [11, 199, 169, 105, 94, 19, 75, 64, 33, 8, 27, 31, 2, 29]
	, [11, 199, 178, 102, 97, 16, 81, 76, 15, 11, 4, 23, 19, 42]
	, [11, 205, 181, 105, 100, 6, 13, 81, 76, 28, 1, 7, 20, 48]
	, [11, 209, 127, 72, 71, 66, 5, 61, 1, 19, 56, 55, 18, 37]
	, [11, 209, 144, 85, 57, 67, 47, 10, 77, 59, 26, 7, 40, 33]
	, [11, 209, 159, 89, 49, 71, 27, 22, 5, 88, 32, 70, 19, 51]
	, [11, 209, 168, 92, 64, 53, 11, 42, 44, 31, 76, 16, 73, 60]
	, [11, 209, 177, 96, 56, 57, 55, 1, 58, 81, 15, 66, 4, 62]
];

/**
 * Place each square in the leftmost highest unfilled part of the rectangle.
 * The integer skyline rejects an overlap, an overhang, or an unfinished tiling.
 * Classification and electrical checks still belong to the Lean certificate.
 *
 * @param {readonly number[]} code Count, dimensions, and ordered square lengths.
 */
export function decodeTablecode(code)
{
	if(!Array.isArray(code) || code.some(value => !Number.isSafeInteger(value) || value <= 0))
		throw new TypeError("A tablecode must contain positive integers");
	const [order, width, height, ...sides] = code;
	if(!order || order > 12 || sides.length !== order || !width || !height || width > MAX_DIMENSION || height > MAX_DIMENSION)
		throw new RangeError("Expected 1–12 squares and dimensions from 1 to 256");
	const skyline = new Array(width).fill(0), squares = [];
	for(const side of sides)
	{
		const y = Math.min(...skyline), x = skyline.indexOf(y);
		if(x + side > width || y + side > height || skyline.slice(x, x + side).some(level => level !== y))
			throw new RangeError("Tablecode square overlaps or exceeds the rectangle");
		squares.push([x, y, side]);
		skyline.fill(y + side, x, x + side);
	}
	if(skyline.some(level => level !== height)) throw new RangeError("Tablecode leaves an unfinished rectangle");
	return { width, height, squares };
}

/**
 * Generate the first catalogue entries, ordered by square count, width and height.
 * This reconstructs enumerated constructions; it is not a new planar-graph search.
 *
 * @param count Number of distinct simple perfect rectangles, from 1 to 30.
 */
export function generateConstructions(count = 20)
{
	if(!Number.isInteger(count) || count < 1 || count > codes.length) throw new RangeError("Choose 1–30 constructions");
	return codes.slice(0, count).map((code, index) => {
		const decoded = decodeTablecode(code), rank = index + 1, order = code[0];
		const id = index === 0 ? "moron" : index === 1 ? "wide" : `spsr-${order}-${decoded.width}x${decoded.height}`;
		return { ...decoded, id, rank, order, kind: "simple"
			, name: `${rank}. ${decoded.width} × ${decoded.height} · ${order} squares` };
	});
}

/**
 * Preserve exact integers while staying inside the compiled transport bounds.
 *
 * @param {{width: number, height: number}} construction Original unscaled dimensions.
 */
export function availableScales(construction)
{
	return [1, 2, 3].filter(scale => Math.max(construction.width, construction.height) * scale <= MAX_DIMENSION);
}
