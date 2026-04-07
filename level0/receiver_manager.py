from level0.receivers.tcp_receiver import TCPReceiver


class ReceiverManager:
    def __init__(self):
        self.receiver = None

    def start_receiver(self, host="0.0.0.0", port=8080):
        if self.receiver:
            return "[Manager] Receiver already running"

        self.receiver = TCPReceiver(host, port)
        self.receiver.start()
        return "[Manager] Receiver started"

    def stop_receiver(self):
        if not self.receiver:
            return "[Manager] Receiver not running"

        self.receiver.stop()
        self.receiver = None
        return "[Manager] Receiver stopped"

    def get_metrics(self):
        if not self.receiver:
            return {"error": "Receiver not running"}

        return self.receiver.get_metrics()