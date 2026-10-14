/**
 * Require an installed, executable browser for every requested Playwright engine.
 *
 * @file
 */
import { accessSync, constants } from "node:fs";
import { chromium, firefox, webkit } from "playwright";

const engines = { chromium, firefox, webkit };
const requested = process.argv.slice(2);
if(!requested.length) throw new Error("Name at least one Playwright engine");
for(const name of requested)
{
	if(!Object.hasOwn(engines, name)) throw new Error(`Unknown Playwright engine: ${name}`);
	const path = engines[/** @type {keyof typeof engines} */ (name)].executablePath();
	try
	{ accessSync(path, constants.X_OK); }
	catch(error)
	{ throw new Error(`${name} has no executable browser at ${path}`, { cause: error }); }
	process.stdout.write(`${name}: ${path}\n`);
}
