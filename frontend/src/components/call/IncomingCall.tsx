'use client';

import { Phone, PhoneOff } from 'lucide-react';
import { useCallStore } from '@/store/callStore';

interface IncomingCallProps {
  callerName: string;
  callType: 'audio' | 'video';
  onAccept: () => void;
  onReject: () => void;
}

export default function IncomingCall({
  callerName,
  callType,
  onAccept,
  onReject,
}: IncomingCallProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 animate-in fade-in zoom-in duration-300">
        {/* Caller Info */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <span className="text-3xl font-bold text-white">
              {callerName.charAt(0).toUpperCase()}
            </span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {callerName}
          </h2>
          <p className="text-gray-600">
            Incoming {callType} call...
          </p>
        </div>

        {/* Ringing Animation */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-blue-500/20 animate-ping absolute"></div>
            <div className="w-16 h-16 rounded-full bg-blue-500/40 animate-pulse"></div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center">
          {/* Reject Button */}
          <button
            onClick={onReject}
            className="group relative w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-110 active:scale-95"
            aria-label="Reject call"
          >
            <PhoneOff className="w-6 h-6 text-white mx-auto" />
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-sm text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Decline
            </span>
          </button>

          {/* Accept Button */}
          <button
            onClick={onAccept}
            className="group relative w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-110 active:scale-95"
            aria-label="Accept call"
          >
            <Phone className="w-6 h-6 text-white mx-auto" />
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-sm text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Accept
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
