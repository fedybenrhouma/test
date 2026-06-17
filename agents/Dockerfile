FROM python:3.11-slim

WORKDIR /app

# Install system dependencies with aggressive network error handling
# libgomp1 is required for xgboost, libpq-dev for psycopg
RUN apt-get update -y -o Acquire::http::No-Cache=True && \
    apt-get install -y --no-install-recommends \
    -o Acquire::http::No-Cache=True \
    -o Acquire::BrokenProxy=true \
    build-essential \
    libgomp1 \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip and install wheel
RUN pip install --no-cache-dir --upgrade pip wheel setuptools

# Copy requirements
COPY requirements.txt .

# Install Python dependencies with extreme network resilience
RUN pip config set global.progress_bar off && \
    pip install --no-cache-dir \
    --default-timeout=1000 \
    --retries=20 \
    --index-url=https://pypi.org/simple/ \
    --extra-index-url=https://www.piwheels.org/simple \
    -r requirements.txt

# Copy source code
COPY . .

# Run the agents
CMD ["python", "test_mas.py"]
