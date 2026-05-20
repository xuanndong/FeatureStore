FROM python:3.10-slim

# Cấu hình PYTHONPATH chung cho cả module main lẫn gRPC code
ENV PYTHONPATH=/app:/app/common/grpc

WORKDIR /app

# 1. Cài đặt toàn bộ phụ thuộc chung
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Tạo sẵn thư mục sandbox cho UDF
RUN mkdir -p /app/udf_envs

# 2. Biên dịch tệp .proto dùng chung cho cả 2 dịch vụ
COPY ./protos ./protos
RUN mkdir -p ./common/grpc && \
    python -m grpc_tools.protoc \
    -I./protos \
    --python_out=./common/grpc \
    --grpc_python_out=./common/grpc \
    ./protos/featurePipeline.proto

# 3. Copy toàn bộ mã nguồn
COPY ./common ./common
COPY ./services ./services
