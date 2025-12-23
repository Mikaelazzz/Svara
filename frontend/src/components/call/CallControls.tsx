'use client';

import { Mic, MicOff, PhoneOff } from 'lucide-react';
import { useEffect, useState } from 'react';

interface CallControlsProps {
  isAudioEnabled: boolean;
  isVideoEnabled?: boolean;
  onToggleAudio: () => void;
  onToggleVideo?: () => void;
  onEndCall: () => void;
  showVideoControls?: boolean;
}

export default function CallControls({
  isAudioEnabled,
  isVideoEnabled = true,
  onToggleAudio,
  onToggleVideo,
  onEndCall,
  showVideoControls = false,
}: CallControlsProps) {
  return (
    <div className="flex items-center justify-center gap-4 p-6 bg-gradient-to-t from-black/60 to-transparent">
      {/* Mute/Unmute Button */}
      <button
        onClick={onToggleAudio}
        className={`w-14 h-14 rounded-full transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 ${
          isAudioEnabled
            ? 'bg-gray-700 hover:bg-gray-600'
            : 'bg-red-500 hover:bg-red-600'
        }`}
        aria-label={isAudioEnabled ? 'Mute' : 'Unmute'}
      >
        {isAudioEnabled ? (
          <Mic className="w-6 h-6 text-white mx-auto" />
        ) : (
          <MicOff className="w-6 h-6 text-white mx-auto" />
        )}
      </button>

      {/* End Call Button */}
      <button
        onClick={onEndCall}
        className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-110 active:scale-95"
        aria-label="End call"
      >
        <PhoneOff className="w-7 h-7 text-white mx-auto" />
      </button>

      {/* Video Toggle Button (if video call) */}
      {showVideoControls && onToggleVideo && (
        <button
          onClick={onToggleVideo}
          className={`w-14 h-14 rounded-full transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 ${
            isVideoEnabled
              ? 'bg-gray-700 hover:bg-gray-600'
              : 'bg-red-500 hover:bg-red-600'
          }`}
          aria-label={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          <svg
            className="w-6 h-6 text-white mx-auto"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {isVideoEnabled ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            )}
          </svg>
        </button>
      )}
    </div>
  );
}
