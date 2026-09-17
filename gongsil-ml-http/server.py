import json,base64,hashlib,time
from http.server import BaseHTTPRequestHandler,HTTPServer
import numpy as np

FEATURES=['operating_months','deposit_amount','monthly_rent','avg_monthly_revenue','avg_daily_rate','fixed_cost','management_fee','occupancy_rate','asset_reuse_pct','facility_investment','review_score','reservation_forward_rate','accessibility_score','tourism_proximity_score','area','accommodation_type']
MAX_BODY=4*1024*1024

def stable_cat(v):
    if v is None or v=='': return 0.0
    h=hashlib.sha256(str(v).encode()).digest(); return int.from_bytes(h[:4],'big')/4294967295.0

def vec(f):
    o=[]
    for n in FEATURES:
        v=(f or {}).get(n)
        if n in ('area','accommodation_type'): o.append(stable_cat(v))
        else:
            try:o.append(float(v or 0))
            except:o.append(0.0)
    return np.asarray(o,dtype=float)

def enc(m):
    raw=json.dumps(m,separators=(',',':')).encode(); uri='data:application/json;base64,'+base64.urlsafe_b64encode(raw).decode()
    if len(uri)>1000: raise ValueError('artifact_too_large')
    return uri

def dec(uri):
    if not str(uri).startswith('data:application/json;base64,'): raise ValueError('unsupported_artifact')
    return json.loads(base64.urlsafe_b64decode(str(uri).split(',',1)[1].encode()).decode())

def train(payload):
    rows=payload.get('examples') or []
    if len(rows)>500: raise ValueError('too_many_rows')
    tr=[r for r in rows if r.get('split')=='train']; ho=[r for r in rows if r.get('split')=='holdout']
    if len(tr)<30 or len(ho)<10: raise ValueError('insufficient_rows')
    X=np.vstack([vec(r.get('features')) for r in tr]); y=np.asarray([float(r['label_premium']) for r in tr],dtype=float)
    Xh=np.vstack([vec(r.get('features')) for r in ho]); yh=np.asarray([float(r['label_premium']) for r in ho],dtype=float)
    mean=X.mean(axis=0); scale=X.std(axis=0); scale[scale<1e-9]=1.0
    Z=(X-mean)/scale; Zh=(Xh-mean)/scale
    A=np.column_stack([np.ones(len(Z)),Z]); Ah=np.column_stack([np.ones(len(Zh)),Zh])
    reg=np.eye(A.shape[1]); reg[0,0]=0
    beta=np.linalg.solve(A.T@A+reg,A.T@y)
    pred=np.maximum(0,Ah@beta)
    mae=float(np.mean(np.abs(pred-yh)))
    bp=[]; by=[]
    for r in ho:
        if r.get('baseline_prediction') is None: raise ValueError('baseline_predictions_missing')
        bp.append(float(r['baseline_prediction'])); by.append(float(r['label_premium']))
    baseline=float(np.mean(np.abs(np.asarray(bp)-np.asarray(by))))
    model={'v':1,'i':round(float(beta[0]),8),'c':[round(float(x),8) for x in beta[1:]],'m':[round(float(x),8) for x in mean],'s':[round(float(x),8) for x in scale]}
    return {'ok':True,'model_version':'premium-ridge-'+time.strftime('%Y%m%d%H%M%S',time.gmtime()),'artifact_uri':enc(model),'metrics':{'holdout_mae':mae,'baseline_holdout_mae':baseline,'label_mean':float(np.mean(yh)),'engine':'ridge_v1'},'eligible_for_promotion':len(tr)>=30 and len(ho)>=10 and mae<baseline}

def infer(payload):
    m=dec(payload.get('artifact_uri','')); x=vec(payload.get('features') or {})
    mean=np.asarray(m['m'],dtype=float); scale=np.asarray(m['s'],dtype=float); coef=np.asarray(m['c'],dtype=float)
    pred=max(0.0,float(m['i']+np.dot((x-mean)/scale,coef)))
    metrics=payload.get('model_metrics') or {}; mae=float(metrics.get('holdout_mae') or max(pred*0.15,1.0)); spread=max(pred*0.10,mae)
    label_mean=float(metrics.get('label_mean') or max(pred,1.0)); conf=max(55.0,min(95.0,100.0*(1.0-mae/(abs(label_mean)+mae))))
    return {'ok':True,'prediction':pred,'premium_min':max(0,pred-spread),'premium_max':pred+spread,'confidence':conf,'metadata':{'engine':'ridge_v1'}}

class H(BaseHTTPRequestHandler):
    def _send(self,code,obj):
        b=json.dumps(obj,separators=(',',':')).encode(); self.send_response(code); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        self._send(200,{'ok':True,'service':'gongsil-ml-http','version':'1.0.0','engine':'ridge_v1'}) if self.path=='/health' else self._send(404,{'ok':False})
    def do_POST(self):
        try:
            n=int(self.headers.get('Content-Length','0'))
            if n<=0 or n>MAX_BODY: return self._send(413,{'ok':False,'error':'invalid_body_size'})
            p=json.loads(self.rfile.read(n))
            if self.path=='/v1/train': return self._send(200,train(p))
            if self.path=='/v1/infer': return self._send(200,infer(p))
            return self._send(404,{'ok':False})
        except Exception as e:
            return self._send(400,{'ok':False,'error':str(e)[:300]})
    def log_message(self,fmt,*args): pass

HTTPServer(('0.0.0.0',int(__import__('os').environ.get('PORT','10000'))),H).serve_forever()
