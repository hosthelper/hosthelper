import express from 'express';

const app=express();
app.disable('x-powered-by');
const PORT=Number(process.env.PORT||10000);

app.use((_req,res,next)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  next();
});

app.get('/health',(_req,res)=>res.json({
  ok:true,
  service:'gongsil-ocr-worker',
  deprecated:true,
  disabled:true,
  replacement:'gongsil-ocr-queue-worker'
}));

app.all('/v1/*',(_req,res)=>res.status(410).json({
  error:'legacy_ocr_endpoint_disabled',
  replacement:'server_queue_only'
}));

app.use((_req,res)=>res.status(404).json({error:'not_found'}));
app.listen(PORT,()=>console.log(`legacy gongsil-ocr-worker disabled on ${PORT}`));
