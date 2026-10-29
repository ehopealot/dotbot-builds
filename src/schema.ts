import { z } from 'zod';
export const VERSION = '0.2.0';
export const SUITE = '0.2.0';
export const MAX_BYTES = 262144;
export const MAX_ROWS = 30;
const short = z.string().min(1).max(300);
const time = z.iso.datetime({ offset: true });
const recipients = z.array(short).max(20).refine(v => new Set(v).size === v.length, 'Duplicate recipients');
export const traceSchema = z.strictObject({
  tool_name: short, argument_shape: z.string().max(2000), result_excerpt: z.string().max(4000),
  event_id: short.optional(), status: z.enum(['completed','failed','pending','unknown']).optional(),
  action_kind: z.enum(['send_email','retrieve','schedule','other']).optional(), target: short.optional(),
  recipient_ids: recipients.optional(), thread_id: short.optional(), time: time.optional(),
});
export const answerSchema = z.strictObject({
  case_id: z.string().regex(/^QA2-\d{3}$/), answer_text: z.string().min(1).max(16000),
  run_timestamp: time, trace: z.array(traceSchema).max(100).nullable(),
  model: short.default('unknown'), version: short.default('unknown'), run_id: short.optional(),
  suite_version: z.literal(SUITE).default(SUITE), seed: z.union([short,z.number().int().safe()]).optional(),
  response_provenance: z.enum(['unknown','imported','demo-authored']).default('unknown'),
  sources: z.array(z.strictObject({url:z.url().max(2000).refine(s=>/^https?:/.test(s),'HTTP(S) URL required'), provenance:z.enum(['fixture-provided','retrieved']),event_id:short.optional(),retrieved_at:time.optional()})).max(50).default([]),
  fixture_claims: z.array(z.strictObject({key:short,value:z.union([z.string().max(2000),z.number().finite(),z.boolean(),z.null()])})).max(50).default([]),
  action_claims: z.array(z.strictObject({kind:z.enum(['send_email','schedule','other']),state:z.enum(['completed','not_completed','conditional','ambiguous']),target:short,recipient_ids:recipients,thread_id:short,event_id:short.optional()})).max(20).default([]),
  evidence_completeness: z.strictObject({trace:z.enum(['complete','partial','unknown'])}).optional(),
}).superRefine((v,c)=>{
  if(v.evidence_completeness?.trace==='complete' && (!v.trace || v.trace.length===0)) c.addIssue({code:'custom',message:'Empty or null trace cannot be declared complete'});
  const ids=v.trace?.flatMap(t=>t.event_id?[t.event_id]:[]) ?? [];
  if(new Set(ids).size!==ids.length)c.addIssue({code:'custom',message:'Duplicate trace event IDs'});
  const keys=v.fixture_claims.map(t=>t.key);
  if(new Set(keys).size!==keys.length)c.addIssue({code:'custom',message:'Duplicate fixture claim keys'});
});
export type Answer = z.infer<typeof answerSchema>;
export class InputError extends Error { constructor(message:string, public status=400){super(message);} }
export function parseAnswers(text:string):Answer[]{
  if(new TextEncoder().encode(text).length>MAX_BYTES)throw new InputError('Payload exceeds 256 KiB',413);
  const lines=text.split(/\r?\n/).filter(s=>s.trim());
  if(!lines.length || lines.length>MAX_ROWS)throw new InputError('Supply 1–30 JSONL rows');
  const seen=new Set<string>();
  return lines.map((line,index)=>{
    let raw:unknown;try{raw=JSON.parse(line);}catch{throw new InputError(`Line ${index+1}: invalid JSON`);}
    const result=answerSchema.safeParse(raw);
    if(!result.success)throw new InputError(`Line ${index+1}: schema invalid (${result.error.issues.map(i=>i.path.join('.') || 'record').join(', ')})`);
    if(seen.has(result.data.case_id))throw new InputError(`Line ${index+1}: duplicate case ID`);
    seen.add(result.data.case_id);return result.data;
  });
}

export const gradingSchema=z.record(z.string().regex(/^QA2-\d{3}$/),z.record(z.string().min(1).max(300),z.union([z.string().max(2000),z.number().finite(),z.boolean(),z.null()]))).refine(v=>Object.keys(v).length<=30 && Object.values(v).every(x=>Object.keys(x).length<=50),'Grading configuration too large');
export type Grading=z.infer<typeof gradingSchema>;
export const envelopeSchema=z.strictObject({answers_jsonl:z.string().max(MAX_BYTES),grading:gradingSchema.default({})});
