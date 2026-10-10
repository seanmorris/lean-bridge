/**
 * Independently authored Subtype signatures and constructor choices.
 * No compiler output supplies this review.
 *
 * @file
 */
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

const subtype = constructor => constructor === null ? null : { kind: "subtype", constructor: `Subtypes.${constructor}` };

/**
 * Describe the native Subtypes fixture, optionally with scalar and generic controls.
 *
 * @param extended - Include the fresh-Lean controls below.
 */
export const reviewedSubtypeIr = (extended = false) => {
	const signatures = [
		["shout", ["string"], "string", ["checkedWord"], "checkedWord"]
		, ["half", ["nat"], "nat", ["checkedEven"], null]
		, ["scale", ["int", "int"], "int", [null, "checkedSmall"], null]
		, ["head", ["bytes"], "uint8", ["checkedPayload"], null]
		, ["pad", ["nat"], "nat", [null], "checkedEven"]
		, ["join", ["string", "string"], "string", ["checkedWord", "checkedWord"], "checkedWord"]
		, ["clamp", ["nat"], "nat", ["checkedBounded"], null]
		, ["mix", ["nat", "nat"], "nat", ["checkedEven", null], null]
		, ...extended ? [
			["byte", ["uint8"], "uint8", ["checkedByte"], "checkedByte"]
			, ["firstEven", ["nat"], "nat", ["checkedEven"], "checkedEven"]
			, ["secondEven", ["nat"], "nat", ["normalizedEven"], "checkedEven"]
		] : []];
	const ir = corpusReviewedIr({ id: "subtypes" }, signatures.map(([name, parameters, result]) => ({ name: `Subtypes.${name}`, parameters, result })));
	for(const declaration of ir.declarations)
	{
		const [, , , parameters, result] = signatures.find(([name]) => declaration.name === name);
		declaration.source.extensions["lean-lang.org/refinements"] = { parameters: parameters.map(subtype), result: subtype(result) };
		if(declaration.name === "mix") declaration.source.extensions["lean-lang.org/refinements"].parameters[1] = { kind: "fin", bound: "10" };
		if(["firstEven", "secondEven"].includes(declaration.name))
		{
			declaration.source.declaration = "Subtypes.echo";
			declaration.source.extensions["lean-lang.org/specialization"] = {
				name: `Subtypes.${declaration.name}`, declaration: "Subtypes.echo"
				, types: ["Subtypes.Even"]
				, application: "(@_root_.Subtypes.echo.{0} (@_root_.Subtypes.Even))"
			};
		}
	}
	return ir;
};

export const reviewedSubtypeExtraSource = `
namespace Subtypes
universe u
abbrev Byte := { value : UInt8 // value != 0 }
def checkedByte (value : UInt8) : Option Byte :=
  if h : value != 0 then some ⟨value, h⟩ else none
def byte (value : Byte) : Byte := value
def echo {α : Type u} (value : α) : α := value
def normalizedEven (value : Nat) : Option Even := some ⟨value * 2, by omega⟩
def wrongEven (value : Nat) : Option Nat := some value
unsafe def unsafeEven (value : Nat) : Option Even := checkedEven value
partial def partialEven (value : Nat) : Option Even :=
  if value == 0 then checkedEven value else partialEven (value - 1)
end Subtypes
`;

/** Undefined foreign constructor used only by source rejection tests, never installed packages. */
export const reviewedSubtypeForeignSource = `
namespace Subtypes
@[extern "lean_bridge_test_foreign_even"] opaque foreignEven (value : Nat) : Option Even
end Subtypes
`;
