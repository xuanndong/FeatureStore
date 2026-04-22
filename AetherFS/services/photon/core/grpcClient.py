# Standard Libraries
from typing import AsyncGenerator

# Third party Libraries
import grpc

# Local Libraries
from common.grpc import featurePipeline_pb2 as pb2
from common.grpc import featurePipeline_pb2_grpc as pb2_grpc
from common.config import settings


class FeatureStoreGRPCClient:
    def __init__(self):
        """
        GRPC Server Address
        """
        self.server_target = settings.GRPC_SERVER_URL
        self._channel = None

    @property
    def channel(self) -> grpc.aio.Channel:
        if self._channel is None:
            self._channel = grpc.aio.insecure_channel(self.server_target)

        return self._channel

    async def get_preview(self, request: pb2.PreviewRequest) -> pb2.PreviewResponse:
        stub = pb2_grpc.PipelineServiceStub(self.channel)
        response = await stub.PreviewFeatureGroup(request, timeout=30.0)

        return response

    async def run_pipeline(self, request: pb2.RunRequest) -> pb2.RunResponse:
        stub = pb2_grpc.PipelineServiceStub(self.channel)
        response = await stub.RunBatchPipeline(request, timeout=10.0)

        return response

    async def close(self):
        if self._channel:
            await self._channel.close()


# Init instance
grpc_client = FeatureStoreGRPCClient()
