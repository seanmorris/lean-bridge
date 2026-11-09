/**
 * Compare JSON values without asking Node's assertion formatter to render an
 * entire large document when one leaf differs.
 *
 * @file
 */
import assert from "node:assert/strict";

const identifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/u;
const maximumValuePreview = 120;

const jsonKind = value => {
	if(value === null) return "null";
	if(Array.isArray(value)) return "array";
	return typeof value;
};

const describe = value => {
	const kind = jsonKind(value);
	if(kind === "array") return `array(${value.length})`;
	if(kind === "object") return `object(${Object.keys(value).length} keys)`;
	if(kind === "string")
	{
		const preview = value.length <= maximumValuePreview
			? value : `${value.slice(0, maximumValuePreview)}…`;
		return `string(${value.length}, ${JSON.stringify(preview)})`;
	}
	if(kind === "undefined") return "undefined";
	if(kind === "bigint") return `${value}n`;
	if(kind === "symbol") return value.toString();
	if(kind === "function") return `function(${value.name || "anonymous"})`;
	return String(value);
};

const childPath = (path, key, array) => array
	? `${path}[${key}]`
	: identifier.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;

/**
 * Return the first bounded structural difference between two JSON values.
 * Object key order is ignored. The walk is depth-first and holds only the
 * current ancestry plus one object's key list, rather than every pending
 * descendant in a wide document.
 *
 * @param actual - First JSON value.
 * @param expected - Second JSON value.
 * @returns {string|undefined} A bounded diagnostic, or undefined when equal.
 */
export const firstJsonDifference = (actual, expected) => {
	const stack = [{ actual, expected, path: "$", entered: false }];
	while(stack.length > 0)
	{
		const frame = stack.at(-1);
		if(!frame.entered)
		{
			if(Object.is(frame.actual, frame.expected))
			{
				stack.pop();
				continue;
			}
			const actualKind = jsonKind(frame.actual);
			const expectedKind = jsonKind(frame.expected);
			if(actualKind !== expectedKind)
				return `${frame.path}: ${actualKind} !== ${expectedKind}`;
			if(actualKind !== "array" && actualKind !== "object")
				return `${frame.path}: ${describe(frame.actual)} !== ${describe(frame.expected)}`;
			if(actualKind === "object"
				&& (Object.getPrototypeOf(frame.actual) !== Object.prototype
					|| Object.getPrototypeOf(frame.expected) !== Object.prototype))
				return `${frame.path}: non-JSON object`;
			frame.array = actualKind === "array";
			frame.actualKeys = frame.array
				? null : Object.keys(frame.actual);
			frame.expectedKeys = frame.array
				? null : Object.keys(frame.expected);
			const actualLength = frame.array
				? frame.actual.length : frame.actualKeys.length;
			const expectedLength = frame.array
				? frame.expected.length : frame.expectedKeys.length;
			if(actualLength !== expectedLength)
				return `${frame.path}: ${frame.array ? "length" : "key count"} `
					+ `${actualLength} !== ${expectedLength}`;
			if(!frame.array)
			{
				const expectedKeys = new Set(frame.expectedKeys);
				for(const key of frame.actualKeys)
					if(!expectedKeys.has(key))
						return `${frame.path}: unexpected key ${JSON.stringify(key)}`;
				const actualKeys = new Set(frame.actualKeys);
				for(const key of frame.expectedKeys)
					if(!actualKeys.has(key))
						return `${frame.path}: missing key ${JSON.stringify(key)}`;
			}
			frame.length = actualLength;
			frame.index = 0;
			frame.entered = true;
		}
		if(frame.index === frame.length)
		{
			stack.pop();
			continue;
		}
		const key = frame.array ? frame.index : frame.actualKeys[frame.index];
		frame.index += 1;
		stack.push({
			actual: frame.actual[key], expected: frame.expected[key]
			, path: childPath(frame.path, key, frame.array), entered: false
		});
	}
};

/**
 * Assert semantic equality of two JSON values with a bounded failure message.
 *
 * @param actual - First JSON value.
 * @param expected - Second JSON value.
 * @param message - Optional contract context.
 */
export const assertJsonEqual = (actual, expected, message = undefined) => {
	const difference = firstJsonDifference(actual, expected);
	if(difference !== undefined)
		assert.fail(message === undefined ? difference : `${message}: ${difference}`);
};
