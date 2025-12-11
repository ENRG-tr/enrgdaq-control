export interface Run {
  id: number;
  description: string;
  startTime: Date;
  endTime: Date | null;
  status: string;
  daqJobName: string | null;
  config: string | null;
  clientId: string | null;
}
