/**
 * Independent compact call plans for owned PHP-Wasm refinement probes.
 * Compiler output supplies private identities; this file supplies semantic order.
 *
 * @file
 */
import assert from "node:assert/strict";
import { phpWasmUnmarkedEntries } from "./php-wasm-refinement-entry-plan.mjs";
import { validateSubtypeEntrySelection } from "./php-wasm-subtype-entry-c.mjs";

const kinds = ["validator", "constructor", "adapter", "source"];
/**
 * Owned.lean defines checkedCountAlternate as checkedCount, so each alternate
 * constructor entry encloses exactly one checkedCount entry.
 */
export const phpWasmOwnedSubtypeAlternateConstructors
	= Object.freeze(["checkedCountAlternate", "checkedCount"]);
const counts = entries => Object.fromEntries(kinds.map(kind => [
	kind, entries.filter(item => item.kind === kind).length
]));

/**
 * Build the exact expected marker sequence for the compact owned caller.
 *
 * The generated validator identity is deliberately recovered from its retained
 * Lean export block. No private hash or adapter symbol is reproduced here.
 *
 * @param family - One explicit #1825 owned refinement family.
 * @param selected - Compiler-derived plus authored marker identities.
 * @param generatedLeanSource - Exact generated owned adapter source.
 * @param options - Compiler-classified entry forms and call targets.
 * @param options.globalDefinitions - Authored entries compiled as module-initialized values.
 * @param options.reducedArity - Authored sources reached only through a reduced-arity target.
 * @param options.unreachedSources - Authored sources no compiled call reaches.
 */
export const phpWasmOwnedRefinementEntryPlan = (family, selected, generatedLeanSource, options = {}) => {
	validateSubtypeEntrySelection(selected); assert.equal(typeof generatedLeanSource, "string");
	const { unmarked, close } = phpWasmUnmarkedEntries(selected, options);
	assert.ok(["owned-subtype", "owned-checked-record"].includes(family));
	const namespace = family === "owned-subtype" ? "Owned" : "OwnedCheckedRecords";
	const find = (kind, label) => {
		const matches = selected.filter(item => item.kind === kind && item.label === label);
		assert.equal(matches.length, 1, `${kind}/${label}`);
		return { kind, label };
	};
	const constructor = name => find("constructor", `${namespace}.${name}`);
	const source = name => find("source", `${namespace}.${name}`);
	const adapter = (name, layer) => find("adapter", `${name}:${layer}`);
	const hook = label => find("adapter", label);
	const validator = names => {
		assert.ok(names.length > 0);
		const blocks = selected.filter(item => item.kind === "validator").map(item => {
			const annotation = `@[export ${item.symbol}]`;
			const start = generatedLeanSource.indexOf(annotation);
			assert.ok(start >= 0, annotation);
			const next = generatedLeanSource.indexOf("\n@[export ", start + annotation.length);
			return { item, block: generatedLeanSource.slice(start, next < 0 ? undefined : next) };
		});
		const matches = blocks.filter(({ block }) => names.every(name => new RegExp(
			`_root_\\.${namespace}\\.${name}(?![A-Za-z0-9_])`, "u"
		).test(block)));
		assert.equal(matches.length, 1, `owned validator for ${names.join(",")}`);
		return { kind: "validator", label: matches[0].item.label };
	};
	const constructors = names => names.map(constructor);
	const borrowed = count => Array.from({ length: count }, () => hook("identity.borrow"));
	// Every owned call closes its input leases, refused or accepted.
	const item = (control, outcome, publicName, entries) => unmarked(control, outcome, publicName
		, [...entries, hook("transfer.finish")], counts);
	const setup = name => item(`setup-${name === "newTicket" ? "owner" : name}`
		, "accepted", name, [adapter(name, "native"), adapter(name, "lean"), source(name)]);
	const accepted = (control, name, validatorNames, constructorNames, borrowCount = 1) => item(
		control, "accepted", name, [
			...borrowed(borrowCount), adapter(name, "native")
			, validator(validatorNames), ...constructors(constructorNames)
			, adapter(name, "lean"), ...constructors(constructorNames), source(name)
		]
	);
	const refused = (control, name, validatorNames, constructorNames, borrowCount = 1) => item(
		control, "refused", name, [
			...borrowed(borrowCount), adapter(name, "native")
			, validator(validatorNames), ...constructors(constructorNames)
		]
	);
	const transfer = (control, outcome, name, validatorNames, constructorNames) => {
		const prefix = [
			hook("transfer.begin"), hook("identity.borrow"), hook("transfer.reserve")
			, hook("transfer.commit"), adapter(name, "native")
			, validator(validatorNames), ...constructors(constructorNames)
		];
		const entries = outcome === "accepted" ? [
			...prefix, hook("owner.move"), hook("owner.consume")
			, adapter(name, "lean"), ...constructors(constructorNames), source(name)
		] : prefix;
		return item(control, outcome, name, entries);
	};
	let cases;
	if(family === "owned-subtype") cases = [
		setup("newTicket")
		, accepted("borrow-valid", "echoRecord", ["checkedCount"], ["checkedCount"])
		, refused("borrow-refusal", "echoRecord", ["checkedCount"], ["checkedCount"])
		, accepted("borrow-recovery", "echoRecord", ["checkedCount"], ["checkedCount"])
		, accepted("alternate-valid", "echoRecordAlternate"
			, ["checkedCountAlternate"], phpWasmOwnedSubtypeAlternateConstructors)
		, refused("alternate-refusal", "echoRecordAlternate"
			, ["checkedCountAlternate"], phpWasmOwnedSubtypeAlternateConstructors)
		, { ...setup("newTicket"), control: "setup-transfer-owner" }
		, transfer("transfer-refusal", "refused", "transferRecord"
			, ["checkedCount"], ["checkedCount"])
		, transfer("transfer-accepted", "accepted", "transferRecord"
			, ["checkedCount"], ["checkedCount"])
	];
	else cases = [
		setup("newTicket")
		, accepted("booking-valid", "echoBooking", ["mkWindow"], ["mkWindow"])
		, refused("booking-refusal", "echoBooking", ["mkWindow"], ["mkWindow"])
		, accepted("claim-valid", "echoClaim", ["mkClaim"], ["mkClaim"])
		, refused("claim-refusal", "echoClaim", ["mkClaim"], ["mkClaim"])
		, accepted("claim-recovery", "echoClaim", ["mkClaim"], ["mkClaim"])
		, accepted("pair-valid", "pairClaim", ["mkWindow"], ["mkWindow"], 2)
	];
	if(family === "owned-checked-record")
	{
		// pairClaim has two distinct validators before its one Lean adapter.
		const pair = (control, outcome) => {
			const first = [
				...borrowed(2), adapter("pairClaim", "native")
				, validator(["mkWindow"]), constructor("mkWindow")
				, validator(["mkClaim"]), constructor("mkClaim")
			];
			return item(control, outcome, "pairClaim", outcome === "accepted" ? [
				...first, adapter("pairClaim", "lean"), constructor("mkWindow")
				, constructor("mkClaim"), source("pairClaim")
			] : first);
		};
		cases.splice(6, 1, pair("pair-valid", "accepted"), pair("pair-second-refusal", "refused"));
		cases.push(
			accepted("grant-valid", "echoGrant"
				, ["checkedPositive", "mkGrant"], ["checkedPositive", "mkGrant"])
			, refused("grant-positive-refusal", "echoGrant"
				, ["checkedPositive", "mkGrant"], ["checkedPositive"])
			, refused("grant-record-refusal", "echoGrant"
				, ["checkedPositive", "mkGrant"], ["checkedPositive", "mkGrant"])
			, { ...setup("newTicket"), control: "setup-transfer-owner" }
			, transfer("transfer-refusal", "refused", "transferClaim", ["mkClaim"], ["mkClaim"])
			, transfer("transfer-accepted", "accepted", "transferClaim", ["mkClaim"], ["mkClaim"])
		);
	}
	assert.equal(new Set(cases.map(value => value.control)).size, cases.length);
	assert.ok(cases.some(value => value.call.entries.some(entry => entry.label === "owner.move")));
	assert.ok(cases.some(value => value.outcome === "refused"));
	const { globals, reduced } = close(cases);
	return { scope: "separate-instrumented-probe", family
		, selected: structuredClone(selected), cases
		, ...globals.length ? { globals } : {}, ...reduced.length ? { reducedArity: reduced } : {} };
};
