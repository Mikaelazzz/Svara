'use client';

import { Phone, PhoneOff } from 'lucide-react';

interface OutgoingCallProps {
  calleeName: string;
  callType: 'audio' | 'video';
  onCancel: () => void;
}

export default function OutgoingCall({
  calleeName,
  callType,
  onCancel,
}: OutgoingCallProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 animate-in fade-in zoom-in duration-300">
        {/* Callee Info */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <span className="text-3xl font-bold text-white">
              {calleeName.charAt(0).toUpperCase()}
            </span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {calleeName}
          </h2>
          <p className="text-gray-600 animate-pulse">
            Calling...
          </p>
        </div>

        {/* Calling Animation */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-blue-500/20 animate-ping absolute"></div>
            <div className="w-16 h-16 rounded-full bg-blue-500/40 animate-pulse flex items-center justify-center">
              <Phone className="w-6 h-6 text-blue-600 animate-bounce" />
            </div>
          </div>
        </div>

        {/* Cancel Button */}
        <div className="flex justify-center">
          <button
            onClick={onCancel}
            className="group relative w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-110 active:scale-95"
            aria-label="Cancel call"
          >
            <PhoneOff className="w-6 h-6 text-white mx-auto" />
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-sm text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Cancel
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
