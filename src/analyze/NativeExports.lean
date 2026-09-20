import Lean

/- Checked native export metadata. Source scanning never supplies a type. -/
open Lean Meta

namespace LeanBridge.NativeExports

structure MetadataModule where
  name : String
  sourcePath : String
  sourceSha256 : String
  interfaceSha256 : String
  deriving FromJson

structure MetadataContext where
  toolchain : String
  invocationIdentitySha256 : String
  modules : Array MetadataModule
  deriving FromJson

structure Specialization where
  name : String
  declaration : String
  types : Array String
  deriving FromJson

structure Request where
  profile : Option String := none
  modules : Array String
  exportModules : Option (Array String) := none
  exports : Array String := #[]
  resources : Array String := #[]
  arities : Array (String × Nat) := #[]
  specializations : Option (Array Specialization) := none
  contracts : Option Json := none
  metadata : Option MetadataContext := none
  deriving FromJson

def obj (fields : List (String × Json)) : Json := Json.mkObj fields
def str (value : String) : Json := toJson value

def primitives : List (Name × String) := [
  (``Unit, "unit"), (``Bool, "bool"), (``UInt8, "uint8"), (``UInt16, "uint16"),
  (``UInt32, "uint32"), (``UInt64, "uint64"), (``Int8, "int8"), (``Int16, "int16"),
  (``Int32, "int32"), (``Int64, "int64"), (``Nat, "nat"), (``Int, "int"),
  (``Float32, "float32"), (``Float, "float64"), (``String, "string"), (``ByteArray, "bytes"),
  (``Char, "char"), (``USize, "usize"), (``ISize, "isize")]

def reject (e : Expr) (reason : String) : MetaM α :=
  throwError "{reason}: {e}"

def abi (e : Expr) : MetaM Json := do
  let lowered ← Compiler.LCNF.toImpureType (← Compiler.LCNF.toMonoType (← Compiler.LCNF.toLCNFType e))
  let (cType, suffix) :=
    if lowered == Compiler.LCNF.ImpureType.uint8 then ("uint8_t", "")
    else if lowered == Compiler.LCNF.ImpureType.uint16 then ("uint16_t", "")
    else if lowered == Compiler.LCNF.ImpureType.uint32 then ("uint32_t", "_uint32")
    else if lowered == Compiler.LCNF.ImpureType.uint64 then ("uint64_t", "_uint64")
    else if lowered == Compiler.LCNF.ImpureType.usize then ("size_t", "_usize")
    else if lowered == Compiler.LCNF.ImpureType.float32 then ("float", "_float32")
    else if lowered == Compiler.LCNF.ImpureType.float then ("double", "_float")
    else if lowered == Compiler.LCNF.ImpureType.object ||
      lowered == Compiler.LCNF.ImpureType.tobject || lowered == Compiler.LCNF.ImpureType.tagged then ("lean_object*", "")
    else ("unsupported", "")
  if cType == "unsupported" then reject e "unsupported native compiler representation"
  return obj [("cType", str cType), ("box", str ("lean_box" ++ suffix)),
    ("unbox", str ("lean_unbox" ++ suffix)), ("heap", toJson (lowered == Compiler.LCNF.ImpureType.object))]

def nativeIdentifier (name : String) : Bool :=
  (name.splitOn ".").all fun part =>
    !part.isEmpty && part.toList.head!.isAlpha && part.toList.head!.toNat < 128 &&
      part.toList.all (fun c => c.toNat < 128 && (c.isAlphanum || c == '_'))

partial def shape (request : Request) (e : Expr) (seen : List Name := [])
    (depth : Nat := 0) (copied : Bool := false) : MetaM Json := do
  if depth > 32 then reject e "native copied type nesting exceeds 32"
  if e.hasFVar || e.hasLooseBVars || e.hasMVar then
    reject e "dependent or unresolved native type"
  if (← isDefEq e (mkConst ``Unit)) then
    return obj [("kind", str "primitive"), ("name", str "unit"), ("lean", str "Unit"), ("abi", ← abi e)]
  if let .const name _ := e then
    if let some (_, primitive) := primitives.find? (·.1 == name) then
      return obj [("kind", str "primitive"), ("name", str primitive), ("lean", str name.toString), ("abi", ← abi e)]
    if request.resources.contains name.toString then
      if copied then reject e "identity resources inside copied values require an ownership policy"
      if !nativeIdentifier name.toString then reject e "unsupported native resource identifier"
      if !(← getEnv).contains name then reject e "unknown resource"
      let lowered ← abi e
      if (lowered.getObjValAs? Bool "heap").toOption != some true then
        reject e "resource has no stable heap identity; use a copied value"
      let some index := (← getEnv).getModuleIdxFor? name | reject e "resource module is unavailable"
      if !request.modules.contains (← getEnv).header.moduleNames[index.toNat]!.toString then
        reject e "resource module is outside the compiled source closure"
      return obj [("kind", str "resource"), ("name", str name.toString), ("lean", str name.toString),
        ("module", str (← getEnv).header.moduleNames[index.toNat]!.toString), ("abi", lowered)]
    if let some info := getStructureInfo? (← getEnv) name then
      if seen.contains name then reject e "recursive copied records require a reviewed representation"
      let .inductInfo induct ← getConstInfo name | reject e "invalid record"
      if !nativeIdentifier name.toString || !nativeIdentifier induct.ctors.head!.toString then
        reject e "unsupported native record identifier"
      if induct.numParams != 0 || induct.numIndices != 0 || !info.parentInfo.isEmpty then
        reject e "generic, dependent and inherited records require a reviewed projection"
      let mut fields := #[]
      for field in info.fieldNames do
        let some projection := info.getProjFn? fields.size | reject e "missing record projection"
        if !nativeIdentifier field.toString || (field.toString.splitOn ".").length != 1 ||
            ["new", "DESTROY", "CLONE", "CLONE_SKIP"].contains field.toString ||
            !nativeIdentifier projection.toString then reject e "invalid or reserved native record field"
        let projectionInfo ← getConstInfo projection
        let .forallE _ _ fieldType _ := projectionInfo.type | reject e "invalid record projection"
        fields := fields.push (obj [("name", str field.toString),
          ("projection", str projection.toString),
          ("type", ← shape request fieldType (name :: seen) (depth + 1) true)])
      return obj [("kind", str "record"), ("name", str name.toString),
        ("lean", str name.toString), ("constructor", str induct.ctors.head!.toString), ("fields", toJson fields), ("abi", ← abi e)]
  if e.isAppOfArity ``Array 1 then
    return obj [("kind", str "array"), ("element", ← shape request e.appArg! seen (depth + 1) true), ("abi", ← abi e)]
  if e.isAppOfArity ``Option 1 then
    return obj [("kind", str "option"), ("element", ← shape request e.appArg! seen (depth + 1) true), ("abi", ← abi e)]
  if e.isAppOfArity ``Except 2 || e.isAppOfArity ``Prod 2 then
    let args := e.getAppArgs
    let first ← shape request args[0]! seen (depth + 1) true
    let second ← shape request args[1]! seen (depth + 1) true
    -- IR result arguments are [success, error]; Lean's Except is [error, success].
    let result := e.isAppOfArity ``Except 2
    return obj [("kind", str (if result then "result" else "tuple")),
      ("arguments", toJson (if result then #[second, first] else #[first, second])), ("abi", ← abi e)]
  if e.isForall then
    if copied then reject e "callbacks inside copied values require a retention policy"
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
  if reduced != e then return ← shape request reduced seen (depth + 1) copied
  reject e "unsupported native export type"

partial def signature (request : Request) (e : Expr) (limit : Nat)
    (index : Nat := 0) : MetaM (Array Json × Json) := do
  let e ← whnf e
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

def expression (e : Expr) : MetaM String := do
  withOptions (fun opts => opts.setBool `pp.fullNames true |>.setBool `pp.universes true) do
    return (← ppExpr e).pretty

def binderName : BinderInfo → String
  | .default => "explicit"
  | .implicit => "implicit"
  | .strictImplicit => "strict-implicit"
  | .instImplicit => "instance-implicit"

def unsupported (reason text : String) : Json :=
  obj [("status", str "unsupported"), ("reason", str reason), ("expression", str text)]

partial def effectNames (e : Expr) (seen : NameSet := {}) (depth : Nat := 0) : MetaM (Array String) := do
  if depth > 32 then return #[]
  match e with
  | .forallE _ _ result _ | .lam _ _ result _ =>
    return ← effectNames result seen (depth + 1)
  | _ => pure ()
  let some name := e.getAppFn.constName? | return #[]
  if seen.contains name then return #[]
  if [``IO, ``EIO, ``BaseIO, ``Task, ``ST].contains name then return #[name.toString]
  if let some (.defnInfo info) := (← getEnv).find? name then
    return ← effectNames (info.value.beta e.getAppArgs) (seen.insert name) (depth + 1)
  return #[]

def scalarType (request : Request) (e : Expr) : MetaM Json := do
  let value ← shape request e
  if (value.getObjValAs? String "kind").toOption != some "primitive" then
    throwError "ordinary components require a primitive value"
  let name ← ofExcept <| value.getObjValAs? String "name"
  return obj [("kind", str "primitive"), ("name", str name)]

partial def componentCopiedType (value : Json) : MetaM Json := do
  if (value.getObjValAs? String "kind").toOption == some "primitive" then
    return obj [("kind", str "primitive"), ("name", ← ofExcept <| value.getObjVal? "name")]
  let kind := (value.getObjValAs? String "kind").toOption.getD ""
  if kind == "array" || kind == "option" then
    return obj [("kind", str kind),
      ("element", ← componentCopiedType (← ofExcept <| value.getObjVal? "element"))]
  if kind == "result" || kind == "tuple" then
    let args ← ofExcept <| value.getObjValAs? (Array Json) "arguments"
    return obj [("kind", str kind), ("arguments", toJson (← args.mapM componentCopiedType))]
  if (value.getObjValAs? String "kind").toOption == some "record" then
    let fields ← ofExcept <| value.getObjValAs? (Array Json) "fields"
    let fields ← fields.mapM fun (field : Json) => do
      pure <| obj [("name", ← ofExcept <| field.getObjVal? "name"),
        ("type", ← componentCopiedType (← ofExcept <| field.getObjVal? "type"))]
    return obj [("kind", str "record"), ("name", ← ofExcept <| value.getObjVal? "name"), ("fields", toJson fields)]
  throwError "component copied values require primitives, arrays, records, Option, Except or Prod"

def componentType (value : Json) : MetaM Json := do
  if (value.getObjValAs? String "kind").toOption != some "callback" then
    return ← componentCopiedType value
  unless (value.getObjValAs? String "kind").toOption == some "callback" do
    throwError "components require primitives or synchronous primitive callables"
  let parameters ← ofExcept <| value.getObjValAs? (Array Json) "parameters"
  let result ← ofExcept <| value.getObjVal? "result"
  let scalar (type : Json) : MetaM Json := do
    unless (type.getObjValAs? String "kind").toOption == some "primitive" do
      throwError "component callable arguments and results must be primitive"
    return obj [("kind", str "primitive"), ("name", ← ofExcept <| type.getObjVal? "name")]
  return obj [("kind", str "callback"), ("parameters", toJson (← parameters.mapM scalar)),
    ("result", ← scalar result)]

def describeScalarSignature (request : Request) (type : Expr) : MetaM (Array Json × String × Json) :=
  forallTelescopeReducing type fun arguments result => do
    let mut parameters := #[]
    let mut runtimeParameters := #[]
    let mut problem : Option Json := none
    for argument in arguments do
      let binder ← argument.fvarId!.getDecl
      let text ← expression binder.type
      parameters := parameters.push <| obj [("name", str binder.userName.toString),
        ("binderInfo", str (binderName binder.binderInfo)), ("typeExpression", str text)]
      let reason := if binder.binderInfo == .instImplicit then some "instance-parameter"
        else if binder.binderInfo != .default then some "implicit-parameter"
        else if binder.type.hasFVar then some "dependent-type" else none
      if let some reason := reason then
        if problem.isNone then problem := some (unsupported reason text)
      else
        try
          runtimeParameters := runtimeParameters.push <| obj [("name", str binder.userName.toString),
            ("type", ← scalarType request binder.type)]
        catch _ =>
          if problem.isNone then problem := some (unsupported "unsupported-parameter-type" text)
    let resultText ← expression result
    if result.hasFVar && problem.isNone then problem := some (unsupported "dependent-type" resultText)
    let mut runtimeResult := Json.null
    try runtimeResult ← scalarType request result
    catch _ =>
      if problem.isNone then problem := some (unsupported "unsupported-result-type" resultText)
    if arguments.size > 32 then problem := some (unsupported "arity-limit" resultText)
    return (parameters, resultText, problem.getD <| obj [("status", str "supported"),
      ("bindingShape", str "pure-function"), ("parameters", toJson runtimeParameters),
      ("result", runtimeResult)])

/- Contracts constrain the adapter; they never supply a type or authorize erasure. -/
def contractSiteProblem (site type : Json) (result : Bool) (label : String) : Option String := Id.run do
  if let .ok refinement := site.getObjVal? "refinement" then
    if refinement != str "reject" then
      return some s!"{label}: checked refinement constructors are not implemented by this profile"
  let identity := ["resource", "callback"].contains ((type.getObjValAs? String "kind").toOption.getD "")
  let ownership := if identity then (if result then "lease" else "borrow") else "copy"
  if (site.getObjValAs? String "ownership").toOption != some ownership then
    return some s!"{label}: ownership or lifetime differs from the implemented adapter"
  let lifetime := (site.getObjVal? "lifetime").toOption.getD Json.null
  if identity then
    if (lifetime.getObjValAs? String "scope").toOption != some (if result then "explicit" else "call") ||
        (lifetime.getObjVal? "anchor").toOption != some Json.null then
      return some s!"{label}: ownership or lifetime differs from the implemented adapter"
  else if lifetime != Json.null then
    return some s!"{label}: ownership or lifetime differs from the implemented adapter"
  return none

def contractProblem (contract projection : Json) : Option String := Id.run do
  let parameters := (projection.getObjValAs? (Array Json) "parameters").toOption.getD #[]
  if let .ok effects := contract.getObjValAs? (Array String) "effects" then
    let hasCallback := parameters.any fun parameter =>
      ((parameter.getObjVal? "type" >>= fun type => type.getObjValAs? String "kind").toOption == some "callback")
    let expected := if hasCallback then #["fails", "host-call"] else #[]
    if effects.qsort (· < ·) != expected then
      return some "effects differ from the implemented boundary effects"
  if let .ok sites := contract.getObjValAs? (Array Json) "parameters" then
    if sites.size != parameters.size then
      return some "parameter decisions must cover the exact runtime argument count"
    for index in [:sites.size] do
      let type := (parameters[index]!.getObjVal? "type").toOption.getD Json.null
      if let some problem := contractSiteProblem sites[index]! type false s!"arg{index}" then
        return some problem
  if let .ok site := contract.getObjVal? "result" then
    let type := (projection.getObjVal? "result").toOption.getD Json.null
    if let some problem := contractSiteProblem site type true "result" then return some problem
  return none

def constrainProjection (request : Request) (name : String) (projection : Json) : Json := Id.run do
  if (projection.getObjValAs? String "status").toOption != some "supported" then return projection
  if let some contracts := request.contracts then
    if let .ok contract := contracts.getObjVal? name then
      if let some problem := contractProblem contract projection then
        return unsupported "export-contract-mismatch" problem
  return projection

def describeSignature (request : Request) (name : String) (type : Expr) : MetaM (Array Json × String × Json) := do
  let (parameters, resultText, scalarProjection) ← describeScalarSignature request type
  let native := request.profile.getD "component-scalars-v1" == "native-library-v1"
  let selectedArity := request.arities.find? (·.1 == name) |>.map (·.2)
  if !native && selectedArity.isNone && (scalarProjection.getObjValAs? String "status").toOption == some "supported" then
    return (parameters, resultText, scalarProjection)
  if !native && selectedArity.isNone && (scalarProjection.getObjValAs? String "reason").toOption == some "arity-limit" then
    return (parameters, resultText, scalarProjection)
  let arity := selectedArity.getD (if native then 1024 else 32)
  try
    let (nativeParameters, result) ← signature request type arity
    if !native && nativeParameters.size > 32 then throwError "components support at most 32 arguments"
    let nativeParameters ← if native then pure nativeParameters else nativeParameters.mapM fun (parameter : Json) => do
      pure <| obj [("name", ← ofExcept <| parameter.getObjVal? "name"),
        ("type", ← componentType (← ofExcept <| parameter.getObjVal? "type"))]
    let result ← if native then pure result else componentType result
    let nativeParameters := nativeParameters.mapIdx fun index parameter =>
      obj [("name", (parameters[index]?.bind fun value => (value.getObjVal? "name").toOption).getD (str s!"arg{index}")),
        ("type", (parameter.getObjVal? "type").toOption.getD Json.null)]
    return (parameters, resultText, obj [("status", str "supported"),
      ("bindingShape", str (if native then "native-function" else "pure-function")), ("parameters", toJson nativeParameters), ("result", result)])
  catch error =>
    if !native then return (parameters, resultText, scalarProjection)
    let reason := (scalarProjection.getObjValAs? String "reason").toOption.getD "unsupported-native-type"
    let reason := if ["implicit-parameter", "instance-parameter", "dependent-type"].contains reason then reason else "unsupported-native-type"
    return (parameters, resultText, unsupported reason (← error.toMessageData.toString))

def diagnostic (category code message moduleName : String) (name : Option String) : Json :=
  obj [("category", str category), ("code", str code), ("severity", str "error"),
    ("message", str message), ("module", str moduleName), ("declaration", toJson name)]

def diagnosticKey (value : Json) : String :=
  ["category", "code", "module", "declaration"].foldl (init := "") fun key field =>
    key ++ "|" ++ (value.getObjValAs? String field).toOption.getD ""

/- Apply only a finite leading type prefix, then resolve its instance dictionaries.
   The caller still checks the resulting runtime signature and all used bodies. -/
def specialize (selection : Specialization) : MetaM Expr := do
  let mut value ← mkConstWithFreshMVarLevels selection.declaration.toName
  for typeName in selection.types do
    let .forallE _ domain _ _ ← whnf (← inferType value)
      | throwError "{selection.declaration} has fewer leading type parameters than configured"
    unless (← whnf domain).isSort do
      throwError "{selection.declaration}: configured types must bind leading type parameters"
    let argument ← mkConstWithFreshMVarLevels typeName.toName
    let argumentType ← inferType argument
    unless (← whnf argumentType).isSort && (← isDefEq domain argumentType) do
      throwError "{typeName} is not a closed type accepted by {selection.declaration}"
    value := mkApp value argument
  repeat
    let .forallE _ domain _ .instImplicit ← whnf (← inferType value) | break
    value := mkApp value (← synthInstance domain)
  value ← instantiateMVars value
  if value.hasMVar || value.hasLevelParam || value.hasFVar || value.hasLooseBVars then
    throwError "{selection.declaration} still has unresolved type or universe parameters"
  return value

/- Serialize the checked expression, rather than resolving pretty-printed names
   again in an adapter namespace. Every constant has an absolute Lean name. -/
partial def applicationSource (value : Expr) (variables : Array String := #[])
    (depth : Nat := 0) : MetaM String := do
  if depth > 128 then throwError "specialization application exceeds the expression nesting limit"
  let render := fun e => applicationSource e variables (depth + 1)
  match value with
  | .const name levels =>
    if isPrivateName name || name.hasMacroScopes then
      throwError "specialization requires a public named dictionary or a monomorphic wrapper: {name}"
    let identifier ← PrettyPrinter.ppTerm ⟨mkIdent (rootNamespace ++ name)⟩
    let levels ← levels.mapM fun level => return (← PrettyPrinter.ppLevel level).pretty
    return "@" ++ identifier.pretty ++ (if levels.isEmpty then "" else ".{" ++ String.intercalate ", " levels ++ "}")
  | .app .. =>
    let fn := value.getAppFn
    if !fn.isConst && !fn.isBVar then
      let reduced ← whnf value
      if reduced != value then return ← render reduced
      throwError "specialization requires a named function application or a monomorphic wrapper"
    let head ← render fn
    let arguments ← value.getAppArgs.mapM fun arg => return "(" ++ (← render arg) ++ ")"
    return "(" ++ (if fn.isBVar then "@" else "") ++ head ++ " " ++ String.intercalate " " arguments.toList ++ ")"
  | .mdata _ body => render body
  | .bvar index =>
    if index < variables.size then return variables[variables.size - 1 - index]!
    throwError "specialization application contains an unbound variable"
  | .sort level => return s!"(Sort {(← PrettyPrinter.ppLevel level).pretty})"
  | .lit (.natVal value) => return s!"({value} : _root_.Nat)"
  | .lit (.strVal value) => return (← PrettyPrinter.ppTerm ⟨Syntax.mkStrLit value⟩).pretty
  | .lam _ type body binder | .forallE _ type body binder =>
    let name := s!"_bridgeSpecial{variables.size}"
    let declaration := s!"{name} : {← render type}"
    let binding := match binder with
      | .default => "(" ++ declaration ++ ")"
      | .implicit => "{" ++ declaration ++ "}"
      | .strictImplicit => "⦃" ++ declaration ++ "⦄"
      | .instImplicit => "[" ++ declaration ++ "]"
    let body ← applicationSource body (variables.push name) (depth + 1)
    return if value.isLambda then s!"(fun {binding} => {body})" else s!"(∀ {binding}, {body})"
  | .letE _ type assigned body _ =>
    let name := s!"_bridgeSpecial{variables.size}"
    return s!"(let {name} : {← render type} := {← render assigned}; {← applicationSource body (variables.push name) (depth + 1)})"
  | _ => throwError "specialization application requires a monomorphic wrapper for this expression: {value}"

def checkedApplicationSource (value : Expr) : MetaM String := do
  let source ← applicationSource value
  let parsed ← ofExcept <| Parser.runParserCategory (← getEnv) `term source
  let reconstructed ← Elab.Term.TermElabM.run' <| Elab.Term.withoutErrToSorry do
    let term ← Elab.Term.elabTermEnsuringType parsed (← inferType value)
    Elab.Term.synthesizeSyntheticMVarsNoPostponing
    instantiateMVars term
  unless !reconstructed.hasMVar && (← isDefEq value reconstructed) do
    throwError "serialized specialization differs from its compiler application"
  return source

def extractSpecialization (request : Request) (source : Json) (selection : Specialization) : MetaM Json := do
  let mut result := source.setObjVal! "identity" (str selection.name) |>.setObjVal! "selected" (toJson true)
  let mut application := Json.null
  try
    unless (source.getObjValAs? String "visibility").toOption == some "public" &&
        (source.getObjValAs? String "kind").toOption != some "theorem" do
      throwError "specializations require a public executable source declaration"
    let value ← specialize selection
    for name in value.getUsedConstants do
      let _ ← checkBody request name
      if (← collectAxioms name).contains ``sorryAx then
        throwError "specialization depends on sorry: {name}"
    let type ← inferType value
    let (parameters, resultText, projection) ← describeSignature request selection.name type
    let effects ← effectNames type
    let typeText ← expression type
    let projection := constrainProjection request selection.name <|
      if effects.isEmpty then projection else unsupported "unsupported-effect" typeText
    result := result.setObjVal! "typeExpression" (str typeText)
      |>.setObjVal! "parameters" (toJson parameters) |>.setObjVal! "resultExpression" (str resultText)
      |>.setObjVal! "effects" (toJson effects) |>.setObjVal! "projection" projection
    application := str (← checkedApplicationSource value)
  catch error =>
    result := result.setObjVal! "projection" (unsupported "invalid-specialization" (← error.toMessageData.toString))
  return result.setObjVal! "specialization" (obj [("declaration", str selection.declaration),
    ("types", toJson selection.types), ("application", application)])

/- Rehydrate only Lean's built-in class/instance indexes. Importing arbitrary
   extension initializers would execute package code during analysis. -/
def loadBuiltinIndex {α β σ : Type} [Inhabited σ]
    (extension : PersistentEnvExtension α β σ) (env : Environment) : IO Environment := do
  let entries := (extension.toEnvExtension.getState env).importedEntries
  let state ← extension.addImportedFn entries { env := env, opts := {} }
  return extension.setState env state

def extractMetadata (request : Request) : MetaM Json := do
  let some context := request.metadata | throwError "metadata context is required"
  let profile := request.profile.getD "component-scalars-v1"
  unless ["component-scalars-v1", "native-library-v1"].contains profile do
    throwError "unsupported metadata profile"
  let env ← getEnv
  let specializations := request.specializations.getD #[]
  for selection in specializations do
    if env.contains selection.name.toName then
      throwError "specialization name already exists: {selection.name}"
  let selectedModules := request.exportModules.getD request.modules
  if selectedModules.isEmpty || selectedModules.any (!request.modules.contains ·) ||
      context.modules.map (·.name) != request.modules then
    throwError "metadata modules differ from the compiled closure"
  let mut declarations : Array (Name × ConstantInfo) := #[]
  let mut theorems : Array (Name × Expr) := #[]
  for (name, info) in env.constants.toList do
    if let some index := env.getModuleIdxFor? name then
      let moduleName := env.header.moduleNames[index.toNat]!.toString
      if request.modules.contains moduleName then
        if info matches .thmInfo _ then theorems := theorems.push (name, info.type)
        if selectedModules.contains moduleName && (info matches .defnInfo _ | .opaqueInfo _ | .thmInfo _) then
          if (← getProjectionFnInfo? name).isNone && !isAuxRecursor env name && !isNoConfusion env name &&
              (isPrivateName name || !(← isAutoDeclOrPrivate_Internal name)) then
            declarations := declarations.push (name, info)
  declarations := declarations.qsort (fun a b => a.1.toString < b.1.toString)
  let mut modules := #[]
  let mut diagnostics := #[]
  let mut discovered := #[]
  for source in context.modules do
    let some moduleIndex := env.getModuleIdx? source.name.toName | throwError "missing metadata module {source.name}"
    let mut items := #[]
    for (name, info) in declarations do
      if env.getModuleIdxFor? name == some moduleIndex then
        let kind := match info with
          | .thmInfo _ => "theorem"
          | .opaqueInfo _ => "opaque"
          | .defnInfo definition => if definition.hints matches .abbrev then "abbreviation" else "definition"
          | _ => "definition"
        let visibility := if isPrivateName name then "private" else if isProtected env name then "protected" else "public"
        let typeValue ← forallTelescopeReducing info.type fun _ result => pure result.isSort
        let proofValue ← forallTelescopeReducing info.type fun _ result => isProp result
        let selected := if request.exports.isEmpty then visibility == "public" && kind != "theorem" && !typeValue && !proofValue &&
            !specializations.any (·.declaration == name.toString)
          else request.exports.contains name.toString
        if selected then discovered := discovered.push name.toString
        let typeText ← expression info.type
        let (parameters, resultText, runtimeProjection) ← describeSignature request name.toString info.type
        let effects ← effectNames info.type
        let mut projection := runtimeProjection
        if !info.levelParams.isEmpty then projection := unsupported "specialization-required" typeText
        if !effects.isEmpty then projection := unsupported "unsupported-effect" typeText
        if typeValue then projection := unsupported "type-declaration" typeText
        if proofValue || kind == "theorem" then projection := unsupported "proof-only" typeText
        if visibility != "public" then projection := unsupported "visibility" typeText
        if selected then
          try
            let _ ← checkBody request name
            if (← collectAxioms name).contains ``sorryAx then
              projection := unsupported "admitted-implementation" typeText
          catch error => projection := unsupported "unreviewed-implementation" (← error.toMessageData.toString)
        if selected then projection := constrainProjection request name.toString projection
        let ranges ← findDeclarationRanges? name
        let position := ranges.map fun ranges => obj [("path", str source.sourcePath),
          ("startLine", toJson ranges.range.pos.line), ("startColumn", toJson ranges.range.charUtf16),
          ("endLine", toJson ranges.range.endPos.line), ("endColumn", toJson ranges.range.endCharUtf16)]
        if selected && position.isNone then
          diagnostics := diagnostics.push <| diagnostic "extractor-failure" "missing-source-position"
            s!"Lean supplied no source range for {name}" source.name (some name.toString)
        if selected && (projection.getObjValAs? String "status").toOption == some "unsupported" then
          let reason ← ofExcept <| projection.getObjValAs? String "reason"
          let explanation := if reason == "export-contract-mismatch" then
              (projection.getObjValAs? String "expression").toOption.getD reason else reason
          diagnostics := diagnostics.push <| diagnostic "unsupported-meaning" reason
            s!"{name}: {explanation}" source.name (some name.toString)
        let references := theorems.filter (fun item => item.2.getUsedConstants.contains name)
          |>.map (·.1.toString) |>.qsort (· < ·)
        let documentation ← findDocString? env name
        items := items.push <| obj [("identity", str name.toString), ("kind", str kind),
          ("visibility", str visibility), ("selected", toJson selected), ("source", position.getD Json.null),
          ("documentation", toJson documentation), ("typeExpression", str typeText),
          ("parameters", toJson parameters), ("resultExpression", str resultText),
          ("effects", toJson effects), ("theoremReferences", toJson references), ("projection", projection)]
    let originals := items
    for selection in specializations do
      if let some original := originals.find? (fun item => (item.getObjValAs? String "identity").toOption == some selection.declaration) then
        let item ← extractSpecialization request original selection
        items := items.push item
        discovered := discovered.push selection.name
        let projection ← ofExcept <| item.getObjVal? "projection"
        if (projection.getObjValAs? String "status").toOption == some "unsupported" then
          let reason ← ofExcept <| projection.getObjValAs? String "reason"
          let message ← ofExcept <| projection.getObjValAs? String "expression"
          diagnostics := diagnostics.push <| diagnostic "unsupported-meaning" reason
            s!"{selection.name}: {message}" source.name (some selection.name)
        if (item.getObjVal? "source").toOption == some Json.null then
          diagnostics := diagnostics.push <| diagnostic "extractor-failure" "missing-source-position"
            s!"Lean supplied no source range for {selection.declaration}" source.name (some selection.name)
    let imports := env.header.moduleData[moduleIndex.toNat]!.imports.map (·.module.toString)
      |>.toList |>.mergeSort (· < ·) |>.eraseDups |>.toArray
    modules := modules.push <| obj [("name", str source.name), ("sourcePath", str source.sourcePath),
      ("sourceSha256", str source.sourceSha256), ("interfaceSha256", str source.interfaceSha256),
      ("directImports", toJson imports), ("declarations", toJson (items.qsort fun a b =>
        (a.getObjValAs? String "identity").toOption.getD "" < (b.getObjValAs? String "identity").toOption.getD ""))]
  for name in (request.exports ++ specializations.map (·.name)).toList.eraseDups do
    if !discovered.contains name then
      diagnostics := diagnostics.push <| diagnostic "unsupported-meaning" "missing-declaration"
        s!"Selected export is absent or outside selected modules: {name}" "" (some name)
  if let some contracts := request.contracts then
    for (name, _) in (← ofExcept contracts.getObj?).toArray do
      if !discovered.contains name then
        diagnostics := diagnostics.push <| diagnostic "unsupported-meaning" "unused-export-contract"
          s!"Contract must name a selected public export: {name}" "" (some name)
  return obj [("schemaVersion", toJson (2 : Nat)), ("kind", str "lean-bridge-elaborated-exports"),
    ("profile", str profile),
    ("producer", obj [("adapter", str "lean-bridge-elaborator"), ("adapterVersion", toJson (2 : Nat)),
      ("tool", str "Lean"), ("toolVersion", str Lean.versionString), ("toolchain", str context.toolchain),
      ("invocationIdentitySha256", str context.invocationIdentitySha256)]),
    ("modules", toJson (modules.qsort fun a b => (a.getObjValAs? String "name").toOption.getD "" < (b.getObjValAs? String "name").toOption.getD "")),
    ("diagnostics", toJson (diagnostics.qsort fun a b => diagnosticKey a < diagnosticKey b))]

end LeanBridge.NativeExports

unsafe def main (args : List String) : IO UInt32 := do
  let (path, safetyOnly) ← match args with
    | ["--check-bodies", path] => pure (path, true)
    | ["--metadata", path] => pure (path, false)
    | _ => throw (IO.userError "expected --metadata or --check-bodies and an export request JSON path")
  let json ← IO.ofExcept <| Json.parse (← IO.FS.readFile path)
  let request ← IO.ofExcept <| fromJson? (α := LeanBridge.NativeExports.Request) json
  initSearchPath (← findSysroot)
  let mut env ← importModules (request.modules.map fun name => { module := name.toName }) {} 0
  if !(request.specializations.getD #[]).isEmpty then
    env ← LeanBridge.NativeExports.loadBuiltinIndex classExtension env
    env ← LeanBridge.NativeExports.loadBuiltinIndex instanceExtension.ext env
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
    else LeanBridge.NativeExports.extractMetadata request
  let (metadata, _, _) ← operation.toIO
    { fileName := "<native-exports>", fileMap := default } { env }
  IO.println metadata.compress
  return 0
