export interface Call {
  id: number;
  caller_id: number;
  callee_id: number;
  type: 'audio' | 'video';
  status: 'ringing' | 'active' | 'ended' | 'missed' | 'rejected';
  started_at: string;
  ended_at?: string;
  duration?: number;
}

export interface CallState {
  active: boolean;
  type?: 'audio' | 'video';
  peer_id?: number;
  peer_name?: string;
  is_caller: boolean;
  status: 'idle' | 'calling' | 'ringing' | 'connected';
}
