import Lean

/- Checked native export metadata. Source scanning never supplies a type. -/
open Lean Meta

namespace LeanBridge.NativeExports

structure Request where
  modules : Array String
  exports : Array String := #[]
  resources : Array String := #[]
  arities : Array (String × Nat) := #[]
  deriving FromJson

def obj (fields : List (String × Json)) : Json := Json.mkObj fields
def str (value : String) : Json := toJson value

def primitives : List (Name × String) := [
  (``Unit, "unit"), (``Bool, "bool"), (``UInt8, "uint8"), (``UInt16, "uint16"),
  (``UInt32, "uint32"), (``UInt64, "uint64"), (``Int8, "int8"), (``Int16, "int16"),
  (``Int32, "int32"), (``Int64, "int64"), (``Nat, "nat"), (``Int, "int"),
  (``Float32, "float32"), (``Float, "float64"), (``String, "string"), (``ByteArray, "bytes")]

def reject (e : Expr) (reason : String) : MetaM α :=
  throwError "{reason}: {e}"

def abi (e : Expr) : MetaM Json := do
  let lowered ← Compiler.LCNF.toImpureType (← Compiler.LCNF.toMonoType (← Compiler.LCNF.toLCNFType e))
  let (cType, suffix) :=
    if lowered == Compiler.LCNF.ImpureType.uint8 then ("uint8_t", "")
    else if lowered == Compiler.LCNF.ImpureType.uint16 then ("uint16_t", "")
    else if lowered == Compiler.LCNF.ImpureType.uint32 then ("uint32_t", "_uint32")
    else if lowered == Compiler.LCNF.ImpureType.uint64 then ("uint64_t", "_uint64")
    else if lowered == Compiler.LCNF.ImpureType.float32 then ("float", "_float32")
    else if lowered == Compiler.LCNF.ImpureType.float then ("double", "_float")
    else if lowered == Compiler.LCNF.ImpureType.object ||
      lowered == Compiler.LCNF.ImpureType.tobject || lowered == Compiler.LCNF.ImpureType.tagged then ("lean_object*", "")
    else ("unsupported", "")
  if cType == "unsupported" then reject e "unsupported native compiler representation"
  return obj [("cType", str cType), ("box", str ("lean_box" ++ suffix)),
    ("unbox", str ("lean_unbox" ++ suffix)), ("heap", toJson (lowered == Compiler.LCNF.ImpureType.object))]

partial def shape (request : Request) (e : Expr) (seen : List Name := [])
    (depth : Nat := 0) : MetaM Json := do
  if depth > 32 then reject e "native copied type nesting exceeds 32"
  if e.hasFVar || e.hasLooseBVars || e.hasMVar then
    reject e "dependent or unresolved native type"
  if (← isDefEq e (mkConst ``Unit)) then
    return obj [("kind", str "primitive"), ("name", str "unit"), ("lean", str "Unit"), ("abi", ← abi e)]
  if let .const name _ := e then
    if let some (_, primitive) := primitives.find? (·.1 == name) then
      return obj [("kind", str "primitive"), ("name", str primitive), ("lean", str name.toString), ("abi", ← abi e)]
    if request.resources.contains name.toString then
      if !(← getEnv).contains name then reject e "unknown resource"
      let lowered ← abi e
      if (lowered.getObjValAs? Bool "heap").toOption != some true then
        reject e "resource has no stable heap identity; use a copied value"
      let some index := (← getEnv).getModuleIdxFor? name | reject e "resource module is unavailable"
      return obj [("kind", str "resource"), ("name", str name.toString), ("lean", str name.toString),
        ("module", str (← getEnv).header.moduleNames[index.toNat]!.toString), ("abi", lowered)]
    if let some info := getStructureInfo? (← getEnv) name then
      if seen.contains name then reject e "recursive copied records require a reviewed representation"
      let .inductInfo induct ← getConstInfo name | reject e "invalid record"
      if induct.numParams != 0 || induct.numIndices != 0 || !info.parentInfo.isEmpty then
        reject e "generic, dependent and inherited records require a reviewed projection"
      let mut fields := #[]
      for field in info.fieldNames do
        let some projection := info.getProjFn? fields.size | reject e "missing record projection"
        let projectionInfo ← getConstInfo projection
        let .forallE _ _ fieldType _ := projectionInfo.type | reject e "invalid record projection"
        fields := fields.push (obj [("name", str field.toString),
          ("projection", str projection.toString),
          ("type", ← shape request fieldType (name :: seen) (depth + 1))])
      return obj [("kind", str "record"), ("name", str name.toString),
        ("lean", str name.toString), ("constructor", str induct.ctors.head!.toString), ("fields", toJson fields), ("abi", ← abi e)]
  if e.isAppOfArity ``Array 1 then
    return obj [("kind", str "array"), ("element", ← shape request e.appArg! seen (depth + 1)), ("abi", ← abi e)]
  if e.isForall then
    let mut result := e
    let mut parameters := #[]
    repeat
      result ← whnf result
      match result with
      | .forallE _ argument rest binder =>
        if binder != .default || rest.hasLooseBVars then reject e "dependent or implicit callback"
        if parameters.size >= 16 then reject e "native callbacks support at most 16 arguments"
        parameters := parameters.push (← shape request argument seen (depth + 1))
        result := rest
      | _ => break
    return obj [("kind", str "callback"), ("parameters", toJson parameters),
      ("result", ← shape request result seen (depth + 1)), ("abi", ← abi e)]
  let reduced ← whnf e
  if reduced != e then return ← shape request reduced seen (depth + 1)
  reject e "unsupported native export type"

partial def signature (request : Request) (e : Expr) (limit : Nat)
    (index : Nat := 0) : MetaM (Array Json × Json) := do
  if index < limit then
    if let .forallE _ argument result binder := e then
      if binder != .default || result.hasLooseBVars then reject e "dependent or implicit parameter"
      let parameter ← shape request argument
      let (rest, result) ← signature request result limit (index + 1)
      return (#[obj [("name", str s!"arg{index}"), ("type", parameter)]] ++ rest, result)
  return (#[], ← shape request e)

partial def checkBody (request : Request) (name : Name) (seen : NameSet := {}) : MetaM NameSet := do
  if seen.contains name then return seen
  let mut seen := seen.insert name
  let env ← getEnv
  let some index := env.getModuleIdxFor? name | return seen
  if !request.modules.contains env.header.moduleNames[index.toNat]!.toString then return seen
  let info ← getConstInfo name
  let partialImplementation := (env.find? (Compiler.mkUnsafeRecName name)).any (·.isPartial)
  if info.isUnsafe || info.isPartial || partialImplementation || isExtern env name || (Compiler.getImplementedBy? env name).isSome then
    throwError "{name} needs a reviewed unsafe, partial or foreign implementation contract"
  if let some value := info.value? then
    for dependency in value.getUsedConstants do
      seen ← checkBody request dependency seen
  return seen

def extract (request : Request) : MetaM Json := do
  let env ← getEnv
  let mut names := request.exports.map String.toName
  if names.isEmpty then
    for (name, info) in env.constants.toList do
      if let some index := env.getModuleIdxFor? name then
        if request.modules.contains env.header.moduleNames[index.toNat]!.toString &&
            !isPrivateName name && !(isProtected env name) then
          if let .defnInfo _ := info then
            if (← getProjectionFnInfo? name).isNone && !name.isInternal && !isAuxRecursor env name then
              names := names.push name
  names := names.qsort (fun a b => a.toString < b.toString)
  let mut declarations := #[]
  for name in names do
    if isPrivateName name || isProtected env name then throwError "nonpublic export {name}"
    let info ← getConstInfo name
    if info.isUnsafe || info.isPartial then throwError "unsafe or partial export {name}"
    let _ ← checkBody request name
    if (← collectAxioms name).contains ``sorryAx then throwError "export {name} depends on sorry"
    if !info.levelParams.isEmpty then throwError "generic export {name} requires specialization"
    match info with
    | .defnInfo _ | .opaqueInfo _ => pure ()
    | _ => throwError "{name} is not an executable definition"
    let some moduleIndex := env.getModuleIdxFor? name | throwError "missing module for {name}"
    let module := env.header.moduleNames[moduleIndex.toNat]!.toString
    if !request.modules.contains module then throwError "export outside selected modules: {name}"
    let arity := request.arities.find? (·.1 == name.toString) |>.map (·.2) |>.getD 1024
    let (parameters, result) ← signature request info.type arity
    declarations := declarations.push (obj [("name", str name.toString), ("module", str module),
      ("parameters", toJson parameters), ("result", result)])
  if declarations.isEmpty then throwError "no executable native exports selected"
  return obj [("schemaVersion", toJson (1 : Nat)),
    ("kind", str "lean-bridge-native-elaborated-exports"), ("declarations", toJson declarations)]

end LeanBridge.NativeExports

unsafe def main (args : List String) : IO UInt32 := do
  let (path, safetyOnly) ← match args with
    | [path] => pure (path, false)
    | ["--check-bodies", path] => pure (path, true)
    | _ => throw (IO.userError "expected native export request JSON path")
  let json ← IO.ofExcept <| Json.parse (← IO.FS.readFile path)
  let request ← IO.ofExcept <| fromJson? (α := LeanBridge.NativeExports.Request) json
  initSearchPath (← findSysroot)
  let env ← importModules (request.modules.map fun name => { module := name.toName }) {} 0
  let operation := if safetyOnly then do
      if request.exports.isEmpty then throwError "no exports supplied for implementation checking"
      for name in request.exports do
        let info ← getConstInfo name.toName
        let some index := env.getModuleIdxFor? name.toName
          | throwError "missing module for {name}"
        if !request.modules.contains env.header.moduleNames[index.toNat]!.toString then
          throwError "export outside selected modules: {name}"
        if isPrivateName name.toName || isProtected env name.toName then
          throwError "nonpublic export {name}"
        if !info.levelParams.isEmpty then throwError "generic export {name} requires specialization"
        match info with
        | .defnInfo _ | .opaqueInfo _ => pure ()
        | _ => throwError "{name} is not an executable definition"
        let _ ← LeanBridge.NativeExports.checkBody request name.toName
        if (← collectAxioms name.toName).contains ``sorryAx then
          throwError "export {name} depends on sorry"
      pure <| Json.mkObj [("checked", toJson request.exports)]
    else LeanBridge.NativeExports.extract request
  let (metadata, _, _) ← operation.toIO
    { fileName := "<native-exports>", fileMap := default } { env }
  IO.println metadata.compress
  return 0
