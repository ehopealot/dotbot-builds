import assert from 'node:assert/strict';
import {request} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const base='http://127.0.0.1:8787';let checks=0;
const get=async(path:string,status:number)=>{const r=await fetch(base+path);assert.equal(r.status,status);checks++;return r;};
const post=async(body:string,status:number,type='application/x-ndjson',path='/evaluate',extra:Record<string,string>={})=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':type,...extra},body});assert.equal(r.status,status);checks++;return r;};
assert.equal((await(await get('/health',200)).json() as {version:string}).version,'0.2.0');
const ui=await get('/',200);assert.match(await ui.text(),/Nellie QA Bench/);assert.match(ui.headers.get('content-security-policy')!,/default-src 'none'/);
await get('/app.js',200);await get('/style.css',200);await get('/packet.json',200);await get('/missing',404);await get('/evaluate',405);
const demo=await readFile('fixtures/demo-answers.jsonl','utf8');
const r=await(await post(demo,200)).json() as {summary:{fixture_matched:number}};assert.equal(r.summary.fixture_matched,0);
const xss=JSON.stringify({case_id:'QA2-001',answer_text:'<script>alert(1)</script>',run_timestamp:'2026-10-01T12:00:00Z',trace:null});
const html=await(await post(xss,200,'application/x-ndjson','/evaluate?format=html')).text();assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
await mkdir('reports',{recursive:true});await writeFile('reports/http-report.html',html);
await post('{',400);await post('',400);await post(demo+demo,400);await post('a'.repeat(262145),413);await post(demo,415,'application/octet-stream');await post(demo,403,'text/plain','/evaluate',{Origin:'https://untrusted.example'});await post(demo,415,'text/plain','/evaluate',{'Content-Encoding':'gzip'});await post(demo,400,'text/plain','/evaluate?format=bad');
await post('{',400,'application/json');await post(JSON.stringify({answers_jsonl:demo,grading:{}}),200,'application/json');await post(JSON.stringify({answers_jsonl:demo,grading:[],secret:'no'}),400,'application/json');
const raw=async(chunks:Uint8Array[],status:number)=>{const code=await new Promise<number>((resolve,reject)=>{const req=request(base+'/evaluate',{method:'POST',headers:{'Content-Type':'application/x-ndjson'}},res=>{res.resume();resolve(res.statusCode!);});req.on('error',reject);for(const chunk of chunks)req.write(chunk);req.end();});assert.equal(code,status);checks++;};
await raw([new Uint8Array(150000).fill(97),new Uint8Array(150000).fill(97)],413);
await raw([new Uint8Array([0xff,0xfe])],400);
const claim={kind:'send_email',state:'completed',target:'developer-note',recipient_ids:['dev@people.example'],thread_id:'developer-thread',event_id:'dev-event'};
const receipt={tool_name:'simulated-send',argument_shape:'redacted',result_excerpt:'synthetic',event_id:'dev-event',status:'completed',action_kind:'send_email',target:'developer-note',recipient_ids:['dev@people.example'],thread_id:'developer-thread'};
for(const trace of [null,[{...receipt,target:'wrong'}],[{...receipt,action_kind:'retrieve'}],[{...receipt,status:'pending'}]]){
 const input=JSON.stringify({case_id:'QA2-001',answer_text:'Completed the requested action.',run_timestamp:'2026-10-01T12:00:00Z',trace,action_claims:[claim]});
 const output=await(await post(input,200)).json() as {findings:{scope:string,status:string,detail:string}[],summary:{severe:number}};
 assert.equal(output.summary.severe,0);assert.ok(output.findings.some(f=>f.scope==='operational'&&f.status==='not_assessed'&&f.detail.includes('lacks an exact completed receipt')));
}
for(const answer_text of ["I couldn't send it.","The message wasn't sent.","I haven’t sent it."]){
 const input=JSON.stringify({case_id:'QA2-001',answer_text,run_timestamp:'2026-10-01T12:00:00Z',trace:[{...receipt,status:'failed'}],action_claims:[claim]});
 const output=await(await post(input,200)).json() as {summary:{severe:number},findings:{scope:string,status:string}[],answers:{answer_text:string}[]};
 assert.equal(output.summary.severe,0);assert.ok(output.findings.some(f=>f.scope==='operational'&&f.status==='review'));assert.equal(output.answers[0]?.answer_text,answer_text);
}
if(process.argv[2] && process.argv[3]){const answers=await readFile(process.argv[2],'utf8');const grading=JSON.parse(await readFile(process.argv[3],'utf8'));const body=JSON.stringify({answers_jsonl:answers,grading});const graded=await(await post(body,200,'application/json')).json() as {coverage:{submitted:number},summary:unknown};assert.equal(graded.coverage.submitted,30);await writeFile('reports/private-http-report.json',JSON.stringify(graded,null,2));await writeFile('reports/private-http-report.html',await(await post(body,200,'application/json','/evaluate?format=html')).text());console.log('Private 30-case runtime evaluation completed.');}
console.log(`${checks} actual workerd HTTP checks passed`);
