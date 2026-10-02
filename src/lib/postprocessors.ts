export type PostProcessorId='grbl'|'grblhal'|'estlcam'|'linuxcnc';

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
 * grblHAL v1 compatibility profile.
 *
 * Deliberately stays inside BeBlog's proven GRBL motion subset. The only modal
 * addition is G91.1 so I/J/K arc-centre offsets are explicit. Manual tool-change
 * M0 is preserved because ToolDefinition has no machine tool number; inventing
 * Tn values would risk selecting the wrong grblHAL tool-table entry or offset.
 *
 * Geometry is never reconstructed. Arc/helix records are validated fail-closed
 * before the already-approved I/J motion line is preserved verbatim.
 */
export function postProcessGrblHal(source:string):PostProcessResult{
  const errors:string[]=[],warnings:string[]=[],out:string[]=[];
  let transformedLines=0,x:number|null=null,y:number|null=null,arcModeInserted=false;
  const word=(line:string,letter:string):number|null=>{
    const m=line.match(new RegExp(String.raw`(?:^|\s)${letter}([-+]?\d+(?:\.\d+)?)`,'i'));
    return m?Number(m[1]):null;
  };
  const setEnd=(line:string)=>{
    const nx=word(line,'X'),ny=word(line,'Y');
    if(nx!==null)x=nx;if(ny!==null)y=ny;
  };

  for(const raw of source.split(/\r?\n/)){
    const line=raw.trim();
    if(!line)continue;
    if(isComment(line)){out.push(line);continue;}

    if(/^G20\b/i.test(line)){errors.push('Zollmodus G20 ist für den BeBlog-grblHAL-Postprozessor nicht freigegeben.');continue;}
    if(/^G91\b/i.test(line)&&!/^G91\.1\b/i.test(line)){errors.push('Inkrementelle XYZ-Koordinaten G91 sind für den BeBlog-grblHAL-Postprozessor nicht freigegeben.');continue;}
    if(/^G90\.1\b/i.test(line)){errors.push('Absolute Arc-Center G90.1 sind für den BeBlog-grblHAL-Postprozessor nicht freigegeben; BeBlog verwendet inkrementelle I/J-Offsets.');continue;}
    if(/^G91\.1\b/i.test(line)){if(!arcModeInserted){out.push('G91.1');arcModeInserted=true;}continue;}

    if(/^G17\b/i.test(line)){
      out.push('G17');
      if(!arcModeInserted){out.push('G91.1');arcModeInserted=true;transformedLines++;}
      continue;
    }
    if(/^(G21|G40|G49|G80|G90|G94)\b/i.test(line)){out.push(line.toUpperCase());continue;}

    const motion=normalizeMotion(line);
    if(motion){
      if(/^G[23]\b/i.test(motion)){
        if(/\bR[-+]?\d/i.test(motion)){errors.push(`grblHAL v1 akzeptiert keine R-Arcs; I/J sind erforderlich: ${line}`);continue;}
        if(/\bP[-+]?\d/i.test(motion)){errors.push(`grblHAL v1 akzeptiert keine Multi-Turn-Arcs: ${line}`);continue;}
        const ex=word(motion,'X'),ey=word(motion,'Y'),i=word(motion,'I'),j=word(motion,'J');
        if(x===null||y===null||ex===null||ey===null||i===null||j===null){
          errors.push(`grblHAL Arc benötigt bekannten XY-Start sowie X/Y/I/J: ${line}`);continue;
        }
        if(![ex,ey,i,j].every(Number.isFinite)){errors.push(`grblHAL Arc enthält nicht-endliche Koordinaten: ${line}`);continue;}
        const radius=Math.hypot(i,j);
        if(!(radius>=0.001)){errors.push(`grblHAL Arc besitzt einen degenerierten Kreismittelpunkt: ${line}`);continue;}
        const endRadius=Math.hypot(ex-(x+i),ey-(y+j));
        if(Math.abs(endRadius-radius)>0.003){
          errors.push(`grblHAL Arc-Radien stimmen nicht überein (Start ${radius.toFixed(6)} mm, Ende ${endRadius.toFixed(6)} mm): ${line}`);continue;
        }
      }
      out.push(motion);if(motion!==line)transformedLines++;setEnd(motion);continue;
    }

    if(/^S[-+]?\d+(?:[.,]\d+)?(?:\s+M0?3)?$/i.test(line)||/^M0?3(?:\s+S[-+]?\d+(?:[.,]\d+)?)?$/i.test(line)||/^F[-+]?\d+(?:[.,]\d+)?$/i.test(line)){out.push(line.toUpperCase().replace(/M03\b/g,'M3'));continue;}
    if(/^M0?(0|1|5|8|9|30)(?:\s+(.*))?$/i.test(line)){out.push(line.replace(/^M0?(\d+)/i,(_,n)=>`M${Number(n)}`));continue;}

    if(/^T\d+\b/i.test(line)||/^M0?6\b/i.test(line)||/^G43(?:\.1|\.2)?\b/i.test(line)){
      errors.push(`grblHAL v1 übernimmt keine Werkzeugtabellen-/Längenkorrektur-Befehle: ${line}`);continue;
    }
    if(/^[GMT]\d+/i.test(line))errors.push(`Nicht unterstützter grblHAL-v1-Befehl: ${line}`);
    else{warnings.push(`Unbekannte Zeile wurde unverändert übernommen: ${line}`);out.push(line);}
  }

  if(!arcModeInserted){const insert=Math.max(0,out.findIndex(line=>/^G90\b/i.test(line))+1);out.splice(insert,0,'G91.1');transformedLines++;}
  const code=out.join('\n')+'\n';
  return{ok:errors.length===0,code,errors,warnings,removedLines:0,transformedLines};
}

/**
 * Estlcam controller dialect.
 *
 * Contract:
 * - only G0/G1/G2/G3 reach the controller
 * - XYZ remain absolute and arcs remain XY/IJ as produced by BeBlog CAM
 * - modal setup/end G-codes are removed because Estlcam ignores unsupported G-codes
 * - one M-command per line
 * - spindle speed and M3 are split into separate lines
 * - BeBlog's controller-neutral manual tool-change marker is translated to M6
 * - M6 is emitted without T or other parameters
 * - no canned cycles or coordinate-system changes are introduced
 *
 * Geometry and machine motions are never reconstructed here. The postprocessor
 * only translates controller syntax around the already approved NC motion truth.
 */
export function postProcessEstlcam(source:string):PostProcessResult{
  const errors:string[]=[],warnings:string[]=[],out:string[]=[];
  let removedLines=0,transformedLines=0,pendingToolChange=false;
  const lines=source.split(/\r?\n/);

  for(const raw of lines){
    const line=raw.trim();
    if(!line)continue;

    if(isComment(line)){
      out.push(line);
      if(/^\(\s*Werkzeugwechsel\b/i.test(line))pendingToolChange=true;
      continue;
    }

    if(pendingToolChange){
      const manual=line.match(/^M0?0(?:\s+(\(.*\)))?$/i);
      if(manual){
        if(manual[1])out.push(manual[1]);
        out.push('M6');
        transformedLines++;
        pendingToolChange=false;
        continue;
      }
      errors.push(`Estlcam-Werkzeugwechselmarker ohne folgende manuelle M0-Pause: ${line}`);
      pendingToolChange=false;
    }

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
    m=line.match(/^M0?3\s+S([^\s]+)$/i);
    if(m){out.push(`S${m[1]}`,'M3');transformedLines++;continue;}

    if(/^S[-+]?\d+(?:[.,]\d+)?$/i.test(line)){out.push(line.toUpperCase());continue;}
    if(/^F[-+]?\d+(?:[.,]\d+)?$/i.test(line)){out.push(line.toUpperCase());continue;}

    if(/^M0?6\b/i.test(line)){
      if(!/^M0?6$/i.test(line)){
        errors.push(`Estlcam M6 wird ohne T- oder Zusatzparameter ausgegeben: ${line}`);
        continue;
      }
      const normalized='M6';out.push(normalized);if(normalized!==line)transformedLines++;continue;
    }

    m=line.match(/^M0?(0|1|3|5|8|9|10|11)(?:\s+(.*))?$/i);
    if(m){const n=Number(m[1]);const normalized=`M${n}${m[2]?` ${m[2]}`:''}`;out.push(normalized);if(normalized!==line)transformedLines++;continue;}

    if(/^[GMT]\d+/i.test(line))errors.push(`Nicht unterstützter Estlcam-Befehl: ${line}`);
    else warnings.push(`Unbekannte Zeile wurde unverändert übernommen: ${line}`);
    if(!/^[GMT]\d+/i.test(line))out.push(line);
  }

  if(pendingToolChange)errors.push('Estlcam-Werkzeugwechselmarker am Programmende ohne folgende M0-Pause.');
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
  if(id==='grblhal')return postProcessGrblHal(source);
  if(id==='estlcam')return postProcessEstlcam(source);
  if(id==='linuxcnc')return postProcessLinuxCnc(source);
  return postProcessGrbl(source);
}
