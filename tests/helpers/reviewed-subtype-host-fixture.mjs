/**
 * Independent reviewed Subtype callers for the remaining native hosts.
 * Preserve the original recovery corpus and add the same portable checked exports.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { reviewedSubtypeInstalledIr, reviewedSubtypeInstalledSource } from "./reviewed-subtype-installed-fixture.mjs";
import { reviewedSubtypeHostSupplements } from "./reviewed-subtype-host-supplements.mjs";

export const reviewedSubtypeHostProfiles = Object.freeze(["python", "rust", "dotnet", "java", "kotlin", "ruby", "php-native", "wit-wasi", "perl"]);
export const reviewedSubtypeHostExtensions = Object.freeze({ python: "py", rust: "rs", dotnet: "cs", java: "java", kotlin: "kt", ruby: "rb", "php-native": "php", "wit-wasi": "c", perl: "pl" });
export const reviewedSubtypeHostSource = `${reviewedSubtypeInstalledSource}
namespace Subtypes
def byteValue (value : Byte) : Byte := byte value
end Subtypes
`;

/** A portable name avoids Java's reserved byte keyword without changing the checked signature. */
export const reviewedSubtypeHostIr = () => {
	const review = reviewedSubtypeInstalledIr();
	const declaration = review.declarations.find(item => item.id === "lean:Subtypes.byte");
	assert.ok(declaration);
	declaration.id = "lean:Subtypes.byteValue";
	declaration.name = "byteValue";
	declaration.overloadKey = "Subtypes.byteValue";
	declaration.source.declaration = "Subtypes.byteValue";
	return review;
};

/** Reconstruct the exact result-constructor annotations retained by the 2026-10-10 producer. */
export const reviewedSubtypeHistoricalHostIr = () => {
	const review = reviewedSubtypeHostIr();
	const constructors = {
		shout: "Subtypes.checkedWord"
		, pad: "Subtypes.checkedEven"
		, join: "Subtypes.checkedWord"
		, byteValue: "Subtypes.checkedByte"
		, firstEven: "Subtypes.checkedEven"
		, secondEven: "Subtypes.checkedEven"
		, zeroEven: "Subtypes.checkedEven"
	};
	for(const [name, constructor] of Object.entries(constructors))
	{
		const declaration = review.declarations.find(item => item.id === `lean:Subtypes.${name}`);
		assert.ok(declaration, `Missing historical reviewed declaration: ${name}`);
		const result = declaration.source.extensions["lean-lang.org/refinements"].result;
		assert.deepEqual(result, { kind: "subtype", constructor: null });
		result.constructor = constructor;
	}
	return review;
};

const calls = {
	python: /\bapi\.([a-z_]+)\(/gu
	, rust: /\bapi::([a-z_]+)\(/gu
	, dotnet: /\bApi\.([A-Za-z]+)\(/gu
	, java: /\bApi\.([A-Za-z]+)\(/gu
	, kotlin: /\bApi\.([A-Za-z]+)\(/gu
	, ruby: /\bAPI\.([a-z_]+)\(/gu
	, "php-native": /\b(?:LeanSubtypes\\)?(shout|half|scale|head|pad|join|clamp|mix|byte_value|first_even|second_even|zero_even)\(/gu
	, "wit-wasi": /\b(?:(?:call|rejected)\(|subtypes_wasmtime_call\(session,\s*)"([a-z-]+)"/gu
	, perl: /\bLeanBridge::Subtypes::([a-z_]+)\(/gu
};
const fullDiagnostic = /(["'])(\w+) (was rejected by ([\w.]+)|is not below its Fin (\d+) bound)\1/gu;
const splitDiagnostic = /(["'])(\w+)\1,\s*(["'])(Subtypes\.\w+|\d+)\3/gu;
const sourceName = name => name[0].toLowerCase() + name.slice(1).replace(/[_-]([a-z])/gu, (_, letter) => letter.toUpperCase());

const declarationFor = (review, profile, line) => {
	assert.ok(reviewedSubtypeHostProfiles.includes(profile), "Unknown reviewed Subtype host");
	const names = [...new Set([...line.matchAll(calls[profile])].map(match => sourceName(match[1])))];
	assert.equal(names.length, 1, `Expected one called export on a diagnostic line: ${line}`);
	const declaration = review.declarations.find(item => item.id === `lean:Subtypes.${names[0]}`);
	assert.ok(declaration, `Unreviewed called export: ${names[0]}`);
	return declaration;
};

const diagnostics = line => [
	...[...line.matchAll(fullDiagnostic)].map(match => ({
		start: match.index + 1, label: match[2]
		, refinement: match[4] ? { kind: "subtype", constructor: match[4] } : { kind: "fin", bound: match[5] } }))
	, ...[...line.matchAll(splitDiagnostic)].map(match => ({
		start: match.index + 1, label: match[2]
		, refinement: match[4].startsWith("Subtypes.") ? { kind: "subtype", constructor: match[4] } : { kind: "fin", bound: match[4] } }))
].sort((a, b) => a.start - b.start);

const parameterFor = (declaration, position, refinement) => {
	assert.ok(position >= 0 && declaration.parameters[position], `Unknown parameter in ${declaration.id}`);
	assert.deepEqual(declaration.source.extensions["lean-lang.org/refinements"].parameters[position], refinement, `${declaration.id} has a different checked parameter`);
	return declaration.parameters[position];
};

/**
 * Change only ordinary diagnostic labels to names owned by the independent review.
 *
 * @param source - Original caller with supplemental cases.
 * @param profile - Supported native host.
 * @param review - Independently authored reviewed signatures.
 */
export const relabelReviewedSubtypeHost = (source, profile, review = reviewedSubtypeHostIr()) => {
	assert.ok(reviewedSubtypeHostProfiles.includes(profile), "Unknown reviewed Subtype host");
	return source.split("\n").map(line => {
		let result = line;
		for(const item of diagnostics(line).reverse())
		{
			const ordinary = /^arg(\d+)$/u.exec(item.label);
			assert.ok(ordinary, `Expected an ordinary diagnostic label: ${item.label}`);
			const parameter = parameterFor(declarationFor(review, profile, line), Number(ordinary[1]), item.refinement);
			result = result.slice(0, item.start) + parameter.name + result.slice(item.start + item.label.length);
		}
		return result;
	}).join("\n");
};

/**
 * Verify each diagnostic against its called export, parameter, constructor or Fin bound.
 *
 * @param source - Complete generated host caller.
 * @param profile - Supported native host.
 * @param review - Independently authored reviewed signatures.
 */
export const assertReviewedSubtypeHostDiagnostics = (source, profile, review = reviewedSubtypeHostIr()) => {
	assert.ok(reviewedSubtypeHostProfiles.includes(profile), "Unknown reviewed Subtype host");
	let count = 0;
	for(const line of source.split("\n")) for(const item of diagnostics(line))
	{
		const declaration = declarationFor(review, profile, line);
		parameterFor(declaration, declaration.parameters.findIndex(parameter => parameter.name === item.label), item.refinement);
		count++;
	}
	assert.ok(count > 0, "No reviewed diagnostics were checked");
	return count;
};

/**
 * Preserve every original caller byte except reviewed diagnostic names; insert eight checks.
 *
 * @param profile - Supported native host.
 */
export const reviewedSubtypeHostConsumer = async profile => {
	assert.ok(reviewedSubtypeHostProfiles.includes(profile), "Unknown reviewed Subtype host");
	const original = await readFile(`tests/fixtures/subtype-consumers/${profile}.${reviewedSubtypeHostExtensions[profile]}`, "utf8");
	const marker = original.match(/^\s*\$?checks \+= 2000;?\n/mu)?.[0];
	assert.ok(marker && original.split(marker).length === 2, "Missing unique original recovery counter");
	const source = relabelReviewedSubtypeHost(original.replace(marker, () => reviewedSubtypeHostSupplements[profile] + marker), profile);
	assertReviewedSubtypeHostDiagnostics(source, profile);
	return source;
};
