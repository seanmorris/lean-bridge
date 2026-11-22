import Lean

/- Read freshly compiled application interfaces, not source text or package declarations.
   The generated host module is the only authorized source of foreign imports. -/
open Lean Meta

namespace LeanBridge.HostExports

structure Nominal where
  lean : String
  id : String
  deriving FromJson

structure PullProtocol where
  «open» : String
  next : String
  close : String
  deriving FromJson, ToJson

structure Request where
  modules : Array String
  exportModules : Array String
  exports : Array String
  taskExports : Array String
  asyncIterators : Array PullProtocol
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

/-- A returned Except is a value. Its success arm is first in Binding IR. -/
partial def returned (r : Request) (e : Expr) (copyOnly := false) : MetaM Json := do
  let e := (← instantiateMVars e).consumeMData
  let args := e.getAppArgs
  if e.getAppFn.constName? == some ``Except && args.size == 2 then
    return Json.mkObj [("kind", toJson "apply"), ("constructor", toJson "result"),
      ("arguments", Json.arr #[← returned r args[1]! true, ← returned r args[0]! true])]
  let t ← carrier r e
  if copyOnly && !primitives.any (fun p => e.constName? == some p.1) then
    throwError "an owned host object cannot be a copied exception payload: {e}"
  return t

partial def checkDependencies (r : Request) (n : Name) (seen : NameSet) : MetaM NameSet := do
  if seen.contains n then return seen
  let mut seen := seen.insert n
  let env ← getEnv
  let some index := env.getModuleIdxFor? n | return seen
  let module := env.header.modules[index.toNat]!.module.toString
  if module == "LeanBridge.Host.Python" then
    if isExtern env n && !r.members.contains n.toString then throwError "undeclared host member {n}"
    return seen
  if !r.modules.contains module then return seen
  let info ← getConstInfo n
  if info.isUnsafe || info.isPartial || (env.find? (Compiler.mkUnsafeRecName n)).any (·.isPartial)
    || isExtern env n || (Compiler.getImplementedBy? env n).isSome then
    throwError "unreviewed unsafe, partial or foreign application declaration: {n}"
  if let some initFn := getInitFnNameFor? env n then
    unless env.getModuleIdxFor? initFn == some index && initFn != n do
      throwError "unreviewed application initializer: {n}"
    if (← collectAxioms initFn).contains ``sorryAx then throwError "initializer {initFn} depends on sorry"
    seen ← checkDependencies r initFn seen
  else if let .axiomInfo _ := info then throwError "unimplemented application axiom: {n}"
  if let some v := info.value? (allowOpaque := true) then
    for dep in v.getUsedConstants do seen ← checkDependencies r dep seen
  return seen

def noWorkerHost (r : Request) (deps : NameSet) (n : Name) : MetaM Unit := do
  if r.members.any (fun m => deps.contains m.toName) || r.resources.any (fun t => deps.contains t.lean.toName) then
    throwError "host identities or calls cannot cross this task scheduler: {n}"

/-- Read each protocol member independently; a review cannot authorize a different cursor or an extern. -/
def cursorMember (r : Request) (memberName : String) (cursor : Expr) : MetaM Expr := do
  let n := memberName.toName
  let env ← getEnv
  let info ← getConstInfo n
  let some idx := env.getModuleIdxFor? n | throwError "missing cursor operation {n}"
  unless r.exportModules.contains env.header.modules[idx.toNat]!.module.toString &&
      !isPrivateName n && !isProtected env n && info.levelParams.isEmpty do
    throwError "cursor operation must be a public monomorphic application definition: {n}"
  match info with
  | .defnInfo _ | .opaqueInfo _ => pure ()
  | _ => throwError "expected an executable cursor operation: {n}"
  noWorkerHost r (← checkDependencies r n {}) n
  if (← collectAxioms n).contains ``sorryAx then throwError "cursor operation {n} depends on sorry"
  forallTelescope info.type fun args result => do
    unless args.size == 1 do throwError "cursor operation takes exactly one cursor: {n}"
    let d ← args[0]!.fvarId!.getDecl
    unless d.binderInfo == .default && (← isDefEq d.type cursor) && !result.hasFVar do
      throwError "cursor operation has the wrong cursor or a dependent result: {n}"
    return result.consumeMData

def pullFields (r : Request) (p : PullProtocol) (result : Expr) (deps : NameSet) : MetaM (List (String × Json)) := do
  noWorkerHost r deps p.open.toName
  let head := result.getAppFn.constName?
  let args := result.getAppArgs
  let (effect, cursor, extra) ← if (head == some ``IO || head == some ``BaseIO) && args.size == 1 then
    pure (head.get!.toString, args[0]!, [])
  else if head == some ``EIO && args.size == 2 then
    pure ("EIO", args[1]!, [("error", ← returned r args[0]! true)])
  else pure ("pure", result, [])
  let env ← getEnv
  let some cn := cursor.getAppFn.constName? | throwError "expected an application-owned cursor"
  let some idx := env.getModuleIdxFor? cn | throwError "expected an application-owned cursor: {cn}"
  unless r.modules.contains env.header.modules[idx.toNat]!.module.toString && !cursor.hasFVar do
    throwError "expected a concrete application-owned cursor: {cn}"
  let stop ← cursorMember r p.close cursor
  unless (← isDefEq stop (← mkAppM ``BaseIO #[mkConst ``Unit])) do
    throwError "cursor close must return BaseIO Unit: {p.close}"
  let step ← cursorMember r p.next cursor
  unless step.getAppFn.constName? == some ``BaseIO && step.getAppArgs.size == 1 do
    throwError "cursor next must return BaseIO (Task ...): {p.next}"
  let task := step.getAppArgs[0]!
  unless task.getAppFn.constName? == some ``Task && task.getAppArgs.size == 1 do
    throwError "cursor next must return a real Task: {p.next}"
  let v := task.getAppArgs[0]!
  let (item, failure) ← if v.getAppFn.constName? == some ``Except && v.getAppArgs.size == 2 then
    pure (v.getAppArgs[1]!, [("stepError", ← returned r v.getAppArgs[0]! true)])
  else pure (v, [])
  unless item.getAppFn.constName? == some ``Option && item.getAppArgs.size == 1 do
    throwError "cursor step must distinguish exhaustion with Option: {p.next}"
  return [("effect", toJson effect), ("delivery", toJson "async-iterator"),
    ("protocol", toJson p), ("result", ← returned r item.getAppArgs[0]! true)] ++ extra ++ failure

def extract (r : Request) : MetaM Json := do
  let env ← getEnv
  -- Module startup runs even declarations that no public function references.
  for module in r.modules do
    if module == "LeanBridge.Host.Python" then continue
    let some idx := env.getModuleIdx? module.toName | throwError "missing source module {module}"
    for n in env.header.moduleData[idx.toNat]!.constNames do
      if (getInitFnNameFor? env n).isSome || isIOUnitInitFn env n then
        let deps ← checkDependencies r n {}
        if (← collectAxioms n).contains ``sorryAx then throwError "initializer {n} depends on sorry"
        if r.members.any (fun m => deps.contains m.toName) then
          throwError "application initializer {n} calls a host before it is bound"
  let mut rows := #[]
  for publicName in r.exports do
    let n := publicName.toName
    let info ← getConstInfo n
    let some idx := env.getModuleIdxFor? n | throwError "no source module for {n}"
    let owner := env.header.modules[idx.toNat]!.module.toString
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
      let fields ← if let some protocol := r.asyncIterators.find? (·.open == publicName) then do
        for a in args do
          let _ ← returned r (← a.fvarId!.getDecl).type true
        pullFields r protocol result deps
      else if r.taskExports.contains publicName then do
        let (effect, task, extra) ← if head == ``Task then
          pure ("pure", result, [])
        else if (head == ``IO || head == ``BaseIO) && resultArgs.size == 1 then
          pure (head.toString, resultArgs[0]!, [])
        else if head == ``EIO && resultArgs.size == 2 then
          pure ("EIO", resultArgs[1]!, [("error", ← returned r resultArgs[0]! true)])
        else throwError "taskExports requires a real Lean Task result: {n}"
        unless task.getAppFn.constName? == some ``Task && task.getAppArgs.size == 1 do
          throwError "taskExports requires a real Lean Task result: {n}"
        noWorkerHost r deps n
        for a in args do
          let _ ← returned r (← a.fvarId!.getDecl).type true
        pure <| [("effect", toJson effect), ("delivery", toJson "task"),
          ("result", ← returned r task.getAppArgs[0]! true)] ++ extra
      else if head == ``IO && resultArgs.size == 1 then
        pure [("effect", toJson "IO"), ("result", ← returned r resultArgs[0]!)]
      else if head == ``EIO && resultArgs.size == 2 then
        pure [("effect", toJson "EIO"), ("error", ← returned r resultArgs[0]! true),
          ("result", ← returned r resultArgs[1]!)]
      else if head == ``Except && resultArgs.size == 2 then
        pure [("effect", toJson "pure"), ("result", ← returned r result)]
      else throwError "expected synchronous IO result, typed EIO or returned Except: {n}"
      return Json.mkObj <| fields ++ [("declaration", toJson publicName), ("module", toJson owner),
        ("parameters", toJson params), ("hostMembers", toJson (r.members.filter (fun m => deps.contains m.toName)))]
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
