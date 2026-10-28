/**
 * Browser consumer for finite specializations selected by configuration or reviewed Binding IR.
 *
 * @file
 */

/**
 * Exercise concrete exports while proving that no type token or instance dictionary crosses the API.
 *
 * @param {object} request - Exact package, author route and browser realm.
 * @param {object} api - Installed public npm API.
 */
export const executeCorpus = (request, api) => {
	const keys = ["module", "profile", "route"];
	if(!request || typeof request !== "object"
		|| Object.keys(request).sort().join() !== keys.sort().join()
		|| request.module !== "specialized"
		|| !["ordinary", "reviewed"].includes(request.route)
		|| !["browser-javascript", "browser-react", "browser-worker"].includes(request.profile))
		throw new Error("Invalid specialization browser request");
	let checks = 0, rejections = 0;
	const check = (value, label) => {
		if(!value) throw new Error(`failed: ${label}`);
		checks++;
	};
	const same = (actual, expected, label) => check(JSON.stringify(actual) === JSON.stringify(expected), label);
	const rejected = (call, label) => {
		try
		{ call(); }
		catch
		{ rejections++; return; }
		throw new Error(`accepted: ${label}`);
	};
	const greeting = "héllo 🙂", large = 2n ** 200n, words = [0, 42, 4294967295];
	check(api.echoWord(0) === 0 && api.echoWord(4294967295) === 4294967295, "echoWord");
	check(api.echoText(greeting) === greeting && api.echoText("") === "", "echoText");
	check(api.echoNat(large) === large, "echoNat");
	same(api.echoWords(words), words, "echoWords");
	for(const name of ["echo", "choose", "first", "duplicate"])
		check(!(name in api), `open generic ${name}`);
	// This result is chosen by Specialized.instInhabitedUInt32_specialized, not by the host.
	const instanceDefault = api.chooseWord(false, 5);
	check(api.chooseWord(true, 5) === 5 && instanceDefault === 37, "chooseWord instance");
	check(api.chooseText(true, greeting) === greeting && api.chooseText(false, greeting) === "", "chooseText");
	same(api.chooseWords(true, words), words, "chooseWords true");
	same(api.chooseWords(false, words), [], "chooseWords false");
	check(api.doubleWord(2147483649) === 2, "doubleWord instance");
	check(api.doubleNat(2n ** 100n) === 2n ** 101n, "doubleNat instance");
	check(api.firstTextWord(greeting, 9) === greeting, "two implicit arguments");
	check(api.plain(1) === 4, "ordinary neighbour");
	rejected(() => api.echoWord(4294967296), "UInt32 overflow");
	rejected(() => api.echoWord(-1), "negative UInt32");
	rejected(() => api.echoNat(-1n), "negative Nat");
	rejected(() => api.echoText([]), "non-string");
	rejected(() => api.chooseWord(0, 1), "non-Bool");
	for(let index = 0; index < 1000; index++)
	{
		check(api.chooseWord(index % 2 === 0, index) === (index % 2 === 0 ? index : 37), "repeated dictionary");
		check(api.doubleWord(index) === 2 * index, "repeated Add instance");
	}
	return { module: request.module, route: request.route, checks, rejections, instanceDefault };
};
