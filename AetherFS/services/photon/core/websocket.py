# Standard Libraries

# Third party Libraries
from fastapi import WebSocket

# Local Libraries


class ConnectionManager:
    def __init__(self):
        # Store active connections
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        """
        Broadcast message to all active users
        """
        dead_connections = []

        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                dead_connections.append(connection)

        for dead_conn in dead_connections:
            if dead_conn in self.active_connections:
                self.disconnect(dead_conn)


manager = ConnectionManager()
