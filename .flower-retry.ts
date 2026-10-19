import { db } from './src/backend/lib/db'
import { storeDb } from './src/backend/lib/tenancy'
import { runImport } from './src/backend/lib/design-import/pipeline'
const s=storeDb('legacy')
try {
 const conn=await s.figmaConnection.findFirst({select:{status:true,authType:true}})
 console.log(JSON.stringify({connection:conn}))
 if(!conn || conn.status!=='ACTIVE') throw Error('Figma connection is not active')
 const id='cmv9brpkz0001p89gaw6cfcf5'
 const job=await s.designImport.findFirst({where:{id}})
 if(!job) throw Error('Review import not found')
 if(job.status==='FAILED') await s.designImport.update({where:{id},data:{status:'NORMALIZING',attempts:0,error:null,lockedAt:new Date(),runAfter:new Date()}})
 if(job.status!=='REVIEW' && job.status!=='INSTALLED') await runImport('legacy',id)
 const done=await s.designImport.findFirst({where:{id}})
 const result=done?.result as any
 console.log(JSON.stringify({id,status:done?.status,error:done?.error,stats:done?.stats,warnings:done?.warnings,pages:result?.pages?.map((p:any)=>({title:p.title,frames:p.frames,sections:p.sections.map((s:any)=>({type:s.type,exact:s.settings.exact}))}))}))
} finally {await db.$disconnect()}
