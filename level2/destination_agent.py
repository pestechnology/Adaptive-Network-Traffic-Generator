import socket
import struct
import time
import threading
from collections import defaultdict

ATG_HEADER = b"ATG1"
PORT = 7070

class AgentState:
    def __init__(self):
        self.received = 0
        self.last_seq = -1
        self.duplicates = 0
        self.out_of_order = 0
        self.latencies = []
        self.seen = set()

state = AgentState()

def parse_packet(data):
    try:
        header, seq, ts, counter, _ = struct.unpack("!4sIQQQ", data[:32])
        if header != ATG_HEADER:
            return None
        return seq, ts
    except:
        return None

def handle_packet(data, addr, sock):
    parsed = parse_packet(data)
    if not parsed:
        return

    seq, sent_ts = parsed
    now = time.time_ns()

    # Duplicate detection
    if seq in state.seen:
        state.duplicates += 1
        return

    state.seen.add(seq)

    # Out-of-order detection
    if seq < state.last_seq:
        state.out_of_order += 1

    state.last_seq = seq
    state.received += 1

    # Latency
    latency_ms = (now - sent_ts) / 1e6
    state.latencies.append(latency_ms)

    # Echo response (important for RTT)
    sock.sendto(data, addr)

def start_probe_listener():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(("0.0.0.0", PORT))

    print(f"[AGENT] Listening on UDP {PORT}")

    while True:
        data, addr = sock.recvfrom(2048)
        threading.Thread(target=handle_packet, args=(data, addr, sock)).start()

# --- MANAGEMENT API (simple HTTP server) ---
from http.server import BaseHTTPRequestHandler, HTTPServer
import json

class AgentHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/stats":
            response = {
                "received": state.received,
                "duplicates": state.duplicates,
                "out_of_order": state.out_of_order,
                "avg_latency_ms": (
                    sum(state.latencies) / len(state.latencies)
                    if state.latencies else 0
                ),
            }

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())

def start_http():
    server = HTTPServer(("0.0.0.0", 7071), AgentHandler)
    print("[AGENT] HTTP on 7071")
    server.serve_forever()

if __name__ == "__main__":
    threading.Thread(target=start_probe_listener).start()
    start_http()