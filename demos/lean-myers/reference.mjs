/**
 * Independent quadratic edit oracle and an optimized typed-array Myers baseline.
 *
 * @file
 */

/**
 * Replay the complete script and check its reported minimum cost.
 *
 * @param {Uint32Array} before Original tokens.
 * @param {Uint32Array} after Target tokens.
 * @param {object} result Distance and operation codes returned by a solver.
 * @param {number} [expectedDistance] Independently computed minimum cost.
 */
export const verifyResult = (before, after, result, expectedDistance) => {
	if(!Number.isSafeInteger(result.distance) || result.distance < 0)
		throw new Error("Edit distance must be an exact nonnegative integer");
	if(result.operations.length > before.length + after.length)
		throw new Error("Edit script is longer than both inputs combined");
	let left = 0;
	let right = 0;
	let distance = 0;
	const output = [];
	for(const operation of result.operations)
	{
		if(operation === 0)
		{
			if(left >= before.length || right >= after.length || before[left] !== after[right])
				throw new Error("Keep does not match the current input tokens");
			output.push(before[left++]);
			right++;
		}
		else if(operation === 1)
		{
			if(left >= before.length) throw new Error("Delete exceeds the source sequence");
			left++; distance++;
		}
		else if(operation === 2)
		{
			if(right >= after.length) throw new Error("Insert exceeds the target sequence");
			output.push(after[right++]);
			distance++;
		}
		else throw new Error("Unknown edit operation");
	}
	if(left !== before.length || right !== after.length) throw new Error("Edit script does not consume both sequences");
	if(output.length !== after.length || output.some((token, index) => token !== after[index]))
		throw new Error("Replayed script does not reproduce the target");
	if(distance !== result.distance) throw new Error("Edit count does not match the reported distance");
	if(expectedDistance !== undefined && distance !== expectedDistance)
		throw new Error("Edit script differs from the independent minimum cost");
	return true;
};

/**
 * Compute a complete shortest script by full dynamic programming, independent of Myers.
 *
 * @param {Uint32Array} before Original tokens.
 * @param {Uint32Array} after Target tokens.
 */
export const solveOracle = (before, after) => {
	const width = after.length + 1;
	const matrix = new Uint32Array((before.length + 1) * width);
	for(let left = 0; left <= before.length; left++) matrix[left * width] = left;
	for(let right = 0; right <= after.length; right++) matrix[right] = right;
	for(let left = 1; left <= before.length; left++)
		for(let right = 1; right <= after.length; right++)
		{
			const index = left * width + right;
			matrix[index] = Math.min(matrix[index - width] + 1, matrix[index - 1] + 1,
				before[left - 1] === after[right - 1] ? matrix[index - width - 1] : Infinity);
		}
	let left = before.length;
	let right = after.length;
	const reverse = [];
	while(left || right)
	{
		const index = left * width + right;
		if(left && matrix[index] === matrix[index - width] + 1)
		{ reverse.push(1); left--; }
		else if(right && matrix[index] === matrix[index - 1] + 1)
		{ reverse.push(2); right--; }
		else
		{ reverse.push(0); left--; right--; }
	}
	return { distance: matrix[matrix.length - 1], operations: Uint32Array.from(reverse.reverse()) };
};

/**
 * Prepare an optimized JS Myers solver with prefix/suffix trimming and compact trace rows.
 *
 * @param {Uint32Array} original Original tokens, snapshotted during preparation.
 * @param {Uint32Array} target Target tokens, snapshotted during preparation.
 * @returns {() => object} Solver returning an independently owned full operation array.
 */
export const prepareJavascript = (original, target) => {
	const before = original.slice();
	const after = target.slice();
	return () => {
		let prefix = 0;
		while(prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++;
		let suffix = 0;
		while(suffix < before.length - prefix && suffix < after.length - prefix
			&& before[before.length - suffix - 1] === after[after.length - suffix - 1]) suffix++;
		const leftLength = before.length - prefix - suffix;
		const rightLength = after.length - prefix - suffix;
		if(leftLength === 0 || rightLength === 0)
		{
			const operations = new Uint32Array(prefix + leftLength + rightLength + suffix);
			operations.fill(leftLength ? 1 : 2, prefix, prefix + leftLength + rightLength);
			return { distance: leftLength + rightLength, operations };
		}
		const trace = [];
		let distance = 0;
		search: for(; distance <= leftLength + rightLength; distance++)
		{
			const row = new Int32Array(distance + 1);
			const previous = trace[distance - 1];
			trace.push(row);
			for(let index = 0; index <= distance; index++)
			{
				const diagonal = 2 * index - distance;
				let left = distance === 0 ? 0 : index === 0
					|| index < distance && previous[index - 1] < previous[index]
					? previous[index] : previous[index - 1] + 1;
				let right = left - diagonal;
				while(left < leftLength && right < rightLength && right >= 0
					&& before[prefix + left] === after[prefix + right]){ left++; right++; }
				row[index] = left;
				if(left >= leftLength && right >= rightLength) break search;
			}
		}
		let left = leftLength;
		let right = rightLength;
		const reverse = new Uint32Array(leftLength + rightLength);
		let count = 0;
		for(let depth = distance; depth > 0; depth--)
		{
			const diagonal = left - right;
			const index = (diagonal + depth) / 2;
			const previous = trace[depth - 1];
			const inserted = index === 0 || index < depth && previous[index - 1] < previous[index];
			const previousLeft = previous[inserted ? index : index - 1];
			const previousRight = previousLeft - (diagonal + (inserted ? 1 : -1));
			while(left > previousLeft && right > previousRight)
			{ reverse[count++] = 0; left--; right--; }
			if(inserted)
			{ reverse[count++] = 2; right--; }
			else
			{ reverse[count++] = 1; left--; }
		}
		while(left > 0 && right > 0)
		{ reverse[count++] = 0; left--; right--; }
		if(left !== 0 || right !== 0) throw new Error("JS Myers trace did not reach its origin");
		const operations = new Uint32Array(prefix + count + suffix);
		for(let index = 0; index < count; index++) operations[prefix + index] = reverse[count - index - 1];
		return { distance, operations };
	};
};
