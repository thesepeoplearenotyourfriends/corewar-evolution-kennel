import {RNG} from '../engine/profiles.mjs';
const A=['Moss','Ghost','Noisy','Glass','Sump','Impossible','Tin','Velvet','Static','Rust','Pale','Neon']; const B=['Hammer','Needle','Cricket','Finch','Oracle','Bird','Comet','Mite','Lantern','Dagger','Marmot','Engine'];
export function goofyName(seed){const r=new RNG(seed); return `${r.pick(A)} ${r.pick(B)}`;}
