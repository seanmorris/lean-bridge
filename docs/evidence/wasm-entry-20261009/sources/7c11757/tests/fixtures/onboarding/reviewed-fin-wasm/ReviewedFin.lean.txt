namespace ReviewedFin

abbrev Digit := Fin 10
abbrev Wide := Fin 184467440737095516170

def mirror (value : Digit) : Digit := ⟨9 - value.val, by omega⟩
def never (value : Fin 0) : Nat := value.elim0
def only (value : Fin 1) : Nat := value.val + 7
def huge (value : Wide) : Wide := value
def tenth (value : Nat) : Digit := ⟨value % 10, Nat.mod_lt _ (by decide)⟩
def label (before : String) (digit : Digit) (after : String) : String :=
  before ++ toString digit.val ++ after

def rows (values : Array (Array Digit)) : Array (Array Digit) := values.reverse
def empty (values : Array (Fin 0)) : Array (Fin 0) := values
def nested (values : List (Option (Fin 3 × Except (Fin 2) (Fin 5)))) :
    List (Option (Fin 3 × Except (Fin 2) (Fin 5))) := values.reverse

end ReviewedFin
