import { db } from './src/backend/lib/db'
import { storeDb } from './src/backend/lib/tenancy'
const s=storeDb('legacy')
try {
 const j=await s.designImport.findFirst({where:{id:'cmv9d3mx50005p8l06201vb9v'}})
 const warnings:any[]=j?.warnings as any[]??[]
 console.log(JSON.stringify({status:j?.status,error:j?.error,updatedAt:j?.updatedAt,lockedAt:j?.lockedAt,stats:j?.stats,assets:Object.keys((j?.result as any)?.assets??{}).length,warnings:warnings.reduce((a,w)=>(a[w.code]=(a[w.code]??0)+1,a),{}),assetFailures:warnings.filter(w=>w.code==='ASSET_FAILED').slice(0,3)}))
} finally {await db.$disconnect()}
