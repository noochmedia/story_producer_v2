import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
    try {
        const url = request.nextUrl.searchParams.get('url')
        if (!url) {
            return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 })
        }

        console.log(`[VIEW] Fetching content from URL: ${url}`)
        const response = await fetch(url)
        if (!response.ok) {
            throw new Error(`Failed to fetch content: ${response.statusText}`)
        }

        const content = await response.text()
        return NextResponse.json({ content })
    } catch (error) {
        console.error('[VIEW] Error fetching content:', error)
        return NextResponse.json({ 
            error: 'Failed to fetch content',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
    }
}
