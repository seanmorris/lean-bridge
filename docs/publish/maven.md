# Build and publish Java and Kotlin packages

Build an ordinary Lean project with `--target maven` to produce a prepared Java/Kotlin JAR and POM. Generated APIs support all 16 primitive types, nested arrays and acyclic copied records. Consumers install the artifacts without compiling Lean or writing native conversions.

For ordinary-source builds, declare the library's [description, authors and URLs](../publishing.md#declare-package-metadata) once in `lean-bridge.exports.json`.

Deploy the reviewed JAR and POM to an organization-controlled Maven repository. Java and Kotlin consumers use the same artifact.

## Build an ordinary Lean project

Use the [author toolchain](../contributing/author-toolchain.md), a native C compiler and JDK 22. Set `LEAN_BRIDGE_JAVAC` to the compiler executable if it is not on PATH. The current native package profile is Linux x86-64 with glibc 2.38 or newer.

Select modules and functions in `lean-bridge.exports.json`. Choose coordinates your organization owns:

```json
{
  "schemaVersion": 1,
  "modules": ["Maple"],
  "exports": ["Maple.echo_nat", "Maple.echo_text", "Maple.matrix"],
  "targets": {
    "maven": { "name": "com.acme:maple-api", "version": "2.0.0-rc.1" }
  }
}
```

Build into a new directory:

```sh
lean-bridge build --project /absolute/path/to/maple --target maven \
  --output /absolute/path/to/maple-release
```

The release contains `archives/maple-api-2.0.0-rc.1.jar`, its companion `.pom`, and `native-release.json` with their hashes. `packages/maven/repository/` also contains both files in Maven's group/artifact/version layout, with SHA-256 sidecars. The JAR includes compiled Java 22 classes, native libraries, generated sources, compiler evidence and dependency license notices. Its README names the generated Java package and API. Changing the Maven coordinate does not rename the Lean-derived Java package.

Calls accept concrete copied values, synchronous primitive callbacks and returned closures. Nesting is limited to 32 types, and native input/output conversions share a 16 MiB budget. Optional values, variants, resources, compound callables and asynchronous effects remain outside this ordinary Maven profile. Repeat `--target` to share one native compilation across Maven, NuGet, C, C++ and CPAN. Add npm when the API fits its [supported shapes](../lean/export-decisions.md#start-with-the-runnable-npm-shapes), including nested primitive arrays; that adds one Wasm compilation. A failed target leaves no partial release.

Test the original archives with the [Java](../consume/java.md#call-an-ordinary-lean-package) and [Kotlin](../consume/kotlin.md#call-an-ordinary-lean-package) consumers. Archive assembly verifies compiled artifacts without invoking a compiler. Verify the release with `lean-bridge verify --receipt /absolute/path/to/maple-release/package-set-receipt.json`. Distribute this receipt, its `.json.sha256` sidecar and the named archives together. The receipt checks local file consistency; it is unsigned.

## Export callbacks and returned functions

Select primitive callable exports in `lean-bridge.exports.json`:

```lean
namespace Maple
def call_word (value : UInt32) (callback : UInt32 → UInt32) : UInt32 :=
  callback (callback value)
def make_word (captured value : UInt32) : UInt32 := captured + value
end Maple
```

Include both exports and set `"arities": { "Maple.make_word": 1 }` to return a function after accepting the captured value. For reviewed Binding IR, the outer parameter count makes that decision; do not also configure `arities`.

Callbacks accept one to sixteen primitive arguments and a primitive result. Java and Kotlin use generated functional interfaces such as `FnUInt32ToUInt32`; returned functions implement that interface and `AutoCloseable`. Exact integers retain `BigInteger`. Calls borrow host callbacks synchronously and contain thrown exceptions until native cleanup. See the [Java](../consume/java.md#callbacks-and-returned-lean-functions) and [Kotlin](../consume/kotlin.md#callbacks-and-returned-lean-functions) examples for thread ownership and cleanup.

Both source paths use the existing private C callable ABI. A combined build rejects the complete request if a selected target does not support its callable signatures.

## Build the repository layout

The separate Alpha interoperability fixture retains its resource and callback examples.

From the Lean Bridge checkout with the pinned Nix environment:

```sh
nix --extra-experimental-features 'nix-command flakes' build \
  .#maven-package --out-link build/publish-maven
```

The fixture writes these files beneath `build/publish-maven/repository/org/leanbridge/lean-alpha/0.0.0/`:

- `lean-alpha-0.0.0.jar`
- `lean-alpha-0.0.0.pom`
- A `.sha256` file for each artifact.

The release root also contains `maven-projection.json`. The JAR includes the generated JDK 22 classes and native libraries for x86-64 Linux with glibc 2.38 or newer.

For an existing verified universal bundle, use a new output directory:

```sh
node scripts/build-maven-package.mjs \
  --bundle build/consumer-universal-bundle --output build/maven-package
```

Check both the [Java](../consume/java.md) and [Kotlin](../consume/kotlin.md) consumers against the package. Contributors can also run the [managed acceptance checks](../contributing/testing.md#consumer-acceptance).

## Choose coordinates your organization owns

The example coordinate is `org.leanbridge:lean-alpha:0.0.0`. Do not publish it as your own package.

For ordinary projects, set `targets.maven.name` to a lowercase `groupId:artifactId` and `targets.maven.version` to an exact three-part release version, optionally with a prerelease suffix. Mutable selectors, version ranges and SNAPSHOT releases are rejected. Rebuild to change coordinates; do not edit an approved JAR or POM.

For the separate Alpha fixture, the [universal bundle mapping](../../src/release/universal-release-bundle.mjs) fixes the package name and [Alpha's Binding IR](../../poc/lean-link-spike/bindings/alpha.binding-ir.json) supplies the version. Do not override coordinates during deployment to disguise that fixture.

## Produce and review the candidate

For an ordinary release, reproduce the build from a different source location, compare both archive hashes, and execute fresh installed consumers. Review source and dependency licenses. Preserve the original JAR, POM and `native-release.json` for the approved upload.

The signed-candidate workflow below applies to the universal Alpha bundle, not ordinary Maven outputs. Use a clean committed checkout. The publication ecosystem is `maven`; its binding target is `jvm`.

```sh
node scripts/lean-bridge.mjs publish --project . --target maven --dry-run \
  --output build/maven-candidate
```

Recheck the manifest and candidate bytes before uploading:

```sh
node --input-type=module -e '
import { verifyPublishManifest } from "./src/release/publish-manifest.mjs";
const result = await verifyPublishManifest({
  manifestPath: process.argv[1], requestedTargets: ["maven"]
});
console.log(JSON.stringify(result.manifest.targets, null, 2));
' build/maven-candidate/publish-manifest.json
```

Retain both the JAR and POM hashes. Complete the [sandbox record](../contributing/sandbox-release.md#rehearse-a-registry-release) and [production approval process](../publishing.md#build-and-approve-the-same-artifacts) for the actual destination.

The installed CLI supplies only the npm transaction adapter. A Maven deploy command does not produce a Lean Bridge signed completion receipt. The reviewed integration must authorize the chosen repository and credentials; the manifest's default Maven Central destination does not authorize a private repository.

## Configure repository credentials

Use JDK 22 and Maven 3.9. The upload below pins Maven Deploy Plugin 3.1.4.

Create a private `settings.xml` containing environment references, not token values:

```xml
<settings xmlns="http://maven.apache.org/SETTINGS/1.2.0">
  <servers>
    <server>
      <id>lean-bridge-release</id>
      <username>${env.LEAN_BRIDGE_MAVEN_USERNAME}</username>
      <password>${env.LEAN_BRIDGE_MAVEN_PASSWORD}</password>
    </server>
  </servers>
</settings>
```

Your credential provider injects `LEAN_BRIDGE_MAVEN_USERNAME` and `LEAN_BRIDGE_MAVEN_PASSWORD` for the operator-controlled repository. The server ID must match the deployment's `repositoryId`. Keep rendered credentials and debug logs out of source control. [Maven settings reference](https://maven.apache.org/settings.html)

Set the non-secret paths and endpoint:

```sh
export LEAN_BRIDGE_MAVEN_SETTINGS=/absolute/path/to/private/settings.xml
export LEAN_BRIDGE_MAVEN_REPOSITORY=https://maven.example.invalid/releases/
export LEAN_BRIDGE_MAVEN_JAR=/absolute/path/to/the-reviewed-artifact.jar
export LEAN_BRIDGE_MAVEN_POM=/absolute/path/to/the-reviewed-artifact.pom
```

Replace each placeholder with the reviewed value. Use a repository accepting ordinary Maven deployment, not the Maven Central publisher API.

## Upload the exact JAR and POM

An authorized operator runs:

```sh
mvn --batch-mode --settings "$LEAN_BRIDGE_MAVEN_SETTINGS" \
  org.apache.maven.plugins:maven-deploy-plugin:3.1.4:deploy-file \
  "-DrepositoryId=lean-bridge-release" \
  "-Durl=$LEAN_BRIDGE_MAVEN_REPOSITORY" \
  "-Dfile=$LEAN_BRIDGE_MAVEN_JAR" \
  "-DpomFile=$LEAN_BRIDGE_MAVEN_POM" \
  -DretryFailedDeploymentCount=1
```

The plugin reads the coordinates from the supplied POM. Do not add coordinate overrides or substitute a generated POM. [Maven Deploy Plugin parameters](https://maven.apache.org/plugins/maven-deploy-plugin/deploy-file-mojo.html)

## Publish to Maven Central

The current projection cannot produce a complete Central release. A reviewed producer must add an owned Central namespace, a POM with developer and SCM information and license URL, `-sources.jar`, `-javadoc.jar`, and detached `.asc` signatures for the JARs and POM. Its upload bundle also needs Central's required checksums. Add these outputs before freezing and approving the expanded candidate. [Central requirements](https://central.sonatype.org/publish/requirements/)

The Maven producer must attach the approved Lean Bridge JAR without recompiling or repacking it, attach the source/documentation artifacts, and verify its outgoing files against the approved inventory. That producer integration is not generated by this checkout.

Configure the reviewed producer's POM with Central Publisher Plugin 0.11.0:

```xml
<build>
  <plugins>
    <plugin>
      <groupId>org.sonatype.central</groupId>
      <artifactId>central-publishing-maven-plugin</artifactId>
      <version>0.11.0</version>
      <extensions>true</extensions>
      <configuration>
        <publishingServerId>central</publishingServerId>
        <autoPublish>false</autoPublish>
      </configuration>
    </plugin>
  </plugins>
</build>
```

In its private settings file, use server ID `central` and environment references to the Central user-token username and password. The plugin supplies checksums, but does not create the missing sources, documentation, signatures, or POM metadata. [Central Maven publisher](https://central.sonatype.org/publish/publish-portal-maven/)

After that producer and the full release are approved, the operator runs:

```sh
mvn --batch-mode --settings "$LEAN_BRIDGE_MAVEN_SETTINGS" \
  --file /absolute/path/to/reviewed-central-producer/pom.xml deploy
```

This uploads to the Central Portal for validation. With `autoPublish` disabled, an authorized operator reviews the deployment in the Portal and explicitly publishes it. Record that deployment ID and confirm publication before consumer checks. [Central upload and manual publication](https://central.sonatype.org/publish/publish-portal-maven/#publishing)

## Verify through a clean consumer cache

Set the reviewed `groupId:artifactId:version`, then resolve it into a new cache. For Central consumption, set `LEAN_BRIDGE_MAVEN_REPOSITORY=https://repo.maven.apache.org/maven2/`; retain the controlled repository URL for a private release.

```sh
export LEAN_BRIDGE_MAVEN_COORDINATE=your.owned.group:your-artifact:1.0.0
export LEAN_BRIDGE_MAVEN_DOWNLOADS="$PWD/build/maven-published-downloads"
mvn --batch-mode --settings "$LEAN_BRIDGE_MAVEN_SETTINGS" \
  "-Dmaven.repo.local=$LEAN_BRIDGE_MAVEN_DOWNLOADS" \
  org.apache.maven.plugins:maven-dependency-plugin:3.8.1:get \
  "-Dartifact=$LEAN_BRIDGE_MAVEN_COORDINATE" \
  "-DremoteRepositories=lean-bridge-release::default::$LEAN_BRIDGE_MAVEN_REPOSITORY" \
  -Dtransitive=false
```

Fetch the POM with the same command and `-Dartifact="$LEAN_BRIDGE_MAVEN_COORDINATE:pom"`. Compare both downloaded files with the candidate's original JAR and POM using `cmp` or the manifest's SHA-256 values. A checksum downloaded beside an artifact is not an independent publisher identity.

Run the [Java](../consume/java.md#compile-and-run) and [Kotlin](../consume/kotlin.md#compile-and-run) programs against the fetched JAR. Both must produce the documented output. Save the endpoint, coordinates, upload result, downloaded hashes, and consumer results with the candidate.

If a reviewed publisher integration supplies a signed release receipt, apply [recipient archive verification](../consume/receive-package.md#authenticate-a-signed-archive) to each named artifact as well.

## Recover an interrupted deployment

A JAR upload can succeed before the POM or metadata upload fails. Inspect the repository's exact coordinate and compare each existing file before retrying. Keep partial-deployment logs and the original candidate.

If any published file differs, stop and involve the repository and release owners. Use an approved new version for corrected content. A repository's overwrite or deletion capability is not authority to replace an immutable reviewed release.

### Publish a Maven package

The package-manager recipe above remains available at this address. Return to [target selection](../publishing.md) or [consumer installation](../consume.md).
