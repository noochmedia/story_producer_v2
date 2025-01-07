import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function ExportOptions() {
  const [exportFormat, setExportFormat] = useState<string>('pdf')

  const handleExport = async () => {
    // This would be replaced with an actual API call to your export system
    const response = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: exportFormat })
    })
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `export.${exportFormat}`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Options</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select onValueChange={setExportFormat} defaultValue={exportFormat}>
          <SelectTrigger>
            <SelectValue placeholder="Select export format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pdf">PDF</SelectItem>
            <SelectItem value="json">JSON</SelectItem>
            <SelectItem value="csv">CSV</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleExport}>Export</Button>
      </CardContent>
    </Card>
  )
}

