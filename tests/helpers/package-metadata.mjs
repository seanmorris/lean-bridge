/**
 * Inspect author metadata in real archives using each format's native parser.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { processBuildRunner } from "../../src/build/process-runner.mjs";

/**
 * Distinct declarations include characters that must remain data in generators.
 *
 * @param name - Unrelated fixture library name.
 */
export const packageMetadataFixture = name => ({
	description: `${name}: costs < limits & "quotes", #{raise 'metadata executed'} and \\ paths.`
	, authors: [{ name: `${name} maintainers & collaborators`, email: `${name}@example.org`, url: `https://example.org/${name}/team` }, { name: "Second author" }]
	, homepage: `https://example.org/${name}`
	, repository: `https://example.org/source/${name}.git`
});

/**
 * Assert emitted manifests rather than trusting receipt hashes or generator output.
 *
 * @param root - Completed release root.
 * @param expected - Exact shared author declaration.
 */
export const assertPackagedMetadata = async (root, expected) => {
	const receipt = JSON.parse(await readFile(join(root, "package-set-receipt.json"), "utf8"));
	const run = async (command, args) => (await processBuildRunner.capture({ command, args })).stdout;
	const py = async (source, value) => JSON.parse(await run("python3", ["-I", "-c", `import json, sys\n${source}`, value]));
	for(const pkg of receipt.packages) for(const artifact of pkg.artifacts)
	{
		const archive = join(root, artifact.path);
		const zip = /\.(?:zip|jar|nupkg|whl)$/.test(archive);
		let actual;
		if(archive.endsWith(".gem"))
			actual = JSON.parse(await run(process.env.LEAN_BRIDGE_RUBY ?? "ruby", ["-rrubygems/package", "-rjson", "-e", "s = Gem::Package.new(ARGV[0]).spec; puts JSON.generate({license: s.metadata['spdx_expression'], nativeLicense: s.license, description: s.summary, authors: s.authors, emails: s.email, homepage: s.homepage, repository: s.metadata['source_code_uri']})", archive]));
		else if(archive.endsWith(".pom"))
			actual = { xml: await readFile(archive, "utf8") };
		else
		{
			const paths = (await run(zip ? "unzip" : "tar", zip ? ["-Z1", archive] : ["-tzf", archive])).trim().split("\n");
			const read = suffix => {
				const path = paths.find(path => path === suffix || path.endsWith(`/${suffix}`));
				assert.ok(path, `${pkg.target}: missing ${suffix}`);
				return run(zip ? "unzip" : "tar", zip ? ["-p", archive, path] : ["-xOzf", archive, path]);
			};
			if(pkg.target === "npm" || (pkg.target === "php-wasm" && archive.endsWith(".tgz")))
			{
				const value = JSON.parse(await read("package.json"));
				actual = { license: value.license, description: value.description, authors: value.author ? [value.author, ...(value.contributors ?? [])] : undefined, homepage: value.homepage, repository: value.repository?.url };
			}
			else if(pkg.target === "cpan")
			{
				const value = JSON.parse(await read("META.json"));
				actual = { license: value.x_spdx_expression, nativeLicense: value.license, description: value.abstract, authors: value.author, homepage: value.resources?.homepage, repository: value.resources?.repository?.url };
			}
			else if(["php-native", "php-wasm"].includes(pkg.target))
			{
				const value = JSON.parse(await read("composer.json"));
				actual = { license: value.license, description: value.description, authors: value.authors, homepage: value.homepage, repository: value.support?.source };
			}
			else if(pkg.target === "cargo") actual = await py("import tomllib\nprint(json.dumps(tomllib.loads(sys.argv[1])['package']))", await read("Cargo.toml"));
			else if(["c", "cpp", "wit-wasi"].includes(pkg.target)) actual = JSON.parse(await read("package-metadata.json"));
			else if(pkg.target === "pypi")
			{
				const path = paths.find(path => path.endsWith(".dist-info/METADATA"));
				actual = await py("from email.parser import Parser\nfrom email.utils import getaddresses\nm = Parser().parsestr(sys.argv[1]); print(json.dumps(dict(license=m['License-Expression'], metadataVersion=m['Metadata-Version'], licenseFiles=m.get_all('License-File'), description=m['Summary'], authors=getaddresses([m['Author-email']]), names=m['Author'], homepage=m['Home-page'], repository=m['Project-URL'].split(', ', 1)[1])))", await read(path));
			}
			else if(pkg.target === "nuget") actual = { xml: await read(paths.find(path => path.endsWith(".nuspec"))) };
			else if(pkg.target === "maven") actual = { xml: await read("pom.xml") };
			else assert.fail(`No metadata assertion for ${pkg.target}`);
		}
		if(actual.xml)
			actual = await py("import xml.etree.ElementTree as E\nr = E.fromstring(sys.argv[1]); t = lambda n: r.findtext('.//{*}' + n); authors = [e.text for e in r.findall('.//{*}developer/{*}name')] or t('authors').split(', '); repo = r.find('.//{*}repository'); print(json.dumps(dict(license=t('license') or r.findtext('.//{*}license/{*}name'), description=t('description'), authors=authors, homepage=t('projectUrl') or t('url'), repository=repo.get('url') if repo is not None else r.findtext('.//{*}scm/{*}url'))))", actual.xml);
		if(pkg.role === "runtime")
		{
			assert.notEqual(actual.description, expected.description);
			assert.notEqual(actual.homepage, expected.homepage);
			assert.notEqual(actual.repository, expected.repository);
			assert.ok(!JSON.stringify(actual.authors ?? []).includes(expected.authors[0].name));
			continue;
		}
		if(expected.license) assert.equal(actual.license, expected.license, `${pkg.target}: license`);
		if(pkg.target === "cpan" && expected.license) assert.deepEqual(actual.nativeLicense, [expected.license === "MIT" ? "mit" : "unknown"]);
		if(pkg.target === "rubygems" && expected.license) assert.equal(actual.nativeLicense, expected.license.includes(" OR ") ? "Nonstandard" : expected.license);
		if(pkg.target === "pypi")
		{ assert.equal(actual.metadataVersion, "2.4"); assert.ok(actual.licenseFiles.includes("source-notices.json")); }
		assert.equal(actual.description, expected.description, `${pkg.target} ${artifact.path}`);
		assert.equal(actual.homepage, expected.homepage, pkg.target);
		assert.equal(actual.repository, expected.repository, pkg.target);
		if(pkg.target === "pypi")
		{
			assert.deepEqual(actual.authors, [[expected.authors[0].name, expected.authors[0].email]]);
			assert.equal(actual.names, expected.authors[1].name);
		}
		else if(["cargo", "cpan"].includes(pkg.target)) assert.deepEqual(actual.authors, expected.authors.map(({ name, email }) => `${name}${email ? ` <${email}>` : ""}`));
		else if(["nuget", "maven", "rubygems"].includes(pkg.target)) assert.deepEqual(actual.authors, expected.authors.map(author => author.name));
		else if(pkg.target === "php-native" || (pkg.target === "php-wasm" && archive.endsWith(".zip"))) assert.deepEqual(actual.authors, expected.authors.map(({ url, ...author }) => ({ ...author, ...(url ? { homepage: url } : {}) })));
		else assert.deepEqual(actual.authors, expected.authors);
		if(pkg.target === "rubygems") assert.deepEqual(actual.emails, [expected.authors[0].email]);
	}
};
