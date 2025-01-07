import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ForceGraph } from '@/components/ui/force-graph'

interface TopicCluster {
  id: string
  label: string
  size: number
}

interface TopicLink {
  source: string
  target: string
  value: number
}

interface TopicClusterData {
  nodes: TopicCluster[]
  links: TopicLink[]
}

export function TopicClustering() {
  const [clusterData, setClusterData] = useState<TopicClusterData | null>(null)

  const clusterTopics = async () => {
    // This would be replaced with an actual API call to your topic clustering system
    const response = await fetch('/api/cluster-topics')
    const result = await response.json()
    setClusterData(result)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Topic Clustering</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={clusterTopics}>Cluster Topics</Button>
        {clusterData && (
          <ForceGraph
            data={clusterData}
            width={600}
            height={400}
          />
        )}
      </CardContent>
    </Card>
  )
}

