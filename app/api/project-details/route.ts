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
      const data = await fs.readFile(PROJECT_DETAILS_FILE, 'utf-8')
      return NextResponse.json({ 
        success: true,
        details: JSON.parse(data).details 
      })
    } catch (error) {
      // If file doesn't exist, return empty details
      if ((error as any).code === 'ENOENT') {
        return NextResponse.json({ 
          success: true,
          details: '' 
        })
      }
      throw error
    }
  } catch (error) {
    console.error('Error reading project details:', error)
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

// Save project details
export async function POST(request: NextRequest) {
  try {
    await ensureDataDir()
    
    const data = await request.json()
    await fs.writeFile(
      PROJECT_DETAILS_FILE,
      JSON.stringify({ details: data.details || '' })
    )

    return NextResponse.json({ 
      success: true,
      message: 'Project details saved successfully' 
    })
  } catch (error) {
    console.error('Error saving project details:', error)
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
