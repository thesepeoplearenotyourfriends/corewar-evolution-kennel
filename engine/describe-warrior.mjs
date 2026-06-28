import {createHash} from 'node:crypto';
import {parseRedcode} from './redcode-parser.mjs';

export function normalizedGenome(warrior){
  const parsed=warrior.instructions?warrior:parseRedcode(warrior.source||'',{id:warrior.id||'warrior'});
  return parsed.instructions.map(i=>`${i.opcode}.${i.modifier||'F'} ${i.a.mode}${i.a.value},${i.b.mode}${i.b.value}`).join('\n')+`\norg ${parsed.start||0}`;
}
export function genomeHash(warrior){return createHash('sha256').update(normalizedGenome(warrior)).digest('hex').slice(0,16);}
export function describeWarrior(warrior){
  const parsed=warrior.instructions?warrior:parseRedcode(warrior.source||'',{id:warrior.id||'warrior'});
  const opcodeCounts={}, addressingModeCounts={}, backwardBranches=[];
  let fixedArithmeticPointerSteps=[];
  parsed.instructions.forEach((ins,index)=>{
    opcodeCounts[ins.opcode]=(opcodeCounts[ins.opcode]||0)+1;
    for(const op of [ins.a,ins.b]) addressingModeCounts[op.mode]=(addressingModeCounts[op.mode]||0)+1;
    if(['JMP','JMZ','JMN','DJN','SPL'].includes(ins.opcode) && ins.a.value<0) backwardBranches.push({at:index,opcode:ins.opcode,offset:ins.a.value,loopLength:Math.abs(ins.a.value)});
    if(['ADD','SUB'].includes(ins.opcode) && ins.a.mode==='#') fixedArithmeticPointerSteps.push({at:index,opcode:ins.opcode,step:ins.a.value,targetMode:ins.b.mode,targetOffset:ins.b.value});
  });
  const facts=[];
  facts.push(`${parsed.instructions.length} instruction${parsed.instructions.length===1?'':'s'}`);
  if(opcodeCounts.SPL) facts.push(`contains ${opcodeCounts.SPL} process-spawning instruction${opcodeCounts.SPL===1?'':'s'}`);
  for(const b of backwardBranches.slice(0,3)) facts.push(`contains a backward ${b.opcode} forming a ${b.loopLength}-instruction loop`);
  for(const step of fixedArithmeticPointerSteps.slice(0,2)) facts.push(`${step.opcode} uses fixed immediate step ${step.step}`);
  return {schemaVersion:1,instructionCount:parsed.instructions.length,opcodeCounts,addressingModeCounts,hasSpl:Boolean(opcodeCounts.SPL),backwardBranches,fixedArithmeticPointerSteps,genomeHash:genomeHash(parsed),normalizedGenome:normalizedGenome(parsed),facts};
}
export function genomeDistance(a,b){const A=normalizedGenome(a).split('\n'),B=normalizedGenome(b).split('\n'); const n=Math.max(A.length,B.length); let d=0; for(let i=0;i<n;i++) if(A[i]!==B[i]) d++; return n?d/n:0;}
