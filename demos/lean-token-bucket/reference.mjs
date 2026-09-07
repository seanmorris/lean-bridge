/**
 * Independent exact token-bucket oracle and matched numeric JavaScript baseline.
 *
 * @file
 */

const statuses = ["allowed", "throttled", "clock-regression"];

const decode = (wire, offset = 0) => ({
	status: statuses[wire[offset]], allowed: wire[offset] === 0
	, tokens: wire[offset + 1], timestamp: wire[offset + 2]
	, available: wire[offset + 3], refilled: wire[offset + 4]
	, retryAfter: wire[offset + 5] ? wire[offset + 6] : null
});

const executeOracle = (capacity, rate, state, operations) => {
	const wire = new Uint32Array(operations.length / 2 * 7);
	for(let input = 0, output = 0; input < operations.length; input += 2, output += 7)
	{
		const timestamp = BigInt(operations[input]);
		const cost = BigInt(operations[input + 1]);
		if(timestamp < state.timestamp)
		{
			wire.set([2, Number(state.tokens), Number(state.timestamp), Number(state.tokens), 0, 0, 0], output);
			continue;
		}
		const uncapped = state.tokens + (timestamp - state.timestamp) * rate;
		const available = uncapped < capacity ? uncapped : capacity;
		const allowed = cost <= available;
		const refilled = available - state.tokens;
		const retry = allowed ? 0n : cost <= capacity && rate > 0n
			? (cost - available + rate - 1n) / rate : null;
		state.tokens = allowed ? available - cost : available;
		state.timestamp = timestamp;
		wire.set([
			allowed ? 0 : 1
			, Number(state.tokens)
			, Number(timestamp)
			, Number(available)
			, Number(refilled)
			, retry === null ? 0 : 1, retry === null ? 0 : Number(retry)
		], output);
	}
	return wire;
};

/**
 * Keep exact arbitrary-precision state independently of the compiled implementation.
 *
 * @param {object} configuration Integer-credit bucket configuration.
 * @param {number} configuration.capacity Maximum credits, initially full.
 * @param {number} configuration.rate Credits replenished per timestamp tick.
 * @param {number} [configuration.now] Initial timestamp.
 * @returns {object} Exact request, trace, and snapshot operations.
 */
export const createOracleBucket = ({ capacity, rate, now = 0 }) => {
	const state = { tokens: BigInt(capacity), timestamp: BigInt(now) };
	const run = operations => executeOracle(BigInt(capacity), BigInt(rate), state, operations);
	return {
		run
		, request: (timestamp, cost) => decode(run(Uint32Array.of(timestamp, cost)))
		, advance: timestamp => decode(run(Uint32Array.of(timestamp, 0)))
		, snapshot: () => ({ tokens: Number(state.tokens), timestamp: Number(state.timestamp) })
	};
};

/**
 * Prepare exact reset-on-run traces for differential validation.
 *
 * @param {object} configuration Bucket parameters and timestamp/cost pairs.
 * @returns {() => Uint32Array} Full seven-word event records from a fresh bucket.
 */
export const prepareOracleTrace = configuration => {
	const operations = configuration.operations.slice();
	return () => createOracleBucket(configuration).run(operations);
};

const executeNumber = (capacity, rate, state, operations) => {
	const wire = new Uint32Array(operations.length / 2 * 7);
	let tokens = state.tokens;
	let previous = state.timestamp;
	for(let input = 0, output = 0; input < operations.length; input += 2, output += 7)
	{
		const timestamp = operations[input];
		const cost = operations[input + 1];
		if(timestamp < previous)
		{
			wire[output] = 2;
			wire[output + 1] = tokens;
			wire[output + 2] = previous;
			wire[output + 3] = tokens;
			continue;
		}
		const elapsed = timestamp - previous;
		const room = capacity - tokens;
		// Only multiply below saturation, where the product is at most UINT32_MAX.
		const refill = rate === 0 ? 0 : elapsed >= Math.ceil(room / rate) ? room : elapsed * rate;
		const available = tokens + refill;
		const allowed = cost <= available;
		tokens = allowed ? available - cost : available;
		previous = timestamp;
		wire[output] = allowed ? 0 : 1;
		wire[output + 1] = tokens;
		wire[output + 2] = timestamp;
		wire[output + 3] = available;
		wire[output + 4] = refill;
		if(allowed || cost <= capacity && rate > 0)
		{
			wire[output + 5] = 1;
			wire[output + 6] = allowed ? 0 : Math.ceil((cost - available) / rate);
		}
	}
	state.tokens = tokens;
	state.timestamp = previous;
	return wire;
};

/**
 * Maintain the same integer bucket semantics using exact bounded Number arithmetic.
 *
 * @param {object} configuration Integer-credit bucket configuration.
 * @param {number} configuration.capacity Maximum credits, initially full.
 * @param {number} configuration.rate Credits replenished per timestamp tick.
 * @param {number} [configuration.now] Initial timestamp.
 * @returns {object} Numeric request, trace, and snapshot operations.
 */
export const createJavascriptBucket = ({ capacity, rate, now = 0 }) => {
	const state = { tokens: capacity, timestamp: now };
	const run = operations => executeNumber(capacity, rate, state, operations);
	return {
		run
		, request: (timestamp, cost) => decode(run(Uint32Array.of(timestamp, cost)))
		, advance: timestamp => decode(run(Uint32Array.of(timestamp, 0)))
		, snapshot: () => ({ ...state })
	};
};

/**
 * Snapshot input and exclude preparation while returning freshly allocated wire output.
 *
 * @param {object} configuration Bucket parameters and timestamp/cost pairs.
 * @param {number} configuration.capacity Maximum credits, initially full.
 * @param {number} configuration.rate Credits replenished per timestamp tick.
 * @param {number} [configuration.now] Initial timestamp.
 * @param {Uint32Array} configuration.operations Alternating timestamps and costs.
 * @returns {() => Uint32Array} Matched numeric trace from the initially full state.
 */
export const prepareJavascriptTrace = ({ capacity, rate, now = 0, operations }) => {
	const snapshot = operations.slice();
	return () => executeNumber(capacity, rate, { tokens: capacity, timestamp: now }, snapshot);
};
