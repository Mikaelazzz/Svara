'use client';

import { useEffect, useState, useRef } from 'react';
import CallControls from './CallControls';

interface AudioCallProps {
  userName: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isAudioEnabled: boolean;
  isSpeaking?: boolean;
  isRemoteMuted?: boolean;
  onToggleAudio: () => void;
  onEndCall: () => void;
}

export default function AudioCall({
  userName,
  localStream,
  remoteStream,
  isAudioEnabled,
  isSpeaking = false,
  isRemoteMuted = false,
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

  // Set remote audio stream with explicit play
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      console.log('🔊 Setting remote audio stream:', {
        tracks: remoteStream.getTracks().length,
        audioTracks: remoteStream.getAudioTracks().length,
        active: remoteStream.active
      });
      
      // Log audio tracks status
      remoteStream.getAudioTracks().forEach((track, idx) => {
        console.log(`🔊 Audio track ${idx}:`, {
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState
        });
      });
      
      remoteAudioRef.current.srcObject = remoteStream;
      
      // Explicitly play with error handling for autoplay policies
      remoteAudioRef.current.play()
        .then(() => {
          console.log('✅ Remote audio playing successfully');
        })
        .catch((error) => {
          console.error('❌ Failed to play remote audio:', error);
          // Try to recover by muting and then unmuting
          if (remoteAudioRef.current) {
            remoteAudioRef.current.muted = true;
            remoteAudioRef.current.play()
              .then(() => {
                console.log('🔊 Playing muted, will unmute after user interaction');
                // Unmute after a short delay
                setTimeout(() => {
                  if (remoteAudioRef.current) {
                    remoteAudioRef.current.muted = false;
                    console.log('🔊 Audio unmuted');
                  }
                }, 100);
              })
              .catch(e => console.error('❌ Still failed to play:', e));
          }
        });
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
        {/* User Avatar with Speaking Indicator */}
        <div className={`w-32 h-32 mb-6 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-2xl transition-all duration-200 ${isSpeaking ? 'ring-4 ring-green-400 ring-opacity-75 animate-pulse scale-105' : ''}`}>
          <span className="text-5xl font-bold">
            {userName.charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Speaking Indicator Text */}
        {isSpeaking && (
          <div className="mb-2 px-3 py-1 rounded-full bg-green-500/30 backdrop-blur-sm">
            <span className="text-sm text-green-300">🎤 Speaking...</span>
          </div>
        )}

        {/* User Name */}
        <h2 className="text-3xl font-bold mb-2">{userName}</h2>

        {/* Remote User Muted Indicator */}
        {isRemoteMuted && (
          <div className="mb-2 px-3 py-1 rounded-full bg-orange-500/30 backdrop-blur-sm">
            <span className="text-sm text-orange-300">🔇 {userName} is muted</span>
          </div>
        )}

        {/* Call Duration */}
        <p className="text-xl text-white/80 mb-4">{formatDuration(callDuration)}</p>

        {/* Status */}
        <div className="flex items-center gap-2 text-white/60">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
          <span>Connected</span>
        </div>

        {/* Local Audio Indicator (Your mute status) */}
        {!isAudioEnabled && (
          <div className="mt-4 px-4 py-2 rounded-full bg-red-500/20 backdrop-blur-sm">
            <span className="text-sm">🎙️ Your microphone is muted</span>
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
