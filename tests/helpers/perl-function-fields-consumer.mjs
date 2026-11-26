/** @file Verify XS provenance and callbacks after moving CPAN runtime and component prefixes. */
import assert from "node:assert/strict";
import {copyFile, mkdir, mkdtemp, readFile, rename, rm} from "node:fs/promises";
import {basename, join, resolve} from "node:path";
import {sha256} from "../../src/capsule/node.mjs";
import {installCpanArchive} from "../../src/release/cpan-install.mjs";
import {traceCpanInstall} from "../../src/release/cpan-install-trace.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";

export const fixture = resolve("tests/fixtures/structured-types/tariff-fields.pl");
export const hostFixture = resolve("tests/fixtures/structured-types/tariff-host-fields.pl");

/**
 * Install one Perl ABI, sharing the unchanged runtime across component modes.
 *
 * @param root - Isolated consumer scratch directory.
 * @param packages - Original verified component and runtime archives.
 * @param perl - Exact interpreter executable.
 * @param env - Offline installer environment.
 * @param hostInputs - Whether this archive declares borrowed callback records.
 * @param modes - Component installation modes to exercise.
 * @param packageRoot - Original component manifest for the installed-payload trace.
 */
export const installPerlTariff = async (root,packages,perl,env,hostInputs,modes,packageRoot) => {
	const work = await mkdtemp(join(root,"cpan-")), deployment = join(work,"relocated");
	try
	{
		await mkdir(deployment);
		const mount=async (role,mode,name,runtime="")=>{
			const local = join(work,basename(packages[role]));
			await copyFile(packages[role],local);
			const prefix=join(work,name);
			await installCpanArchive({archive: local,workingRoot: work,prefix,perl,mode
				, environment: {...env,PERL5LIB: runtime}});
			await rm(local);
			await rename(prefix,join(deployment,name));
			return join(deployment,name,"lib/perl5");
		};
		const runtime=await mount("runtime","prebuilt-only","runtime");
		const client = join(work,"tariff.pl"); await copyFile(fixture,client);
		const borrowed=join(work,"host-fields.pl");
		if(hostInputs) await copyFile(hostFixture,borrowed);
		const results=[];
		for(const mode of modes)
		{
			const component=await mount("component",mode,mode,runtime);
			const child = {PERL5LIB: [component,runtime].join(":")
				, PATH: "/no-author-tools", LANG: "C.UTF-8", LEAN_NUM_THREADS: "1"
				, TARIFF_INSTALL: deployment};
			const record = JSON.parse(await run(perl,[client],work,child));
			const {baseline,held,after,shutdown,stageCalls,staged,staleVisits,recovered} = record;
			assert.ok(held > baseline); assert.equal(after,baseline);
			assert.deepEqual([shutdown,stageCalls,staged,staleVisits,recovered],[0,1,44,0,42]);
			assert.match(record.installReceiptSha256,/^[0-9a-f]{64}$/u);
			if(hostInputs)
			{
				const installRoot=join(component,record.arch), location=join(installRoot,"LeanBridge/TariffQuotes/install-receipt.json");
				const bytes=await readFile(location), receipt=JSON.parse(bytes);
				assert.equal(sha256(bytes),record.installReceiptSha256);
				assert.equal(receipt.abi.archname,record.arch);
				assert.equal(receipt.abi.api_version,record.version.split(".")[1]);
				const trace=await traceCpanInstall({packageRoot,installRoot});
				assert.equal(trace.operation,mode==="build-xs"?"generated-xs-only":"prebuilt-xs");
				assert.equal(trace.nativePayloadUnchanged,true);
				const derived=mode==="build-xs"?{sourceSha256: receipt.sourceSha256,generatedCSha256: receipt.generatedCSha256}:{};
				record.installXs={mode,operation: trace.operation
					, outputSha256: receipt.outputSha256,...derived};
				const result=JSON.parse(await run(perl,[borrowed],work,child));
				assert.ok(result.held>result.baseline);
				assert.deepEqual(result.settled,Array(6).fill(result.baseline));
				assert.deepEqual([result.hostCalls,result.reentries,result.afterShutdown],[3,1,0]);
				record.hostInputs=result;
			}
			results.push(record);
		}
		return results;
	} finally
	{
		await rm(work,{recursive: true,force: true});
	}
};
