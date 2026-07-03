FROM python:3.11-slim

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y build-essential curl && rm -rf /var/lib/apt/lists/*

# Copy and install Python deps
COPY backend/requirements.txt /app/requirements.txt
RUN python -m pip install --upgrade pip
RUN python -m pip install -r /app/requirements.txt

# Copy backend sources
COPY backend/ /app/

ENV PORT 8000

EXPOSE 8000

CMD ["sh", "-lc", "uvicorn backend.server:app --host 0.0.0.0 --port $PORT"]
