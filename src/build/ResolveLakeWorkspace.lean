import Lake
import Lake.Load.Workspace
import Lake.Load.Resolve
import Lean.Elab.Import

/-! Resolve only captured, locked packages. This program never updates a lock or
executes a Lake build target. Export signature extraction is a separate stage. -/

open Lean Lake System

namespace LeanBridgeWorkspace

structure PackageInput where
  name : String
  directory : String
  packageRoot : String
  configFile : String
  manifestFile : Option String
  deriving FromJson

structure Request where
  workspace : String
  packages : Array PackageInput
  modules : Array String
  files : Array String
  deriving FromJson

structure Traversal where
  visiting : NameSet := {}
  done : NameSet := {}
  records : Array Json := #[]
  external : NameSet := {}
  hasNative : Bool := false

def fail {α : Type} (message : String) : IO α :=
  throw <| IO.userError message

def relativeInput (request : Request) (path : FilePath) : IO String := do
  let full ← IO.FS.realPath path
  let base := request.workspace ++ "/"
  let some relative := full.toString.dropPrefix? base
    | fail "Lake input escaped the isolated workspace"
  let relative := relative.toString
  unless request.files.contains relative do
    fail s!"Lake requested an uncaptured input: {relative}"
  return relative

def checkLeanConfig (label : String) (config : LeanConfig) : IO Unit := do
  unless config.plugins.isEmpty && config.dynlibs.isEmpty &&
      config.moreLinkLibs.isEmpty &&
      config.moreLinkArgs.isEmpty && config.weakLinkArgs.isEmpty &&
      config.moreLeancArgs.isEmpty && config.weakLeancArgs.isEmpty &&
      config.moreLeanArgs.isEmpty && config.weakLeanArgs.isEmpty &&
      config.leanOptions.isEmpty && config.buildType == .release &&
      config.backend != .llvm do
    fail s!"Unsupported Lake native targets or compiler options in {label}"

def nativeInput (request : Request) (ws : Workspace) (consumer : Package)
    (target : Target FilePath) : IO Json := do
  let .packageTarget package targetName := target.key
    | fail s!"Unsupported Lake native input key: {target}"
  let some owner := if package.isAnonymous then some consumer
      else ws.packages.find? fun pkg => pkg.baseName == package || pkg.keyName == package
    | fail s!"Missing Lake native input package: {package}"
  unless owner.keyName == consumer.keyName ||
      consumer.depPkgs.any (·.keyName == owner.keyName) do
    fail s!"Lake native input package is not a declared dependency: {package}"
  let some input := owner.findConfigTarget? InputFile.configKind targetName
    | fail s!"Lake native inputs require an input_file target: {owner.baseName}/{targetName}"
  let path ← relativeInput request (InputFile.path input)
  let directory ← if owner.isRoot then pure "root" else do
    let some captured := request.packages.find? (·.name == owner.baseName.toString)
      | fail s!"Uncaptured native input package: {owner.baseName}"
    pure captured.directory
  unless path.startsWith (directory ++ "/") do
    fail s!"Lake native input escaped its owning package: {path}"
  unless path.endsWith ".c" do
    fail s!"Lake native inputs require C source, not a prebuilt object or library: {path}"
  return Json.mkObj [("package", toJson owner.baseName.toString),
    ("target", toJson targetName.toString), ("path", toJson path)]

partial def visit (request : Request) (ws : Workspace) (name : Name)
    : StateT Traversal IO Unit := do
  if (← get).done.contains name then return
  if (← get).visiting.contains name then
    fail s!"Cyclic Lake module imports: {name}"
  let candidates := ws.findModules name
  if candidates.isEmpty then
    -- The search path contains only the selected compiler's libraries.
    let _ ← findOLean name
    modify fun state => { state with external := state.external.insert name }
    return
  unless candidates.size == 1 do
    fail s!"Ambiguous Lake module ownership: {name}"
  let compilerModule ← try
    let _ ← findOLean name
    pure true
  catch _ => pure false
  if compilerModule then
    fail s!"Lake source shadows a compiler-library module: {name}"
  let some mod := candidates[0]? | fail s!"Missing Lake module: {name}"
  unless (mod.pkg.leanLibs.filter (·.config.isLocalModule name)).size == 1 do
    fail s!"Ambiguous Lake library ownership: {name}"
  let path ← relativeInput request mod.leanFile
  let source ← IO.FS.readFile mod.leanFile
  let native ← (mod.lib.moreLinkObjs.mapM (nativeInput request ws mod.pkg) : IO (Array Json))
  let (imports, _, messages) ← Lean.Elab.parseImports source (some path)
  if messages.hasErrors then fail s!"Invalid import header in {path}"
  modify fun state => { state with visiting := state.visiting.insert name }
  for imported in imports do visit request ws imported.module
  modify fun state => { state with
    visiting := state.visiting.erase name
    done := state.done.insert name
    records := state.records.push <| Json.mkObj ([
      ("module", toJson name.toString), ("path", toJson path),
      ("package", toJson mod.pkg.baseName.toString),
      ("imports", toJson <| imports.map (·.module.toString))] ++
      (if native.isEmpty then [] else [("nativeInputs", toJson native)]))
    hasNative := state.hasNative || !native.isEmpty }

def resolve (request : Request) : IO Json := do
  let some lean ← findLeanInstall? | fail "Selected Lean installation is unavailable"
  let env : Lake.Env := {
    lake := LakeInstall.ofLean lean, lean, elan? := none
    reservoirApiUrl := "", githashOverride := "", pkgUrlMap := {}
    noCache := true, enableArtifactCache? := some false
    restoreAllArtifacts? := some false, noSystemCache := true
    lakeConfig? := none, cacheKey? := none, cacheArtifactEndpoint? := none
    cacheRevisionEndpoint? := none, cacheService? := none
    initLeanPath := [], initLeanSrcPath := [], initSharedLibPath := []
    initPath := [], toolchain := Lean.toolchain }
  let root := FilePath.mk request.workspace / "root"
  let overrides : Array PackageEntry := request.packages.map fun pkg => {
    name := pkg.name.toName, inherited := false
    configFile := pkg.configFile
    manifestFile? := pkg.manifestFile.map FilePath.mk
    src := .path (FilePath.mk ".." / pkg.directory / pkg.packageRoot) }
  let operation : LoggerIO Workspace := do
    let ws ← loadWorkspaceRoot {
      lakeEnv := env, wsDir := root
      reconfigure := true, updateDeps := false, updateToolchain := false }
    unless ws.manifestFile.normalize == (root / "lake-manifest.json").normalize do
      error "Custom root manifest paths are not supported by locked builds"
    let manifest ← Manifest.load (root / "lake-manifest.json")
    for dep in ws.root.depConfigs do
      if let some entry := manifest.packages.find? (·.name == dep.name) then
        match dep.src?, entry.src with
        | some (.path dir), .path locked =>
          unless dir.normalize == locked.normalize do
            error s!"Locked local dependency path changed: {dep.name}"
        | some (.git _ _ subDir), .git _ _ _ lockedSubDir =>
          unless subDir.map FilePath.normalize == lockedSubDir.map FilePath.normalize do
            error s!"Locked Git dependency subdirectory changed: {dep.name}"
        | _, _ => pure ()
    ws.materializeDeps manifest {} true overrides
  let (workspace?, log) ← operation.captureLog
  if log.maxLv >= .warning then fail (String.intercalate "\n" <| log.entries.toList.map toString)
  let some ws := workspace? | fail "Lake could not resolve the locked workspace"
  unless ws.packages.size == request.packages.size + 1 do
    fail "Lake's resolved package set differs from the captured lock"
  let mut packages := #[]
  for pkg in ws.packages do
    let config ← relativeInput request pkg.configFile
    checkLeanConfig pkg.baseName.toString pkg.config.toLeanConfig
    unless pkg.config.extraDepTargets.isEmpty && !pkg.config.precompileModules &&
        !pkg.config.bootstrap do
      fail s!"Unsupported Lake package build prerequisites: {pkg.baseName}"
    for target in pkg.targetDecls do
      unless target.kind == LeanLib.configKind || target.kind == LeanExe.configKind ||
          target.kind == InputFile.configKind do
        fail s!"Unsupported Lake build target: {pkg.baseName}/{target.name}"
    for lib in pkg.leanLibs do
      checkLeanConfig s!"{pkg.baseName}/{lib.name}" lib.config.toLeanConfig
      unless lib.config.needs.isEmpty && lib.config.extraDepTargets.isEmpty &&
          !lib.config.precompileModules && !lib.config.allowImportAll &&
          (lib.config.nativeFacets false).map (·.name) == #[Module.oFacet] &&
          (lib.config.nativeFacets true).map (·.name) == #[Module.oExportFacet] do
        fail s!"Unsupported Lake library build prerequisites: {pkg.baseName}/{lib.name}"
      -- Validate every declared input before compilation. Do not execute targets.
      for input in lib.moreLinkObjs do
        let _ ← nativeInput request ws pkg input
    packages := packages.push <| Json.mkObj [
      ("name", toJson pkg.baseName.toString), ("configFile", toJson config),
      ("dependencies", toJson <| pkg.depConfigs.map (·.name.toString))]
  Lean.searchPathRef.set env.leanSearchPath
  for name in request.modules do
    unless (ws.findModules name.toName).any (·.pkg.isRoot) do
      fail s!"Selected module does not belong to the root Lake package: {name}"
  let (_, state) ← (request.modules.forM fun name => visit request ws name.toName).run {}
  return Json.mkObj [
    ("schemaVersion", toJson (if state.hasNative then 2 else 1 : Nat)), ("resolver", toJson "lean-lake-locked"),
    ("leanVersion", toJson Lean.versionString), ("leanCommit", toJson Lean.githash),
    ("packages", toJson packages), ("modules", toJson state.records),
    ("externalImports", toJson <| state.external.toArray.map Name.toString)]

end LeanBridgeWorkspace

def main (args : List String) : IO Unit := do
  let [path] := args | throw <| IO.userError "Expected a workspace request file"
  let json ← IO.ofExcept <| Json.parse (← IO.FS.readFile path)
  let request ← IO.ofExcept (fromJson? json : Except String LeanBridgeWorkspace.Request)
  IO.println (← LeanBridgeWorkspace.resolve request).compress
