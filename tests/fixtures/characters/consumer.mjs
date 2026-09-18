/**
 * Exercise installed public functions in Node, browser pages, React and workers.
 *
 * @file
 */
export const points = [0, 0x41, 0x7f, 0x80, 0xe9, 0x301, 0x7ff, 0x800, 0xd7ff, 0xe000, 0xffff, 0x10000, 0x1f331, 0x10ffff];

/**
 * Run independent expectations without loading private package internals.
 *
 * @param api - Installed generated API.
 */
export const checkCharacters = api => {
	let checks = 0;
	const equal = (actual, expected) => {
		if(actual !== expected) throw new Error(`Char result differs: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
		checks++;
	};
	const rejected = call => {
		try
		{ call(); } catch(error)
		{ if(error instanceof TypeError)
		{ checks++; return; } throw error; }
		throw new Error("Invalid Char was accepted");
	};
	const values = [];
	for(const point of points)
	{
		const value = String.fromCodePoint(point);
		equal(api.echo(value), value);
		equal(api.codePoint(value), point);
		equal(api.text(value), value);
		equal(api.choose(true, value, "z"), value);
		equal(api.choose(false, "z", value), value);
		values.push(api.codePoint(api.echo(value)));
	}
	for(const value of ["", "ab", "e\u0301", "☀️", "🇨🇦", "\ud800", "\udfff", "a\ud800", "\udfffa", "\udfff\ud800", 65, 65n, null, undefined, true, {}, ["a"], new String("a")])
	{
		rejected(() => api.echo(value));
		rejected(() => api.choose(false, value, "a"));
		rejected(() => api.choose(true, "a", value));
	}
	for(let index = 0; index < 1000; index++) equal(api.echo("🌱"), "🌱");
	equal(api.sprout(), "🌱");
	equal(api.codePoint("\0"), 0);
	return { checks, values, sprout: api.sprout() };
};
