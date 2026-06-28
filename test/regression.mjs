import assert from 'node:assert/strict'; import {parseRedcode} from '../engine/redcode-parser.mjs'; import {runMatch} from '../engine/corewar-vm.mjs';
const imp=';name Imp\norg 0\nMOV.F 0, 1\nend\n'; const dwarf=';name Dwarf\norg 0\nADD.F #4, 3\nMOV.F 2, @2\nJMP.F -2, 0\nDAT.F #0, #0\nend\n';
assert.equal(parseRedcode(imp).instructions[0].opcode,'MOV'); assert.throws(()=>parseRedcode('MUL 0, 1'),/Unsupported/);
const a=runMatch({warriors:[{id:'imp',source:imp},{id:'dwarf',source:dwarf}],seed:'same'}); const b=runMatch({warriors:[{id:'imp',source:imp},{id:'dwarf',source:dwarf}],seed:'same'}); assert.deepEqual(a,b); assert.ok(a.cycles>0); console.log('regression ok');
