namespace NativeFin

/-- A transparent alias keeps the exact bound. -/
abbrev Small := Fin 300

/-- 2^70: wider than any C machine word. -/
abbrev Huge := Fin 1180591620717411303424

/-- Fin 0 is uninhabited, so every native input is rejected. -/
def impossible (value : Fin 0) : Nat := value.val

def only (value : Fin 1) : Nat := value.val + 7

def mirror (value : Fin 10) : Fin 10 := ⟨9 - value.val, by omega⟩

def twice (value : Small) : Nat := value.val * 2

def succHuge (value : Huge) : Huge :=
  if h : value.val + 1 < 1180591620717411303424 then ⟨value.val + 1, h⟩ else value

def wrap (value : Nat) : Fin 7 := ⟨value % 7, Nat.mod_lt _ (by decide)⟩

def label (base : Nat) (offset : Fin 4) (name : String) : String :=
  s!"{name}:{base + offset.val}"

end NativeFin
