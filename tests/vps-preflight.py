"""Real HTTP checks of the VPS installer, without root or system modifications."""
import http.server
import json
from pathlib import Path
import subprocess
import sys
import threading
import time
import unittest

script = Path(__file__).resolve().parents[1] / 'deploy/install-vps.py'

class PreflightTest(unittest.TestCase):
    def check(self, body, delay=0, status=200):
        class Handler(http.server.BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass
            def do_GET(self):
                time.sleep(delay)
                self.send_response(status)
                self.end_headers()
                try:
                    self.wfile.write(body)
                except BrokenPipeError:
                    pass
        server = http.server.HTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever)
        thread.start()
        try:
            return subprocess.run([sys.executable, str(script), '--check-upstream', '--upstream',
                f'127.0.0.1:{server.server_port}', '--timeout', '0.1'],
                capture_output=True, text=True, timeout=5)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_healthy_backend(self):
        result = self.check(json.dumps({'status': 'ok', 'mediaMode': 'mesh'}).encode())
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('Backend ready:', result.stdout)

    def test_failure_is_actionable_without_traceback_or_email_prompt(self):
        for body, delay, status in [(b'not json', 0, 200), (b'[]', 0, 200), (b'{}', 0, 404), (b'{}', 0.3, 200)]:
            with self.subTest(body=body, delay=delay, status=status):
                result = self.check(body, delay, status)
                self.assertEqual(result.returncode, 1)
                self.assertIn('Backend check failed:', result.stderr)
                self.assertIn('sudo ufw status verbose', result.stderr)
                self.assertNotIn('Traceback', result.stderr)
                self.assertNotIn('Email for', result.stdout)

if __name__ == '__main__':
    unittest.main()
