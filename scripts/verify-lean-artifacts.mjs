#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { CapsuleContractError } from "../src/capsule/contract.mjs";
import {
	canonicalJson,
	readLockedGraph,
	sha256,
} from "../src/capsule/node.mjs";

const option = name => {
	const index = process.argv.indexOf(name);
	if(index === -1 || !process.argv[index + 1])
	{
		throw new Error(`missing required ${name}`);
	}
	return process.argv[index + 1];
};

const lockPath = resolve(option("--lock"));
const buildRoot = resolve(option("--build-root"));
const targetName = option("--target");

const verify = async ({ packageId, profile, path, expected }) => {
	const actual = sha256(await readFile(path));
	if(actual !== expected)
	{
		throw new CapsuleContractError(
			"artifact-integrity-mismatch",
			`${packageId} produced unexpected ${profile} artifact`,
			{
				package: packageId
				, profile
				, path
				, expected
				, actual
				, action: "Reject this composition; rebuild in the locked closure or review and relock the changed artifact."
			},
		);
	}
	return Object.freeze({ profile, file: path.slice(buildRoot.length + 1), sha256: actual });
};

try
{
	const graph = await readLockedGraph({ lockPath, profile: "side-lazy" });
	const libraries = [];
	for(const library of graph.libraries)
	{
		const target = library.capsule.artifacts.targets.find(
			candidate => candidate.target === targetName,
		);
		if(!target)
		{
			throw new CapsuleContractError(
				"missing-artifact-target",
				`${library.id} has no artifacts for ${targetName}`,
				{
					package: library.id
					, target: targetName
					, action: "Build or select a target declared by every capsule in the graph."
				},
			);
		}
		const artifacts = [];
		for(const profile of ["startup", "lazy"])
		{
			artifacts.push(
				await verify({
					packageId: library.id
					, profile: `side-${profile}`
					, path: resolve(buildRoot, profile, target.sideModule.file)
					, expected: target.sideModule.sha256
				}),
			);
		}
		for(const artifact of target.staticObjects)
		{
			artifacts.push(
				await verify({
					packageId: library.id
					, profile: "final-static-input"
					, path: resolve(buildRoot, "final-static", artifact.file)
					, expected: artifact.sha256
				}),
			);
		}
		libraries.push({
			id: library.id
			, capsuleSha256: library.sha256
			, bindingIr: library.build.bindingIr
			, artifacts
		});
	}
	process.stdout.write(
		canonicalJson({
			schemaVersion: 1
			, graphId: graph.graphId
			, target: targetName
			, libraries
		}),
	);
} catch(error)
{
	if(error instanceof CapsuleContractError)
	{
		process.stderr.write(`${error.code}: ${error.message}\n`);
		process.stderr.write(`${JSON.stringify(error.details)}\n`);
		process.exitCode = 1;
	} else
	{
		throw error;
	}
}
