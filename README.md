# Adaptive Network Traffic Generator (ATG)

A modular network testing platform designed to generate controlled traffic, capture packets, analyze network behavior, and evaluate system performance.

This system was developed as part of a cybersecurity and networking research initiative focused on traffic validation, execution control, and end-to-end network verification.

---

## Overview

The Adaptive Network Traffic Generator (ATG) enables structured traffic simulation and validation across multiple protocols using a modular and extensible architecture.

The system not only generates traffic but also verifies delivery using a dual validation approach, combining packet capture analysis with receiver-side validation (Level-2 architecture).

### Key Capabilities

* Protocol-based traffic generation
* Execution-synchronized packet capture
* PCAP-based traffic analysis
* End-to-end packet validation using receiver agents
* Execution control and scheduling
* Metrics generation and storage
* Header-level packet inspection

---

## System Architecture

### Level-1 (Sender + Capture Model)

```mermaid
flowchart LR
    Sender --> Network --> CaptureManager --> Analyzer --> Metrics
```

### Level-2 (Receiver Validation Model – Implemented)

```mermaid
flowchart LR
    Sender --> Network --> ReceiverAgent --> MetricsEngine --> Database
```

---

## Execution Workflow

```mermaid
sequenceDiagram
    participant UI as Frontend
    participant API as FastAPI
    participant EM as ExecutionManager
    participant EE as ExecutionEngine
    participant CAP as CaptureManager
    participant SND as Sender
    participant ANA as CaptureAnalyzer
    participant RCV as ReceiverAgent
    participant DB as MongoDB

    UI->>API: POST /execute
    API->>EM: start_job()

    EM->>EE: start()
    EE->>CAP: start_capture()
    EE->>SND: generate traffic

    SND-->>Network: send packets
    Network-->>RCV: receive packets

    EE->>CAP: stop_capture()
    CAP->>PCAP: save .pcap

    EE->>ANA: analyze(pcap)
    ANA->>EE: metrics

    RCV->>DB: validation metrics
    EE->>DB: store execution result
```

---

## Features

### Traffic Generation

* Supports ICMP, HTTP, HTTPS, SSH
* Configurable packet count, size, duration, and rate

### Packet Capture

* Real-time packet sniffing using Scapy
* Automatic PCAP generation
* Lifecycle-based capture control

### Receiver Validation (Level-2)

* End-to-end packet verification
* Latency tracking
* Duplicate detection
* Sequence validation

### Packet Analysis

* Packet count verification
* Protocol breakdown
* Delivery percentage

### Execution Control

* Start / Pause / Resume / Stop

### Scheduling

* One-time and interval-based execution

### Storage

* MongoDB for profiles, executions, and metrics

---

## Project Structure

```
backend/
├── level0/
├── level1_backend/
├── level2/
```

---

## Technologies Used

* Python
* FastAPI
* Scapy
* MongoDB

---

## Setup

```bash
pip install fastapi uvicorn scapy pymongo dnspython
```

```bash
python -m uvicorn backend.api:app
```

---

## Running

* Backend: http://localhost:8000/docs
* Frontend: http://localhost:3000

---

## Authors

* Anikait Nair
* Dr. Swetha P
* Dr. Prasad B Honnavalli

---

## License

Licensed under Apache License 2.0
