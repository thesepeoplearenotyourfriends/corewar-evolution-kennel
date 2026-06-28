import {runMatch} from '../engine/corewar-vm.mjs';
import {describeBout} from '../engine/describe-bout.mjs';
function emptyRecord(){return {wins:0,losses:0,ties:0};}
function add(record,winner){if(winner===0) record.wins++; else if(winner===1) record.losses++; else record.ties++;}
export function scoreCandidates(candidates,opponents,{profileId,matchesPerCandidate}){return candidates.map(c=>scoreOne(c,opponents,{profileId,matchesPerCandidate,recordName:'record'})).sort((a,b)=>b.score-a.score);}
export function scoreOne(c,opponents,{profileId,matchesPerCandidate,recordName='record'}){let record=emptyRecord(); const replays=[]; for(let i=0;i<Math.min(matchesPerCandidate,opponents.length);i++){const o=opponents[i]; const m=runMatch({profileId,warriors:[c,o],seed:`${recordName}-${c.id}-vs-${o.id}-${i}`}); add(record,m.winner); if(replays.length<1) replays.push({...m,description:describeBout(m),events:m.events.slice(0,200),warriors:[c.id,o.id]});} const diversity=new Set(c.source.split(/\s+/)).size/100; return {...c,[recordName]:record,score:(record.wins*3)+record.ties+diversity,replays};}
export function attachBenchmarkScores(candidates,benchmarks,{profileId,matchesPerCandidate}){return candidates.map(c=>{const b=scoreOne(c,benchmarks,{profileId,matchesPerCandidate,recordName:'benchmarkRecord'}); return {...c,benchmarkRecord:b.benchmarkRecord,benchmarkScore:b.score};});}
