#!/usr/bin/env node
/**
 * Check the reviewed type inventory or print scoped evidence and outstanding work.
 *
 * @file
 */

import assert from "node:assert/strict";
import { readTypeSurface, typeSurfaceCells, typeSurfaceGapReport } from "../src/adoption/type-surface.mjs";

const options = { json: false, profile: null, shape: null };
for(let index = 2; index < process.argv.length; index++)
{
	const argument = process.argv[index];
	if(argument === "--json") options.json = true;
	else if(argument === "--profile" || argument === "--shape")
	{
		const name = argument.slice(2);
		assert.equal(options[name], null, `Duplicate ${argument}`);
		const value = process.argv[++index];
		assert.ok(value && !value.startsWith("--"), `${argument} needs a value`);
		options[name] = value;
	}
	else assert.fail("Use --json [--profile ID] [--shape ID]");
}
const { document, ...contracts } = await readTypeSurface();
if(options.profile !== null) assert.ok(document.profiles.some(entry => entry.id === options.profile), `Unknown profile ${options.profile}`);
if(options.shape !== null) assert.ok(document.shapes.some(entry => entry.id === options.shape), `Unknown shape ${options.shape}`);
const report = typeSurfaceGapReport(document, contracts);
if(options.json)
{
	const cells = typeSurfaceCells(document, contracts).filter(cell =>
		(options.profile === null || cell.profile === options.profile) && (options.shape === null || cell.shape === options.shape));
	const keys = new Set(cells.map(cell => cell.id));
	const gaps = report.gaps.filter(gap => keys.has(gap.cell));
	const requiredGaps = gaps.filter(gap => gap.requirement !== "reviewed-exclusion").length;
	console.log(JSON.stringify({
		...report
		, filters: { profile: options.profile, shape: options.shape }
		, profiles: new Set(cells.map(cell => cell.profile)).size
		, shapes: new Set(cells.map(cell => cell.shape)).size
		, cells: cells.length
		, observedCells: cells.filter(cell => cell.observation !== null).length
		, installedTestedCells: cells.filter(cell => cell.stages.installedExecution.state === "passed").length
		, requiredGaps, complete: requiredGaps === 0, gaps, selectedCells: cells
	}, null, 2));
}
else
{
	assert.ok(options.profile === null && options.shape === null, "Filters require --json");
	const summary = { ...report };
	delete summary.gaps;
	console.log(JSON.stringify(summary, null, 2));
	console.log("Inventory valid. Unreviewed and rejected required cells remain work; this check does not promote type support.");
}
