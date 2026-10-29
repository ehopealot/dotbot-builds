import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseAnswers, gradingSchema, provenanceOverrideSchema } from './schema';
import { evaluate } from './evaluator';
import { htmlReport } from './report';
const [input,output='reports',gradingFile,provenanceFile]=process.argv.slice(2);
if(!input){console.error('Usage: npm run cli -- answers.jsonl [output-directory] [private-grading.json] [provenance-sidecar.json]');process.exitCode=1;}
else{try{const report=evaluate(parseAnswers(await readFile(input,'utf8')),gradingFile?gradingSchema.parse(JSON.parse(await readFile(gradingFile,'utf8'))):{},provenanceFile?provenanceOverrideSchema.parse(JSON.parse(await readFile(provenanceFile,'utf8'))):undefined);await mkdir(output,{recursive:true});await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));await writeFile(join(output,'report.html'),htmlReport(report));console.log(JSON.stringify(report.summary));}catch(error){console.error(error instanceof Error?error.message:'Evaluation failed');process.exitCode=1;}}
