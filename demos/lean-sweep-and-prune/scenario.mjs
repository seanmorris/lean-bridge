/**
 * Create and move rectangle scenes without deciding which rectangles overlap.
 *
 * @file
 */

export const WORLD = { width: 900, height: 480 };
export const BODY_COLORS = ["#8fd9ff", "#b9bdff", "#ffcc87", "#ffc1d2", "#b9edbb", "#92e4d3"];

/**
 * Build the six-body scene used to explain a rejected candidate and an overlap.
 *
 * @returns {object[]} Mutable bodies with world coordinates and velocities.
 */
export const explanationScene = () => [
	{ x: 98, y: 67, width: 118, height: 70, vx: 23, vy: 15 }
	, { x: 155, y: 266, width: 110, height: 87, vx: -18, vy: -16 }
	, { x: 399, y: 162, width: 132, height: 103, vx: 17, vy: -11 }
	, { x: 477, y: 227, width: 115, height: 85, vx: -21, vy: 17 }
	, { x: 697, y: 72, width: 102, height: 75, vx: -16, vy: 19 }
	, { x: 605, y: 350, width: 88, height: 64, vx: 20, vy: -16 }
].map((body, index) => ({ ...body, id: index, label: String.fromCharCode(65 + index) }));

/**
 * Generate a repeatable collection of moving boxes from a visible seed.
 *
 * @param {number} seed Unsigned integer scene seed.
 * @param {number} count Body count from 4 through 24.
 * @returns {object[]} Scene bodies, without any precomputed pair decisions.
 */
export const seededScene = (seed, count = 12) => {
	let state = seed >>> 0;
	const random = () => {
		state += 0x6d2b79f5;
		let value = state;
		value = Math.imul(value ^ value >>> 15, value | 1);
		value ^= value + Math.imul(value ^ value >>> 7, value | 61);
		return ((value ^ value >>> 14) >>> 0) / 4294967296;
	};
	return Array.from({ length: Math.max(4, Math.min(24, count)) }, (_, id) => {
		const width = 64 + Math.round(random() * 62);
		const height = 48 + Math.round(random() * 58);
		return {
			id, label: String.fromCharCode(65 + id), width, height
			, x: 24 + random() * (WORLD.width - width - 48)
			, y: 24 + random() * (WORLD.height - height - 48)
			, vx: (random() < .5 ? -1 : 1) * (15 + random() * 17)
			, vy: (random() < .5 ? -1 : 1) * (13 + random() * 15)
		};
	});
};

/**
 * Clamp a dragged body to the displayed world.
 *
 * @param {object} body Scene body to move.
 * @param {number} x Desired left edge.
 * @param {number} y Desired top edge.
 * @returns {void}
 */
export const placeBody = (body, x, y) => {
	body.x = Math.round(Math.max(12, Math.min(WORLD.width - body.width - 12, x)));
	body.y = Math.round(Math.max(12, Math.min(WORLD.height - body.height - 12, y)));
};

/**
 * Advance bodies independently and reflect their velocity at the world bounds.
 *
 * @param {object[]} bodies Mutable body collection.
 * @param {number} seconds Elapsed simulation time.
 * @returns {void}
 */
export const advanceScene = (bodies, seconds) => {
	for(const body of bodies)
	{
		body.x += body.vx * seconds;
		body.y += body.vy * seconds;
		if(body.x < 12 || body.x + body.width > WORLD.width - 12) body.vx *= -1;
		if(body.y < 12 || body.y + body.height > WORLD.height - 12) body.vy *= -1;
		body.x = Math.max(12, Math.min(WORLD.width - body.width - 12, body.x));
		body.y = Math.max(12, Math.min(WORLD.height - body.height - 12, body.y));
	}
};

/**
 * Pack a scene snapshot into signed integer two-dimensional boxes for Lean.
 *
 * @param {object[]} bodies Displayed rectangle collection.
 * @returns {Int32Array} Four words per body: min X, min Y, max X, max Y.
 */
export const packScene = bodies => Int32Array.from(bodies.flatMap(body => [
	Math.round(body.x), Math.round(body.y)
	, Math.round(body.x) + body.width, Math.round(body.y) + body.height
]));
