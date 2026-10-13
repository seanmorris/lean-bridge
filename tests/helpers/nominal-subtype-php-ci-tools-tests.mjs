/**
 * Exercise explicit PHP tool observation with stand-in subprocesses, not packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { copiedCleanEnvironment } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { selectNominalSubtypePhpCiTools } from "./nominal-subtype-php-ci-tools.mjs";

test("nominal PHP CI observes explicit commands, extensions and exact versions before production", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-php-ci-tools-"));
	t.after(() => rm(root, { recursive: true }));
	const php = join(root, 'PHP "selected"/php8.2.mjs'), composer = join(root, "Composer tools/composer");
	const extensionDirectory = join(root, "PHP extensions");
	const extensions = ["ctype", "ffi", "iconv", "mbstring", "phar", "tokenizer"];
	for(const name of extensions) await saveLakeFile(extensionDirectory, `${name}.so`, "synthetic extension " + name);
	await saveLakeFile(root, "Composer tools/composer", "synthetic composer script, never interpreted\n");
	const source = `#!${process.execPath}
import assert from 'node:assert/strict';
import fs from 'node:fs';
for (const [key, value] of Object.entries(${JSON.stringify(copiedCleanEnvironment)})) assert.equal(process.env[key], value);
for (const key of ['PHPRC', 'PHP_INI_SCAN_DIR', 'COMPOSER_HOME', 'COMPOSER']) assert.equal(process.env[key], undefined);
const args = process.argv.slice(2), issue = fs.existsSync('issue') ? fs.readFileSync('issue', 'utf8') : '';
if (args[0] === '-n' && args[1] === '-r') {
  assert.equal(args.length, 3);
  const full = args[2].includes('PHP_SAPI');
  process.stdout.write(JSON.stringify({version: issue === 'old-php' ? '8.1.33' : issue === 'changed-php' && full ? '8.2.34' : '8.2.33',
    sapi: 'cli', zts: 0, integerBytes: 8, os: 'Linux', arch: 'x86_64', directory: ${JSON.stringify(extensionDirectory)}, modules: ['Core']}));
} else {
  assert.deepEqual(args, ['-n', ...${JSON.stringify(extensions.map(name => join(extensionDirectory, name + ".so")))}.flatMap(path => ['-d', 'extension=' + path]),
    ${JSON.stringify(composer)}, '--no-plugins', '--no-scripts', '--no-interaction', '--version']);
  assert.equal(process.env.COMPOSER_ALLOW_SUPERUSER, '1'); assert.equal(process.env.COMPOSER_DISABLE_NETWORK, '1');
  process.stdout.write('Composer version ' + (issue === 'old-composer' ? '1.0.0' : '2.5.5') + ' synthetic date\\n');
  if (issue === 'stderr') process.stderr.write('unexpected output');
  if (issue === 'change-extension') fs.appendFileSync(${JSON.stringify(join(extensionDirectory, "ffi.so"))}, 'changed');
}
`;
	await saveLakeFile(root, 'PHP "selected"/php8.2.mjs', source); await chmod(php, 0o755);
	const alias = join(root, "php-alias"); await symlink(php, alias);
	const result = await selectNominalSubtypePhpCiTools({ php: alias, composer }, root);
	assert.deepEqual(result.selected, { php, composer, phpVersion: "8.2.33", composerVersion: "2.5.5" });
	assert.equal(result.command, php); assert.equal(result.composer, composer);
	assert.deepEqual(Object.keys(result.tools).sort(), [php, composer, ...extensions.map(name => join(extensionDirectory, `${name}.so`))].sort());
	for(const [path, identity] of Object.entries(result.tools))
	{
		const bytes = await readFile(path); assert.deepEqual(identity, { bytes: bytes.length, sha256: sha256(bytes) });
	}
	for(const issue of ["old-php", "changed-php", "old-composer", "stderr", "change-extension"])
	{
		await saveLakeFile(root, "issue", issue);
		await assert.rejects(selectNominalSubtypePhpCiTools({ php: alias, composer }, root));
	}
	await rm(join(root, "issue"));
	for(const commands of [{ php: "php", composer }, { php, composer: "composer" }, { php: join(root, "missing"), composer }])
		await assert.rejects(selectNominalSubtypePhpCiTools(commands, root));
	await rm(join(extensionDirectory, "ffi.so"));
	await assert.rejects(selectNominalSubtypePhpCiTools({ php, composer }, root));
	t.diagnostic("Nine argument, missing-input, version, output and drift controls; stand-ins do not claim installed PHP execution");
});
