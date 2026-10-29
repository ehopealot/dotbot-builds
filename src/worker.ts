import { parseAnswers, InputError, MAX_BYTES, envelopeSchema, VERSION } from './schema';
import { evaluate } from './evaluator';
import { htmlReport } from './report';
import { ui,css,js } from './ui';
import packet from '../fixtures/blind-packet.json';
import demo from '../fixtures/demo-answers.jsonl';
declare const __SOURCE_COMMIT__:string;
const sourceCommit=typeof __SOURCE_COMMIT__==='string'?__SOURCE_COMMIT__:'local-development';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"};
function response(body:string,status=200,type='application/json'){return new Response(body,{status,headers:{...headers,'Content-Type':type+'; charset=utf-8'}});}
async function boundedBody(request:Request){
 if(request.headers.get('content-encoding') && request.headers.get('content-encoding')!=='identity')throw new InputError('Encoded payloads unsupported',415);
 const length=request.headers.get('content-length');if(length && Number(length)>MAX_BYTES)throw new InputError('Payload exceeds 256 KiB',413);
 const reader=request.body?.getReader();if(!reader)return '';
 let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES){await reader.cancel();throw new InputError('Payload exceeds 256 KiB',413);}chunks.push(value);}}finally{reader.releaseLock();}
 const all=new Uint8Array(size);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length;}
 try{return new TextDecoder('utf-8',{fatal:true}).decode(all);}catch{throw new InputError('Invalid UTF-8');}
}
export default {async fetch(request:Request):Promise<Response>{
 const url=new URL(request.url);
 try{
  if(request.method==='GET'){
   switch(url.pathname){case '/':return response(ui,200,'text/html');case '/style.css':return response(css,200,'text/css');case '/app.js':return response(js,200,'text/javascript');case '/packet.json':return response(JSON.stringify(packet));case '/demo.jsonl':return response(demo,200,'application/x-ndjson');case '/health':return response(JSON.stringify({status:'ok',version:VERSION,source_commit:sourceCommit,storage:'none'}));}
  }
  if(url.pathname!=='/evaluate')return response('{"error":"Not found"}',404);
  if(request.method!=='POST')return response('{"error":"Method not allowed"}',405);
  const origin=request.headers.get('origin');if(origin && origin!==url.origin)throw new InputError('Cross-origin submission rejected',403);
  if(!['application/json','application/x-ndjson','application/jsonl','text/plain'].includes((request.headers.get('content-type')??'').split(';')[0]!))throw new InputError('Use application/x-ndjson',415);
  const format=url.searchParams.get('format');if(format && !['html','json'].includes(format))throw new InputError('Unknown format');
  const body=await boundedBody(request);
  let answersText=body;let grading={};let provenanceOverride;
  if(request.headers.get('content-type')?.split(';')[0]==='application/json'){
   let raw:unknown;try{raw=JSON.parse(body);}catch{throw new InputError('Invalid JSON envelope');}
   const parsed=envelopeSchema.safeParse(raw);if(!parsed.success)throw new InputError('Invalid grading envelope');
   answersText=parsed.data.answers_jsonl;grading=parsed.data.grading;provenanceOverride=parsed.data.provenance_override;
  }
  const report=evaluate(parseAnswers(answersText),grading,provenanceOverride);
  return response(format==='html'?htmlReport(report):JSON.stringify(report),200,format==='html'?'text/html':'application/json');
 }catch(error){return response(JSON.stringify({error:error instanceof InputError?error.message:'Internal evaluation error'}),error instanceof InputError?error.status:500);}
}};
