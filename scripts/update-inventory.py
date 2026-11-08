"""Write and verify inventory using existing private Sites service access.

Send {origin, token, inventory} as one JSON line on stdin only. Never supply
credentials as arguments, environment files, source or shell interpolation.
"""
import json
import sys
import urllib.error
import urllib.parse
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def main():
    if sys.stdin.isatty():
        import termios
        settings = termios.tcgetattr(sys.stdin)
        settings[3] &= ~(termios.ECHO | termios.ICANON)
        settings[6][termios.VMIN] = 1
        settings[6][termios.VTIME] = 0
        termios.tcsetattr(sys.stdin, termios.TCSANOW, settings)
    print('Ready for private Site update JSON on stdin (input is hidden).', flush=True)
    config = json.loads(sys.stdin.readline())
    origin = config['origin']
    parsed = urllib.parse.urlsplit(origin)
    if parsed.scheme != 'https' or not parsed.hostname or not parsed.hostname.endswith('.chatgpt.site') or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ('', '/') or parsed.port:
        raise ValueError('Use the exact published Site origin')
    endpoint = origin.rstrip('/') + '/api/inventory'
    headers = {'OAI-Sites-Authorization': 'Bearer ' + config['token'], 'Content-Type': 'application/json'}
    opener = urllib.request.build_opener(NoRedirect())

    def request(method, body=None):
        req = urllib.request.Request(endpoint, data=body, headers=headers, method=method)
        with opener.open(req, timeout=30) as response:
            
            if 'application/json' not in response.headers.get('Content-Type', ''):
                print(json.dumps({'status': 'unexpected_response', 'httpStatus': response.status, 'contentType': response.headers.get('Content-Type', '')}), flush=True)
                raise ValueError('Expected a JSON response')
            return json.load(response)

    inventory = config['inventory']
    written = request('POST', json.dumps(inventory).encode('utf-8'))
    if written.get('status') != 'success':
        raise ValueError('Site did not confirm the update')
    stored = request('GET')
    if stored['syncedAt'] != inventory['syncedAt'] or stored != inventory:
        raise ValueError('Inventory readback did not match the write')
    print(json.dumps({'status': 'verified', 'count': len(stored['sites']), 'syncedAt': stored['syncedAt']}), flush=True)


try:
    main()
except urllib.error.HTTPError as error:
    print(json.dumps({'status': 'failed', 'httpStatus': error.code}), flush=True)
    sys.exit(1)
except Exception as error:
    # No provider error content or request headers reach logs.
    print(json.dumps({'status': 'failed', 'errorType': type(error).__name__}), flush=True)
    sys.exit(1)
