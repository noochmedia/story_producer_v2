import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

// Use absolute path for data directory
const DATA_DIR = path.join(process.cwd(), 'data')
const PROJECT_DETAILS_FILE = path.join(DATA_DIR, 'project-details.json')

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR)
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true })
  }
}

// Fetch project details
export async function GET() {
  try {
    console.log('Reading from:', PROJECT_DETAILS_FILE);
    await ensureDataDir()

    try {
      const content = await fs.readFile(PROJECT_DETAILS_FILE, 'utf-8')
      console.log('File content:', content);
      const data = JSON.parse(content)
      return NextResponse.json({ details: data.details })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist yet, create it with empty details
        await fs.writeFile(PROJECT_DETAILS_FILE, JSON.stringify({ details: '' }, null, 2))
        return NextResponse.json({ details: '' })
      }
      throw error
    }
  } catch (error) {
    console.error('Error in GET /api/project-details:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch project details',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Store project details
export async function POST(request: NextRequest) {
  try {
    const { details } = await request.json()

    if (typeof details !== 'string') {
      return NextResponse.json({ error: 'Invalid details format' }, { status: 400 })
    }

    console.log('Writing to:', PROJECT_DETAILS_FILE);
    console.log('Content:', { details });

    await ensureDataDir()
    
    // Save to file
    await fs.writeFile(PROJECT_DETAILS_FILE, JSON.stringify({ details }, null, 2))

    // Verify the file was written
    const content = await fs.readFile(PROJECT_DETAILS_FILE, 'utf-8')
    console.log('Verified content:', content);

    // Set cache headers to prevent stale data
    const headers = new Headers({
      'Cache-Control': 'no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    return NextResponse.json({ success: true }, { headers })
  } catch (error) {
    console.error('Error in POST /api/project-details:', error)
    return NextResponse.json({ 
      error: 'Failed to save project details',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
