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
        response = await stub.PreviewFeatureGroup(request, timeout=180.0)

        return response

    async def run_pipeline(self, request: pb2.RunRequest) -> pb2.RunResponse:
        stub = pb2_grpc.PipelineServiceStub(self.channel)
        response = await stub.RunBatchPipeline(request, timeout=10.0)

        return response

    async def materialize_feature_view(self, request: pb2.MaterializeViewRequest) -> pb2.MaterializeViewResponse:
        """
        Trigger feature view materialization task (Non-blocking)
        """
        stub = pb2_grpc.PipelineServiceStub(self.channel)
        response = await stub.MaterializeFeatureView(request, timeout=10.0)

        return response

    async def execute_user_script(self, request: pb2.ExecuteScriptRequest) -> pb2.ExecuteScriptResponse:
        """
        Trigger in-system execution task with 1 hour timeout (Blocking)
        """
        stub = pb2_grpc.PipelineServiceStub(self.channel)
        response = await stub.ExecuteUserScript(request, timeout=3600.0)

        return response

    async def start_streaming_pipeline(self, request: pb2.StartStreamingRequest) -> pb2.StreamingResponse:
        """
        Activate a background Ray Actor to listen to Kafka
        """
        stub = pb2_grpc.PipelineServiceStub(self.channel)
        response = await stub.StartStreamingPipeline(request, timeout=30.0)

        return response

    async def stop_streaming_pipeline(self, request: pb2.StopStreamingRequest) -> pb2.StreamingResponse:
        """
        Terminate the Ray Actor and stop the flow
        """
        stub = pb2_grpc.PipelineServiceStub(self.channel)
        response = await stub.StopStreamingPipeline(request, timeout=10.0)

        return response

    async def close(self):
        if self._channel:
            await self._channel.close()


# Init instance
grpc_client = FeatureStoreGRPCClient()
