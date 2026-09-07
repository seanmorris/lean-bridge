/**
 * A burst followed by two arrivals after replenishment. Times are milliseconds.
 *
 * @file
 */
export const EXAMPLE_CONFIG = Object.freeze({ capacity: 5, rate: 2, cost: 1 });
export const CREDITS_PER_TOKEN = 1000;
export const EXAMPLE_REQUESTS = Object.freeze([
	...Array.from({ length: 8 }, () => Object.freeze({ timestamp: 0, cost: 1 }))
	, Object.freeze({ timestamp: 500, cost: 1 })
	, Object.freeze({ timestamp: 1000, cost: 1 })
]);

/**
 * Format credit units for presentation without implementing bucket transitions.
 *
 * @param {number} credits Integer credit units.
 * @returns {string} Token count with up to three fractional digits.
 */
export const formatTokens = credits => (credits / CREDITS_PER_TOKEN).toLocaleString("en-US", {
	maximumFractionDigits: 3
});

/**
 * Show simulation time with millisecond precision.
 *
 * @param {number} milliseconds Simulation timestamp.
 * @returns {string} Seconds with three fractional digits.
 */
export const formatTime = milliseconds => `${(milliseconds / 1000).toFixed(3)} s`;
