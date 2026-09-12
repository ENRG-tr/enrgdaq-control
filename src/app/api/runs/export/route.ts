import { NextResponse } from 'next/server';
import { RunController, type DetailedRun } from '@/lib/runs';
import * as XLSX from 'xlsx';

function cleanHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mu;/g, 'μ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

function formatDate(dateVal: Date | string | null | undefined): string {
  if (!dateVal) return '-';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '-';
  const pad = (n: number) => (n < 10 ? '0' + n : n);
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const mins = pad(d.getMinutes());
  const secs = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${mins}:${secs}`;
}

function calculateDuration(
  startVal: Date | string,
  endVal: Date | string | null | undefined,
  status: string,
): string {
  if (status === 'RUNNING' && !endVal) {
    const start = new Date(startVal).getTime();
    const now = Date.now();
    const diff = Math.max(0, now - start);
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    return `${hours}h ${mins}m ${secs}s (Running)`;
  }

  if (!endVal) return '-';
  const start = new Date(startVal).getTime();
  const end = new Date(endVal).getTime();
  const diff = Math.max(0, end - start);
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diff % (1000 * 60)) / 1000);
  return `${hours}h ${mins}m ${secs}s`;
}

export async function GET() {
  try {
    const runsList = await RunController.getAllRunsDetailed();

    // 1. Sheet 1: Runs History (Master View)
    const runsSheetRows = runsList.map((run) => {
      const paramSummary = run.parameters.length > 0
        ? run.parameters
            .map((p) => `${p.displayName || p.name}: ${p.value}`)
            .join(' | ')
        : '-';

      const daqJobs = Array.isArray(run.daqJobIds) && run.daqJobIds.length > 0
        ? run.daqJobIds.join(', ')
        : '-';

      return {
        'Run ID': `#${run.id}`,
        'Run Type': run.runTypeName,
        'Status': run.status,
        'Description': run.description,
        'Client / Supervisor': run.clientId || '-',
        'Start Time': formatDate(run.startTime),
        'End Time': run.endTime ? formatDate(run.endTime) : (run.status === 'RUNNING' ? 'Running' : '-'),
        'Duration': calculateDuration(run.startTime, run.endTime, run.status),
        'Scheduled End Time': formatDate(run.scheduledEndTime),
        'DAQ Job IDs': daqJobs,
        'Parameters Summary': paramSummary,
        'Notes / Logs': cleanHtml(run.metadata?.details),
        'Last Updated By': run.metadata?.updatedBy || '-',
        'Last Updated At': formatDate(run.metadata?.updatedAt),
      };
    });

    // 2. Sheet 2: Parameters Breakdown (Granular View)
    const paramsSheetRows: any[] = [];
    for (const run of runsList) {
      if (run.parameters && run.parameters.length > 0) {
        for (const p of run.parameters) {
          paramsSheetRows.push({
            'Run ID': `#${run.id}`,
            'Run Description': run.description,
            'Run Type': run.runTypeName,
            'Parameter Name': p.name,
            'Display Name': p.displayName || p.name,
            'Type': p.type,
            'Value': p.value,
          });
        }
      }
    }

    // 3. Sheet 3: Notes & Logs (Full Notes View)
    const notesSheetRows = runsList
      .filter((r) => r.metadata?.details && cleanHtml(r.metadata.details).length > 0)
      .map((run) => ({
        'Run ID': `#${run.id}`,
        'Run Description': run.description,
        'Status': run.status,
        'Author / Updated By': run.metadata?.updatedBy || '-',
        'Updated At': formatDate(run.metadata?.updatedAt),
        'Detailed Log Content': cleanHtml(run.metadata?.details),
      }));

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Add Sheet 1
    const wsRuns = XLSX.utils.json_to_sheet(runsSheetRows);
    wsRuns['!cols'] = [
      { wch: 10 }, // Run ID
      { wch: 18 }, // Run Type
      { wch: 14 }, // Status
      { wch: 45 }, // Description
      { wch: 22 }, // Client
      { wch: 22 }, // Start Time
      { wch: 22 }, // End Time
      { wch: 18 }, // Duration
      { wch: 22 }, // Scheduled End Time
      { wch: 30 }, // DAQ Jobs
      { wch: 50 }, // Parameters
      { wch: 60 }, // Notes
      { wch: 22 }, // Author
      { wch: 22 }, // Updated At
    ];
    XLSX.utils.book_append_sheet(wb, wsRuns, 'Runs History');

    // Add Sheet 2 if parameters exist
    if (paramsSheetRows.length > 0) {
      const wsParams = XLSX.utils.json_to_sheet(paramsSheetRows);
      wsParams['!cols'] = [
        { wch: 10 }, // Run ID
        { wch: 40 }, // Run Description
        { wch: 18 }, // Run Type
        { wch: 25 }, // Parameter Name
        { wch: 25 }, // Display Name
        { wch: 12 }, // Type
        { wch: 25 }, // Value
      ];
      XLSX.utils.book_append_sheet(wb, wsParams, 'Parameters Breakdown');
    }

    // Add Sheet 3 if notes exist
    if (notesSheetRows.length > 0) {
      const wsNotes = XLSX.utils.json_to_sheet(notesSheetRows);
      wsNotes['!cols'] = [
        { wch: 10 }, // Run ID
        { wch: 40 }, // Run Description
        { wch: 14 }, // Status
        { wch: 22 }, // Author
        { wch: 22 }, // Updated At
        { wch: 80 }, // Detailed Log Content
      ];
      XLSX.utils.book_append_sheet(wb, wsNotes, 'Notes & Logs');
    }

    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const nowStr = new Date().toISOString().split('T')[0];
    const filename = `runs_history_export_${nowStr}.xlsx`;

    return new Response(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('[API /api/runs/export] Error exporting runs:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to export runs to Excel' },
      { status: 500 },
    );
  }
}
