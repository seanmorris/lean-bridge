/**
 * Source controls for public C++ FinContainers entry counters (VO #1438). Installed execution belongs to the
 * gated native-fin-containers producer with LEAN_BRIDGE_FIN_CONTAINER_ENTRY_COUNTERS=1.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { generateCppBindingPackage } from "../src/backends/cpp/generate.mjs";
import { boostSources } from "../src/backends/cpp/boost.mjs";
import { copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { cppFinContainerEntryLabels, cppFinContainerEntryMissing, cppFinContainerEntryParameterNames, cppFinContainerEntryProbe } from "./helpers/cpp-fin-container-entry-probe.mjs";
import { finContainerEntryExpected, finContainerEntryMutations, finContainerEntrySteps, readFinContainerEntry } from "./helpers/fin-container-entry-dispatch.mjs";
import { finContainerReviewedIr } from "./helpers/reviewed-fin-container-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const model = () => {
	const ir = finContainerReviewedIr();
	return { component: ir.component, bindingIr: ir };
};

test("C++ container labels are read from the installed contract and must be the labels the rows expect", () => {
	assert.deepEqual(cppFinContainerEntryParameterNames(model()), cppFinContainerEntryLabels);
	for(const [label, mutate] of [
		["reviewed valueN labels", copy => { copy.bindingIr.declarations.find(item => item.source.declaration === "FinContainers.label").parameters[1].name = "value1"; }]
		, ["another component", copy => { copy.component = { ...copy.component, id: "other@1.0.0" }; }]
		, ["missing declaration", copy => { copy.bindingIr.declarations = copy.bindingIr.declarations.filter(item => item.source.declaration !== "FinContainers.present"); }]
		, ["duplicate declaration", copy => { copy.bindingIr.declarations.push(copy.bindingIr.declarations.find(item => item.source.declaration === "FinContainers.sumHuge")); }]
		, ["short arity", copy => { copy.bindingIr.declarations.find(item => item.source.declaration === "FinContainers.label").parameters.pop(); }]
	]) {
		const copy = model(); mutate(copy);
		assert.throws(() => cppFinContainerEntryParameterNames(copy), assert.AssertionError, label);
	}
});

test("the C++ probe resolves its counter first and checks every exact result and refusal", () => {
	const source = cppFinContainerEntryProbe();
	assert.match(source, /#include <fincontainers\.hpp>/u);
	assert.match(source, /namespace api = lean_bridge::fincontainers;/u);
	assert.ok(source.indexOf("if (!counter)") < source.indexOf('report("start"'), "the counter is resolved before any call");
	assert.ok(source.includes(JSON.stringify(cppFinContainerEntryMissing)));
	assert.match(source, /error\.status != FINCONTAINERS_STATUS_INVALID_ARGUMENT \|\| error\.code != FINCONTAINERS_ERROR_INVALID_ARGUMENT \|\| std::string\(error\.what\(\)\) != message/u);
	assert.match(source, /Nat\("1180591620717411303424"\)/u);
	// Only the public wrapper is called; raw adapters belong to the separately labelled C probe.
	assert.doesNotMatch(source, /lean\/lean\.h|lean_box|lb_[0-9a-f]{24}|l_FinContainers_/u);
	for(const [step, method, , outcome] of finContainerEntrySteps)
	{
		assert.ok(source.includes(JSON.stringify(step)), step);
		if(method) assert.ok(source.includes(`api::${method.replace(/[A-Z]/gu, letter => `_${letter.toLowerCase()}`)}(`), method);
		if(outcome.rejected) assert.ok(source.includes(`${outcome.rejected[0]} is not below its Fin ${outcome.rejected[1]} bound`), step);
	}
	for(const [step] of finContainerEntrySteps) assert.equal(source.split(`(${JSON.stringify(step)}`).length - 1, 1, `${step} is reported exactly once`);
	const { valid, mutations } = finContainerEntryMutations(finContainerEntryExpected);
	readFinContainerEntry(valid, finContainerEntryExpected);
	for(const [reason, output] of Object.entries(mutations)) assert.throws(() => readFinContainerEntry(output, finContainerEntryExpected), TypeError, reason);
});

test("the C++ probe compiles against the generated public C++ declarations and bundled Boost", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-cpp-container-entry-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = finContainerReviewedIr(), c = generateCBindingPackage(ir), cpp = generateCppBindingPackage(ir);
	await saveLakeFile(root, "fincontainers.h", c["include/fincontainers.h"]);
	await saveLakeFile(root, "fincontainers.hpp", cpp["include/fincontainers.hpp"]);
	for(const [path, bytes] of Object.entries(boostSources())) await saveLakeFile(root, path, bytes);
	await saveLakeFile(root, "probe.cpp", cppFinContainerEntryProbe());
	// This checks C++ types, overloads and error constants; real entries are counted by the gated producer.
	const result = await runCopied("/usr/bin/c++", ["-std=c++20", "-Wall", "-Wextra", "-Werror", "-DBOOST_MP_STANDALONE", "-I", root, "-I", join(root, "include"), "-fsyntax-only", "probe.cpp"], root
		, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" });
	assert.equal(result.stdout, ""); assert.equal(result.stderr, "");
});
