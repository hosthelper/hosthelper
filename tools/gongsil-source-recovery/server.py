from http.server import BaseHTTPRequestHandler, HTTPServer
import urllib.request, os, base64

TARGET='https://gongsil-helper.netlify.app/'

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path not in ('/','/source'):
            self.send_response(404); self.end_headers(); return
        try:
            req=urllib.request.Request(TARGET, headers={'User-Agent':'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=20) as response:
                data=response.read()
            self.send_response(200)
            self.send_header('Content-Type','text/plain; charset=utf-8')
            self.send_header('Cache-Control','no-store')
            self.end_headers()
            self.wfile.write(base64.b64encode(data))
        except Exception as exc:
            self.send_response(500); self.end_headers(); self.wfile.write(str(exc).encode())

HTTPServer(('0.0.0.0', int(os.environ.get('PORT','10000'))), Handler).serve_forever()
