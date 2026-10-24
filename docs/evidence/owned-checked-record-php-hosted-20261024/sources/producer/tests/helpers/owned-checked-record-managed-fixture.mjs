/**
 * .NET, JVM, native PHP and WIT target selections for owned checked records.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	ownedCheckedRecordJavaScriptRoutes
	, ownedCheckedRecordJavaScriptSelection
} from "./owned-checked-record-javascript-fixture.mjs";

export const ownedCheckedRecordManagedRoutes
	= ownedCheckedRecordJavaScriptRoutes;
export const ownedCheckedRecordManagedTargets = Object.freeze({
	dotnet: Object.freeze({ target: "nuget"
		, profiles: Object.freeze(["dotnet"])
		, name: "LeanBridge.OwnedCheckedRecords" })
	, jvm: Object.freeze({ target: "maven"
		, profiles: Object.freeze(["java", "kotlin"])
		, name: "org.leanbridge:owned-checked-records" })
	, php: Object.freeze({ target: "php-native"
		, profiles: Object.freeze(["php-native"])
		, name: "leanbridge/owned-checked-records" })
	, wit: Object.freeze({ target: "wit-wasi"
		, profiles: Object.freeze(["wit-wasi"])
		, name: "owned-checked-records" })
});

/**
 * Replace only one authenticated selection's downstream package target.
 *
 * @param route - Ordinary/reviewed and full/result-only route.
 * @param group - Managed target group.
 */
export const ownedCheckedRecordManagedSelection = (route, group) => {
	assert.ok(Object.hasOwn(ownedCheckedRecordManagedTargets, group));
	const selected = ownedCheckedRecordJavaScriptSelection(route);
	const specification = ownedCheckedRecordManagedTargets[group];
	const suffix = selected.resultOnly ? "-result-only" : "";
	const name = group === "dotnet"
		? `${specification.name}${selected.resultOnly ? ".ResultOnly" : ""}`
		: group === "jvm"
			? `${specification.name}${suffix}`
			: `${specification.name}${suffix}`;
	const configuration = structuredClone(selected.configuration);
	configuration.targets = {
		[specification.target]: { name, version: "1.0.0" }
	};
	return Object.freeze({ ...selected, group, specification, configuration });
};
