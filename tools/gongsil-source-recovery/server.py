from http.server import BaseHTTPRequestHandler, HTTPServer
import urllib.request, os, base64

TARGETS={
  '/':'https://gongsil-helper.netlify.app/',
  '/source':'https://gongsil-helper.netlify.app/',
  '/app':'https://gongsil-helper.netlify.app/app.js?v=user-v5-20260918',
  '/styles':'https://gongsil-helper.netlify.app/styles.css?v=user-v5-20260918',
}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        target=TARGETS.get(self.path)
        if not target:
            self.send_response(404); self.end_headers(); return
        try:
            req=urllib.request.Request(target, headers={'User-Agent':'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=20) as response:
                data=response.read()
            self.send_response(200)
            self.send_header('Content-Type','text/plain; charset=utf-8')
            self.send_header('Cache-Control','no-store')
            self.end_headers()
            self.wfile.write(base64.b64encode(data))
        except Exception as exc:
            self.send_response(500); self.end_headers(); self.wfile.write(str(exc).encode())

def verify_live_patch():
    checks = {
        'index_version': ('https://gongsil-helper.netlify.app/', 'user-v6-20260919'),
        'brand_copy': ('https://gongsil-helper.netlify.app/app.js?v=user-v6-20260919', '망하지 않는 숙박사업'),
        'helper_universe_sso': ('https://gongsil-helper.netlify.app/app.js?v=user-v6-20260919', 'HELPER_UNIVERSE_AUTH_URL'),
        'ml_quote': ('https://gongsil-helper.netlify.app/app.js?v=user-v6-20260919', 'gongsil-ml-http.onrender.com/v1/quote'),
        'idempotent_pass': ('https://gongsil-helper.netlify.app/app.js?v=user-v6-20260919', 'gongsil_create_access_order_idempotent'),
    }
    for name, (url, needle) in checks.items():
        try:
            req = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=20) as response:
                text = response.read().decode('utf-8', errors='replace')
            print('PATCH_VERIFY', name, needle in text, flush=True)
        except Exception as exc:
            print('PATCH_VERIFY', name, 'ERROR', str(exc), flush=True)

verify_live_patch()
HTTPServer(('0.0.0.0', int(os.environ.get('PORT','10000'))), Handler).serve_forever()
