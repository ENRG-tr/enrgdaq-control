export interface Run {
  id: number;
  description: string;
  startTime: Date;
  endTime: Date | null;
  status: string;
  daqJobIds: string[] | null;
  config: string | null;
  clientId: string | null;
  runTypeId: number | null;
}
