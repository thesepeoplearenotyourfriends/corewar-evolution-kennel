export const PROFILES={kennel94:{id:'kennel94',name:'Kennel ICWS-94 subset',coreSize:800,maxWarriorLength:64,maxProcesses:64,maxCycles:8000,minSeparation:100,opcodes:['DAT','MOV','ADD','SUB','JMP','JMZ','JMN','DJN','SPL','CMP','SEQ','SNE','SLT','NOP'],modifiers:['F'],modes:['#','$','@','<','>']}};
export function getProfile(id='kennel94'){const p=PROFILES[id]; if(!p) throw Error(`Unknown profile ${id}`); return p;}
export function mod(n,m){return ((n%m)+m)%m;}
export class RNG{constructor(seed='seed'){let h=2166136261>>>0; for(const c of String(seed)) {h^=c.charCodeAt(0); h=Math.imul(h,16777619);} this.s=h>>>0||1;} next(){let x=this.s; x^=x<<13; x^=x>>>17; x^=x<<5; this.s=x>>>0; return this.s/4294967296;} int(n){return Math.floor(this.next()*n);} pick(a){return a[this.int(a.length)];}}
