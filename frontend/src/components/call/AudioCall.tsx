'use client';

import { useEffect, useState, useRef } from 'react';
import CallControls from './CallControls';

interface AudioCallProps {
  userName: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isAudioEnabled: boolean;
  onToggleAudio: () => void;
  onEndCall: () => void;
}

export default function AudioCall({
  userName,
  localStream,
  remoteStream,
  isAudioEnabled,
  onToggleAudio,
  onEndCall,
}: AudioCallProps) {
  const [callDuration, setCallDuration] = useState(0);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Update call duration every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Set remote audio stream
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600">
      {/* Hidden audio element for remote stream */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Call Info */}
      <div className="flex-1 flex flex-col items-center justify-center text-white">
        {/* User Avatar */}
        <div className="w-32 h-32 mb-6 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-2xl">
          <span className="text-5xl font-bold">
            {userName.charAt(0).toUpperCase()}
          </span>
        </div>

        {/* User Name */}
        <h2 className="text-3xl font-bold mb-2">{userName}</h2>

        {/* Call Duration */}
        <p className="text-xl text-white/80 mb-4">{formatDuration(callDuration)}</p>

        {/* Status */}
        <div className="flex items-center gap-2 text-white/60">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
          <span>Connected</span>
        </div>

        {/* Audio Indicator */}
        {!isAudioEnabled && (
          <div className="mt-4 px-4 py-2 rounded-full bg-red-500/20 backdrop-blur-sm">
            <span className="text-sm">Microphone muted</span>
          </div>
        )}
      </div>

      {/* Call Controls */}
      <CallControls
        isAudioEnabled={isAudioEnabled}
        onToggleAudio={onToggleAudio}
        onEndCall={onEndCall}
        showVideoControls={false}
      />
    </div>
  );
}
