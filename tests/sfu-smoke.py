"""Control-plane startup only: this deliberately does not certify SFU media."""
import json
import os
import socket
import subprocess
import sys
import time
import urllib.request

binary = os.path.abspath(sys.argv[1])
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
env = dict(os.environ, MAIA_CONTROL_BIND='127.0.0.1', MAIA_CONTROL_PORT=str(port),
           MAIA_UDP_PORT_MIN='23100', MAIA_UDP_PORT_MAX='23110')
process = subprocess.Popen([binary], env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
try:
    for attempt in range(100):
        if process.poll() is not None:
            raise RuntimeError(process.communicate())
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{port}/health', timeout=1) as response:
                assert json.load(response)['status'] == 'ok'
                break
        except OSError:
            time.sleep(0.05)
    else:
        raise AssertionError('SFU control did not start')
    collision = subprocess.run([binary], env=env, capture_output=True, timeout=5)
    assert collision.returncode != 0, 'An occupied control port must fail'
finally:
    if process.poll() is None:
        process.terminate()
    try:
        stdout, stderr = process.communicate(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.communicate()
        raise
assert process.returncode == 0, stderr.decode()
for overrides in [{'MAIA_CONTROL_PORT': '65536'}, {'MAIA_UDP_PORT_MIN': '0'},
                  {'MAIA_UDP_PORT_MIN': '24000', 'MAIA_UDP_PORT_MAX': '23000'}]:
    result = subprocess.run([binary], env=dict(env, **overrides), capture_output=True, timeout=5)
    assert result.returncode != 0, overrides
print('PASS: SFU control health, custom port, port collision, invalid ranges and shutdown')
