/**
 * Real installed Perl runtimes: deep binding, mapped identities and context guards.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { buildNativeSharedRuntime } from "../src/build/native-component.mjs";
import { compileCpanXsVariant } from "../src/build/perl-xs.mjs";
import { stageCpanPackage, archiveCpanPackage } from "../src/release/cpan-package.mjs";
import { installCpanArchive } from "../src/release/cpan-install.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { perlGraphCommands } from "./helpers/perl-graph-probes.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const commandFailure = error => { error.message += `: ${JSON.stringify(error.details ?? {})}`; throw error; };

test("installed Perl loaders prefer private dependencies and balance mapped-library probes", {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 600000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-owned-perl-loader-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const runtimeRoot = join(directory, "native"), packageRoot = join(directory, "package");
	const perls = perlGraphCommands(), environment = { PATH: "/usr/bin:/bin", CC: "/usr/bin/cc", LD: "/usr/bin/cc" };
	await buildNativeSharedRuntime({ outputRoot: runtimeRoot, leanPrefix, cc: "/usr/bin/cc" });
	await stageCpanPackage({ runtimeRoot, outputRoot: packageRoot, leanPrefix
		, glibcMinimumVersion: process.env.LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR ?? "2.38" });
	for(const perl of perls) await compileCpanXsVariant({ packageRoot, perl, environment }).catch(commandFailure);
	const archive = await archiveCpanPackage({ packageRoot, outputRoot: join(directory, "archives") });
	const consumer = await readFile("tests/fixtures/structured-types/owned-perl-loader.pl", "utf8");
	const assetConsumer = await readFile("tests/fixtures/structured-types/owned-perl-assets.pl", "utf8");
	await saveLakeFile(directory, "consumer.pl", consumer);
	await saveLakeFile(directory, "assets.pl", assetConsumer);
	await saveLakeFile(directory, "dependency.c", "#ifndef PROBE_VALUE\n#define PROBE_VALUE 29\n#endif\nint lb_loader_probe_value(void) { return PROBE_VALUE; }\n#if PROBE_VALUE == 29\nint lb_loader_private_only(void) { return 29; }\n#endif\n");
	for(const [name, value] of [["global", 11], ["private", 29], ["transient", 37]])
		await runCopied("/usr/bin/cc", ["-O2", "-fPIC", "-shared"
			, `-DPROBE_VALUE=${value}`
			, `-Wl,-soname,liblb-loader-${name}.so`
			, "-Wl,--build-id=none", "dependency.c"
			, "-o", `liblb-loader-${name}.so`], directory, environment);
	await saveLakeFile(directory, "conflict/dependency.c", await readFile(join(directory, "dependency.c")));
	await runCopied("/usr/bin/cc", ["-O2", "-fPIC", "-shared", "-DPROBE_VALUE=71"
		, "-Wl,-soname,liblb-loader-private.so", "-Wl,--build-id=none"
		, "conflict/dependency.c", "-o", "conflict/liblb-loader-private.so"
	], directory, environment);
	const xs = `#include "EXTERN.h"
#include "perl.h"
#include "XSUB.h"
#include <dlfcn.h>
int lb_loader_probe_value(void);
MODULE = LeanBridge::LoaderProbe PACKAGE = LeanBridge::LoaderProbe
PROTOTYPES: DISABLE

int
read()
  CODE:
    RETVAL = lb_loader_probe_value();
  OUTPUT: RETVAL

int
private_visible()
  CODE:
    RETVAL = dlsym(RTLD_DEFAULT, "lb_loader_private_only") != NULL;
  OUTPUT: RETVAL
`;
	await saveLakeFile(directory, "Probe.xs", xs);
	await saveLakeFile(directory, "GlobalProbe.xs", xs.replaceAll("LeanBridge::LoaderProbe", "LeanBridge::GlobalProbe"));
	await saveLakeFile(directory, "build.pl", `use strict; use warnings;
use ExtUtils::ParseXS; use ExtUtils::CBuilder;
my $builder = ExtUtils::CBuilder->new(quiet => 1);
for my $entry (['Probe', 'LoaderProbe', 'private'], ['GlobalProbe', 'GlobalProbe', 'global']) {
  my ($source, $module, $dependency) = @$entry;
  ExtUtils::ParseXS::process_file(filename => "$source.xs", output => "$source.c", prototypes => 0);
  my $object = $builder->compile(source => "$source.c", extra_compiler_flags => '-O2 -Wall -Wextra -Werror');
  $builder->link(objects => $object, module_name => "LeanBridge::$module", lib_file => "$module.so",
    extra_linker_flags => "-L. -Wl,--no-as-needed -llb-loader-$dependency " . q{-Wl,--build-id=none -Wl,-rpath,'$ORIGIN'});
}
`);
	const observations = [];
	for(const [index, perl] of perls.entries())
	{
		const prefix = join(directory, `installed-${index}`);
		await installCpanArchive({ archive: archive.path, workingRoot: directory
			, prefix, perl, mode: "prebuilt-only", environment }).catch(commandFailure);
		await runCopied(perl, ["build.pl"], directory, environment);
		const assets = [];
		for(const [name, soname] of [["liblb-loader-private.so", true], ["LoaderProbe.so", false]])
			assets.push({ path: join(directory, name)
				, sha256: sha256(await readFile(join(directory, name)))
				, ...(soname ? { soname: name } : {}) });
		await saveLakeFile(directory, "assets.json", canonicalJson(assets));
		for(const mode of ["global", "private"])
		{
			const execution = await runCopied(perl, ["consumer.pl", mode, directory], directory
				, { PATH: "/unavailable", PERL5LIB: join(prefix, "lib/perl5") });
			assert.equal(execution.stderr, "");
			const observed = JSON.parse(execution.stdout);
			assert.equal(observed.value, mode === "private" ? 29 : 11);
			assert.equal(observed.global, 11);
			assert.ok(observed.checks >= (mode === "private" ? 130 : 2));
			observations.push({ perl, mode, observed }); t.diagnostic(JSON.stringify({ perl, mode, observed }));
		}
		for(const mode of ["cold", "preloaded", "conflict", "warm"])
		{
			const execution = await runCopied(perl, ["assets.pl", mode, directory], directory
				, { PATH: "/unavailable", PERL5LIB: join(prefix, "lib/perl5") });
			assert.equal(execution.stderr, "");
			const observed = JSON.parse(execution.stdout);
			assert.equal(observed.mode, mode);
			assert.ok(observed.checks >= ({ cold: 47, preloaded: 2, conflict: 2, warm: 15 })[mode]);
			observations.push({ perl, mode, observed }); t.diagnostic(JSON.stringify({ perl, mode, observed }));
		}
		await rm(prefix, { recursive: true, force: true });
	}
	await saveLakeFile(resolve("build/owned-perl-loader"), "installed.json", canonicalJson({
		observations, installedRuntime: true, installedOwnedComponent: false
		, runtimeArchive: archive.receipt, consumerSha256: sha256(consumer)
		, probeXsSha256: sha256(xs), assetConsumerSha256: sha256(assetConsumer)
	}));
});
