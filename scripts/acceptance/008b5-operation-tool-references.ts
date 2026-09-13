import { CAM_PROJECT_FORMAT, CAM_PROJECT_VERSION, parseCamProject } from '../../src/lib/projectPersistence';

const contour={
  id:'op-contour-1',kind:'contour',name:'Kontur 1',enabled:true,
  tool:{id:'tool-1',name:'Schaftfräser 3 mm',diameterMm:3},
  contourId:null,contourIds:[],stepWireId:null,stepContourFaceIds:[],topology:'closed',side:'outside',openSide:'left',direction:'climb',
  totalDepthMm:3,stepDownMm:1,feedMmMin:600,plungeMmMin:200,spindleRpm:12000,safeZMm:5,
};
const pocket={
  id:'op-pocket-2',kind:'pocket',name:'Tasche 2',enabled:true,
  tool:{id:'tool-2',name:'Schaftfräser 2 mm',diameterMm:2},
  contourId:null,contourIds:[],restMachiningEnabled:true,restFromOperationId:'op-contour-1',direction:'climb',stepoverPercent:40,entry:'plunge',rampAngleDeg:3,strategy:'auto',
  totalDepthMm:2,stepDownMm:1,feedMmMin:500,plungeMmMin:150,spindleRpm:12000,safeZMm:5,
};
const valid={
  format:CAM_PROJECT_FORMAT,
  version:CAM_PROJECT_VERSION,
  source:{path:'/fixtures/008b5-reference.dxf',fileName:'008b5-reference.dxf',geometryIdentity:'fnv1a64:fixture'},
  setup:{},
  operationsProject:{operations:[contour,pocket],activeOperationId:'op-pocket-2'},
};

function result(id:string,value:unknown){
  try{parseCamProject(JSON.stringify(value));return{id,rejected:false,error:null};}
  catch(error){return{id,rejected:true,error:error instanceof Error?error.message:String(error)};}
}

export function run008b5(){
  return[
    result('valid-project',valid),
    result('empty-operations',{...valid,operationsProject:{operations:[],activeOperationId:null}}),
    result('missing-operation-id',{...valid,operationsProject:{operations:[{...contour,id:''}],activeOperationId:null}}),
    result('duplicate-operation-id',{...valid,operationsProject:{operations:[contour,{...pocket,id:contour.id,restFromOperationId:contour.id}],activeOperationId:contour.id}}),
    result('unknown-operation-kind',{...valid,operationsProject:{operations:[{...contour,kind:'laser'}],activeOperationId:contour.id}}),
    result('missing-tool',{...valid,operationsProject:{operations:[{...contour,tool:null}],activeOperationId:contour.id}}),
    result('missing-tool-id',{...valid,operationsProject:{operations:[{...contour,tool:{...contour.tool,id:''}}],activeOperationId:contour.id}}),
    result('invalid-tool-diameter',{...valid,operationsProject:{operations:[{...contour,tool:{...contour.tool,diameterMm:0}}],activeOperationId:contour.id}}),
    result('dangling-active-operation',{...valid,operationsProject:{operations:[contour],activeOperationId:'op-missing'}}),
    result('dangling-rest-source',{...valid,operationsProject:{operations:[contour,{...pocket,restFromOperationId:'op-missing'}],activeOperationId:pocket.id}}),
    result('self-rest-source',{...valid,operationsProject:{operations:[{...pocket,restFromOperationId:pocket.id}],activeOperationId:pocket.id}}),
  ];
}

console.log(JSON.stringify(run008b5()));
