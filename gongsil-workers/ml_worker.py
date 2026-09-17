import os,json,time,base64,hashlib,threading,urllib.request,urllib.error
from http.server import BaseHTTPRequestHandler,HTTPServer
import numpy as np
SUPABASE_URL=os.environ['SUPABASE_URL'].rstrip('/')
SUPABASE_KEY=os.environ['SUPABASE_PUBLISHABLE_KEY']
WORKER_TOKEN=os.environ['GONGSIL_WORKER_TOKEN']
WORKER_ID=os.environ.get('WORKER_ID','render-ml-01')
PORT=int(os.environ.get('PORT','10000'))
POLL_SECONDS=int(os.environ.get('POLL_SECONDS','20'))
FEATURE_NAMES=['operating_months','deposit_amount','monthly_rent','avg_monthly_revenue','avg_daily_rate','fixed_cost','management_fee','occupancy_rate','asset_reuse_pct','facility_investment','review_score','reservation_forward_rate','accessibility_score','tourism_proximity_score','area','accommodation_type']
def rpc(name,payload):
    req=urllib.request.Request(f'{SUPABASE_URL}/rest/v1/rpc/{name}',data=json.dumps(payload,separators=(',',':')).encode(),headers={'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':f'Bearer {SUPABASE_KEY}'},method='POST')
    try:
        with urllib.request.urlopen(req,timeout=30) as r:
            d=r.read().decode(); return json.loads(d) if d else None
    except urllib.error.HTTPError as e:
        b=e.read().decode(errors='ignore'); raise RuntimeError(f'{name}:{e.code}:{b[:600]}')
def stable_cat(v):
    if v is None or v=='': return 0.0
    h=hashlib.sha256(str(v).encode()).digest(); return int.from_bytes(h[:4],'big')/4294967295.0
def feature_vector(f):
    o=[]
    for n in FEATURE_NAMES:
        v=f.get(n)
        if n in ('area','accommodation_type'): o.append(stable_cat(v))
        else:
            try:o.append(float(v or 0))
            except:o.append(0.0)
    return np.asarray(o,dtype=float)
def encode_model(m):
    raw=json.dumps(m,separators=(',',':')).encode(); uri='data:application/json;base64,'+base64.urlsafe_b64encode(raw).decode()
    if len(uri)>1000: raise RuntimeError('model_artifact_too_large')
    return uri
def decode_model(uri):
    if not uri.startswith('data:application/json;base64,'): raise RuntimeError('unsupported_model_artifact')
    return json.loads(base64.urlsafe_b64decode(uri.split(',',1)[1].encode()).decode())
def train(job):
    rows=job.get('examples') or []; tr=[r for r in rows if r.get('split')=='train']; ho=[r for r in rows if r.get('split')=='holdout']
    if len(tr)<30 or len(ho)<10: raise RuntimeError('insufficient_rows')
    X=np.vstack([feature_vector(r['features']) for r in tr]); y=np.asarray([float(r['label_premium']) for r in tr])
    Xh=np.vstack([feature_vector(r['features']) for r in ho]); yh=np.asarray([float(r['label_premium']) for r in ho])
    mean=X.mean(axis=0); scale=X.std(axis=0); scale[scale<1e-9]=1.0; Z=(X-mean)/scale; Zh=(Xh-mean)/scale
    A=np.column_stack([np.ones(len(Z)),Z]); Ah=np.column_stack([np.ones(len(Zh)),Zh]); reg=np.eye(A.shape[1]); reg[0,0]=0
    beta=np.linalg.solve(A.T@A+reg,A.T@y); pred=np.maximum(0,Ah@beta); mae=float(np.mean(np.abs(pred-yh)))
    bp=[float(r['baseline_prediction']) for r in ho if r.get('baseline_prediction') is not None]; by=[float(r['label_premium']) for r in ho if r.get('baseline_prediction') is not None]
    if len(bp)!=len(ho): raise RuntimeError('baseline_predictions_missing')
    base_mae=float(np.mean(np.abs(np.asarray(bp)-np.asarray(by))))
    model={'v':1,'i':round(float(beta[0]),8),'c':[round(float(x),8) for x in beta[1:]],'m':[round(float(x),8) for x in mean],'s':[round(float(x),8) for x in scale]}
    version='premium-ridge-'+time.strftime('%Y%m%d%H%M%S',time.gmtime()); metrics={'holdout_mae':mae,'baseline_holdout_mae':base_mae,'label_mean':float(np.mean(yh)),'engine':'ridge_v1'}
    result=rpc('gongsil_worker_complete_ml_training_job',{'p_worker_token':WORKER_TOKEN,'p_job_id':job['job_id'],'p_worker_id':WORKER_ID,'p_claim_token':job['claim_token'],'p_model_version':version,'p_artifact_uri':encode_model(model),'p_metrics':metrics})
    if result and result.get('eligible_for_promotion'):
        try: rpc('gongsil_worker_promote_ml_candidate',{'p_worker_token':WORKER_TOKEN,'p_model_version':version})
        except Exception as e: print('promotion blocked',e,flush=True)
    return result
def infer(job):
    m=decode_model(job['artifact_uri']); x=feature_vector(job['features']); mean=np.asarray(m['m']); scale=np.asarray(m['s']); coef=np.asarray(m['c']); pred=max(0.0,float(m['i']+np.dot((x-mean)/scale,coef)))
    metrics=job.get('model_metrics') or {}; mae=float(metrics.get('holdout_mae') or max(pred*0.15,1.0)); spread=max(pred*0.10,mae); pmin=max(0,pred-spread); pmax=pred+spread; label_mean=float(metrics.get('label_mean') or max(pred,1.0)); conf=max(55.0,min(95.0,100.0*(1.0-mae/(abs(label_mean)+mae))))
    return rpc('gongsil_worker_complete_ml_inference_job',{'p_worker_token':WORKER_TOKEN,'p_job_id':job['job_id'],'p_worker_id':WORKER_ID,'p_claim_token':job['claim_token'],'p_prediction':pred,'p_min':pmin,'p_max':pmax,'p_confidence':conf,'p_metadata':{'engine':'ridge_v1'}})
def fail(kind,job,err):
    name='gongsil_worker_fail_ml_training_job' if kind=='training' else 'gongsil_worker_fail_ml_inference_job'
    try: rpc(name,{'p_worker_token':WORKER_TOKEN,'p_job_id':job['job_id'],'p_worker_id':WORKER_ID,'p_claim_token':job['claim_token'],'p_error':str(err)[:1800],'p_retry':True})
    except Exception as e: print('fail reporting error',e,flush=True)
def heartbeat(): rpc('gongsil_worker_heartbeat',{'p_worker_token':WORKER_TOKEN,'p_worker_id':WORKER_ID,'p_kind':'ml'})
busy=False
def loop():
    global busy
    while True:
        try:
            busy=True; heartbeat(); tj=rpc('gongsil_worker_claim_ml_training_job',{'p_worker_token':WORKER_TOKEN,'p_worker_id':WORKER_ID})
            if tj:
                try: train(tj)
                except Exception as e: print('training error',e,flush=True); fail('training',tj,e)
            for _ in range(4):
                ij=rpc('gongsil_worker_claim_ml_inference_job',{'p_worker_token':WORKER_TOKEN,'p_worker_id':WORKER_ID})
                if not ij: break
                try: infer(ij)
                except Exception as e: print('inference error',e,flush=True); fail('inference',ij,e)
        except Exception as e: print('worker loop error',e,flush=True)
        finally: busy=False
        time.sleep(POLL_SECONDS)
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body=json.dumps({'ok':self.path=='/health','worker':WORKER_ID,'kind':'ml','busy':busy}).encode(); self.send_response(200 if self.path=='/health' else 404); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body)
    def log_message(self,fmt,*args): pass
threading.Thread(target=loop,daemon=True).start(); HTTPServer(('0.0.0.0',PORT),Handler).serve_forever()
