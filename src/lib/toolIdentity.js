/**
 * Physical tool identity used for job-order tool-change decisions.
 *
 * ID is the strongest library identity. Kind and diameter remain part of the
 * key as defensive metadata so an inconsistent library record cannot silently
 * suppress a required tool change.
 *
 * @param {{tool:{id?:string|null,name?:string|null,kind?:string|null,diameterMm:number}}} operation
 */
export function toolIdentityKey(operation){
  const tool=operation.tool;
  const id=(tool.id??'').trim()||'(no-id)';
  const name=(tool.name??'').trim()||'(unnamed)';
  const kind=tool.kind??'(unknown-kind)';
  const diameter=Number.isFinite(tool.diameterMm)?tool.diameterMm.toFixed(6):'NaN';
  return `${id}|${kind}|${diameter}|${name}`;
}

/**
 * @param {{tool:{id?:string|null,name?:string|null,kind?:string|null,diameterMm:number}}} a
 * @param {{tool:{id?:string|null,name?:string|null,kind?:string|null,diameterMm:number}}} b
 */
export function samePhysicalTool(a,b){
  return toolIdentityKey(a)===toolIdentityKey(b);
}
