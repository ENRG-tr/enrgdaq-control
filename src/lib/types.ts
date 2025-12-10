export interface Run {
  id: number;
  description: string;
  startTime: string;
  endTime?: string;
  status: 'RUNNING' | 'COMPLETED' | 'STOPPED';
  daqJobName?: string;
  config?: string;
}
