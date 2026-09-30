import type { TrochoidalContourContract } from './trochoidalContourContract';

export type TrochoidalSpoilboardClearance=
  |{ok:true;requiredMm:number;availableMm:number;remainingMm:number}
  |{ok:false;errors:string[]};

export function validateTrochoidalSpoilboardClearance(operation:TrochoidalContourContract,spoilboardThicknessMm:number|undefined):TrochoidalSpoilboardClearance{
  const errors:string[]=[],available=spoilboardThicknessMm??0;
  if(!Number.isFinite(available)||available<0)errors.push('Opferplattenstärke muss eine endliche, nicht negative Zahl sein.');
  const required=(operation.depthMode??'manual')==='stock-bottom'?(operation.overcutMm??0):0;
  if(required>0&&available<=0)errors.push('Durchfräsen mit Overcut benötigt eine definierte Opferplatte.');
  if(required>available+1e-9)errors.push(`Overcut ${required.toFixed(3)} mm überschreitet die verfügbare Opferplatte ${available.toFixed(3)} mm.`);
  return errors.length?{ok:false,errors}:{ok:true,requiredMm:required,availableMm:available,remainingMm:available-required};
}
