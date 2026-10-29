import { z } from 'zod';
import { writeFile } from 'node:fs/promises';
import { answerSchema } from '../src/schema';
await writeFile('schemas/answer.schema.json',JSON.stringify(z.toJSONSchema(answerSchema,{io:'input'}),null,2)+'\n');
