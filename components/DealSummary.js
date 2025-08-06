'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { 
  MessageSquare, 
  Send, 
  AlertTriangle,
  Clock,
  CheckCircle,
  Bell,
  X,
  Calendar,
  TrendingDown,
  AlertCircle,
  Home,
  User,
  FileText,
  Activity,
  Target,
  Lightbulb,
  Timer,
  Loader2
} from 'lucide-react'

const ALERT_PRIORITY_CONFIG = {
  low: { color: 'bg-gray-100 text-gray-700', icon: Bell },
  medium: { color: 'bg-blue-100 text-blue-700', icon: Clock },
  high: { color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
  urgent: { color: 'bg-red-100 text-red-700', icon: AlertCircle }
}

const ALERT_TYPE_CONFIG = {
  overdue_tasks: { name: 'Overdue Tasks', icon: Clock },
  deal_inactivity: { name: 'Deal Inactive', icon: TrendingDown },
  closing_approaching: { name: 'Closing Soon', icon: Calendar }
}

export function DealCommand() {
  const [command, setCommand] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [commandHistory, setCommandHistory] = useState([])

  const executeCommand = async () => {
    if (!command.trim()) return

    setLoading(true)
    try {
      const response = await fetch('/api/agent/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: command.trim() })
      })

      const data = await response.json()
      
      const commandEntry = {
        id: Date.now().toString(),
        command: command.trim(),
        result: data,
        timestamp: new Date()
      }
      
      setCommandHistory(prev => [commandEntry, ...prev.slice(0, 9)]) // Keep last 10
      setResult(data)
      setCommand('')
    } catch (error) {
      console.error('Command execution error:', error)
      setResult({
        success: false,
        error: 'Failed to execute command'
      })
    }
    setLoading(false)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading) {
      executeCommand()
    }
  }

  const DealSummaryDisplay = ({ summary }) => (
    <div className="space-y-6">
      {/* Transaction Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5" />
                {summary.transaction.property_address}
              </CardTitle>
              <CardDescription>
                Client: {summary.transaction.client_name} | Type: {summary.transaction.transaction_type}
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-lg px-3 py-1">
              {summary.transaction.current_stage.replace('_', ' ')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {summary.checklist_summary.completed_tasks}
              </div>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {summary.checklist_summary.total_tasks}
              </div>
              <p className="text-sm text-muted-foreground">Total Tasks</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {summary.checklist_summary.overdue_tasks}
              </div>
              <p className="text-sm text-muted-foreground">Overdue</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {summary.checklist_summary.current_stage_progress}%
              </div>
              <p className="text-sm text-muted-foreground">Stage Progress</p>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-2">
              <span>Current Stage Progress</span>
              <span>{summary.checklist_summary.current_stage_progress}%</span>
            </div>
            <Progress value={summary.checklist_summary.current_stage_progress} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* AI Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            AI Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Summary</h4>
            <p className="text-sm">{summary.ai_analysis.summary}</p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">Current Status</h4>
            <p className="text-sm">{summary.ai_analysis.current_status}</p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-2">Progress Assessment</h4>
            <p className="text-sm">{summary.ai_analysis.progress_assessment}</p>
          </div>
        </CardContent>
      </Card>

      {/* Critical Actions & Next Steps */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Critical Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary.ai_analysis.critical_actions?.length > 0 ? (
              <ul className="space-y-2">
                {summary.ai_analysis.critical_actions.map((action, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    {action}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No critical actions at this time</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-600">
              <Target className="h-5 w-5" />
              Next Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary.ai_analysis.next_steps?.length > 0 ? (
              <ul className="space-y-2">
                {summary.ai_analysis.next_steps.map((step, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    {step}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No next steps defined</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Overdue Tasks */}
      {summary.overdue_tasks?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <Clock className="h-5 w-5" />
              Overdue Tasks ({summary.overdue_tasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {summary.overdue_tasks.slice(0, 5).map((task, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <div>
                    <h5 className="font-medium">{task.title}</h5>
                    <p className="text-sm text-muted-foreground">
                      Due: {new Date(task.due_date).toLocaleDateString()} | 
                      Priority: {task.priority}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-orange-600">
                    {Math.ceil((new Date() - new Date(task.due_date)) / (1000 * 60 * 60 * 24))} days overdue
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600">
            <Lightbulb className="h-5 w-5" />
            Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summary.ai_analysis.recommendations?.length > 0 ? (
            <ul className="space-y-2">
              {summary.ai_analysis.recommendations.map((recommendation, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <Lightbulb className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  {recommendation}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No specific recommendations at this time</p>
          )}
        </CardContent>
      </Card>

      {/* Timeline Outlook */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Timeline Outlook
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{summary.ai_analysis.timeline_outlook}</p>
          <div className="mt-3 text-xs text-muted-foreground">
            Summary generated: {new Date(summary.generated_at).toLocaleString()}
          </div>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Command Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Agent Command Interface
          </CardTitle>
          <CardDescription>
            Try: "Summarize 125 Maple Ave deal" or "Show me overdue tasks"
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter your command..."
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
              className="flex-1"
            />
            <Button 
              onClick={executeCommand}
              disabled={!command.trim() || loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Command Result */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Command Result</CardTitle>
          </CardHeader>
          <CardContent>
            {result.success ? (
              result.action === 'deal_summary' ? (
                <DealSummaryDisplay summary={result} />
              ) : result.action === 'alerts' ? (
                <div>Alerts functionality coming soon</div>
              ) : (
                <pre className="text-sm">{JSON.stringify(result, null, 2)}</pre>
              )
            ) : (
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-4 w-4" />
                {result.error}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Command History */}
      {commandHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Commands</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {commandHistory.map((entry, index) => (
                  <div key={entry.id} className="flex items-center justify-between text-sm p-2 bg-muted rounded">
                    <span>"{entry.command}"</span>
                    <div className="flex items-center gap-2">
                      {entry.result.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {entry.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export function SmartAlerts() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    priority: 'all',
    type: 'all'
  })

  useEffect(() => {
    fetchAlerts()
  }, [filters])

  const fetchAlerts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.priority !== 'all') params.append('priority', filters.priority)
      if (filters.type !== 'all') params.append('type', filters.type)

      const response = await fetch(`/api/alerts/smart?${params.toString()}`)
      const data = await response.json()
      
      if (data.success) {
        setAlerts(data.alerts)
      }
    } catch (error) {
      console.error('Error fetching alerts:', error)
    }
    setLoading(false)
  }

  const dismissAlert = async (alertId) => {
    try {
      const response = await fetch(`/api/alerts/dismiss/${alertId}`, {
        method: 'POST'
      })
      
      if (response.ok) {
        setAlerts(alerts.filter(alert => alert.id !== alertId))
      }
    } catch (error) {
      console.error('Error dismissing alert:', error)
    }
  }

  const generateAlerts = async () => {
    setLoading(true)
    try {
      await fetch('/api/alerts/generate', { method: 'POST' })
      await fetchAlerts()
    } catch (error) {
      console.error('Error generating alerts:', error)
    }
    setLoading(false)
  }

  const AlertCard = ({ alert }) => {
    const priorityConfig = ALERT_PRIORITY_CONFIG[alert.priority] || ALERT_PRIORITY_CONFIG.medium
    const typeConfig = ALERT_TYPE_CONFIG[alert.alert_type] || ALERT_TYPE_CONFIG.overdue_tasks
    const PriorityIcon = priorityConfig.icon
    const TypeIcon = typeConfig.icon

    return (
      <Card className="hover:shadow-sm transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className={`p-2 rounded-full ${priorityConfig.color}`}>
                <PriorityIcon className="h-4 w-4" />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold">{alert.title}</h4>
                  <Badge variant="outline" className="text-xs">
                    {typeConfig.name}
                  </Badge>
                </div>
                
                <p className="text-sm text-muted-foreground mb-2">
                  {alert.message}
                </p>
                
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Home className="h-3 w-3" />
                    {alert.property_address}
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {alert.client_name}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(alert.created_at).toLocaleDateString()}
                  </span>
                </div>

                {/* Alert Details */}
                {alert.details && (
                  <div className="mt-3 p-2 bg-muted rounded text-xs">
                    {alert.alert_type === 'overdue_tasks' && (
                      <div>
                        <strong>{alert.details.overdue_count} overdue tasks</strong>
                        {alert.details.overdue_tasks && (
                          <ul className="mt-1 list-disc list-inside">
                            {alert.details.overdue_tasks.slice(0, 3).map((task, index) => (
                              <li key={index}>
                                {task.title} ({task.days_overdue} days overdue)
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                    
                    {alert.alert_type === 'deal_inactivity' && (
                      <div>
                        <strong>Inactive for {alert.details.days_inactive} days</strong>
                        <br />Current stage: {alert.details.current_stage}
                      </div>
                    )}
                    
                    {alert.alert_type === 'closing_approaching' && (
                      <div>
                        <strong>Closing in {alert.details.days_to_closing} days</strong>
                        <br />{alert.details.incomplete_tasks} tasks remaining
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dismissAlert(alert.id)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Smart Alerts</h2>
          <p className="text-muted-foreground">
            Automated alerts for overdue tasks, deal inactivity, and closing deadlines
          </p>
        </div>
        <Button onClick={generateAlerts} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Bell className="mr-2 h-4 w-4" />
          )}
          Refresh Alerts
        </Button>
      </div>

      {/* Alert Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['urgent', 'high', 'medium', 'low'].map(priority => {
          const count = alerts.filter(alert => alert.priority === priority).length
          const config = ALERT_PRIORITY_CONFIG[priority]
          return (
            <Card key={priority}>
              <CardContent className="p-4 text-center">
                <div className={`text-2xl font-bold ${config.color.replace('bg-', 'text-').replace('100', '600')}`}>
                  {count}
                </div>
                <p className="text-sm capitalize">{priority} Priority</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Alerts List */}
      {loading && alerts.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading alerts...</p>
          </div>
        </div>
      ) : alerts.length > 0 ? (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <Bell className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No active alerts</h3>
            <p className="text-muted-foreground mb-4">
              All your transactions are on track! Smart alerts will appear here when attention is needed.
            </p>
            <Button onClick={generateAlerts}>
              <Bell className="mr-2 h-4 w-4" />
              Check for New Alerts
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}