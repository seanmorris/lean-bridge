/**
 * Install an exact prepared CPAN archive without registry access.
 *
 * @file
 */
import { pathToFileURL } from "node:url";
import { installCpanArchive } from "../src/release/cpan-install.mjs";
export { installCpanArchive };

if(import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
{
	const flags = Object.fromEntries(Array.from({ length: (process.argv.length - 2) / 2 }, (_, i) => [process.argv[2 + i * 2], process.argv[3 + i * 2]]));
	try
	{
		const result = await installCpanArchive({ archive: flags["--archive"]
			, prefix: flags["--prefix"]
			, workingRoot: flags["--work"] ?? "build/perl-installs"
			, mode: flags["--mode"] ?? "auto"
			, perl: flags["--perl"] ?? "perl" });
		console.log(JSON.stringify(result));
	} catch(error)
	{ console.error(error.message, error.details ?? ""); process.exitCode = 1; }
}
