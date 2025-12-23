import { create } from 'zustand';
import { useAuthStore } from './authStore';

export type CallType = 'audio' | 'video';
export type CallStatus = 'idle' | 'ringing' | 'outgoing' | 'active' | 'ended';

export interface Call {
  callId: string;
  callerId: number;
  calleeId: number;
  type: CallType;
  status: CallStatus;
  startedAt?: Date;
}

interface CallState {
  currentCall: Call | null;
  callHistory: Call[];
  
  // Actions
  initiateCall: (calleeId: number, type: CallType) => void;
  acceptCall: (callId: string) => void;
  rejectCall: (callId: string) => void;
  endCall: (callId: string) => void;
  setCallStatus: (status: CallStatus) => void;
  setCurrentCall: (call: Call | null) => void;
  addToHistory: (call: Call) => void;
  clearCurrentCall: () => void;
}

export const useCallStore = create<CallState>((set) => ({
  currentCall: null,
  callHistory: [],

  initiateCall: (calleeId, type) => {
    // Get current user ID from auth store
    const currentUserId = useAuthStore.getState().user?.id || 0;
    
    const call: Call = {
      callId: '', // Will be set by server
      callerId: currentUserId,
      calleeId,
      type,
      status: 'outgoing',
      startedAt: new Date(),
    };
    
    console.log('📞 Initiating call:', call);
    set({ currentCall: call });
  },

  acceptCall: (callId) => {
    set((state) => ({
      currentCall: state.currentCall
        ? { ...state.currentCall, status: 'active' }
        : null,
    }));
  },

  rejectCall: (callId) => {
    set({ currentCall: null });
  },

  endCall: (callId) => {
    set((state) => {
      if (state.currentCall) {
        const endedCall = { ...state.currentCall, status: 'ended' as CallStatus };
        return {
          currentCall: null,
          callHistory: [endedCall, ...state.callHistory],
        };
      }
      return state;
    });
  },

  setCallStatus: (status) => {
    set((state) => ({
      currentCall: state.currentCall
        ? { ...state.currentCall, status }
        : null,
    }));
  },

  setCurrentCall: (call) => {
    set({ currentCall: call });
  },

  addToHistory: (call) => {
    set((state) => ({
      callHistory: [call, ...state.callHistory],
    }));
  },

  clearCurrentCall: () => {
    set({ currentCall: null });
  },
}));
