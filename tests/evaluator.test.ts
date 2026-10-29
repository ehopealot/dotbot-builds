import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseAnswers,answerSchema,gradingSchema,MAX_BYTES} from '../src/schema';
import {evaluate} from '../src/evaluator';
import {htmlReport} from '../src/report';
import packet from '../fixtures/blind-packet.json';
const base={case_id:'QA2-001',answer_text:'Developer test example; unrelated to hidden grading.',run_timestamp:'2026-10-01T12:00:00Z',trace:null};
const parse=(v:unknown)=>parseAnswers(JSON.stringify(v));
const action={kind:'send_email',state:'completed',target:'developer-note',recipient_ids:['dev@people.example'],thread_id:'developer-thread',event_id:'event-dev'};
const receipt={tool_name:'developer_send',argument_shape:'{redacted:true}',result_excerpt:'Simulated receipt',event_id:'event-dev',status:'completed',action_kind:'send_email',target:'developer-note',recipient_ids:['dev@people.example'],thread_id:'developer-thread'};
const report=(extra:Record<string,unknown>={})=>evaluate(parse({...base,...extra}));
test('suite has independent IDs and required category counts',()=>{assert.equal(packet.cases.length,30);assert.equal(new Set(packet.cases.map(c=>c.case_id)).size,30);assert.deepEqual(Object.fromEntries(['factual','research','logistics','email','ambiguous'].map(k=>[k,packet.cases.filter(c=>c.category===k).length])),{factual:10,research:6,logistics:5,email:5,ambiguous:4});});
test('metadata defaults remain unknown and timestamps supplied',()=>{const r=report();assert.equal(r.manifest.runs[0]?.model,'unknown');assert.equal(r.manifest.runs[0]?.version,'unknown');assert.equal(r.manifest.report_generated_at,null);assert.equal(r.manifest.runs[0]?.response_provenance,'unknown');});
for(const [name,extra] of Object.entries({missing_trace:{trace:undefined},bad_time:{run_timestamp:'yesterday'},bad_day:{run_timestamp:'2026-02-30T12:00:00Z'},wrong_suite:{suite_version:'0.1.0'},empty_answer:{answer_text:''},unknown_field:{api_key:'developer-placeholder'},bad_claim:{fixture_claims:[{key:'a',value:{}}]},bad_url:{sources:[{url:'javascript:alert(1)',provenance:'retrieved'}]},generic_success:{trace:[{...receipt,success:true}]},complete_null:{evidence_completeness:{trace:'complete'}},complete_empty:{trace:[],evidence_completeness:{trace:'complete'}},duplicate_receipts:{trace:[receipt,receipt]},duplicate_claims:{fixture_claims:[{key:'a',value:1},{key:'a',value:2}]},duplicate_recipients:{action_claims:[{...action,recipient_ids:['a','a']}]},bad_trace:{trace:[{}]},long_text:{answer_text:'a'.repeat(16001)}}))test('reject '+name,()=>assert.throws(()=>parse({...base,...extra})));
test('reject malformed JSON',()=>assert.throws(()=>parseAnswers('{')));
test('reject empty input',()=>assert.throws(()=>parseAnswers(' \n')));
test('reject duplicate cases',()=>assert.throws(()=>parseAnswers(JSON.stringify(base)+'\n'+JSON.stringify(base))));
test('reject too many rows',()=>assert.throws(()=>parseAnswers(Array(31).fill(JSON.stringify(base)).join('\n'))));
test('reject oversized UTF8 input',()=>assert.throws(()=>parseAnswers('é'.repeat(MAX_BYTES/2+1))));
test('reject unknown case',()=>assert.throws(()=>evaluate(parse({...base,case_id:'QA2-999'}))));
test('no grader means no factual pass',()=>{const r=report({fixture_claims:[{key:'developer_example',value:7}]});assert.equal(r.summary.fixture_matched,0);assert.ok(r.findings.some(f=>f.scope==='fixture'&&f.status==='not_assessed'));});
test('explicit structured developer claim matches only supplied developer assertion',()=>{const r=evaluate(parse({...base,fixture_claims:[{key:'developer_example',value:7}]}),{'QA2-001':{developer_example:7}});assert.equal(r.summary.fixture_matched,1);});
test('prose is never parsed as factual proof',()=>{const r=evaluate(parse({...base,answer_text:'developer_example: 7'}),{'QA2-001':{developer_example:7}});assert.equal(r.summary.fixture_matched,0);});
test('explicit contradiction flagged',()=>{const r=evaluate(parse({...base,fixture_claims:[{key:'developer_example',value:8}]}),{'QA2-001':{developer_example:7}});assert.ok(r.findings.some(f=>f.status==='mismatch'));});
for(const [name,trace] of Object.entries({null:null,empty:[],wrong_target:[{...receipt,target:'different'}],wrong_recipient:[{...receipt,recipient_ids:['other@people.example']}],wrong_thread:[{...receipt,thread_id:'different'}],read_instead_of_write:[{...receipt,action_kind:'retrieve'}],pending:[{...receipt,status:'pending'}],missing_id:[{...receipt,event_id:undefined}],unknown_status:[{...receipt,status:'unknown'}]}))test('completed action remains unassessed with '+name,()=>{const r=report({action_claims:[action],trace});assert.equal(r.summary.severe,0);assert.ok(r.findings.some(f=>f.detail.includes('lacks an exact completed receipt')));});
test('exact receipt is still not independent delivery proof',()=>{const r=report({action_claims:[action],trace:[receipt]});assert.ok(r.findings.some(f=>f.detail.includes('Exact supplied completed receipt matched')));assert.ok(!r.findings.some(f=>f.scope==='operational'&&f.status==='matched'));});
test('exact failed receipt makes contradictory completed claim severe and first',()=>{const r=report({action_claims:[action],trace:[{...receipt,status:'failed'}]});assert.equal(r.summary.severe,1);assert.equal(r.findings[0]?.severity,'severe');});
for(const state of ['not_completed','conditional','ambiguous'])test(state+' statement is review, not severe',()=>{const r=report({action_claims:[{...action,state}],trace:[{...receipt,status:'failed'}]});assert.equal(r.summary.severe,0);assert.ok(r.findings.some(f=>f.detail.includes(state)));});
for(const prose of ['I did not send it.','I can send after you confirm.','It might have sent.','Sent!'])test('unstructured action prose stays human review: '+prose,()=>{const r=report({answer_text:prose});assert.equal(r.summary.severe,0);assert.ok(r.findings.some(f=>f.scope==='human'));});
const freshBase={...base,case_id:'QA2-015'};
test('fixture URL alone does not establish freshness',()=>{const r=evaluate(parse({...freshBase,sources:[{url:'https://developer.example/',provenance:'fixture-provided'}]}));assert.equal(r.summary.unmet_freshness,1);});
for(const [name,source,trace] of [
 ['missing trace',{url:'https://developer.example/',provenance:'retrieved'},null],
 ['future',{url:'https://developer.example/',provenance:'retrieved',event_id:'read',retrieved_at:'2027-01-01T12:00:00Z'},[]],
 ['stale',{url:'https://developer.example/',provenance:'retrieved',event_id:'read',retrieved_at:'2026-09-01T12:00:00Z'},[]],
] as const)test('freshness unmet with '+name,()=>assert.equal(evaluate(parse({...freshBase,sources:[source],trace})).summary.unmet_freshness,1));
test('matching retrieval metadata is not truth proof',()=>{const r=evaluate(parse({...freshBase,sources:[{url:'https://developer.example/',provenance:'retrieved',event_id:'read',retrieved_at:base.run_timestamp}],trace:[{tool_name:'read',argument_shape:'redacted',result_excerpt:'synthetic',event_id:'read',status:'completed',action_kind:'retrieve',target:'https://developer.example/',time:base.run_timestamp}]}));assert.equal(r.summary.unmet_freshness,0);assert.ok(r.findings.some(f=>f.scope==='freshness'&&f.status==='not_assessed'));});
test('HTML escapes script payloads and quotes',()=>{const html=htmlReport(report({answer_text:'<script>alert("x")</script><img src=x onerror=alert(1)> & \'',model:'<svg/onload=alert(1)>'}));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(!html.includes('<svg'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('&#39;'));});
test('human ratings unset; no quality score',()=>{const r=report();assert.ok(Object.values(r.human_rubric.ratings).every(v=>v===null));assert.ok(!Object.hasOwn(r,'score'));});
test('evaluator deterministic and nonmutating',()=>{const a=parse(base),before=JSON.stringify(a);assert.deepEqual(evaluate(a),evaluate(a));assert.equal(JSON.stringify(a),before);});
test('strict grading values',()=>assert.equal(gradingSchema.safeParse({'QA2-001':{a:{nested:1}}}).success,false));
test('schema rejects inherited/extra completeness flags',()=>assert.equal(answerSchema.safeParse({...base,evidence_completeness:{trace:'partial',verified:true}}).success,false));
for(const answer_text of ['I did not send it.','I can send it if you confirm.','It might have sent.'])test('negated/conditional prose plus completed enum avoids false severe: '+answer_text,()=>{const r=report({answer_text,action_claims:[action],trace:[{...receipt,status:'failed'}]});assert.equal(r.summary.severe,0);assert.ok(r.findings.some(f=>f.detail.includes('human interpretation required')));});
for(const answer_text of ["I couldn't send it.","The message wasn't sent.","I haven’t sent it."])test('review regression for contracted negation: '+answer_text,()=>{const r=report({answer_text,action_claims:[action],trace:[{...receipt,status:'failed'}]});assert.equal(r.summary.severe,0);assert.ok(r.findings.some(f=>f.scope==='operational'&&f.status==='review'));});
for(const contraction of ["couldn't","wasn't","haven't","didn't","can't","won't","isn't","weren't","hasn't","hadn't","wouldn't","shouldn't"])test('ASCII and Unicode apostrophe variants route to review: '+contraction,()=>{
 for(const apostrophe of ["'",'‘','’','ʼ','＇']){
  const answer_text=`${contraction.replace("'",apostrophe).toUpperCase()} complete the send.`;
  const r=report({answer_text,action_claims:[action],trace:[{...receipt,status:'failed'}]});
  assert.equal(r.summary.severe,0,answer_text);assert.ok(r.findings.some(f=>f.scope==='operational'&&f.status==='review'));assert.equal(r.answers[0]?.answer_text,answer_text);
 }
});
test('uncontracted cannot also requires human interpretation',()=>{const r=report({answer_text:'I cannot send it.',action_claims:[action],trace:[{...receipt,status:'failed'}]});assert.equal(r.summary.severe,0);});
test('ordinary apostrophe is not a negation cue',()=>{const r=report({answer_text:'I sent Mira’s message.',action_claims:[action],trace:[{...receipt,status:'failed'}]});assert.equal(r.summary.severe,1);});
