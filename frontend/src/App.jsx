import React, { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';

function App() {
  const webcamRef = useRef(null);
  const wsRef = useRef(null);
  const [status, setStatus] = useState("Connecting...");
  const [message, setMessage] = useState("Initializing...");
  const [blinks, setBlinks] = useState(0);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    const connectWebSocket = () => {
      // Use relative path for WebSocket when served via Nginx (which proxies /ws)
      // Fallback to localhost:8000 for local dev if needed, but for this deployment we assume proxy
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host; // Includes port if present
      // If running on port 5173 (dev), connect to 8000 directly. Otherwise use relative /ws
      const wsUrl = window.location.port === '5173'
        ? 'ws://localhost:8000/ws'
        : `${protocol}//${host}/ws`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("Connected");
        setMessage("Ready");
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setStatus(data.status);
        setMessage(data.message);
        if (data.blinks !== undefined) {
          setBlinks(data.blinks);
        }
        if (data.status === "verified") {
          setIsVerified(true);
        }
      };

      ws.onclose = () => {
        setStatus("Disconnected");
        setMessage("Reconnecting...");
        setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        ws.close();
      };
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const capture = useCallback(() => {
    if (webcamRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !isVerified) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        wsRef.current.send(imageSrc);
      }
    }
  }, [isVerified]);

  useEffect(() => {
    const interval = setInterval(capture, 100); // Send frame every 100ms
    return () => clearInterval(interval);
  }, [capture]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-8 text-blue-500">Liveliness Check</h1>

      <div className="relative border-4 border-blue-500 rounded-lg overflow-hidden shadow-2xl">
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          width={640}
          height={480}
          className="block"
        />

        {isVerified && (
          <div className="absolute inset-0 flex items-center justify-center bg-green-500 bg-opacity-50">
            <div className="text-6xl font-bold text-white drop-shadow-md">VERIFIED</div>
          </div>
        )}
      </div>

      <div className="mt-8 text-center space-y-4">
        <div className={`text-2xl font-semibold ${isVerified ? 'text-green-400' : 'text-yellow-400'}`}>
          Status: {status}
        </div>
        <div className="text-xl text-gray-300">
          {message}
        </div>
        <div className="text-lg text-gray-400">
          Blinks Detected: <span className="font-bold text-white">{blinks}</span> / 2
        </div>
      </div>
    </div>
  );
}

export default App;
