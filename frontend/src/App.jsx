import React, { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';

function App() {
  const webcamRef = useRef(null);
  const wsRef = useRef(null);
  const [status, setStatus] = useState("Connecting...");
  const [message, setMessage] = useState("Initializing...");
  const [blinks, setBlinks] = useState(0);
  const [isVerified, setIsVerified] = useState(false);
  const [zoomStyle, setZoomStyle] = useState({ transform: 'scale(1) translate(0px, 0px)' });
  const [capturedImage, setCapturedImage] = useState(null);

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
        if (data.status === "verified" && !isVerified) {
          setIsVerified(true);
          // Capture photo on verification
          if (webcamRef.current) {
            const imageSrc = webcamRef.current.getScreenshot();
            setCapturedImage(imageSrc);
          }
        }

        // Smart Zoom Logic
        if (data.face_box && !isVerified) {
          const { x, y, width, height, frame_width, frame_height } = data.face_box;

          // Calculate center of face
          const faceCenterX = x + width / 2;
          const faceCenterY = y + height / 2;

          // Calculate center of frame
          const frameCenterX = frame_width / 2;
          const frameCenterY = frame_height / 2;

          // Calculate shift needed to center the face
          // We need to move the image opposite to the face offset
          // Normalized shift (-0.5 to 0.5)
          const shiftX = (frameCenterX - faceCenterX) / frame_width;
          const shiftY = (frameCenterY - faceCenterY) / frame_height;

          // Zoom level (scale)
          // Target: Face should take up about 50% of the height
          const targetHeightRatio = 0.5;
          const currentHeightRatio = height / frame_height;
          let scale = targetHeightRatio / currentHeightRatio;

          // Clamp scale
          scale = Math.min(Math.max(scale, 1.0), 2.5);

          // Calculate translate values in percentage
          // When scaled, the image expands from center.
          // We need to translate to bring face to center.
          const translateX = shiftX * 100 * scale;
          const translateY = shiftY * 100 * scale;

          setZoomStyle({
            transform: `scale(${scale}) translate(${translateX}%, ${translateY}%)`,
            transition: 'transform 0.2s ease-out'
          });
        } else if (!data.face_box && !isVerified) {
          setZoomStyle({ transform: 'scale(1) translate(0px, 0px)', transition: 'transform 0.5s ease-out' });
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
  }, [isVerified]);

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

  const handleRestart = () => {
    setIsVerified(false);
    setBlinks(0);
    setCapturedImage(null);
    setZoomStyle({ transform: 'scale(1) translate(0px, 0px)' });
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send("reset");
    }
  };

  const handleDownload = () => {
    if (capturedImage) {
      const link = document.createElement('a');
      link.href = capturedImage;
      link.download = 'verified_photo.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-8 text-blue-500">Liveliness Check</h1>

      <div className="relative border-4 border-blue-500 rounded-lg overflow-hidden shadow-2xl w-[640px] h-[480px] bg-black">
        <div style={zoomStyle} className="w-full h-full origin-center">
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            width={640}
            height={480}
            className="block object-cover w-full h-full"
          />
        </div>

        {isVerified && (
          <div className="absolute inset-0 flex items-center justify-center bg-green-500 bg-opacity-50 z-10">
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

        <div className="flex space-x-4 justify-center mt-4">
          <button
            onClick={handleRestart}
            className="px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded-full font-semibold transition-colors"
          >
            Restart
          </button>

          {isVerified && (
            <button
              onClick={handleDownload}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-full font-semibold transition-colors animate-bounce"
            >
              Download Photo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
