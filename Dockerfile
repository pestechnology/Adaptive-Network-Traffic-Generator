FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1

# Install system deps (needed for Scapy)
RUN apt-get update && apt-get install -y \
    gcc \
    libpcap-dev \
    iproute2 \
    net-tools \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy entire project (IMPORTANT for level2 imports)
COPY . .

# Expose FastAPI port
EXPOSE 8000

# Run FastAPI (adjust path to your main file)
CMD ["uvicorn", "level1_backend.api:app", "--host", "0.0.0.0", "--port", "8000"]
