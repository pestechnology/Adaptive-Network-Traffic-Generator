import socket
import json
import uuid
import time

packet = {
    "packet_id": str(uuid.uuid4()),
    "sequence": 1,
    "timestamp": time.time(),
    "data": "test"
}

sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.connect(("127.0.0.1", 5001))
sock.sendall(json.dumps(packet).encode())

ack = sock.recv(4096)
print("ACK RECEIVED:", ack.decode())

sock.close()
