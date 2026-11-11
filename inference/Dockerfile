# The image has the code and the dependencies. The weight files are not in
# the image: the directory /app/models is a volume (see download_weights.sh).
FROM python:3.14-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ app/
ENV PYTHONUNBUFFERED=1
USER 65534:65534
EXPOSE 8000
# The application writes one log line for each request, so the access log of
# uvicorn is off. One worker: the service runs one inference at a time (RN-23).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
