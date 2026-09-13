import { CAM_PROJECT_FORMAT, CAM_PROJECT_VERSION, parseCamProject } from '../../src/lib/projectPersistence';

const sourcePocket={
  id:'op-pocket-1',kind:'pocket',name:'Tasche 1',enabled:true,
  tool:{id:'tool-6',name:'Schaftfräser 6 mm',diameterMm:6},
  contourId:null,contourIds:[],restMachiningEnabled:false,restFromOperationId:null,direction:'climb',stepoverPercent:40,entry:'plunge',rampAngleDeg:3,strategy:'auto',
  totalDepthMm:2,stepDownMm:1,feedMmMin:600,plungeMmMin:180,spindleRpm:12000,safeZMm:5,
};
const pocket={
  id:'op-pocket-2',kind:'pocket',name:'Tasche 2',enabled:true,
  tool:{id:'tool-2',name:'Schaftfräser 2 mm',diameterMm:2},
  contourId:null,contourIds:[],restMachiningEnabled:true,restFromOperationId:'op-pocket-1',direction:'climb',stepoverPercent:40,entry:'plunge',rampAngleDeg:3,strategy:'auto',
  totalDepthMm:2,stepDownMm:1,feedMmMin:500,plungeMmMin:150,spindleRpm:12000,safeZMm:5,
};
const contour={...sourcePocket,id:'op-contour-1',kind:'contour',name:'Kontur 1',tool:{id:'tool-3',name:'Schaftfräser 3 mm',diameterMm:3},topology:'closed',side:'outside',openSide:'left',direction:'climb',contourIds:[],restMachiningEnabled:undefined,restFromOperationId:undefined};
const valid={
  format:CAM_PROJECT_FORMAT,
  version:CAM_PROJECT_VERSION,
  source:{path:'/fixtures/008b5-reference.dxf',fileName:'008b5-reference.dxf',geometryIdentity:'fnv1a64:fixture'},
  setup:{},
  operationsProject:{operations:[sourcePocket,pocket],activeOperationId:'op-pocket-2'},
};

function result(id:string,value:unknown){
  try{parseCamProject(JSON.stringify(value));return{id,rejected:false,error:null};}
  catch(error){return{id,rejected:true,error:error instanceof Error?error.message:String(error)};}
}

export function run008b5(){
  return[
    result('valid-project',valid),
    result('empty-operations',{...valid,operationsProject:{operations:[],activeOperationId:null}}),
    result('missing-operation-id',{...valid,operationsProject:{operations:[{...sourcePocket,id:''}],activeOperationId:null}}),
    result('duplicate-operation-id',{...valid,operationsProject:{operations:[sourcePocket,{...pocket,id:sourcePocket.id,restFromOperationId:sourcePocket.id}],activeOperationId:sourcePocket.id}}),
    result('unknown-operation-kind',{...valid,operationsProject:{operations:[{...sourcePocket,kind:'laser'}],activeOperationId:sourcePocket.id}}),
    result('missing-tool',{...valid,operationsProject:{operations:[{...sourcePocket,tool:null}],activeOperationId:sourcePocket.id}}),
    result('missing-tool-id',{...valid,operationsProject:{operations:[{...sourcePocket,tool:{...sourcePocket.tool,id:''}}],activeOperationId:sourcePocket.id}}),
    result('invalid-tool-diameter',{...valid,operationsProject:{operations:[{...sourcePocket,tool:{...sourcePocket.tool,diameterMm:0}}],activeOperationId:sourcePocket.id}}),
    result('dangling-active-operation',{...valid,operationsProject:{operations:[sourcePocket],activeOperationId:'op-missing'}}),
    result('dangling-rest-source',{...valid,operationsProject:{operations:[sourcePocket,{...pocket,restFromOperationId:'op-missing'}],activeOperationId:pocket.id}}),
    result('self-rest-source',{...valid,operationsProject:{operations:[{...pocket,restFromOperationId:pocket.id}],activeOperationId:pocket.id}}),
    result('wrong-kind-rest-source',{...valid,operationsProject:{operations:[contour,{...pocket,restFromOperationId:contour.id}],activeOperationId:pocket.id}}),
    result('forward-rest-source',{...valid,operationsProject:{operations:[{...pocket,restFromOperationId:sourcePocket.id},sourcePocket],activeOperationId:pocket.id}}),
  ];
}

console.log(JSON.stringify(run008b5()));
