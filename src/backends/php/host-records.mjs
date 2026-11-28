/** @file Present compiler-inspected PHP records as closable application objects. */
import {phpClassName, phpFieldName, reservedPhpNames} from "./copied-names.mjs";

/**
 * Use the public V4 definitions for field names; private sites remain the
 * declared class index or scalar checked by the existing HostFrame.
 *
 * @param api - Reconciled public interface.
 * @param site - Private codec identifier for a flat leaf.
 * @param hint - Public scalar or host-object type for a leaf.
 * @param names - Generated class names already occupied, case insensitive.
 * @param fail - Surface diagnostic.
 */
export const phpHostRecords = (api, site, hint, names, fail) => {
	const records = new Map();
	for(const type of api.types.filter(t => t.kind === "record"))
	{
		const name = phpClassName(type.name), key = name.toLowerCase();
		if(!/^[A-Za-z][A-Za-z0-9_]*$/u.test(name) || reservedPhpNames.has(key) || names.has(key)) fail("colliding record class " + name);
		names.add(key);
		const fields = type.fields.map(f => ({name: phpFieldName(f.name, fail), site: site(f.type)}));
		if(!fields.length || fields.length > 64 || !fields.some(f => Number.isInteger(f.site))) fail("invalid native record fields");
		const args = fields.map(f => "$" + f.name), indices = fields.map((f, i) => JSON.stringify(f.name) + "=>" + i).join(",");
		records.set(type.source.declaration, {name, fields
			, php: `/**
${fields.map(f => " * @property-read " + hint(f.site) + " $" + f.name).join("\n")}
 */
final class ${name} {
    private ?array $slots;
    private readonly bool $initialized;
    private const FIELDS=[${indices}];
    public function __construct(${args.map(a => "mixed " + a).join(", ")}) {
        if (func_num_args()!==${fields.length}) throw new \\ArgumentCountError('Wrong host record field count');
        if (isset($this->initialized)) throw new \\LogicException('Cannot reconstruct a host record');
        $this->initialized=true;
        $this->slots=[${args.join(", ")}];
    }
    public function __get(string $field): mixed {
        if (!array_key_exists($field,self::FIELDS)) throw new \\OutOfBoundsException('Unknown host record field: '.$field);
        if ($this->slots===null) throw new \\LogicException('Host record is closed');
        return $this->slots[self::FIELDS[$field]];
    }
    public function __isset(string $field): bool { return isset(self::FIELDS[$field]) && isset($this->slots[self::FIELDS[$field]]); }
    public function __set(string $field,mixed $value): void { throw new \\LogicException('Host record fields are immutable'); }
    public function __unset(string $field): void { throw new \\LogicException('Host record fields are immutable'); }
    public function close(): void { $this->slots=null; }
    public function __serialize(): array { throw new \\LogicException('Cannot serialize a host record'); }
    public function __unserialize(array $data): void { throw new \\LogicException('Cannot restore a host record'); }
}`});
	}
	return records;
};

/**
 * Keep the existing shared native reference domain unchanged: only packages
 * exporting records gain this component-private result reader.
 *
 * @param template - Generated per-package HostFrame containing the public namespace.
 */
export const phpRecordReader = template => {
	const anchor = "        if (!is_array($site)) return $this->read($site,$words,$data,0);";
	if(template.split(anchor).length !== 2) throw new Error("PHP host record result reader is not aligned with HostFrame");
	return template.replace(anchor, () => anchor + `
        if (isset($site['record'])) {
            $fields=$site['fields']; $n=count($fields);
            if ($n<1 || $n>64 || $data[3]!==3 || $data[1]!==$n || $data[2]!==0 || !$data[0] || ($data[0]&7))
                throw new \\UnexpectedValueException('Invalid native host record result');
            $lanes=$this->ffi->cast('uint64_t*',$data[0]); $values=[];
            foreach ($fields as $i=>$leaf) {
                $kind=match ($leaf) { 'bytes','string'=>1, 'int','nat'=>2, default=>0 };
                if ($lanes[4*$i+3]!==$kind) throw new \\UnexpectedValueException('Invalid native record field storage');
                $values[]=$this->read($leaf,$words,$lanes,4*$i);
            }
            $class=$site['record']; return new $class(...$values);
        }`);
};
