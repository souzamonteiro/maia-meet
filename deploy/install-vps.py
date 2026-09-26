"""Publish Meet through an existing Maia Edge VPN; never reconfigure WireGuard."""
import argparse
import datetime
import ipaddress
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument('--domain', default='meet.maiaplatform.org')
parser.add_argument('--upstream', default='10.77.0.2:3181')
parser.add_argument('--email', help='ACME contact; prompted on first issuance if omitted')
parser.add_argument('--cert', type=Path)
parser.add_argument('--key', type=Path)
parser.add_argument('--dry-run', action='store_true')
args = parser.parse_args()
if not re.fullmatch(r'[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?', args.domain):
    parser.error('Invalid domain')
try:
    host, port = args.upstream.split(':')
    if not ipaddress.IPv4Address(host).is_private or not 1 <= int(port) <= 65535:
        raise ValueError()
    args.upstream = f'{host}:{int(port)}'
except ValueError:
    parser.error('--upstream must be a private IPv4 address and port, e.g. 10.77.0.2:3181')
if bool(args.cert) != bool(args.key):
    parser.error('Pass both --cert and --key')
custom_cert = bool(args.cert)
cert = args.cert or Path(f'/etc/letsencrypt/live/{args.domain}/fullchain.pem')
key = args.key or Path(f'/etc/letsencrypt/live/{args.domain}/privkey.pem')
for path in [cert, key]:
    if not re.fullmatch(r'/[A-Za-z0-9_./-]+', str(path)):
        parser.error('Certificate paths must be absolute without spaces or nginx metacharacters')
marker = '# Maia Meet: managed by deploy/install-vps.py'
site = Path('/etc/nginx/sites-available/maia-meet-public.conf')
link = Path('/etc/nginx/sites-enabled/maia-meet-public.conf')
webroot = Path('/var/www/maia-meet-acme')
hook = Path('/etc/letsencrypt/renewal-hooks/deploy/maia-meet-nginx')
http = f'''{marker}
server {{
    listen 80;
    server_name {args.domain};
    location ^~ /.well-known/acme-challenge/ {{
        root {webroot};
        default_type text/plain;
        try_files $uri =404;
    }}
    location / {{ return 308 https://{args.domain}$request_uri; }}
}}
'''
https = f'''server {{
    listen 443 ssl;
    server_name {args.domain};
    ssl_certificate {cert};
    ssl_certificate_key {key};
    ssl_protocols TLSv1.2 TLSv1.3;
    location / {{
        proxy_pass http://{args.upstream};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 10s;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_buffering off;
    }}
}}
'''
if args.dry_run:
    print(http + https)
    print(f'# Backend health required: http://{args.upstream}/health')
    raise SystemExit(0)
if os.geteuid() != 0:
    parser.error('Run on the VPS with sudo, or use --dry-run locally')
for tool in ['nginx', 'systemctl', 'openssl']:
    if not shutil.which(tool):
        raise RuntimeError(f'Missing {tool}; install nginx, openssl and certbot on the VPS first')
needs_certificate = not (cert.is_file() and key.is_file())
if needs_certificate:
    if custom_cert:
        parser.error('Custom certificate/key files must already exist')
    if not shutil.which('certbot'):
        raise RuntimeError('Install certbot first: sudo apt-get install certbot')
    if not args.email and sys.stdin.isatty():
        args.email = input('Email for the HTTPS certificate (Let\'s Encrypt): ').strip()
    if not args.email or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', args.email):
        parser.error('First certificate issuance requires --email you@example.com')


def run(*command, **kwargs):
    return subprocess.run(command, check=True, **kwargs)


def reload_nginx():
    run('nginx', '-t')
    run('systemctl', 'reload', 'nginx')


run('nginx', '-t')
configuration = run('nginx', '-T', capture_output=True, text=True).stdout
if not re.search(r'include\s+/etc/nginx/sites-enabled/\*', configuration):
    raise RuntimeError('Expected the standard /etc/nginx/sites-enabled/* include')
# Refuse a second vhost for the same domain, including files managed by Maia Edge.
sections = re.split(r'# configuration file ([^\n]+):\n', configuration)
for index in range(1, len(sections), 2):
    filename, contents = sections[index:index + 2]
    for names in re.findall(r'\bserver_name\s+([^;]+);', contents):
        if args.domain in names.split() and Path(filename).resolve() != site.resolve():
            raise RuntimeError(f'{args.domain} is already configured in {filename}; migrate that site first')
if hook.exists() and '# Maia Meet renewal hook' not in hook.read_text():
    raise RuntimeError(f'Refusing to overwrite unmanaged {hook}')
if site.exists() and marker not in site.read_text():
    raise RuntimeError(f'Refusing to overwrite unmanaged {site}')
if link.exists() or link.is_symlink():
    if not link.is_symlink() or link.resolve() != site.resolve():
        raise RuntimeError(f'Refusing to replace {link}')
# Fail before changing nginx if the on-premises service/VPN/firewall is not ready.
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
try:
    with opener.open(f'http://{args.upstream}/health', timeout=10) as response:
        import json
        body = json.load(response)
        if response.status != 200 or body.get('mediaMode') != 'mesh':
            raise RuntimeError('Upstream is not the Maia Meet service')
except OSError as error:
    raise RuntimeError(f'Cannot reach http://{args.upstream}/health. Install the node and check the VPN/firewall first.') from error

stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
backup = Path('/var/backups/maia-meet-vps') / stamp
backup.mkdir(parents=True, mode=0o700)
previous = {}
for path in [site, hook]:
    previous[path] = path.exists()
    if path.exists():
        shutil.copy2(path, backup / path.name)
had_link = link.is_symlink()
try:
    site.parent.mkdir(parents=True, exist_ok=True)
    link.parent.mkdir(parents=True, exist_ok=True)
    webroot.mkdir(parents=True, exist_ok=True, mode=0o755)
    if not had_link:
        link.symlink_to(site)
    if needs_certificate:
        site.write_text(http)
        reload_nginx()
        run('certbot', 'certonly', '--webroot', '-w', str(webroot), '-d', args.domain,
            '--non-interactive', '--agree-tos', '--email', args.email)
    run('openssl', 'x509', '-in', str(cert), '-noout', '-checkhost', args.domain)
    run('openssl', 'x509', '-in', str(cert), '-noout', '-checkend', '0')
    site.write_text(http + https)
    reload_nginx()
    hook.parent.mkdir(parents=True, exist_ok=True)
    hook.write_text('#!/bin/sh\n# Maia Meet renewal hook\nset -e\n/usr/sbin/nginx -t\n/bin/systemctl reload nginx\n')
    hook.chmod(0o755)
except Exception:
    if not had_link and link.is_symlink():
        link.unlink()
    for path, existed in previous.items():
        if existed:
            shutil.copy2(backup / path.name, path)
        elif path.exists():
            path.unlink()
    reload_nginx()
    print(f'Restored previous nginx files. Backup: {backup}. Issued certificates, if any, are retained.')
    raise
print(f'Published: https://{args.domain}/')
print(f'WebSocket and HTTP upstream: {args.upstream}; backup: {backup}')
print('Check certificate renewal scheduling with: systemctl list-timers certbot.timer')
print('This script did not change WireGuard, DNS or firewall rules.')
