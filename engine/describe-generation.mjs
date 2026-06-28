export function describeGeneration(generation){
  const selected=generation.selectionLedger?.selected||generation.warriors||[];
  const retired=generation.selectionLedger?.retired||[];
  const lineageShare={};
  for(const w of selected){const root=(w.parentIds&&w.parentIds[0])||w.id; lineageShare[root]=(lineageShare[root]||0)+1;}
  return {schemaVersion:1,generation:generation.generation,parentPool:generation.parentPool||[],candidateCount:generation.candidateCount||0,selected:selected.map(w=>({id:w.id,status:w.status||'active',retentionReason:w.retentionReason||'legacy generation: no retention ledger',evidence:w.selectionEvidence||null,genomeHash:w.genomeHash||null,parentIds:w.parentIds||[]})),retired,lineageShare};
}
