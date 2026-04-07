import time
from level0.receiver_manager import ReceiverManager


def main():
    manager = ReceiverManager()
    print(manager.start_receiver())

    try:
        while True:
            time.sleep(5)
            print("[Receiver Metrics]", manager.get_metrics())
    except KeyboardInterrupt:
        print(manager.stop_receiver())


if __name__ == "__main__":
    main()
