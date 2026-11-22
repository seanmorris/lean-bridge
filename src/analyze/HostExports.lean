import Lean

/- Read freshly compiled application interfaces, not source text or package declarations.
   The generated host module is the only authorized source of foreign imports. -/
open Lean Meta

namespace LeanBridge.HostExports

structure Nominal where
  lean : String
  id : String
  deriving FromJson

structure Request where
  modules : Array String
  exportModules : Array String
  exports : Array String
  resources : Array Nominal
  members : Array String
  deriving FromJson

def primitives : List (Name × String) := [
  (``Unit, "unit"), (``Bool, "bool"), (``Char, "char"), (``String, "string"),
  (``ByteArray, "bytes"), (``Nat, "nat"), (``Int, "int"), (``Float, "float64"),
  (``Float32, "float32"), (``USize, "usize"), (``ISize, "isize"),
  (``UInt8, "uint8"), (``UInt16, "uint16"), (``UInt32, "uint32"), (``UInt64, "uint64"),
  (``Int8, "int8"), (``Int16, "int16"), (``Int32, "int32"), (``Int64, "int64")]

def carrier (request : Request) (e : Expr) : MetaM Json := do
  let e ← instantiateMVars e
  if let .const name _ := e.consumeMData then
    if let some (_, tag) := primitives.find? (·.1 == name) then
      return Json.mkObj [("kind", toJson "primitive"), ("name", toJson tag)]
    if let some r := request.resources.find? (·.lean == name.toString) then
      return Json.mkObj [("kind", toJson "named"), ("id", toJson r.id)]
  throwError "unsupported Python host-component carrier: {e}"

partial def checkDependencies (r : Request) (n : Name) (seen : NameSet) : MetaM NameSet := do
  if seen.contains n then return seen
  let mut seen := seen.insert n
  let env ← getEnv
  let some index := env.getModuleIdxFor? n | return seen
  let module := env.header.moduleNames[index.toNat]!.toString
  if module == "LeanBridge.Host.Python" then
    if isExtern env n && !r.members.contains n.toString then throwError "undeclared host member {n}"
    return seen
  if !r.modules.contains module then return seen
  let info ← getConstInfo n
  if info.isUnsafe || info.isPartial || (env.find? (Compiler.mkUnsafeRecName n)).any (·.isPartial)
    || isExtern env n || (Compiler.getImplementedBy? env n).isSome then
    throwError "unreviewed unsafe, partial or foreign application declaration: {n}"
  if let .axiomInfo _ := info then throwError "unimplemented application axiom: {n}"
  if let some v := info.value? (allowOpaque := true) then
    for dep in v.getUsedConstants do seen ← checkDependencies r dep seen
  return seen

def extract (r : Request) : MetaM Json := do
  let env ← getEnv
  let mut rows := #[]
  for publicName in r.exports do
    let n := publicName.toName
    let info ← getConstInfo n
    let some idx := env.getModuleIdxFor? n | throwError "no source module for {n}"
    let owner := env.header.moduleNames[idx.toNat]!.toString
    unless r.exportModules.contains owner && !isPrivateName n && !isProtected env n && info.levelParams.isEmpty do
      throwError "expected a public monomorphic declaration in a selected module: {n}"
    match info with
    | .defnInfo _ | .opaqueInfo _ => pure ()
    | _ => throwError "not an executable application definition: {n}"
    let deps ← checkDependencies r n {}
    if (← collectAxioms n).contains ``sorryAx then throwError "export {n} depends on sorry"
    let row ← forallTelescope info.type fun args result => do
      let mut params := #[]
      for arg in args do
        let decl ← arg.fvarId!.getDecl
        unless decl.binderInfo == .default do throwError "explicit application parameters required: {n}"
        params := params.push <| Json.mkObj [("name", toJson decl.userName.toString), ("type", ← carrier r decl.type)]
      let result := result.consumeMData
      let some head := result.getAppFn.constName? | throwError "expected synchronous IO result: {n}"
      let resultArgs := result.getAppArgs
      unless head == ``IO && resultArgs.size == 1 do throwError "expected synchronous IO result: {n}"
      return Json.mkObj [("declaration", toJson publicName), ("module", toJson owner),
        ("parameters", toJson params), ("result", ← carrier r resultArgs[0]!),
        ("effect", toJson "IO"), ("hostMembers", toJson (r.members.filter (fun m => deps.contains m.toName)))]
    rows := rows.push row
  return Json.mkObj [("schemaVersion", toJson (1 : Nat)), ("kind", toJson "lean-bridge-host-export-metadata"),
    ("leanVersion", toJson Lean.versionString), ("entries", toJson rows)]

end LeanBridge.HostExports

unsafe def main (args : List String) : IO Unit := do
  let [path] := args | throw (IO.userError "expected a host-import selection file")
  let r ← IO.ofExcept <| fromJson? (α := LeanBridge.HostExports.Request) (← IO.ofExcept <| Json.parse (← IO.FS.readFile path))
  initSearchPath (← findSysroot)
  let env ← importModules (r.modules.map fun m => { module := m.toName }) {} 0
  let (result, _, _) ← (LeanBridge.HostExports.extract r).toIO
    { fileName := "<host-imports>", fileMap := default } { env }
  IO.println result.compress
