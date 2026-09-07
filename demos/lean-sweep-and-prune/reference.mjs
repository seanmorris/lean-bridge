/**
 * Independent quadratic oracle and optimized typed-array sweep baseline.
 *
 * @file
 */

/**
 * Compare every unordered pair directly, without sorting or an active set.
 *
 * @param {object} request Packed boxes, dimensions, and optional sweep axis.
 * @param {Int32Array} request.boxes Packed signed box coordinates.
 * @param {number} request.dimensions Number of axes.
 * @param {number} [request.axis] Sweep axis.
 */
export const solveOracle = ({ boxes, dimensions, axis = 0 }) => {
	const stride = dimensions * 2;
	const count = boxes.length / stride;
	const candidates = [];
	const overlaps = [];
	for(let first = 0; first < count; first++)
		for(let second = first + 1; second < count; second++)
		{
			const left = first * stride;
			const right = second * stride;
			if(boxes[left + axis] > boxes[right + dimensions + axis]
				|| boxes[right + axis] > boxes[left + dimensions + axis]) continue;
			candidates.push(first, second);
			let matching = true;
			for(let dimension = 0; dimension < dimensions; dimension++)
				if(boxes[left + dimension] > boxes[right + dimensions + dimension]
					|| boxes[right + dimension] > boxes[left + dimensions + dimension]){
					matching = false; break;
					}
			if(matching) overlaps.push(first, second);
		}
	return { candidates: Uint32Array.from(candidates), overlaps: Uint32Array.from(overlaps) };
};

/**
 * Validate canonical IDs and uniqueness independently of enumeration order.
 *
 * @param {Uint32Array} pairs Flattened ordered ID pairs.
 * @param {number} count Number of boxes.
 */
export const pairKeys = (pairs, count) => {
	if(!(pairs instanceof Uint32Array) || pairs.length % 2) throw new Error("Malformed pair array");
	const keys = new Set();
	for(let index = 0; index < pairs.length; index += 2)
	{
		const first = pairs[index];
		const second = pairs[index + 1];
		if(first >= second || second >= count) throw new Error("Pair IDs must be distinct, canonical, and in bounds");
		const key = first * count + second;
		if(keys.has(key)) throw new Error("Duplicate pair");
		keys.add(key);
	}
	return keys;
};

/**
 * Check every candidate and overlap against the independently enumerated sets.
 *
 * @param {object} request Packed box input.
 * @param {object} result Candidate and overlap arrays.
 * @param {object} [expected] Optional precomputed quadratic result, always outside timing.
 */
export const verifyResult = (request, result, expected = solveOracle(request)) => {
	const count = request.boxes.length / (request.dimensions * 2);
	for(const field of ["candidates", "overlaps"])
	{
		const actual = pairKeys(result?.[field], count);
		const wanted = pairKeys(expected[field], count);
		if(actual.size !== wanted.size || [...actual].some(pair => !wanted.has(pair)))
			throw new Error(`${field} differs from the complete quadratic oracle`);
	}
	return result;
};

/**
 * Prepare a typed-array sweep; sorting and full owned outputs remain inside each call.
 *
 * @param {object} request Packed boxes, dimensions, and optional sweep axis.
 * @param {Int32Array} request.boxes Packed signed box coordinates.
 * @param {number} request.dimensions Number of axes.
 * @param {number} [request.axis] Sweep axis.
 */
export const prepareJavascript = ({ boxes: input, dimensions, axis = 0 }) => {
	const boxes = input.slice();
	const stride = dimensions * 2;
	const count = boxes.length / stride;
	const order = new Uint32Array(count);
	const active = new Uint32Array(count);
	let candidates = new Uint32Array(Math.max(16, count * 4));
	let overlaps = new Uint32Array(Math.max(16, count * 2));
	const compare = (first, second) => boxes[first * stride + axis] - boxes[second * stride + axis] || first - second;
	return () => {
		for(let index = 0; index < count; index++) order[index] = index;
		order.sort(compare);
		let activeCount = 0;
		let candidateWords = 0;
		let overlapWords = 0;
		for(let index = 0; index < count; index++)
		{
			const current = order[index];
			const currentOffset = current * stride;
			const start = boxes[currentOffset + axis];
			let retained = 0;
			for(let slot = 0; slot < activeCount; slot++)
			{
				const previous = active[slot];
				const previousOffset = previous * stride;
				if(boxes[previousOffset + dimensions + axis] < start) continue;
				active[retained++] = previous;
				const first = Math.min(previous, current);
				const second = Math.max(previous, current);
				if(candidateWords + 2 > candidates.length)
				{
					const larger = new Uint32Array(candidates.length * 2);
					larger.set(candidates); candidates = larger;
				}
				candidates[candidateWords++] = first;
				candidates[candidateWords++] = second;
				let matching = true;
				for(let dimension = 0; dimension < dimensions; dimension++)
				{
					if(dimension === axis) continue;
					if(boxes[currentOffset + dimension] > boxes[previousOffset + dimensions + dimension]
						|| boxes[previousOffset + dimension] > boxes[currentOffset + dimensions + dimension]){
						matching = false; break;
						}
				}
				if(matching)
				{
					if(overlapWords + 2 > overlaps.length)
					{
						const larger = new Uint32Array(overlaps.length * 2);
						larger.set(overlaps); overlaps = larger;
					}
					overlaps[overlapWords++] = first;
					overlaps[overlapWords++] = second;
				}
			}
			active[retained] = current;
			activeCount = retained + 1;
		}
		return { candidates: candidates.slice(0, candidateWords), overlaps: overlaps.slice(0, overlapWords) };
	};
};
