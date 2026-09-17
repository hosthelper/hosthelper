import json,base64,hashlib,time,zlib
from http.server import BaseHTTPRequestHandler,HTTPServer
import numpy as np
import xgboost as xgb

FEATURES=['operating_months','deposit_amount','monthly_rent','avg_monthly_revenue','avg_daily_rate','fixed_cost','management_fee','occupancy_rate','asset_reuse_pct','facility_investment','review_score','reservation_forward_rate','accessibility_score','tourism_proximity_score','area','accommodation_type']
MAX_BODY=8*1024*1024
XGB_PREFIX='gongsil-xgb-v1:'
RIDGE_PREFIX='data:application/json;base64,'

def stable_cat(v):
    if v is None or v=='': return 0.0
    h=hashlib.sha256(str(v).encode()).digest(); return int.from_bytes(h[:4],'big')/4294967295.0

def n(v,default=0.0):
    try:
        if v is None or v=='': return float(default)
        return float(v)
    except: return float(default)

def vec(f):
    o=[]
    for name in FEATURES:
        v=(f or {}).get(name)
        if name in ('area','accommodation_type'): o.append(stable_cat(v))
        else: o.append(n(v,0))
    return np.asarray(o,dtype=float)

def baseline_from_features(f):
    f=f or {}
    monthly_rent=n(f.get('monthly_rent'),0)
    fixed=n(f.get('fixed_cost'),0)
    mgmt=n(f.get('management_fee'),0)
    revenue=n(f.get('avg_monthly_revenue'),0)
    operating=n(f.get('operating_months'),0)
    occ=n(f.get('occupancy_rate'),60)
    facility=n(f.get('facility_investment'),0)
    reuse=n(f.get('asset_reuse_pct'),0)
    review=n(f.get('review_score'),4)
    forward=n(f.get('reservation_forward_rate'),occ)
    access=n(f.get('accessibility_score'),50)
    tourism=n(f.get('tourism_proximity_score'),50)
    profit=max(revenue-(monthly_rent+fixed+mgmt),0)
    if reuse:
        facility_value=facility*(reuse/100.0)
    else:
        facility_value=facility*max(0.20,1-operating/60.0)
    quality=1 + max(-0.08,min(0.12,(occ-60)/400.0)) + max(-0.04,min(0.06,(review-4)/20.0)) + max(-0.04,min(0.06,(forward-60)/500.0)) + max(-0.03,min(0.05,(access-50)/1000.0)) + max(-0.03,min(0.05,(tourism-50)/1000.0))
    business=profit*max(6,min(18,8+operating/6.0))*quality
    return float(round(max(0,facility_value+business)))

def enc_ridge(m):
    raw=json.dumps(m,separators=(',',':')).encode()
    return RIDGE_PREFIX+base64.urlsafe_b64encode(raw).decode()

def dec_ridge(uri):
    return json.loads(base64.urlsafe_b64decode(str(uri).split(',',1)[1].encode()).decode())

def pack_xgb(model,mode,blend):
    raw=model.get_booster().save_raw(raw_format='ubj')
    header=json.dumps({'v':1,'mode':mode,'blend':float(blend)},separators=(',',':')).encode()
    packed=zlib.compress(header+b'\n'+bytes(raw),9)
    return XGB_PREFIX+base64.urlsafe_b64encode(packed).decode()

def unpack_xgb(uri):
    packed=zlib.decompress(base64.urlsafe_b64decode(str(uri)[len(XGB_PREFIX):].encode()))
    header_raw,model_raw=packed.split(b'\n',1)
    header=json.loads(header_raw.decode())
    booster=xgb.Booster()
    booster.load_model(bytearray(model_raw))
    return header,booster

def ridge_candidate(X,y,Xh):
    mean=X.mean(axis=0); scale=X.std(axis=0); scale[scale<1e-9]=1.0
    Z=(X-mean)/scale; Zh=(Xh-mean)/scale
    A=np.column_stack([np.ones(len(Z)),Z]); Ah=np.column_stack([np.ones(len(Zh)),Zh])
    reg=np.eye(A.shape[1]); reg[0,0]=0
    beta=np.linalg.solve(A.T@A+reg,A.T@y)
    pred=np.maximum(0,Ah@beta)
    model={'v':1,'i':round(float(beta[0]),8),'c':[round(float(x),8) for x in beta[1:]],'m':[round(float(x),8) for x in mean],'s':[round(float(x),8) for x in scale]}
    return pred,enc_ridge(model),'ridge_v1'

def train(payload):
    rows=payload.get('examples') or []
    if len(rows)>1000: raise ValueError('too_many_rows')
    tr=[r for r in rows if r.get('split')=='train']; ho=[r for r in rows if r.get('split')=='holdout']
    if len(tr)<30 or len(ho)<10: raise ValueError('insufficient_rows')
    X=np.vstack([vec(r.get('features')) for r in tr]); y=np.asarray([float(r['label_premium']) for r in tr],dtype=float)
    Xh=np.vstack([vec(r.get('features')) for r in ho]); yh=np.asarray([float(r['label_premium']) for r in ho],dtype=float)
    bt=np.asarray([float(r.get('baseline_prediction')) if r.get('baseline_prediction') is not None else baseline_from_features(r.get('features')) for r in tr],dtype=float)
    bh=np.asarray([float(r.get('baseline_prediction')) if r.get('baseline_prediction') is not None else baseline_from_features(r.get('features')) for r in ho],dtype=float)
    baseline=float(np.mean(np.abs(bh-yh)))
    X2=np.column_stack([X,bt]); Xh2=np.column_stack([Xh,bh])
    candidates=[]
    rp,ra,re=ridge_candidate(X2,y,Xh2)
    candidates.append((float(np.mean(np.abs(rp-yh))),rp,ra,re,{'mode':'direct'}))
    grids=[
      {'n_estimators':80,'max_depth':2,'learning_rate':0.04,'min_child_weight':2,'reg_lambda':8.0,'subsample':0.9,'colsample_bytree':0.9},
      {'n_estimators':140,'max_depth':2,'learning_rate':0.03,'min_child_weight':2,'reg_lambda':10.0,'subsample':0.9,'colsample_bytree':0.9},
      {'n_estimators':100,'max_depth':3,'learning_rate':0.035,'min_child_weight':3,'reg_lambda':12.0,'subsample':0.9,'colsample_bytree':0.85},
    ]
    for g in grids:
        m=xgb.XGBRegressor(objective='reg:squarederror',random_state=2026,n_jobs=1,verbosity=0,**g)
        m.fit(X2,y-bt)
        residual=m.predict(Xh2)
        for blend in (0.35,0.5,0.7,1.0):
            pred=np.maximum(0,bh+blend*residual)
            mae=float(np.mean(np.abs(pred-yh)))
            art=pack_xgb(m,'residual',blend)
            candidates.append((mae,pred,art,'xgboost_residual_v1',{'mode':'residual','blend':blend,'params':g}))
        md=xgb.XGBRegressor(objective='reg:squarederror',random_state=2027,n_jobs=1,verbosity=0,**g)
        md.fit(X2,np.log1p(np.maximum(y,0)))
        pred=np.maximum(0,np.expm1(md.predict(Xh2)))
        mae=float(np.mean(np.abs(pred-yh)))
        art=pack_xgb(md,'log_direct',1.0)
        candidates.append((mae,pred,art,'xgboost_log_v1',{'mode':'log_direct','params':g}))
    best=min(candidates,key=lambda z:z[0])
    mae,pred,artifact,engine,meta=best
    return {'ok':True,'model_version':'premium-xgb-'+time.strftime('%Y%m%d%H%M%S',time.gmtime()),'artifact_uri':artifact,'metrics':{'holdout_mae':mae,'baseline_holdout_mae':baseline,'label_mean':float(np.mean(yh)),'engine':engine,'selection':meta,'artifact_bytes':len(artifact)},'eligible_for_promotion':len(tr)>=30 and len(ho)>=10 and mae<baseline}

def infer(payload):
    uri=str(payload.get('artifact_uri',''))
    features=payload.get('features') or {}
    metrics=payload.get('model_metrics') or {}
    if uri.startswith(XGB_PREFIX):
        header,booster=unpack_xgb(uri)
        x0=vec(features); b=baseline_from_features(features); x=np.concatenate([x0,[b]])
        raw=float(booster.predict(xgb.DMatrix(x.reshape(1,-1)))[0])
        mode=header.get('mode')
        if mode=='residual': pred=max(0.0,b+float(header.get('blend',1))*raw)
        elif mode=='log_direct': pred=max(0.0,float(np.expm1(raw)))
        else: raise ValueError('unsupported_xgb_mode')
        engine=metrics.get('engine') or 'xgboost_v1'
    elif uri.startswith(RIDGE_PREFIX):
        m=dec_ridge(uri); x0=vec(features); b=baseline_from_features(features); x=np.concatenate([x0,[b]])
        mean=np.asarray(m['m'],dtype=float); scale=np.asarray(m['s'],dtype=float); coef=np.asarray(m['c'],dtype=float)
        pred=max(0.0,float(m['i']+np.dot((x-mean)/scale,coef)))
        engine='ridge_v1'
    else:
        raise ValueError('unsupported_artifact')
    mae=float(metrics.get('holdout_mae') or max(pred*0.15,1.0)); spread=max(pred*0.10,mae)
    label_mean=float(metrics.get('label_mean') or max(pred,1.0)); conf=max(55.0,min(95.0,100.0*(1.0-mae/(abs(label_mean)+mae))))
    return {'ok':True,'prediction':pred,'premium_min':max(0,pred-spread),'premium_max':pred+spread,'confidence':conf,'metadata':{'engine':engine,'baseline_prediction':baseline_from_features(features)}}

class H(BaseHTTPRequestHandler):
    def _send(self,code,obj):
        b=json.dumps(obj,separators=(',',':')).encode(); self.send_response(code); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        self._send(200,{'ok':True,'service':'gongsil-ml-http','version':'2.0.0','engine':'xgboost_residual_v1','features':len(FEATURES)}) if self.path=='/health' else self._send(404,{'ok':False})
    def do_POST(self):
        try:
            size=int(self.headers.get('Content-Length','0'))
            if size<=0 or size>MAX_BODY: return self._send(413,{'ok':False,'error':'invalid_body_size'})
            payload=json.loads(self.rfile.read(size))
            if self.path=='/v1/train': return self._send(200,train(payload))
            if self.path=='/v1/infer': return self._send(200,infer(payload))
            return self._send(404,{'ok':False})
        except Exception as e:
            return self._send(400,{'ok':False,'error':str(e)[:500]})
    def log_message(self,fmt,*args): pass

HTTPServer(('0.0.0.0',int(__import__('os').environ.get('PORT','10000'))),H).serve_forever()
