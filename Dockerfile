# ASCILINE live server — Python + ffmpeg, containerized
FROM python:3.11-slim

WORKDIR /app

# ffmpeg/ffprobe for audio + thumbnails; ca-certificates for yt-dlp HTTPS.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-docker.txt .
RUN pip install --no-cache-dir -r requirements-docker.txt

# Create non-root user
RUN groupadd -r asciline && useradd -r -g asciline -d /app asciline

COPY . .

# Ensure upload/video dirs exist and are owned by non-root user
RUN mkdir -p videos uploads && chown -R asciline:asciline /app

USER asciline

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/')" || exit 1

EXPOSE 8000

# Must bind 0.0.0.0 so port mapping reaches the host browser.
CMD ["python", "stream_server.py", "--folder", "videos", "--host", "0.0.0.0", "--port", "8000"]
