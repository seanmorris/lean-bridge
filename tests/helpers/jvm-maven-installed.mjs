/** @file Install original Maven releases using only an offline third-party dependency seed. */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {constants,createReadStream} from "node:fs";
import {access,cp,mkdir,readFile,rename,writeFile} from "node:fs/promises";
import {basename,delimiter,dirname,isAbsolute,join,relative,resolve} from "node:path";
import {validateOrdinaryMavenSettings} from "../../src/backends/jvm/copied-model.mjs";
import {runNativeTool as run} from "./native-effect-consumers.mjs";
const digest = async f => { const h = createHash("sha256"); for await(const b of createReadStream(f)) h.update(b); return h.digest("hex"); };

/**
 * Install original component archives offline, then relocate the resolved JVM classpath.
 *
 * @param proj - Empty destination for this consumer's isolated Maven project.
 * @param work - Directory containing the offline repository settings.
 * @param packages - Verified package records and original JAR/POM files.
 * @param env - Toolchain and offline third-party seed.
 * @param tasks - Expect a pinned coroutine dependency (absent from synchronous packages).
 */
export const installMavenTasks = async (proj, work, packages, env, tasks = true) => {
	const repo = join(proj, "tool-repo"), dest = join(proj, "installed"), mvn = env.LEAN_BRIDGE_MAVEN ?? "mvn";
	await mkdir(proj); await cp(resolve(env.LEAN_BRIDGE_JVM_TASK_M2_SEED), repo, { recursive: true, mode: constants.COPYFILE_FICLONE });
	for(const p of packages)
	{
		validateOrdinaryMavenSettings({name: p.proof.name,version: p.version ?? "1.0.0"});
		const [group, artifact] = p.proof.name.split(":");
		await assert.rejects(access(join(repo, ...group.split("."), artifact)), {code: "ENOENT"});
	}
	const dependencies = packages.map(p => "<dependency><groupId>"+p.proof.name.split(":")[0]+"</groupId><artifactId>" + p.proof.name.split(":")[1] + "</artifactId><version>" + (p.version ?? "1.0.0") + "</version></dependency>").join("");
	await writeFile(join(proj, "pom.xml"), '<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><groupId>client</groupId><artifactId>tasks</artifactId><version>1</version><dependencies>' + dependencies + "</dependencies></project>", { flag: "wx" });
	const flags = ["--offline", "-B", "-q", "-ntp", "-s", join(work, "settings.xml"), "-Dmaven.repo.local=" + repo];
	for(const p of packages) await run(mvn, [...flags, "org.apache.maven.plugins:maven-install-plugin:3.1.4:install-file", "-Dfile=" + p.paths[0], "-DpomFile=" + p.paths[1]], proj, env);
	await run(mvn, [...flags, "org.apache.maven.plugins:maven-dependency-plugin:3.8.1:build-classpath", "-Dmdep.outputFile=resolved.txt"], proj, env);
	const resolved = (await readFile(join(proj, "resolved.txt"), "utf8")).trim().split(delimiter).map(f => relative(repo, f));
	assert.ok(resolved.every(s => !isAbsolute(s) && !s.startsWith("..") && s.endsWith(".jar")));
	await rename(repo, dest);
	for(const p of packages)
	{
		const installed = resolved.find(s => basename(s) === basename(p.paths[0])); assert.ok(installed);
		for(const a of p.proof.artifacts) assert.equal(await digest(join(dest, dirname(installed), basename(a.path))), a.sha256);
	}
	const coroutine = resolved.find(s => s.endsWith("/kotlinx-coroutines-core-jvm-1.8.0.jar"));
	if(tasks)
	{
		assert.ok(coroutine); assert.equal(await digest(join(dest, coroutine)), packages[0].proof.detail.coroutinesSha256);
	}
	else assert.equal(coroutine, undefined);
	assert.ok(resolved.some(s => s.endsWith("/kotlin-stdlib-2.2.0.jar")));
	return { resolved, classpath: resolved.map(s => join(dest, s)).join(delimiter) };
};
