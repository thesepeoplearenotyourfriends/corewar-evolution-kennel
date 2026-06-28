export function describeBout(bout){
  const peak=[0,0], births=[0,0], writes=[0,0]; let eliminationCycle=null;
  for(const ev of bout.events||[]){
    const q=ev.queues||[]; for(let i=0;i<2;i++) peak[i]=Math.max(peak[i],(q[i]||0)+(ev.warrior===i?1:0));
    if(ev.spawn!==null&&ev.spawn!==undefined) births[ev.warrior]++;
    for(const w of ev.write||[]) writes[w.owner]++;
    if(ev.death && bout.winner!==null) eliminationCycle=ev.c;
  }
  for(let i=0;i<2;i++) peak[i]=Math.max(peak[i],bout.finalProcessCounts?.[i]||0);
  const facts=[];
  if(bout.winner===null) facts.push(`Neither side eliminated the other before cycle ${bout.cycles}.`); else facts.push(`Warrior ${bout.winner} won at cycle ${bout.cycles}.`);
  facts.push(`Final processes: ${bout.finalProcessCounts?.[0]??0} and ${bout.finalProcessCounts?.[1]??0}.`);
  facts.push(`Peak processes: ${peak[0]} and ${peak[1]}.`);
  return {schemaVersion:1,winner:bout.winner,result:bout.result,cycles:bout.cycles,replayEventCount:(bout.events||[]).length,eliminationCycle,finalProcessCounts:bout.finalProcessCounts||[0,0],peakProcessCounts:peak,processBirths:births,writesBySide:writes,facts};
}
