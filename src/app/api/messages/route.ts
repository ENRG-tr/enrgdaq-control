import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { MessageController } from '@/lib/messages';
import { checkAuthSession, canSendMessages } from '@/lib/auth';

// GET all messages with pagination
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const data = await MessageController.getAllMessages(limit, offset);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST send a new message
export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const authSession = await checkAuthSession(headersList);
    if (!canSendMessages(authSession.role)) {
      return NextResponse.json(
        { error: 'Unauthorized: Insufficient privileges to send messages' },
        { status: 403 },
      );
    }

    const body = await req.json();
    const {
      templateId,
      clientId,
      targetDaqJobType,
      parameterValues,
      runId,
      // For raw messages (without template)
      messageType,
      payload,
    } = body;

    if (!clientId) {
      return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
    }

    let message;

    if (templateId) {
      // Send using template
      message = await MessageController.sendMessageFromTemplate(
        templateId,
        clientId,
        targetDaqJobType || null,
        parameterValues || {},
        runId,
      );
    } else if (messageType && payload) {
      // Send raw message
      message = await MessageController.sendRawMessage(
        clientId,
        messageType,
        payload,
        targetDaqJobType || null,
        runId,
      );
    } else {
      return NextResponse.json(
        { error: 'Must provide either templateId or messageType+payload' },
        { status: 400 },
      );
    }

    return NextResponse.json(message);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
