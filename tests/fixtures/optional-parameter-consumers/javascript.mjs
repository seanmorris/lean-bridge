/**
 * Independent public JavaScript caller for the optional-parameter package.
 *
 * @file
 */

/**
 * Exercise omission, explicit defaults, explicit nondefaults, Option.none,
 * Unit, invalid host values and explicit host null.
 *
 * @param api - Installed generated public API, or a deliberate test double.
 */
export const checkOptionalParameters = api => {
	let checks = 0, rejections = 0;
	const check = (ok, label) => {
		if(!ok) throw new Error(`failed: ${label}`);
		checks++;
	};
	const refused = (call, label) => {
		try
		{ call(); }
		catch(error)
		{
			if(!(error instanceof TypeError))
				throw new Error(`wrong rejection: ${label}: ${error?.message}`
					, { cause: error });
			rejections++;
			return;
		}
		throw new Error(`accepted: ${label}`);
	};
	for(const name of [
		"word", "natural", "text", "character", "maybe", "present", "unitValue"
	]) check(typeof api[name] === "function" && api[name].length === 1
		, `${name} optional full-arity wrapper`);

	check(api.word() === 7, "word omitted");
	check(api.word(7) === 7, "word explicit default");
	check(api.word(11) === 11, "word explicit nondefault");
	refused(() => api.word(null), "word explicit null");

	const naturalDefault = 184467440737095516160n;
	check(api.natural() === naturalDefault, "natural omitted");
	check(api.natural(naturalDefault) === naturalDefault, "natural explicit default");
	check(api.natural(11n) === 11n, "natural explicit nondefault");
	refused(() => api.natural(11), "natural number");

	check(api.text() === "Lean\nBridge", "text omitted");
	check(api.text("Lean\nBridge") === "Lean\nBridge", "text explicit default");
	check(api.text("other") === "other", "text explicit nondefault");
	refused(() => api.text(null), "text explicit null");

	check(api.character() === "λ", "character omitted");
	check(api.character("λ") === "λ", "character explicit default");
	check(api.character("猫") === "猫", "character explicit nondefault");
	refused(() => api.character("ab"), "character invalid scalar");

	const none = Object.freeze({ tag: "none" });
	const some9 = Object.freeze({ tag: "some", value: 9 });
	const some11 = Object.freeze({ tag: "some", value: 11 });
	check(api.maybe().tag === "none", "none omitted");
	check(api.maybe(none).tag === "none", "none explicit default");
	check(api.maybe(some11).value === 11, "none explicit nondefault");
	refused(() => api.maybe(null), "Option.none is not host null");

	const omittedPresent = api.present();
	check(omittedPresent.tag === "some" && omittedPresent.value === 9
		, "some omitted");
	const explicitPresent = api.present(some9);
	check(explicitPresent.tag === "some" && explicitPresent.value === 9
		, "some explicit default");
	check(api.present(none).tag === "none", "some explicit Option.none");
	refused(() => api.present(null), "Option.some is not host null");

	check(api.unitValue() === undefined, "Unit omitted");
	check(api.unitValue(undefined) === undefined, "Unit supplied");
	refused(() => api.unitValue(null), "Unit explicit null");
	return { checks, rejections };
};
