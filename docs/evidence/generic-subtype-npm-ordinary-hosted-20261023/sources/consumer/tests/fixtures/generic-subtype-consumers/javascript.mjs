/**
 * Public caller for installed generic records with checked Subtype fields.
 * Expected values are independent of generated metadata and adapter code.
 *
 * @file
 */
import { structuralValueSnapshot as snapshot } from "../structural-subtype-consumers/javascript.mjs";

/**
 * Exercise both generic-function specializations and their independent constructors.
 *
 * @param api - Installed public npm API, or an explicit oracle-test double.
 */
export const checkGenericSubtypeCompositions = api => {
	let checks = 0, rejections = 0;
	const check = (ok, label) => { if(!ok) throw new Error(`failed: ${label}`); checks++; };
	const equal = (actual, expected, label) => check(snapshot(actual) === snapshot(expected), label);
	const call = (name, arguments_, expected) => {
		const before = snapshot(arguments_), result = api[name](...arguments_);
		equal(result, expected, name);
		check(snapshot(arguments_) === before, `${name} input unchanged`);
		return result;
	};
	const refused = (name, arguments_, pattern = /failed \(5\)/u) => {
		const before = snapshot(arguments_);
		try
		{ api[name](...arguments_); }
		catch(error)
		{
			if(!pattern.test(String(error?.message))) throw new Error(`wrong rejection: ${name}: ${error?.message}`, { cause: error });
			check(snapshot(arguments_) === before, `${name} rejected input unchanged`);
			rejections++; return;
		}
		throw new Error(`accepted: ${name}`);
	};
	const generic = (value, marker) => ({ value, marker });
	for(let round = 0n; round < 100n; round++)
	{
		const value = round % 89n, marker = round % 7n, input = generic(value, marker);
		call("genericUse", [input], value + 1n + marker);
		call("echoGenericFirst", [input], generic(value + 1n, marker));
		call("echoGenericSecond", [input], generic(value + 2n, marker));
	}
	call("genericUse", [generic(99n, 2n)], 102n);
	call("echoGenericFirst", [generic(99n, 2n)], generic(100n, 2n));
	call("echoGenericSecond", [generic(89n, 2n)], generic(91n, 2n));
	refused("genericUse", [generic(100n, 2n)]);
	refused("echoGenericFirst", [generic(100n, 2n)]);
	refused("echoGenericSecond", [generic(90n, 2n)]);
	refused("echoGenericFirst", [generic(40n, "2")], /marker must be bigint/u);
	refused("echoGenericSecond", [{ marker: 2n }], /does not match the declared copied fields/u);
	return { checks, rejections };
};
