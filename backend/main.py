import cv2
import mediapipe as mp
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import base64
import json
import antigravity

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# Eye landmarks
LEFT_EYE = [362, 385, 387, 263, 373, 380]
RIGHT_EYE = [33, 160, 158, 133, 153, 144]

def calculate_ear(landmarks, eye_indices):
    # EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
    # Indices in MediaPipe are different, mapping roughly to:
    # p1: 362 (left corner), p4: 263 (right corner)
    # p2: 385, p6: 380
    # p3: 387, p5: 373
    
    # Extract coordinates
    coords = []
    for idx in eye_indices:
        lm = landmarks[idx]
        coords.append(np.array([lm.x, lm.y]))
    
    # Vertical distances
    v1 = np.linalg.norm(coords[1] - coords[5])
    v2 = np.linalg.norm(coords[2] - coords[4])
    
    # Horizontal distance
    h = np.linalg.norm(coords[0] - coords[3])
    
    ear = (v1 + v2) / (2.0 * h)
    return ear

EAR_THRESHOLD = 0.25  # Threshold for closed eyes
BLINK_CONSEC_FRAMES = 2 # Number of frames the eye must be closed

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    
    blink_count = 0
    eye_closed = False
    verified = False
    
    try:
        while True:
            data = await websocket.receive_text()
            
            if verified:
                 await websocket.send_json({"status": "verified", "message": "Person Verified", "blinks": blink_count})
                 continue

            # Decode image
            try:
                # Expecting data:image/jpeg;base64,....
                header, encoded = data.split(",", 1)
                image_data = base64.b64decode(encoded)
                np_arr = np.frombuffer(image_data, np.uint8)
                frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
                
                if frame is None:
                    continue

                # Process with MediaPipe
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = face_mesh.process(frame_rgb)
                
                status = "No Face"
                message = "Please look at the camera"
                
                if results.multi_face_landmarks:
                    status = "Face Detected"
                    message = "Blink to Verify"
                    
                    for face_landmarks in results.multi_face_landmarks:
                        landmarks = face_landmarks.landmark
                        
                        left_ear = calculate_ear(landmarks, LEFT_EYE)
                        right_ear = calculate_ear(landmarks, RIGHT_EYE)
                        
                        avg_ear = (left_ear + right_ear) / 2.0
                        
                        if avg_ear < EAR_THRESHOLD:
                            eye_closed = True
                        else:
                            if eye_closed:
                                blink_count += 1
                                eye_closed = False
                        
                        if blink_count >= 2:
                            verified = True
                            status = "verified"
                            message = "Person Verified"
                
                await websocket.send_json({
                    "status": status,
                    "message": message,
                    "blinks": blink_count
                })
                
            except Exception as e:
                print(f"Error processing frame: {e}")
                await websocket.send_json({"status": "error", "message": str(e)})

    except WebSocketDisconnect:
        manager.disconnect(websocket)
