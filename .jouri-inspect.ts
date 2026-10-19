import { db } from './src/backend/lib/db'
import { storeDb } from './src/backend/lib/tenancy'
import { getSnapshot } from './src/backend/lib/design-import/storage'
const s=storeDb('legacy')
try {
 const j=await s.designImport.findFirst({where:{id:'cmv9d3mx50005p8l06201vb9v'}})
 if(!j) throw Error('Jouri import missing')
 const raw:any=await getSnapshot('legacy',j.rawSnapshotKey!)
 const counts:Record<string,number>={}; for(const w of j.warnings as any[]) counts[w.code]=(counts[w.code]??0)+1
 console.log(JSON.stringify({id:j.id,status:j.status,error:j.error,stats:j.stats,warnings:counts,frames:Object.entries(raw.nodes).map(([id,n]:any)=>({id,name:n?.document?.name,width:n?.document?.absoluteBoundingBox?.width,height:n?.document?.absoluteBoundingBox?.height,visible:n?.document?.visible!==false})),resultAssets:Object.keys((j.result as any)?.assets??{}).length}))
} finally {await db.$disconnect()}
