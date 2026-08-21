export type PostProcessorId='grbl'|'estlcam'|'linuxcnc';

export interface PostProcessResult{
  ok:boolean;
  code:string;
  errors:string[];
  warnings:string[];
  removedLines:number;
  transformedLines:number;
}

const isComment=(line:string)=>line.startsWith('(')&&line.endsWith(')');

function normalizeMotion(line:string):string|null{
  const trimmed=line.trim();
  const m=trimmed.match(/^(G0?0|G0?1|G0?2|G0?3)\b(.*)$/i);
  if(!m)return null;
  const code=m[1].toUpperCase().replace(/^G0([0-3])$/,'G$1');
  return `${code}${m[2]}`.trim();
}

/**
 * GRBL reference output.
 *
 * The verified BeBlog CAM generator already emits a GRBL-compatible subset:
 * G21, G90, G17, G0/G1/G2/G3, S/M3, M5, M0 and M30. The postprocessor therefore
 * preserves the proven source program and only gives that dialect an explicit
 * controller identity instead of treating it as an unnamed generic output.
 */
export function postProcessGrbl(source:string):PostProcessResult{
  return{ok:true,code:source,errors:[],warnings:[],removedLines:0,transformedLines:0};
}

/**
 * Estlcam controller dialect according to the official CNC-program requirements:
 * - only G0/G1/G2/G3 motions
 * - absolute XYZ coordinates (BeBlog CAM already emits absolute coordinates)
 * - arcs in XY with relative I/J (BeBlog CAM already emits relative I/J)
 * - no full circles (BeBlog CAM splits circles into semicircles)
 * - no canned cycles / coordinate-system changes
 * - M0/M1/M3/M5/M6/M8/M9/M10/M11 supported
 * - comments in parentheses
 *
 * The postprocessor intentionally stays conservative and does not reinterpret
 * geometry. It only removes unsupported modal setup/end codes and normalizes
 * supported commands into an Estlcam-safe line structure.
 */
export function postProcessEstlcam(source:string):PostProcessResult{
  const errors:string[]=[],warnings:string[]=[],out:string[]=[];
  let removedLines=0,transformedLines=0;
  const lines=source.split(/\r?\n/);

  for(const raw of lines){
    const line=raw.trim();
    if(!line)continue;
    if(isComment(line)){out.push(line);continue;}

    if(/^(G17|G20|G21|G40|G49|G54|G55|G56|G57|G58|G59|G80|G90|G91)\b/i.test(line)){
      if(/^G91\b/i.test(line))errors.push('Inkrementelle Koordinaten (G91) sind für Estlcam nicht zulässig.');
      if(/^G20\b/i.test(line))errors.push('Zollmodus (G20) ist für den BeBlog-Estlcam-Postprozessor nicht freigegeben.');
      removedLines++;continue;
    }
    if(/^M30\b/i.test(line)){removedLines++;continue;}

    const motion=normalizeMotion(line);
    if(motion){out.push(motion);if(motion!==line)transformedLines++;continue;}

    let m=line.match(/^S([^\s]+)\s+M0?3$/i);
    if(m){out.push(`S${m[1]}`,'M3');transformedLines++;continue;}

    if(/^S[-+]?\d+(?:[.,]\d+)?$/i.test(line)){out.push(line.toUpperCase());continue;}
    if(/^F[-+]?\d+(?:[.,]\d+)?$/i.test(line)){out.push(line.toUpperCase());continue;}

    m=line.match(/^M0?(0|1|3|5|6|8|9|10|11)(?:\s+(.*))?$/i);
    if(m){const n=Number(m[1]);const normalized=`M${n}${m[2]?` ${m[2]}`:''}`;out.push(normalized);if(normalized!==line)transformedLines++;continue;}

    m=line.match(/^M0?0\s+(\(.*\))$/i);
    if(m){out.push(`M0 ${m[1]}`);if(line!==`M0 ${m[1]}`)transformedLines++;continue;}

    if(/^[GMT]\d+/i.test(line))errors.push(`Nicht unterstützter Estlcam-Befehl: ${line}`);
    else warnings.push(`Unbekannte Zeile wurde unverändert übernommen: ${line}`);
    if(!/^[GMT]\d+/i.test(line))out.push(line);
  }

  if(out[out.length-1]?.trim()!=='M5')out.push('M5');
  const code=out.join('\n')+'\n';
  return{ok:errors.length===0,code,errors,warnings,removedLines,transformedLines};
}

/**
 * LinuxCNC reference output.
 *
 * LinuxCNC explicitly supports the modal preamble used by BeBlog CAM (G17, G21,
 * G90), G0/G1/G2/G3 motion with I/J arcs, spindle control M3/M5, program pause M0
 * and program end M30. The postprocessor therefore keeps the proven geometry and
 * makes the controller contract explicit while validating that no unexpected
 * controller-specific command slips through unnoticed.
 */
export function postProcessLinuxCnc(source:string):PostProcessResult{
  const errors:string[]=[],warnings:string[]=[],out:string[]=[];
  let removedLines=0,transformedLines=0;
  const lines=source.split(/\r?\n/);

  for(const raw of lines){
    const line=raw.trim();
    if(!line)continue;
    if(isComment(line)){out.push(line);continue;}

    const motion=normalizeMotion(line);
    if(motion){out.push(motion);if(motion!==line)transformedLines++;continue;}

    if(/^(G17|G21|G40|G49|G80|G90|G94)\b/i.test(line)){out.push(line.toUpperCase());continue;}
    if(/^G20\b/i.test(line)){errors.push('Zollmodus G20 ist für den BeBlog-LinuxCNC-Postprozessor nicht freigegeben.');continue;}
    if(/^G91\b/i.test(line)){errors.push('Inkrementelle Koordinaten G91 sind für den BeBlog-LinuxCNC-Postprozessor nicht freigegeben.');continue;}

    let m=line.match(/^S([^\s]+)\s+M0?3$/i);
    if(m){out.push(`S${m[1]} M3`);if(line!==`S${m[1]} M3`)transformedLines++;continue;}
    if(/^S[-+]?\d+(?:[.,]\d+)?$/i.test(line)){out.push(line.toUpperCase());continue;}
    if(/^F[-+]?\d+(?:[.,]\d+)?$/i.test(line)){out.push(line.toUpperCase());continue;}

    m=line.match(/^M0?(0|1|2|3|4|5|7|8|9|30)(?:\s+(.*))?$/i);
    if(m){const n=Number(m[1]);const normalized=`M${n}${m[2]?` ${m[2]}`:''}`;out.push(normalized);if(normalized!==line)transformedLines++;continue;}

    if(/^[GMT]\d+/i.test(line))errors.push(`Nicht unterstützter LinuxCNC-Befehl im aktuellen Gate: ${line}`);
    else{warnings.push(`Unbekannte Zeile wurde unverändert übernommen: ${line}`);out.push(line);}
  }

  const code=out.join('\n')+'\n';
  return{ok:errors.length===0,code,errors,warnings,removedLines,transformedLines};
}

export function postProcessGcode(source:string,id:PostProcessorId):PostProcessResult{
  if(id==='estlcam')return postProcessEstlcam(source);
  if(id==='linuxcnc')return postProcessLinuxCnc(source);
  return postProcessGrbl(source);
}
