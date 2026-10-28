/**
 * Fast controls for the JavaScript-family dependent Fin consumer.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	dependentFinJavascriptConsumer, dependentFinJavascriptExpected
	, dependentFinJavascriptProfiles, dependentFinJavascriptRoutes
	, dependentFinTypeScript
} from "./dependent-fin-javascript.mjs";
import { executeDependentFin } from "../fixtures/dependent-fin-consumers/javascript.mjs";

const faithful = () => {
	const call = (name, args) => {
		if(name === "mirror")
		{
			const [bound, value] = args;
			if(value >= bound) throw new Error("component call failed (6)");
			return bound - 1n - value;
		}
		const [start, bound, value, name_] = args;
		if(value >= bound) throw new Error("component call failed (6)");
		return `${name_}:${start + value}`;
	};
	const checked = (name, args) => {
		const labels = name === "mirror" ? ["arg0", "arg1"]
			: ["arg0", "arg1", "arg2", "arg3"];
		for(const [index, value] of args.entries())
		{
			if(index === labels.length - 1 && name === "label")
			{
				if(typeof value !== "string")
					throw new TypeError(`${name}.${labels[index]} must be string`);
				continue;
			}
			if(typeof value !== "bigint" || value < 0n)
				throw new TypeError(`${name}.${labels[index]} must be non-negative bigint`);
		}
		const bound = args[name === "mirror" ? 0 : 1];
		const position = name === "mirror" ? 1 : 2;
		if(args[position] >= bound)
			throw new TypeError(
				`${name}.${labels[position]} must be bigint below ${bound}`
			);
		return call(name, args);
	};
	return {
		mirror: (...args) => checked("mirror", args)
		, label: (...args) => checked("label", args)
		, raw: call
	};
};

test("the shared JavaScript caller covers every exact profile and route", async () => {
	assert.equal(dependentFinJavascriptProfiles.length, 5);
	assert.deepEqual(dependentFinJavascriptRoutes
		, ["ordinary-source", "reviewed-ir"]);
	const source = await dependentFinJavascriptConsumer();
	for(const text of ["2n ** 70n", "2n ** 128n", "1000"
		, "caller data unchanged", "arg2", "arg1"])
		assert.ok(source.includes(text), text);
	for(const profile of dependentFinJavascriptProfiles)
		for(const route of dependentFinJavascriptRoutes)
			assert.deepEqual(executeDependentFin({
				module: "dependentfin", profile, route
			}, faithful()), {
				module: "dependentfin", route
				, ...dependentFinJavascriptExpected
			});
});

test("strict TypeScript states the two public signatures without any", () => {
	const source = dependentFinTypeScript({ profile: "node-typescript" });
	assert.match(source, /typeof api\.mirror, \(arg0: bigint, arg1: bigint\) => bigint/u);
	assert.match(source, /typeof api\.label, \(arg0: bigint, arg1: bigint, arg2: bigint, arg3: string\) => string/u);
	assert.equal((source.match(/@ts-expect-error/gu) ?? []).length, 2);
	assert.doesNotMatch(source, /\bany\b/u);
});

test("the caller rejects a frozen or wrong dependency", () => {
	const request = {
		module: "dependentfin", profile: "node-javascript"
		, route: "ordinary-source"
	};
	const frozen = faithful();
	frozen.mirror = (bound, value) => {
		if(value >= 10n) throw new TypeError("mirror.arg1 must be bigint below 10");
		return bound - 1n - value;
	};
	assert.throws(() => executeDependentFin(request, frozen)
		, /accepted: mirror public bound|wrong rejection/u);
	const wrong = faithful();
	wrong.label = (start, bound, value, name) => {
		if(value >= start)
			throw new TypeError(`label.arg2 must be bigint below ${start}`);
		return `${name}:${start + value}`;
	};
	assert.throws(() => executeDependentFin(request, wrong)
		, /accepted: label public bound|wrong rejection/u);
});
