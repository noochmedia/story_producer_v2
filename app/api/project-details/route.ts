import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

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
    await ensureDataDir()

    try {
      const content = await fs.readFile(PROJECT_DETAILS_FILE, 'utf-8')
      const data = JSON.parse(content)
      return NextResponse.json({ details: data.details })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist yet, return empty details
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

    await ensureDataDir()
    
    // Save to file
    await fs.writeFile(PROJECT_DETAILS_FILE, JSON.stringify({ details }, null, 2))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in POST /api/project-details:', error)
    return NextResponse.json({ 
      error: 'Failed to save project details',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
