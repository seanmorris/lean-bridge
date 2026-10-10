/**
 * Authenticate RubyGems discovery inputs before any installed specification or package can run.
 * The selected MRI/RubyGems and their standard library remain trusted toolchain inputs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { lstat, mkdir, readFile, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { verifyFinContainerEdgeFileClosure } from "./fin-container-edge-closure.mjs";

const receiptPath = "lean-bridge/package-receipt.json";
const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
const safePath = path => assert.ok(typeof path === "string" && /^[A-Za-z0-9_.+/-]+$/u.test(path)
	&& !isAbsolute(path) && path.split("/").every(part => part && part !== "." && part !== ".."), `unsafe Ruby package path: ${path}`);
const environment = gems => ({ ...copiedCleanEnvironment, GEM_HOME: gems, GEM_PATH: gems });

/** Inspect only the authenticated archive, never an installed gemspec or load path. */
export const finContainerEdgeRubyArchive = String.raw`require "rubygems"
require "rubygems/package"
require "json"
require "digest"
require "stringio"
package = Gem::Package.new(ARGV.fetch(0))
package.verify
spec = package.spec
abort "unexpected gem executable inputs" unless spec.extensions.empty? && spec.executables.empty? && spec.plugins.empty? && spec.dependencies.empty? && spec.require_paths == ["lib"]
abort "unexpected gem plugin input" if spec.files.any? { |path| path.match?(/(?:\A|\/)rubygems_plugin(?:\.[^\/]+)?\z/) }
abort "expected native Ruby platform" unless spec.platform.to_s == "x86_64-linux"
payloads = []
Gem::Package::TarReader.new(File.open(ARGV.fetch(0), "rb")) do |tar|
  tar.each { |entry| payloads << entry.read if entry.full_name == "data.tar.gz" && entry.file? }
end
abort "expected one gem payload" unless payloads.length == 1
files = {}; receipt = nil
Zlib::GzipReader.wrap(StringIO.new(payloads.fetch(0))) do |gzip|
  Gem::Package::TarReader.new(gzip) do |tar|
    tar.each do |entry|
      abort "unsupported gem entry" unless entry.file? || entry.directory?
      next if entry.directory?
      path = entry.full_name
      abort "duplicate gem entry" if files.key?(path)
      bytes = entry.read
      files[path] = {bytes: bytes.bytesize, sha256: Digest::SHA256.hexdigest(bytes)}
      receipt = bytes if path == "lean-bridge/package-receipt.json"
    end
  end
end
abort "missing gem receipt" unless receipt
abort "gem spec files differ from payload" unless spec.files.sort == files.keys.sort
spec.installed_by_version = Gem.rubygems_version
print JSON.generate({name: spec.name, version: spec.version.to_s, fullName: spec.full_name, fileName: spec.file_name, receipt: receipt, files: files, cachedSpec: spec.to_ruby_for_cache})
`;

/**
 * Check every GEM_HOME file without starting Ruby or evaluating any gem specification.
 *
 * @param context - Original archive-derived identity with the current GEM_HOME after relocation.
 */
export const verifyFinContainerEdgeRubyEnvironment = async context => {
	assert.equal(await realpath(context.gems), resolve(context.gems), "Ruby GEM_HOME must not traverse a symlink");
	assert.equal(await realpath(context.command), context.command, "Ruby interpreter target drift");
	assert.deepEqual(identity(await readFile(context.command)), context.interpreter, "Ruby interpreter drift");
	assert.equal(sha256(canonicalJson(context.files)), context.expectedSha256, "Ruby environment inventory drift");
	assert.deepEqual(await nativeArtifactPaths(context.gems), Object.keys(context.files).sort(), "unrecorded or missing Ruby environment file");
	for(const [path, expected] of Object.entries(context.files))
		assert.deepEqual(identity(await readFile(join(context.gems, path))), expected, `Ruby environment drift: ${path}`);
	const closure = await verifyFinContainerEdgeFileClosure({ installed: join(context.gems, "gems", context.fullName)
		, receiptPath, receiptBytes: context.receiptBytes });
	return { ...closure, environmentSha256: context.expectedSha256
		, interpreterSha256: context.interpreter.sha256
		, gemspecSha256: context.files[`specifications/${context.fullName}.gemspec`].sha256 };
};

/**
 * Preserve normal RubyGems startup, with all installation inputs checked on both sides.
 *
 * @param context - Original archive-derived environment identity.
 * @param args - Ordinary Ruby script or -e program.
 * @param cwd - Working directory outside GEM_HOME.
 */
export const runFinContainerEdgeRuby = async (context, args, cwd) => {
	assert.ok(args.length && (args[0] === "-e" || !args[0].startsWith("-")));
	const location = relative(await realpath(context.gems), await realpath(cwd));
	assert.ok(location === ".." || location.startsWith("../") || isAbsolute(location), "Ruby working directory must be outside GEM_HOME");
	await verifyFinContainerEdgeRubyEnvironment(context);
	try
	{ return await runCopied(context.command, args, cwd, environment(context.gems)); }
	finally
	{ await verifyFinContainerEdgeRubyEnvironment(context); }
};

/**
 * Derive exact gem payload, cache and installed gemspec bytes from the original archive before install.
 * No installed tree is accepted as a baseline and no installed spec is evaluated to discover its path.
 *
 * @param options - Trusted toolchain and original package-set archive identity.
 * @param options.command - Selected MRI executable.
 * @param options.gemCommand - Selected trusted RubyGems CLI.
 * @param options.root - Consumer directory; its gems child must not exist.
 * @param options.archive - Original gem file.
 * @param options.archiveSha256 - Package-set digest of that gem.
 */
export const installFinContainerEdgeRuby = async ({ command, gemCommand, root, archive, archiveSha256 }) => {
	const gems = join(root, "gems");
	await assert.rejects(lstat(gems), { code: "ENOENT" }, "refuse any pre-existing Ruby GEM_HOME");
	assert.match(archiveSha256, /^[a-f0-9]{64}$/u);
	const archiveBytes = await readFile(archive);
	assert.equal(sha256(archiveBytes), archiveSha256, "original Ruby gem drift");
	command = await realpath(command);
	const interpreter = identity(await readFile(command));
	await mkdir(gems);
	const inspected = await runCopied(command, ["--disable-gems", "-e", finContainerEdgeRubyArchive, archive], root, environment(gems));
	assert.equal(inspected.stderr, "");
	const original = JSON.parse(inspected.stdout), receipt = JSON.parse(original.receipt);
	assert.match(original.fullName, /^[A-Za-z0-9_.+-]+-x86_64-linux$/u);
	assert.equal(original.fileName, `${original.fullName}.gem`);
	assert.equal(receipt.name, original.name); assert.equal(receipt.version, original.version);
	const payload = { ...receipt.files, [receiptPath]: identity(original.receipt) };
	assert.deepEqual(original.files, payload, "gem payload must equal receipt files plus receipt");
	const files = Object.create(null);
	for(const [path, entry] of Object.entries(payload))
	{
		safePath(path);
		assert.deepEqual(Object.keys(entry).sort(), ["bytes", "sha256"]);
		assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0); assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
		files[`gems/${original.fullName}/${path}`] = entry;
	}
	files[`cache/${original.fileName}`] = identity(archiveBytes);
	files[`specifications/${original.fullName}.gemspec`] = identity(original.cachedSpec);
	const context = Object.freeze({ gems, command, fullName: original.fullName
		, receiptBytes: original.receipt, interpreter: Object.freeze(interpreter)
		, files: Object.freeze(Object.fromEntries(Object.entries(files).map(([path, entry]) => [path, Object.freeze(entry)])))
		, expectedSha256: sha256(canonicalJson(files)) });
	await runCopied(command, ["--disable-gems", gemCommand, "install", "--norc", archive, "--local", "--install-dir", gems, "--no-document", "--ignore-dependencies"], root, environment(gems));
	assert.equal(sha256(await readFile(archive)), archiveSha256, "Ruby gem changed during installation");
	await verifyFinContainerEdgeRubyEnvironment(context);
	return { context, run: (args, cwd) => runFinContainerEdgeRuby(context, args, cwd) };
};
