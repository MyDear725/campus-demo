#!/usr/bin/env python3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
import sys

root = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(__file__))
port = int(sys.argv[2] if len(sys.argv) > 2 else os.environ.get("PORT", "4173"))
os.chdir(root)


class CampusHandler(SimpleHTTPRequestHandler):
  extensions_map = {
      **SimpleHTTPRequestHandler.extensions_map,
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".mjs": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".svg": "image/svg+xml",
      ".json": "application/json",
      ".glb": "model/gltf-binary",
      ".png": "image/png",
      ".jpg": "image/jpeg",
  }

  def end_headers(self):
    self.send_header("Cache-Control", "no-cache")
    super().end_headers()

  def log_message(self, format, *args):
    pass


if __name__ == "__main__":
  try:
    server = ThreadingHTTPServer(("127.0.0.1", port), CampusHandler)
    server.serve_forever()
  except OSError:
    # Port already in use (another server instance is already running)
    sys.exit(0)
