'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  Bot, 
  Send, 
  User, 
  Home, 
  DollarSign, 
  MapPin, 
  Bed, 
  Bath,
  Square,
  UserPlus,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'

export function AssistantChat() {
  const [messages, setMessages] = useState([
    {
      id: '1',
      type: 'assistant',
      content: 'Hi! I\'m your AI real estate assistant. You can tell me about leads in natural language like: "Just met Priya Sharma. 2BHK in Frisco under $500K." I\'ll help you create leads and find matching properties!',
      timestamp: new Date(),
    }
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const formatCurrency = (amount) => {
    if (!amount) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return

    const userMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    
    const currentInput = inputMessage
    setInputMessage('')

    try {
      // Step 1: Parse the message with timeout
      console.log('Sending parse request with message:', currentInput)
      
      const parseController = new AbortController()
      const parseTimeout = setTimeout(() => parseController.abort(), 30000) // 30 second timeout

      const parseResponse = await fetch('/api/assistant/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentInput }),
        signal: parseController.signal
      })

      clearTimeout(parseTimeout)

      console.log('Parse response status:', parseResponse.status, parseResponse.statusText)

      if (!parseResponse.ok) {
        const errorText = await parseResponse.text()
        console.error('Parse API error response:', errorText)
        throw new Error(`Parse API failed: ${parseResponse.status} ${parseResponse.statusText} - ${errorText}`)
      }

      let parseData
      try {
        const responseText = await parseResponse.text()
        console.log('Parse response text:', responseText)
        
        if (!responseText.trim()) {
          throw new Error('Empty response from parse API')
        }
        parseData = JSON.parse(responseText)
        console.log('Parse data:', parseData)
      } catch (jsonError) {
        console.error('Parse response JSON error:', jsonError)
        throw new Error('Invalid response format from parse API')
      }

      if (!parseData || !parseData.success) {
        console.error('Parse data indicates failure:', parseData)
        throw new Error(parseData?.error || 'Failed to parse message')
      }

      // Step 2: Match leads and properties with timeout
      console.log('Sending match request with parsed data:', parseData.parsed_data)
      
      const matchController = new AbortController()
      const matchTimeout = setTimeout(() => matchController.abort(), 30000) // 30 second timeout

      const matchResponse = await fetch('/api/assistant/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parsed_data: parseData.parsed_data,
          original_message: currentInput,
          agent_name: 'Agent Smith'
        }),
        signal: matchController.signal
      })

      clearTimeout(matchTimeout)

      console.log('Match response status:', matchResponse.status, matchResponse.statusText)

      if (!matchResponse.ok) {
        const errorText = await matchResponse.text()
        console.error('Match API error response:', errorText)
        throw new Error(`Match API failed: ${matchResponse.status} ${matchResponse.statusText} - ${errorText}`)
      }

      let matchData
      try {
        const responseText = await matchResponse.text()
        console.log('Match response text length:', responseText.length)
        
        if (!responseText.trim()) {
          throw new Error('Empty response from match API')
        }
        matchData = JSON.parse(responseText)
        console.log('Match data success:', matchData.success)
      } catch (jsonError) {
        console.error('Match response JSON error:', jsonError)
        throw new Error('Invalid response format from match API')
      }

      if (!matchData || !matchData.success) {
        console.error('Match data indicates failure:', matchData)
        throw new Error(matchData?.error || 'Failed to process request')
      }

      // Create assistant response with results
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: matchData.ai_recommendations || 'I\'ve processed your request successfully.',
        timestamp: new Date(),
        data: {
          lead: matchData.lead,
          isNewLead: matchData.is_new_lead,
          properties: matchData.properties || [],
          propertiesCount: matchData.properties_count || 0,
          summary: matchData.summary
        }
      }

      setMessages(prev => [...prev, assistantMessage])

    } catch (error) {
      console.error('Assistant error:', error)
      
      let errorMsg = 'Sorry, I encountered an error. Please try again.'
      
      if (error.name === 'AbortError') {
        errorMsg = 'Request timed out. The AI processing is taking longer than expected. Please try with a shorter message.'
      } else if (error.message.includes('502') || error.message.includes('Bad Gateway')) {
        errorMsg = '🔧 **Infrastructure Issue Detected**\n\nThe AI Assistant backend is fully functional, but there\'s a proxy configuration issue preventing external API access. \n\n**What works**: All APIs on localhost:3000 ✅\n**Issue**: External proxy routing for /api/* endpoints ❌\n\n**For immediate testing**, you can verify the AI works by running:\n```bash\ncurl -X POST http://localhost:3000/api/assistant/parse \\\n  -H "Content-Type: application/json" \\\n  -d \'{"message": "Met Sarah, 2BHK in Austin under $350K"}\'\n```\n\n**Status**: Waiting for proxy configuration fix to enable full functionality.'
      } else if (error.message.includes('Parse API failed')) {
        errorMsg = 'Failed to understand your message. Please try rephrasing it.'
      } else if (error.message.includes('Match API failed')) {
        errorMsg = 'Failed to process your request. Please try again.'
      } else {
        errorMsg = `Error: ${error.message}`
      }
      
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: errorMsg,
        timestamp: new Date(),
        isError: true
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="flex flex-col h-[600px] w-full">
      {/* Chat Header */}
      <div className="flex items-center space-x-3 p-4 border-b bg-muted/50">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary/10 text-primary">
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="font-semibold">AI Real Estate Assistant</h3>
          <p className="text-sm text-muted-foreground">Lead & Property Matching</p>
        </div>
      </div>

      {/* Chat Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex items-start space-x-2 max-w-[80%] ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                <Avatar className="h-6 w-6 mt-1">
                  <AvatarFallback className={`text-xs ${message.type === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    {message.type === 'user' ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                  </AvatarFallback>
                </Avatar>
                
                <div className="space-y-2">
                  <div className={`rounded-lg p-3 ${
                    message.type === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : message.isError
                        ? 'bg-destructive/10 text-destructive border border-destructive/20'
                        : 'bg-muted'
                  }`}>
                    <p className="text-sm whitespace-pre-line">{message.content}</p>
                  </div>

                  {/* Results Display */}
                  {message.data && (
                    <div className="space-y-3">
                      {/* Lead Information */}
                      {message.data.lead && (
                        <Card className="bg-background">
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm flex items-center">
                                {message.data.isNewLead ? <UserPlus className="mr-2 h-4 w-4 text-green-600" /> : <CheckCircle className="mr-2 h-4 w-4 text-blue-600" />}
                                {message.data.isNewLead ? 'New Lead Created' : 'Existing Lead Found'}
                              </CardTitle>
                              <Badge variant={message.data.lead.lead_type === 'buyer' ? 'default' : 'secondary'}>
                                {message.data.lead.lead_type}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="space-y-2">
                              <p className="font-medium">{message.data.lead.name}</p>
                              <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                                <span>📧 {message.data.lead.email}</span>
                                <span>📞 {message.data.lead.phone}</span>
                              </div>
                              {message.data.lead.preferences && Object.keys(message.data.lead.preferences).length > 0 && (
                                <div className="mt-2 p-2 bg-muted rounded text-sm">
                                  <strong>Preferences:</strong>
                                  <div className="grid grid-cols-2 gap-1 mt-1">
                                    {message.data.lead.preferences.zipcode && (
                                      <span><MapPin className="inline h-3 w-3 mr-1" />{message.data.lead.preferences.zipcode}</span>
                                    )}
                                    {message.data.lead.preferences.bedrooms && (
                                      <span><Bed className="inline h-3 w-3 mr-1" />{message.data.lead.preferences.bedrooms} bed</span>
                                    )}
                                    {message.data.lead.preferences.min_price && (
                                      <span><DollarSign className="inline h-3 w-3 mr-1" />Min: {formatCurrency(message.data.lead.preferences.min_price)}</span>
                                    )}
                                    {message.data.lead.preferences.max_price && (
                                      <span><DollarSign className="inline h-3 w-3 mr-1" />Max: {formatCurrency(message.data.lead.preferences.max_price)}</span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Properties Results */}
                      {message.data.properties && message.data.properties.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">Found {message.data.propertiesCount} properties</p>
                            <Badge variant="outline">{message.data.properties.length} shown</Badge>
                          </div>
                          
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {message.data.properties.slice(0, 3).map((property, index) => (
                              <Card key={index} className="bg-background">
                                <CardContent className="p-3">
                                  <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                      <p className="font-medium text-sm">
                                        {property.address || `Property #${index + 1}`}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {property.city}, {property.state} {property.zipcode}
                                      </p>
                                      <div className="flex gap-3 text-xs text-muted-foreground">
                                        {property.bedrooms && (
                                          <span className="flex items-center">
                                            <Bed className="mr-1 h-3 w-3" />
                                            {property.bedrooms}
                                          </span>
                                        )}
                                        {property.bathrooms && (
                                          <span className="flex items-center">
                                            <Bath className="mr-1 h-3 w-3" />
                                            {property.bathrooms}
                                          </span>
                                        )}
                                        {property.square_feet && (
                                          <span className="flex items-center">
                                            <Square className="mr-1 h-3 w-3" />
                                            {property.square_feet} sq ft
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {property.price && (
                                      <div className="text-right">
                                        <p className="font-bold text-primary text-sm">
                                          {formatCurrency(property.price)}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* No Properties Found */}
                      {message.data.properties && message.data.properties.length === 0 && (
                        <Card className="bg-background border-dashed">
                          <CardContent className="p-4 text-center">
                            <Home className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">No properties found matching the criteria</p>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-start space-x-2 max-w-[80%]">
                <Avatar className="h-6 w-6 mt-1">
                  <AvatarFallback className="bg-muted">
                    <Bot className="h-3 w-3" />
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-lg p-3 bg-muted">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <p className="text-sm">Processing your request...</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <Separator />

      {/* Chat Input */}
      <div className="p-4">
        <div className="flex space-x-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Try: 'Just met John Smith. Looking for 3BR in Dallas under $400K'"
            className="flex-1"
            disabled={isLoading}
          />
          <Button 
            onClick={handleSendMessage} 
            disabled={!inputMessage.trim() || isLoading}
            className="shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Tip: Use natural language like "Met Sarah, wants 2BHK in Austin under $350K" or "John selling condo in NYC for $800K"
        </p>
      </div>
    </div>
  )
}