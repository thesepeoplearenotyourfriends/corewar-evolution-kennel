import assert from 'node:assert/strict';
import {parseRedcode} from '../engine/redcode-parser.mjs';
import {describeWarrior, genomeHash} from '../engine/describe-warrior.mjs';
import {dedupeByGenome, balancedSeries, selectRetained} from '../kennel/retention-policy.mjs';

const imp=parseRedcode(';name Imp\norg 0\nMOV.F 0, 1\nend\n',{id:'imp'});
const imp2={...parseRedcode(';name Other\norg 0\nMOV.F 0, 1\nend\n',{id:'imp2'}),id:'imp2'};
const dwarf=parseRedcode(';name Dwarf\norg 0\nADD.F #4, 3\nMOV.F 2, @2\nJMP.F -2, 0\nDAT.F #0, #0\nend\n',{id:'dwarf'});

assert.equal(genomeHash(imp), genomeHash(imp2));
const deduped=dedupeByGenome([imp,imp2],[]);
assert.equal(deduped.length,1,'exact normalized duplicates collapse to one active candidate');
assert.equal(deduped[0].duplicateProvenance.alsoAppearedAs[0].id,'imp2');
assert.equal(deduped.duplicates[0].retirementReason, 'exact normalized genome duplicate of imp');

const series=balancedSeries(dwarf,imp,{profileId:'kennel94',seeds:['one','two']});
assert.equal(series.bouts,4,'balanced counter series runs both left/right placements per seed');
assert.equal(series.record.wins+series.record.losses+series.record.ties,4);

const scored=[dwarf,imp].map((w,i)=>({...w,id:w.id,source:w.source,record:{wins:2-i,losses:i,ties:1},benchmarkRecord:{wins:1,losses:1,ties:0},score:10-i,replays:[]}));
const ledger=selectRetained({scored,parents:[imp],profileId:'kennel94',policy:{populationSize:2,broadCompetitors:1,counterSlots:0,outlierSlots:1,humanFavoredSlots:0,nearDuplicateDistance:0,counterBoutSeeds:['x'],counterMinWins:1,outlierMinDistance:0.1,outlierMinTiesOrWins:1}});
assert.ok(ledger.selected.every(w=>w.retentionReason && w.selectionEvidence),'retained organisms carry reason and evidence');

assert.deepEqual(describeWarrior(dwarf), describeWarrior(dwarf),'semantic warrior description is deterministic');
console.log('retention-policy tests passed');
