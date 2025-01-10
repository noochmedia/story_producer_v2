import { NextRequest } from 'next/server'

let clients = new Set<ReadableStreamDefaultController>()
let currentStatus = 'idle'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  return new Response(
    new ReadableStream({
      start(controller) {
        clients.add(controller)

        // Send initial status
        controller.enqueue(`data: ${JSON.stringify({ status: currentStatus })}\n\n`)

        // Remove client when connection closes
        req.signal.addEventListener('abort', () => {
          clients.delete(controller)
        })
      }
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    }
  )
}

// Helper function to update all clients
export function updateStatus(status: 'idle' | 'analyzing' | 'complete') {
  currentStatus = status
  const message = `data: ${JSON.stringify({ status })}\n\n`
  clients.forEach(client => {
    try {
      client.enqueue(message)
    } catch (e) {
      console.error('Error sending status update:', e)
      clients.delete(client)
    }
  })
}
