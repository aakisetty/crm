import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'

// MongoDB connection
let client
let db

async function connectToMongo() {
  if (!client) {
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME)
  }
  return db
}

// Enhanced OpenAI Agent Utilities with advanced features
class OpenAIUtility {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY
    this.baseURL = 'https://api.openai.com/v1'
    this.maxRetries = 3
    this.baseDelay = 1000 // 1 second
    this.maxDelay = 30000 // 30 seconds
    this.tokenLimits = {
      'gpt-4o-mini': { input: 128000, output: 16000, cost_per_1k_input: 0.00015, cost_per_1k_output: 0.0006 },
      'o1-mini': { input: 128000, output: 65536, cost_per_1k_input: 0.003, cost_per_1k_output: 0.012 },
      'gpt-4o': { input: 128000, output: 4096, cost_per_1k_input: 0.005, cost_per_1k_output: 0.015 }
    }
    this.requestLog = []
    this.totalCost = 0
    this.dailyCostLimit = 50.00 // $50 daily limit
  }

  // Enhanced token counting with tiktoken-style approximation
  estimateTokenCount(text, model = 'gpt-4o-mini') {
    if (!text) return 0
    
    // Rough approximation: 1 token ≈ 4 characters for English text
    // More accurate for code and structured content
    const baseCount = Math.ceil(text.length / 4)
    
    // Adjust for model-specific tokenization patterns
    const modelAdjustments = {
      'gpt-4o-mini': 1.0,
      'o1-mini': 1.1, // O1 models tend to use slightly more tokens
      'gpt-4o': 1.0
    }
    
    return Math.ceil(baseCount * (modelAdjustments[model] || 1.0))
  }

  // Calculate message token count including system formatting
  calculateMessageTokens(messages, model = 'gpt-4o-mini') {
    let totalTokens = 0
    
    for (const message of messages) {
      // Add tokens for role and content
      totalTokens += this.estimateTokenCount(message.role, model)
      totalTokens += this.estimateTokenCount(message.content, model)
      // Add overhead tokens for message formatting
      totalTokens += 4
    }
    
    // Add conversation overhead
    totalTokens += 2
    
    return totalTokens
  }

  // Cost calculation and budget checking
  calculateCost(inputTokens, outputTokens, model = 'gpt-4o-mini') {
    const limits = this.tokenLimits[model]
    if (!limits) return 0

    const inputCost = (inputTokens / 1000) * limits.cost_per_1k_input
    const outputCost = (outputTokens / 1000) * limits.cost_per_1k_output
    
    return inputCost + outputCost
  }

  // Check if request would exceed budget limits
  checkBudgetLimits(estimatedCost) {
    const projectedTotal = this.totalCost + estimatedCost
    
    if (projectedTotal > this.dailyCostLimit) {
      throw new Error(`Request would exceed daily cost limit. Current: $${this.totalCost.toFixed(4)}, Estimated: $${estimatedCost.toFixed(4)}, Limit: $${this.dailyCostLimit}`)
    }

    if (estimatedCost > 5.00) {
      throw new Error(`Single request cost too high: $${estimatedCost.toFixed(4)}. Maximum allowed: $5.00`)
    }
  }

  // Exponential backoff calculation
  calculateBackoffDelay(attemptNumber) {
    const delay = this.baseDelay * Math.pow(2, attemptNumber - 1)
    const jitter = Math.random() * 0.1 * delay // Add 10% jitter
    return Math.min(delay + jitter, this.maxDelay)
  }

  // Enhanced error handling and classification
  classifyError(error, response = null) {
    const status = response?.status || error.status || 0
    const errorData = error.response?.data || error.data || {}
    const errorCode = errorData.error?.code || errorData.code
    const errorType = errorData.error?.type || errorData.type
    
    return {
      status,
      code: errorCode,
      type: errorType,
      message: errorData.error?.message || errorData.message || error.message,
      isRetryable: status === 429 || status === 503 || status === 502 || status >= 500,
      isRateLimit: status === 429,
      isBudgetIssue: errorCode === 'insufficient_quota' || errorCode === 'quota_exceeded',
      isModelIssue: status === 404 && errorType === 'invalid_request_error'
    }
  }

  // Stream response handler
  async handleStreamResponse(response, onChunk = null) {
    if (!response.body) {
      throw new Error('No response body for streaming')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content
              if (content) {
                fullContent += content
                if (onChunk) onChunk(content)
              }
            } catch (parseError) {
              console.warn('Failed to parse streaming chunk:', parseError)
            }
          }
        }
      }

      return fullContent
    } finally {
      reader.releaseLock()
    }
  }

  // Main callOpenAI function with all enhancements
  async callOpenAI(model = 'gpt-4o-mini', messages, options = {}) {
    const {
      stream = false,
      onChunk = null,
      maxTokens = null,
      temperature = 0.7,
      topP = 1.0,
      frequencyPenalty = 0,
      presencePenalty = 0,
      stop = null,
      skipBudgetCheck = false,
      customRetries = null
    } = options

    // Validate model
    if (!this.tokenLimits[model]) {
      console.warn(`Unknown model: ${model}, using gpt-4o-mini as fallback`)
      model = 'gpt-4o-mini'
    }

    // Validate API key
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Calculate token usage and cost
    const inputTokens = this.calculateMessageTokens(messages, model)
    const estimatedOutputTokens = maxTokens || this.tokenLimits[model].output / 4
    const estimatedCost = this.calculateCost(inputTokens, estimatedOutputTokens, model)

    // Budget checks
    if (!skipBudgetCheck) {
      this.checkBudgetLimits(estimatedCost)
    }

    // Token limit validation
    const modelLimits = this.tokenLimits[model]
    if (inputTokens > modelLimits.input) {
      throw new Error(`Input tokens (${inputTokens}) exceed model limit (${modelLimits.input})`)
    }

    // Build request payload
    const requestPayload = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
      stream
    }

    if (stop) requestPayload.stop = stop

    // Remove null/undefined values
    Object.keys(requestPayload).forEach(key => {
      if (requestPayload[key] === null || requestPayload[key] === undefined) {
        delete requestPayload[key]
      }
    })

    const maxRetries = customRetries ?? this.maxRetries
    let lastError = null

    // Retry loop with exponential backoff
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const requestStart = Date.now()
      
      try {
        const response = await fetch(`${this.baseURL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'RealEstate-CRM/1.0'
          },
          body: JSON.stringify(requestPayload)
        })

        const responseTime = Date.now() - requestStart

        // Handle streaming response
        if (stream && response.ok) {
          const content = await this.handleStreamResponse(response, onChunk)
          const outputTokens = this.estimateTokenCount(content, model)
          const actualCost = this.calculateCost(inputTokens, outputTokens, model)
          
          // Log successful request
          this.logRequest({
            model,
            inputTokens,
            outputTokens,
            cost: actualCost,
            responseTime,
            attempt,
            success: true,
            stream: true
          })

          this.totalCost += actualCost
          return content
        }

        // Handle non-streaming response
        if (response.ok) {
          const data = await response.json()
          const content = data.choices?.[0]?.message?.content || ''
          const usage = data.usage
          const actualOutputTokens = usage?.completion_tokens || this.estimateTokenCount(content, model)
          const actualInputTokens = usage?.prompt_tokens || inputTokens
          const actualCost = this.calculateCost(actualInputTokens, actualOutputTokens, model)

          // Log successful request
          this.logRequest({
            model,
            inputTokens: actualInputTokens,
            outputTokens: actualOutputTokens,
            cost: actualCost,
            responseTime,
            attempt,
            success: true,
            usage
          })

          this.totalCost += actualCost
          return content
        }

        // Handle error response
        const errorData = await response.json().catch(() => ({}))
        const error = new Error(`OpenAI API Error: ${response.status}`)
        error.status = response.status
        error.data = errorData
        throw error

      } catch (error) {
        lastError = error
        const errorInfo = this.classifyError(error)
        
        // Log failed request
        this.logRequest({
          model,
          inputTokens,
          outputTokens: 0,
          cost: 0,
          responseTime: Date.now() - requestStart,
          attempt,
          success: false,
          error: errorInfo
        })

        console.error(`OpenAI API attempt ${attempt} failed:`, errorInfo)

        // Don't retry on non-retryable errors
        if (!errorInfo.isRetryable || attempt > maxRetries) {
          break
        }

        // Calculate backoff delay
        const delay = this.calculateBackoffDelay(attempt)
        console.log(`Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries + 1})`)
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    // All retries exhausted, throw the last error
    const errorInfo = this.classifyError(lastError)
    
    if (errorInfo.isRateLimit) {
      throw new Error(`Rate limit exceeded after ${maxRetries} retries. Please try again later.`)
    } else if (errorInfo.isBudgetIssue) {
      throw new Error(`OpenAI quota exceeded. Please check your billing.`)
    } else if (errorInfo.isModelIssue) {
      throw new Error(`Model '${model}' is not available. Please try a different model.`)
    } else {
      throw new Error(`OpenAI API failed after ${maxRetries} retries: ${errorInfo.message}`)
    }
  }

  // Request logging for monitoring and debugging
  logRequest(requestInfo) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      ...requestInfo
    }
    
    this.requestLog.push(logEntry)
    
    // Keep only last 100 requests in memory
    if (this.requestLog.length > 100) {
      this.requestLog = this.requestLog.slice(-100)
    }

    // Console logging for monitoring
    if (requestInfo.success) {
      console.log(`✅ OpenAI ${requestInfo.model}: ${requestInfo.inputTokens}+${requestInfo.outputTokens} tokens, $${requestInfo.cost.toFixed(4)}, ${requestInfo.responseTime}ms`)
    } else {
      console.error(`❌ OpenAI ${requestInfo.model} failed: ${requestInfo.error.message}`)
    }
  }

  // Get usage statistics
  getUsageStats() {
    const successfulRequests = this.requestLog.filter(req => req.success)
    const totalRequests = this.requestLog.length
    const totalTokens = successfulRequests.reduce((sum, req) => sum + req.inputTokens + req.outputTokens, 0)
    const avgResponseTime = successfulRequests.reduce((sum, req) => sum + req.responseTime, 0) / successfulRequests.length

    return {
      totalRequests,
      successfulRequests: successfulRequests.length,
      successRate: (successfulRequests.length / totalRequests) * 100,
      totalCost: this.totalCost,
      totalTokens,
      avgResponseTime: Math.round(avgResponseTime),
      dailyCostLimit: this.dailyCostLimit,
      remainingBudget: Math.max(0, this.dailyCostLimit - this.totalCost),
      modelUsage: this.getModelUsageBreakdown()
    }
  }

  // Model usage breakdown
  getModelUsageBreakdown() {
    const breakdown = {}
    
    this.requestLog.forEach(req => {
      if (!breakdown[req.model]) {
        breakdown[req.model] = {
          requests: 0,
          tokens: 0,
          cost: 0,
          avgResponseTime: 0
        }
      }
      
      breakdown[req.model].requests++
      breakdown[req.model].tokens += req.inputTokens + req.outputTokens
      breakdown[req.model].cost += req.cost
      breakdown[req.model].avgResponseTime += req.responseTime
    })

    // Calculate averages
    Object.keys(breakdown).forEach(model => {
      if (breakdown[model].requests > 0) {
        breakdown[model].avgResponseTime = Math.round(breakdown[model].avgResponseTime / breakdown[model].requests)
      }
    })

    return breakdown
  }

  // Reset daily usage (for production, this would be automated)
  resetDailyUsage() {
    this.totalCost = 0
    this.requestLog = []
    console.log('✅ Daily usage reset')
  }
}

// Create global instance
const openaiUtility = new OpenAIUtility()

// Enhanced callOpenAI function with all features
async function callOpenAI(model = 'gpt-4o-mini', messages, options = {}) {
  return await openaiUtility.callOpenAI(model, messages, options)
}

// Real Estate API Integration - Enhanced Property Search
async function fetchProperties(filters = {}) {
  try {
    const { 
      location, 
      beds, 
      baths, 
      min_price, 
      max_price, 
      listing_status = 'for_sale',
      property_type,
      sort_by,
      limit = 20,
      offset = 0
    } = filters

    // Use the specific endpoint requested
    const baseUrl = 'https://api.realestateapi.com/v1/properties'
    const params = new URLSearchParams()
    
    // Required filters
    params.append('listing_status', listing_status)
    
    // Optional filters
    if (location) params.append('location', location)
    if (beds) params.append('beds', beds.toString())
    if (baths) params.append('baths', baths.toString())
    if (min_price) params.append('min_price', min_price.toString())
    if (max_price) params.append('max_price', max_price.toString())
    if (property_type) params.append('property_type', property_type)
    if (sort_by) params.append('sort_by', sort_by)
    if (limit) params.append('limit', limit.toString())
    if (offset) params.append('offset', offset.toString())

    const url = `${baseUrl}?${params.toString()}`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': process.env.REAL_ESTATE_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    })
    
    if (!response.ok) {
      console.error('Real Estate API Error:', {
        status: response.status,
        statusText: response.statusText,
        url: url
      })
      
      // Return fallback/mock data for development
      return generateFallbackProperties(filters)
    }
    
    const data = await response.json()
    
    // Normalize response structure
    const properties = data.properties || data.results || data.data || []
    
    // Add metadata
    return {
      properties: properties.map(property => ({
        id: property.id || `prop_${Date.now()}_${Math.random()}`,
        address: property.address || property.street_address,
        city: property.city,
        state: property.state,
        zipcode: property.zipcode || property.zip_code,
        price: property.price || property.list_price,
        bedrooms: property.bedrooms || property.beds,
        bathrooms: property.bathrooms || property.baths,
        square_feet: property.square_feet || property.sqft,
        property_type: property.property_type || property.type,
        listing_status: property.listing_status || property.status,
        description: property.description,
        images: property.images || property.photos || [],
        listing_date: property.listing_date || property.date_listed,
        days_on_market: property.days_on_market || property.dom,
        mls_number: property.mls_number || property.mls_id,
        lot_size: property.lot_size,
        year_built: property.year_built,
        garage: property.garage,
        pool: property.pool,
        fireplace: property.fireplace
      })),
      total: data.total || data.count || properties.length,
      has_more: data.has_more || false,
      filters_applied: filters
    }
  } catch (error) {
    console.error('Property Search Error:', error)
    
    // Return fallback data on error
    return generateFallbackProperties(filters)
  }
}

// Legacy function for backwards compatibility
async function searchProperties(filters = {}) {
  const result = await fetchProperties(filters)
  return result.properties || []
}

// Stage Transition Validation using o1-mini
async function validateStageTransition(db, transactionId, currentStage, targetStage, force = false) {
  try {
    // Get all checklist items for current stage
    const currentStageItems = await db.collection('checklist_items')
      .find({ 
        transaction_id: transactionId, 
        stage: currentStage 
      })
      .toArray()

    const incompleteItems = currentStageItems.filter(item => item.status !== 'completed')
    const blockedItems = currentStageItems.filter(item => item.status === 'blocked')

    // Use o1-mini for intelligent validation
    const validationMessages = [
      {
        role: "system",
        content: `You are a real estate transaction expert. Analyze stage transitions for completeness and compliance.

        Current stage: ${currentStage}
        Target stage: ${targetStage}
        
        Stages in order:
        1. pre_listing - Property preparation, pricing, marketing setup
        2. listing - Active marketing, showings, offers
        3. under_contract - Inspections, appraisal, financing
        4. escrow_closing - Title work, final walkthrough, closing
        
        Rules:
        - All critical tasks must be completed before advancing
        - Some tasks can be moved to next stage if reasonable
        - Blocked items must be resolved
        - Cannot skip stages (must go in order)
        
        Return JSON with:
        {
          "valid": boolean,
          "confidence": number (0-100),
          "errors": ["error messages"],
          "warnings": ["warning messages"],
          "missing_critical": ["critical task titles"],
          "can_proceed_with_warnings": boolean,
          "recommendations": ["suggestions"]
        }`
      },
      {
        role: "user", 
        content: `Validate transition from "${currentStage}" to "${targetStage}".
        
        Incomplete items (${incompleteItems.length}):
        ${incompleteItems.map(item => `- ${item.title} (${item.priority} priority, status: ${item.status})`).join('\n')}
        
        Blocked items (${blockedItems.length}):
        ${blockedItems.map(item => `- ${item.title} (blocked: ${item.notes})`).join('\n')}
        
        Force override requested: ${force}
        
        Should this transition be allowed?`
      }
    ]

    const validationResponse = await callOpenAI('o1-mini', validationMessages)
    let validationResult

    try {
      validationResult = JSON.parse(validationResponse)
    } catch (parseError) {
      // Fallback validation logic
      validationResult = {
        valid: incompleteItems.length === 0 && blockedItems.length === 0,
        confidence: 70,
        errors: incompleteItems.length > 0 ? [`${incompleteItems.length} incomplete tasks`] : [],
        warnings: blockedItems.length > 0 ? [`${blockedItems.length} blocked tasks`] : [],
        missing_critical: incompleteItems.filter(i => i.priority === 'high' || i.priority === 'urgent').map(i => i.title),
        can_proceed_with_warnings: incompleteItems.filter(i => i.priority === 'high' || i.priority === 'urgent').length === 0,
        recommendations: ["Complete high-priority tasks before proceeding"]
      }
    }

    return {
      valid: force || validationResult.valid || validationResult.can_proceed_with_warnings,
      ...validationResult,
      incomplete_count: incompleteItems.length,
      blocked_count: blockedItems.length,
      missing_tasks: incompleteItems.map(item => ({
        id: item.id,
        title: item.title,
        priority: item.priority,
        status: item.status
      }))
    }
  } catch (error) {
    console.error('Stage validation error:', error)
    return {
      valid: false,
      confidence: 0,
      errors: ["Validation service unavailable"],
      warnings: [],
      missing_critical: [],
      can_proceed_with_warnings: false,
      recommendations: ["Please try again or contact support"]
    }
  }
}

// Create default checklist items for each stage
async function createDefaultChecklistItems(db, transactionId, stage) {
  const defaultTasks = getDefaultTasksForStage(stage)
  
  const checklistItems = defaultTasks.map((task, index) => ({
    id: uuidv4(),
    transaction_id: transactionId,
    title: task.title,
    description: task.description,
    stage: stage,
    status: 'not_started',
    priority: task.priority,
    assignee: '',
    due_date: task.due_days ? new Date(Date.now() + task.due_days * 24 * 60 * 60 * 1000) : null,
    completed_date: null,
    notes: '',
    order: index + 1,
    stage_order: getStageOrder(stage),
    dependencies: task.dependencies || [],
    created_at: new Date(),
    updated_at: new Date()
  }))

  if (checklistItems.length > 0) {
    await db.collection('checklist_items').insertMany(checklistItems)
  }

  return checklistItems.map(({ _id, ...rest }) => rest)
}

// Get stage order for sorting
function getStageOrder(stage) {
  const stageOrder = {
    'pre_listing': 1,
    'listing': 2,
    'under_contract': 3,
    'escrow_closing': 4
  }
  return stageOrder[stage] || 999
}

// Helper function to extract names from messages (fallback parsing)
function extractNameFromMessage(message) {
  // Simple regex to find potential names
  const namePatterns = [
    /met\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    /client\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    /([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\s+wants|is\s+looking|needs)/i
  ]
  
  for (const pattern of namePatterns) {
    const match = message.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }
  
  return null
}

// Deal Summary Generation with o1-mini
async function generateDealSummary(db, propertyAddress) {
  try {
    // Find transaction by property address
    const transaction = await db.collection('transactions').findOne({
      property_address: { $regex: propertyAddress, $options: 'i' }
    })

    if (!transaction) {
      return {
        success: false,
        error: "Transaction not found",
        property_address: propertyAddress
      }
    }

    return await generateDealSummaryById(db, transaction.id)
  } catch (error) {
    console.error('Deal summary error:', error)
    return {
      success: false,
      error: "Failed to generate summary"
    }
  }
}

async function generateDealSummaryById(db, transactionId) {
  try {
    // Get transaction details
    const transaction = await db.collection('transactions').findOne({ id: transactionId })
    if (!transaction) {
      return {
        success: false,
        error: "Transaction not found"
      }
    }

    // Get all checklist items
    const checklistItems = await db.collection('checklist_items')
      .find({ transaction_id: transactionId })
      .sort({ stage_order: 1, order: 1 })
      .toArray()

    // Calculate overdue tasks
    const now = new Date()
    const overdueTasks = checklistItems.filter(item => 
      item.due_date && 
      new Date(item.due_date) < now && 
      item.status !== 'completed'
    )

    // Calculate stage completion
    const currentStageItems = checklistItems.filter(item => item.stage === transaction.current_stage)
    const completedStageItems = currentStageItems.filter(item => item.status === 'completed')
    const stageProgress = currentStageItems.length > 0 
      ? Math.round((completedStageItems.length / currentStageItems.length) * 100)
      : 0

    // Use o1-mini for intelligent deal analysis
    const analysisMessages = [
      {
        role: "system",
        content: `You are a real estate deal analyst. Analyze the transaction data and provide a comprehensive summary with actionable insights.

        Focus on:
        - Current stage status and progress
        - Critical overdue items requiring immediate attention
        - Key next steps to keep the deal moving
        - Risk factors and recommendations
        - Timeline insights and potential delays

        Return structured JSON with:
        {
          "summary": "Brief deal overview",
          "current_status": "Current stage analysis",
          "progress_assessment": "Overall progress evaluation",
          "critical_actions": ["List of urgent actions needed"],
          "overdue_risks": "Analysis of overdue items impact",
          "next_steps": ["Prioritized next steps"],
          "recommendations": ["Strategic recommendations"],
          "timeline_outlook": "Timeline assessment and closing likelihood"
        }`
      },
      {
        role: "user",
        content: `Analyze this real estate transaction:

        Property: ${transaction.property_address}
        Client: ${transaction.client_name}
        Type: ${transaction.transaction_type}
        Current Stage: ${transaction.current_stage}
        Stage Progress: ${stageProgress}% (${completedStageItems.length}/${currentStageItems.length} tasks)
        
        Overdue Tasks (${overdueTasks.length}):
        ${overdueTasks.map(task => `- ${task.title} (${task.priority} priority, due ${new Date(task.due_date).toLocaleDateString()})`).join('\n')}
        
        Current Stage Items:
        ${currentStageItems.map(item => `- ${item.title}: ${item.status} (${item.priority})`).join('\n')}
        
        Transaction Created: ${new Date(transaction.created_at).toLocaleDateString()}
        Last Updated: ${new Date(transaction.updated_at).toLocaleDateString()}
        
        Provide comprehensive analysis and actionable recommendations.`
      }
    ]

    const aiAnalysis = await callOpenAI('o1-mini', analysisMessages)
    let analysisResult

    try {
      analysisResult = JSON.parse(aiAnalysis)
    } catch (parseError) {
      // Fallback analysis
      analysisResult = {
        summary: `${transaction.property_address} - ${transaction.current_stage} stage with ${stageProgress}% completion`,
        current_status: `Currently in ${transaction.current_stage} stage`,
        progress_assessment: stageProgress >= 75 ? "Good progress" : stageProgress >= 50 ? "Moderate progress" : "Needs attention",
        critical_actions: overdueTasks.slice(0, 3).map(task => task.title),
        overdue_risks: overdueTasks.length > 0 ? "Multiple overdue tasks may delay closing" : "No overdue tasks",
        next_steps: currentStageItems.filter(item => item.status === 'not_started').slice(0, 3).map(item => item.title),
        recommendations: ["Review overdue tasks", "Update task assignments", "Set realistic deadlines"],
        timeline_outlook: "Timeline assessment pending detailed review"
      }
    }

    return {
      success: true,
      transaction: {
        ...transaction,
        _id: undefined
      },
      checklist_summary: {
        total_tasks: checklistItems.length,
        completed_tasks: checklistItems.filter(item => item.status === 'completed').length,
        overdue_tasks: overdueTasks.length,
        current_stage_progress: stageProgress,
        current_stage_tasks: currentStageItems.length
      },
      overdue_tasks: overdueTasks.map(({ _id, ...rest }) => rest),
      ai_analysis: analysisResult,
      generated_at: new Date()
    }
  } catch (error) {
    console.error('Deal summary generation error:', error)
    return {
      success: false,
      error: "Failed to generate deal summary"
    }
  }
}

// Smart Alerts System
async function getSmartAlerts(db, filters = {}) {
  try {
    // Get existing alerts from database
    let query = { status: { $ne: 'dismissed' } }
    
    if (filters.agent) query.assigned_agent = filters.agent
    if (filters.priority) query.priority = filters.priority
    if (filters.type) query.alert_type = filters.type

    const existingAlerts = await db.collection('smart_alerts')
      .find(query)
      .sort({ created_at: -1 })
      .limit(50)
      .toArray()

    // Generate new alerts if needed
    const newAlerts = await generateSmartAlerts(db)

    // Combine and return all alerts
    const allAlerts = [...newAlerts, ...existingAlerts.filter(alert => 
      !newAlerts.find(newAlert => 
        newAlert.transaction_id === alert.transaction_id && 
        newAlert.alert_type === alert.alert_type
      )
    )]

    return {
      success: true,
      alerts: allAlerts.map(({ _id, ...rest }) => rest),
      total: allAlerts.length,
      filters_applied: filters
    }
  } catch (error) {
    console.error('Smart alerts error:', error)
    return {
      success: false,
      error: "Failed to get smart alerts"
    }
  }
}

async function generateSmartAlerts(db) {
  try {
    const alerts = []
    const now = new Date()
    const threeDaysAgo = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000))
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000))

    // Get all active transactions
    const transactions = await db.collection('transactions')
      .find({ current_stage: { $ne: 'closed' } })
      .toArray()

    for (const transaction of transactions) {
      // Check for overdue tasks (> 3 days)
      const overdueTasks = await db.collection('checklist_items')
        .find({
          transaction_id: transaction.id,
          due_date: { $lt: threeDaysAgo },
          status: { $ne: 'completed' }
        })
        .toArray()

      if (overdueTasks.length > 0) {
        const alertId = uuidv4()
        const overdueAlert = {
          id: alertId,
          alert_type: 'overdue_tasks',
          priority: overdueTasks.some(task => task.priority === 'urgent') ? 'urgent' : 'high',
          transaction_id: transaction.id,
          property_address: transaction.property_address,
          client_name: transaction.client_name,
          assigned_agent: transaction.assigned_agent,
          title: `${overdueTasks.length} Overdue Tasks`,
          message: `${transaction.property_address} has ${overdueTasks.length} tasks overdue by more than 3 days`,
          details: {
            overdue_count: overdueTasks.length,
            most_overdue: overdueTasks[0]?.title,
            overdue_tasks: overdueTasks.slice(0, 5).map(task => ({
              title: task.title,
              due_date: task.due_date,
              priority: task.priority,
              days_overdue: Math.ceil((now - new Date(task.due_date)) / (1000 * 60 * 60 * 24))
            }))
          },
          created_at: now,
          status: 'active'
        }
        alerts.push(overdueAlert)
      }

      // Check for deal inactivity (> 7 days)
      if (new Date(transaction.updated_at) < sevenDaysAgo) {
        const alertId = uuidv4()
        const inactivityAlert = {
          id: alertId,
          alert_type: 'deal_inactivity',
          priority: 'medium',
          transaction_id: transaction.id,
          property_address: transaction.property_address,
          client_name: transaction.client_name,
          assigned_agent: transaction.assigned_agent,
          title: 'Deal Inactive',
          message: `${transaction.property_address} has been inactive for ${Math.ceil((now - new Date(transaction.updated_at)) / (1000 * 60 * 60 * 24))} days`,
          details: {
            days_inactive: Math.ceil((now - new Date(transaction.updated_at)) / (1000 * 60 * 60 * 24)),
            current_stage: transaction.current_stage,
            last_update: transaction.updated_at
          },
          created_at: now,
          status: 'active'
        }
        alerts.push(inactivityAlert)
      }

      // Check for approaching closing dates
      if (transaction.closing_date) {
        const closingDate = new Date(transaction.closing_date)
        const daysToClosing = Math.ceil((closingDate - now) / (1000 * 60 * 60 * 24))
        
        if (daysToClosing <= 7 && daysToClosing > 0) {
          const currentStageItems = await db.collection('checklist_items')
            .find({ 
              transaction_id: transaction.id,
              stage: transaction.current_stage,
              status: { $ne: 'completed' }
            })
            .toArray()

          if (currentStageItems.length > 0) {
            const alertId = uuidv4()
            const closingAlert = {
              id: alertId,
              alert_type: 'closing_approaching',
              priority: daysToClosing <= 3 ? 'urgent' : 'high',
              transaction_id: transaction.id,
              property_address: transaction.property_address,
              client_name: transaction.client_name,
              assigned_agent: transaction.assigned_agent,
              title: `Closing in ${daysToClosing} Days`,
              message: `${transaction.property_address} closes in ${daysToClosing} days with ${currentStageItems.length} incomplete tasks`,
              details: {
                days_to_closing: daysToClosing,
                closing_date: transaction.closing_date,
                incomplete_tasks: currentStageItems.length,
                current_stage: transaction.current_stage
              },
              created_at: now,
              status: 'active'
            }
            alerts.push(closingAlert)
          }
        }
      }
    }

    // Save new alerts to database
    if (alerts.length > 0) {
      await db.collection('smart_alerts').insertMany(alerts)
    }

    return alerts.map(({ _id, ...rest }) => rest)
  } catch (error) {
    console.error('Smart alerts generation error:', error)
    return []
  }
}
function getDefaultTasksForStage(stage) {
  const taskTemplates = {
    'pre_listing': [
      {
        title: 'Property Condition Assessment',
        description: 'Conduct thorough walkthrough to identify needed repairs and improvements',
        priority: 'high',
        due_days: 3
      },
      {
        title: 'Comparative Market Analysis (CMA)',
        description: 'Research comparable sales, active listings, and market trends',
        priority: 'high',
        due_days: 5
      },
      {
        title: 'Pricing Strategy Development',
        description: 'Set competitive listing price based on CMA and market conditions',
        priority: 'high',
        due_days: 7
      },
      {
        title: 'Home Staging Consultation',
        description: 'Evaluate staging needs and arrange professional staging if needed',
        priority: 'medium',
        due_days: 10
      },
      {
        title: 'Professional Photography Scheduling',
        description: 'Book professional photographer for listing photos',
        priority: 'high',
        due_days: 12
      },
      {
        title: 'Marketing Materials Preparation',
        description: 'Create flyers, brochures, and property feature sheets',
        priority: 'medium',
        due_days: 14
      },
      {
        title: 'Pre-Listing Inspections',
        description: 'Schedule home, pest, and other recommended inspections',
        priority: 'medium',
        due_days: 14
      },
      {
        title: 'Listing Agreement Execution',
        description: 'Sign listing agreement and review all terms with seller',
        priority: 'urgent',
        due_days: 1
      }
    ],
    'listing': [
      {
        title: 'MLS Entry and Syndication',
        description: 'Enter property details in MLS and syndicate to major real estate websites',
        priority: 'urgent',
        due_days: 1
      },
      {
        title: 'Listing Photos Upload',
        description: 'Upload high-quality photos to MLS and marketing platforms',
        priority: 'high',
        due_days: 1
      },
      {
        title: 'Property Description Optimization',
        description: 'Write compelling property description highlighting key features',
        priority: 'high',
        due_days: 2
      },
      {
        title: 'Social Media Marketing Campaign',
        description: 'Create and launch social media marketing posts and ads',
        priority: 'medium',
        due_days: 3
      },
      {
        title: 'Open House Scheduling',
        description: 'Schedule and advertise open house events',
        priority: 'medium',
        due_days: 7
      },
      {
        title: 'Showing Management System Setup',
        description: 'Configure showing system and coordinate with seller',
        priority: 'high',
        due_days: 2
      },
      {
        title: 'Lead Follow-up System',
        description: 'Implement system to track and follow up with interested buyers',
        priority: 'high',
        due_days: 5
      },
      {
        title: 'Market Feedback Collection',
        description: 'Gather feedback from showings and adjust strategy as needed',
        priority: 'medium',
        due_days: 14
      }
    ],
    'under_contract': [
      {
        title: 'Purchase Agreement Review',
        description: 'Review all contract terms and conditions with client',
        priority: 'urgent',
        due_days: 1
      },
      {
        title: 'Earnest Money Deposit',
        description: 'Collect and deposit earnest money per contract terms',
        priority: 'urgent',
        due_days: 2
      },
      {
        title: 'Home Inspection Coordination',
        description: 'Schedule home inspection and coordinate access',
        priority: 'high',
        due_days: 7
      },
      {
        title: 'Appraisal Scheduling',
        description: 'Coordinate appraisal appointment with lender and appraiser',
        priority: 'high',
        due_days: 10
      },
      {
        title: 'Loan Processing Follow-up',
        description: 'Monitor buyer\'s loan application progress with lender',
        priority: 'high',
        due_days: 14
      },
      {
        title: 'Inspection Response Negotiation',
        description: 'Review inspection report and negotiate any needed repairs',
        priority: 'high',
        due_days: 10
      },
      {
        title: 'Insurance Verification',
        description: 'Verify buyer has secured homeowner\'s insurance',
        priority: 'medium',
        due_days: 20
      },
      {
        title: 'Final Walk-through Scheduling',
        description: 'Schedule final walk-through 24-48 hours before closing',
        priority: 'medium',
        due_days: 25
      }
    ],
    'escrow_closing': [
      {
        title: 'Title Company Coordination',
        description: 'Coordinate with title company and review title commitment',
        priority: 'high',
        due_days: 3
      },
      {
        title: 'Closing Disclosure Review',
        description: 'Review closing disclosure with client for accuracy',
        priority: 'high',
        due_days: 5
      },
      {
        title: 'Final Walk-through Execution',
        description: 'Complete final walk-through with buyer',
        priority: 'high',
        due_days: 1
      },
      {
        title: 'Closing Document Preparation',
        description: 'Ensure all closing documents are prepared and reviewed',
        priority: 'urgent',
        due_days: 2
      },
      {
        title: 'Keys and Garage Remote Transfer',
        description: 'Coordinate transfer of all keys, garage remotes, and access codes',
        priority: 'high',
        due_days: 1
      },
      {
        title: 'Utility Transfer Coordination',
        description: 'Assist with utility transfer arrangements',
        priority: 'medium',
        due_days: 3
      },
      {
        title: 'Closing Day Coordination',
        description: 'Attend closing and ensure smooth transaction completion',
        priority: 'urgent',
        due_days: 0
      },
      {
        title: 'Post-Closing Follow-up',
        description: 'Follow up with clients to ensure satisfaction and gather feedback',
        priority: 'low',
        due_days: 7
      }
    ]
  }

  return taskTemplates[stage] || []
}
function generateFallbackProperties(filters = {}) {
  const mockProperties = [
    {
      id: 'mock_1',
      address: '123 Main Street',
      city: 'Dallas',
      state: 'TX',
      zipcode: '75201',
      price: 450000,
      bedrooms: 3,
      bathrooms: 2.5,
      square_feet: 2200,
      property_type: 'Single Family',
      listing_status: 'for_sale',
      description: 'Beautiful family home in prime location with modern amenities.',
      images: [],
      listing_date: new Date().toISOString(),
      days_on_market: 15,
      mls_number: 'MLS123456',
      lot_size: '0.25 acres',
      year_built: 2018,
      garage: 2,
      pool: false,
      fireplace: true
    },
    {
      id: 'mock_2',
      address: '456 Oak Avenue',
      city: 'Frisco',
      state: 'TX',
      zipcode: '75034',
      price: 520000,
      bedrooms: 4,
      bathrooms: 3,
      square_feet: 2800,
      property_type: 'Single Family',
      listing_status: 'for_sale',
      description: 'Spacious home with large backyard and updated kitchen.',
      images: [],
      listing_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      days_on_market: 7,
      mls_number: 'MLS789012',
      lot_size: '0.33 acres',
      year_built: 2020,
      garage: 3,
      pool: true,
      fireplace: true
    },
    {
      id: 'mock_3',
      address: '789 Pine Street',
      city: 'Austin',
      state: 'TX',
      zipcode: '78701',
      price: 380000,
      bedrooms: 2,
      bathrooms: 2,
      square_feet: 1600,
      property_type: 'Condo',
      listing_status: 'for_sale',
      description: 'Modern downtown condo with city views and walkable amenities.',
      images: [],
      listing_date: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
      days_on_market: 21,
      mls_number: 'MLS345678',
      lot_size: 'N/A',
      year_built: 2019,
      garage: 1,
      pool: false,
      fireplace: false
    }
  ]

  // Filter mock properties based on criteria
  let filteredProperties = mockProperties

  if (filters.min_price) {
    filteredProperties = filteredProperties.filter(p => p.price >= parseInt(filters.min_price))
  }
  if (filters.max_price) {
    filteredProperties = filteredProperties.filter(p => p.price <= parseInt(filters.max_price))
  }
  if (filters.beds) {
    filteredProperties = filteredProperties.filter(p => p.bedrooms >= parseInt(filters.beds))
  }
  if (filters.baths) {
    filteredProperties = filteredProperties.filter(p => p.bathrooms >= parseInt(filters.baths))
  }
  if (filters.location) {
    const location = filters.location.toLowerCase()
    filteredProperties = filteredProperties.filter(p => 
      p.city.toLowerCase().includes(location) || 
      p.zipcode.includes(location) ||
      p.state.toLowerCase().includes(location)
    )
  }

  return {
    properties: filteredProperties,
    total: filteredProperties.length,
    has_more: false,
    filters_applied: filters,
    is_fallback: true
  }
}

// Helper function to handle CORS
function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

// Lead deduplication check
async function checkDuplicateLead(db, email, phone) {
  const existingLead = await db.collection('leads').findOne({
    $or: [
      { email: email },
      { phone: phone }
    ]
  })
  return existingLead
}

// AI Lead Insights
async function generateLeadInsights(lead, properties = []) {
  const messages = [
    {
      role: "system",
      content: "You are a real estate AI assistant. Analyze the lead information and provide insights about their preferences, potential matches, and recommendations."
    },
    {
      role: "user",
      content: `Analyze this lead:
      Name: ${lead.name}
      Type: ${lead.lead_type}
      Preferences: ${JSON.stringify(lead.preferences)}
      Tags: ${lead.tags?.join(', ') || 'None'}
      
      Available properties: ${properties.length} found
      
      Provide brief insights and recommendations for this lead.`
    }
  ]
  
  return await callOpenAI('gpt-4o-mini', messages)
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

// Route handler function
async function handleRoute(request, { params }) {
  const { path = [] } = params
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    const db = await connectToMongo()

    // Root endpoint
    if (route === '/' && method === 'GET') {
      return handleCORS(NextResponse.json({ message: "Real Estate CRM API" }))
    }

    // LEADS ENDPOINTS
    
    // GET /api/leads - Get all leads with search
    if (route === '/leads' && method === 'GET') {
      const url = new URL(request.url)
      const search = url.searchParams.get('search')
      const leadType = url.searchParams.get('lead_type')
      
      let query = {}
      
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ]
      }
      
      if (leadType) {
        query.lead_type = leadType
      }
      
      const leads = await db.collection('leads')
        .find(query)
        .sort({ created_at: -1 })
        .limit(100)
        .toArray()

      const cleanedLeads = leads.map(({ _id, ...rest }) => rest)
      return handleCORS(NextResponse.json(cleanedLeads))
    }

    // POST /api/leads - Create new lead
    if (route === '/leads' && method === 'POST') {
      const body = await request.json()
      
      if (!body.name || !body.email || !body.phone) {
        return handleCORS(NextResponse.json(
          { error: "Name, email, and phone are required" }, 
          { status: 400 }
        ))
      }

      // Check for duplicates
      const duplicate = await checkDuplicateLead(db, body.email, body.phone)
      if (duplicate) {
        return handleCORS(NextResponse.json(
          { error: "Lead with this email or phone already exists", existing_lead: duplicate.id }, 
          { status: 409 }
        ))
      }

      const lead = {
        id: uuidv4(),
        name: body.name,
        email: body.email,
        phone: body.phone,
        lead_type: body.lead_type || 'buyer',
        preferences: body.preferences || {},
        assigned_agent: body.assigned_agent || null,
        tags: body.tags || [],
        status: 'new',
        created_at: new Date(),
        updated_at: new Date()
      }

      await db.collection('leads').insertOne(lead)
      
      // Generate AI insights
      const insights = await generateLeadInsights(lead)
      if (insights) {
        await db.collection('leads').updateOne(
          { id: lead.id },
          { $set: { ai_insights: insights, updated_at: new Date() } }
        )
        lead.ai_insights = insights
      }

      const { _id, ...cleanedLead } = lead
      return handleCORS(NextResponse.json(cleanedLead, { status: 201 }))
    }

    // GET /api/leads/:id - Get specific lead
    if (route.match(/^\/leads\/[^\/]+$/) && method === 'GET') {
      const leadId = path[1]
      const lead = await db.collection('leads').findOne({ id: leadId })
      
      if (!lead) {
        return handleCORS(NextResponse.json(
          { error: "Lead not found" }, 
          { status: 404 }
        ))
      }

      const { _id, ...cleanedLead } = lead
      return handleCORS(NextResponse.json(cleanedLead))
    }

    // PUT /api/leads/:id - Update lead
    if (route.match(/^\/leads\/[^\/]+$/) && method === 'PUT') {
      const leadId = path[1]
      const body = await request.json()
      
      const updateData = {
        ...body,
        updated_at: new Date()
      }
      delete updateData.id
      delete updateData.created_at

      const result = await db.collection('leads').updateOne(
        { id: leadId },
        { $set: updateData }
      )

      if (result.matchedCount === 0) {
        return handleCORS(NextResponse.json(
          { error: "Lead not found" }, 
          { status: 404 }
        ))
      }

      const updatedLead = await db.collection('leads').findOne({ id: leadId })
      const { _id, ...cleanedLead } = updatedLead
      return handleCORS(NextResponse.json(cleanedLead))
    }

    // DELETE /api/leads/:id - Delete lead
    if (route.match(/^\/leads\/[^\/]+$/) && method === 'DELETE') {
      const leadId = path[1]
      
      const result = await db.collection('leads').deleteOne({ id: leadId })
      
      if (result.deletedCount === 0) {
        return handleCORS(NextResponse.json(
          { error: "Lead not found" }, 
          { status: 404 }
        ))
      }

      return handleCORS(NextResponse.json({ message: "Lead deleted successfully" }))
    }

    // POST /api/leads/:id/match - AI-powered property matching
    if (route.match(/^\/leads\/[^\/]+\/match$/) && method === 'POST') {
      const leadId = path[1]
      const lead = await db.collection('leads').findOne({ id: leadId })
      
      if (!lead) {
        return handleCORS(NextResponse.json(
          { error: "Lead not found" }, 
          { status: 404 }
        ))
      }

      // Search properties based on lead preferences
      const properties = await searchProperties(lead.preferences)
      
      // Generate AI matching insights
      const matchingInsights = await callOpenAI('o1-mini', [
        {
          role: "system",
          content: "You are a real estate matching expert. Analyze the lead's preferences and the available properties to provide personalized recommendations."
        },
        {
          role: "user",
          content: `Lead: ${lead.name} (${lead.lead_type})
          Preferences: ${JSON.stringify(lead.preferences)}
          Available Properties: ${JSON.stringify(properties.slice(0, 5))}
          
          Provide top 3 property matches with reasons why each property suits this lead.`
        }
      ])

      return handleCORS(NextResponse.json({
        lead_id: leadId,
        properties: properties.slice(0, 10),
        ai_recommendations: matchingInsights,
        total_found: properties.length
      }))
    }

    // PROPERTY SEARCH ENDPOINTS

    // GET /api/properties - Enhanced property search with comprehensive filters
    if (route === '/properties' && method === 'GET') {
      const url = new URL(request.url)
      const filters = {
        location: url.searchParams.get('location'),
        beds: url.searchParams.get('beds'),
        baths: url.searchParams.get('baths'),
        min_price: url.searchParams.get('min_price'),
        max_price: url.searchParams.get('max_price'),
        listing_status: url.searchParams.get('listing_status') || 'for_sale',
        property_type: url.searchParams.get('property_type'),
        sort_by: url.searchParams.get('sort_by'),
        limit: parseInt(url.searchParams.get('limit')) || 20,
        offset: parseInt(url.searchParams.get('offset')) || 0
      }
      
      // Remove null/undefined values
      Object.keys(filters).forEach(key => {
        if (filters[key] === null || filters[key] === undefined || filters[key] === '') {
          delete filters[key]
        }
      })
      
      const result = await fetchProperties(filters)
      
      return handleCORS(NextResponse.json({
        success: true,
        ...result,
        search_performed_at: new Date().toISOString()
      }))
    }

    // POST /api/properties/search - Advanced property search with saved filters
    if (route === '/properties/search' && method === 'POST') {
      const body = await request.json()
      
      const filters = {
        location: body.location,
        beds: body.beds,
        baths: body.baths,
        min_price: body.min_price,
        max_price: body.max_price,
        listing_status: body.listing_status || 'for_sale',
        property_type: body.property_type,
        sort_by: body.sort_by || 'price_asc',
        limit: body.limit || 20,
        offset: body.offset || 0
      }
      
      const result = await fetchProperties(filters)
      
      // Save search to database for analytics
      try {
        const searchRecord = {
          id: uuidv4(),
          filters: filters,
          results_count: result.total,
          timestamp: new Date(),
          user_agent: request.headers.get('user-agent')
        }
        
        await db.collection('property_searches').insertOne(searchRecord)
      } catch (error) {
        console.error('Failed to save search record:', error)
        // Don't fail the request if search logging fails
      }
      
      return handleCORS(NextResponse.json({
        success: true,
        ...result,
        search_performed_at: new Date().toISOString()
      }))
    }

    // GET /api/properties/:id - Get specific property details
    if (route.match(/^\/properties\/[^\/]+$/) && method === 'GET') {
      const propertyId = path[1]
      
      try {
        // In a real implementation, you'd fetch from RealEstateAPI by ID
        // For now, we'll use fallback data
        const mockProperty = {
          id: propertyId,
          address: '123 Property Street',
          city: 'Dallas',
          state: 'TX',
          zipcode: '75201',
          price: 450000,
          bedrooms: 3,
          bathrooms: 2.5,
          square_feet: 2200,
          property_type: 'Single Family',
          listing_status: 'for_sale',
          description: 'Beautiful family home with modern amenities and updates throughout.',
          images: [],
          listing_date: new Date().toISOString(),
          days_on_market: 15,
          mls_number: 'MLS123456',
          lot_size: '0.25 acres',
          year_built: 2018,
          garage: 2,
          pool: false,
          fireplace: true,
          agent_info: {
            name: 'Jane Smith',
            phone: '(555) 123-4567',
            email: 'jane@realestate.com'
          }
        }
        
        return handleCORS(NextResponse.json({
          success: true,
          property: mockProperty
        }))
      } catch (error) {
        console.error('Error fetching property details:', error)
        return handleCORS(NextResponse.json({
          success: false,
          error: 'Property not found'
        }, { status: 404 }))
      }
    }

    // ASSISTANT ENDPOINTS
    
    // POST /api/assistant/parse - Parse natural language input
    if (route === '/assistant/parse' && method === 'POST') {
      const body = await request.json()
      
      if (!body.message) {
        return handleCORS(NextResponse.json(
          { error: "Message is required" }, 
          { status: 400 }
        ))
      }

      try {
        const messages = [
          {
            role: "system",
            content: `You are a real estate assistant that extracts structured information from agent messages. 
            
            Extract the following information from the agent's message and return it as JSON:
            {
              "lead_info": {
                "name": "extracted name or null",
                "phone": "extracted phone or null", 
                "email": "extracted email or null",
                "lead_type": "buyer or seller (inferred from context)"
              },
              "preferences": {
                "zipcode": "extracted zipcode/area or null",
                "min_price": "minimum price or null",
                "max_price": "maximum price or null", 
                "bedrooms": "number of bedrooms or null",
                "bathrooms": "number of bathrooms or null",
                "property_type": "extracted property type or null"
              },
              "intent": "what the agent wants to do (find properties, create lead, etc)",
              "summary": "brief summary of the request"
            }
            
            For property preferences:
            - Convert terms like "2BHK" to bedrooms: "2"
            - Convert "under $500K" to max_price: "500000"
            - Convert "above $300K" to min_price: "300000"
            - Extract city/area names and map to zipcodes if possible (Frisco->75034, Dallas->75201, etc)
            
            Return only valid JSON, no other text.`
          },
          {
            role: "user",
            content: body.message
          }
        ]

        const response = await callOpenAI('gpt-4o-mini', messages, { maxTokens: 500 })
        
        if (!response) {
          throw new Error('No response from OpenAI')
        }

        // Parse the JSON response with better error handling
        let parsedData
        try {
          parsedData = JSON.parse(response.trim())
        } catch (parseError) {
          console.error('JSON parse error in assistant/parse:', parseError)
          console.error('OpenAI response:', response)
          
          // Fallback parsing - extract what we can
          parsedData = {
            lead_info: {
              name: extractNameFromMessage(body.message),
              phone: null,
              email: null,
              lead_type: "buyer"
            },
            preferences: {
              zipcode: null,
              min_price: null,
              max_price: null,
              bedrooms: null,
              bathrooms: null,
              property_type: null
            },
            intent: "unknown",
            summary: body.message
          }
        }
        
        return handleCORS(NextResponse.json({
          success: true,
          parsed_data: parsedData,
          original_message: body.message
        }))
        
      } catch (error) {
        console.error('Assistant parsing error:', error)
        return handleCORS(NextResponse.json({
          success: false,
          error: "Failed to parse message",
          fallback_data: {
            lead_info: { name: null, phone: null, email: null, lead_type: "buyer" },
            preferences: {},
            intent: "unknown",
            summary: body.message
          }
        }, { status: 500 }))
      }
    }

    // POST /api/assistant/match - Find/create lead and match properties
    if (route === '/assistant/match' && method === 'POST') {
      const body = await request.json()
      
      if (!body.parsed_data) {
        return handleCORS(NextResponse.json(
          { error: "Parsed data is required" }, 
          { status: 400 }
        ))
      }

      try {
        const { lead_info, preferences, intent, summary } = body.parsed_data
        let lead = null
        let isNewLead = false

        // Step 1: Check if lead exists
        if (lead_info.name || lead_info.email || lead_info.phone) {
          const searchQuery = {}
          if (lead_info.email) searchQuery.email = lead_info.email
          if (lead_info.phone) searchQuery.phone = lead_info.phone
          if (lead_info.name && !lead_info.email && !lead_info.phone) {
            searchQuery.name = { $regex: lead_info.name, $options: 'i' }
          }

          if (Object.keys(searchQuery).length > 0) {
            lead = await db.collection('leads').findOne({
              $or: Object.entries(searchQuery).map(([key, value]) => ({ [key]: value }))
            })
          }
        }

        // Step 2: Create new lead if not found
        if (!lead && lead_info.name) {
          const newLead = {
            id: uuidv4(),
            name: lead_info.name,
            email: lead_info.email || `${lead_info.name.toLowerCase().replace(/\s+/g, '.')}@temp.email`,
            phone: lead_info.phone || `(555) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
            lead_type: lead_info.lead_type || 'buyer',
            preferences: preferences || {},
            assigned_agent: body.agent_name || 'AI Assistant',
            tags: ['ai-created', 'assistant'],
            status: 'new',
            created_at: new Date(),
            updated_at: new Date(),
            source: 'assistant',
            original_message: body.original_message
          }

          await db.collection('leads').insertOne(newLead)
          lead = newLead
          isNewLead = true

          // Generate AI insights for new lead
          const insights = await generateLeadInsights(lead)
          if (insights) {
            await db.collection('leads').updateOne(
              { id: lead.id },
              { $set: { ai_insights: insights, updated_at: new Date() } }
            )
            lead.ai_insights = insights
          }
        }

        // Step 3: Update existing lead preferences if provided
        if (lead && !isNewLead && preferences && Object.keys(preferences).length > 0) {
          const updatedPreferences = { ...lead.preferences, ...preferences }
          await db.collection('leads').updateOne(
            { id: lead.id },
            { 
              $set: { 
                preferences: updatedPreferences,
                updated_at: new Date()
              }
            }
          )
          lead.preferences = updatedPreferences
        }

        // Step 4: Search for properties
        let properties = []
        if (preferences && Object.keys(preferences).length > 0) {
          const propertyResult = await fetchProperties({
            location: preferences.zipcode,
            beds: preferences.bedrooms,
            baths: preferences.bathrooms,
            min_price: preferences.min_price,
            max_price: preferences.max_price,
            property_type: preferences.property_type
          })
          properties = propertyResult.properties || []
        }

        // Step 5: Generate AI recommendations
        let aiRecommendations = null
        if (properties.length > 0) {
          const recommendationMessages = [
            {
              role: "system",
              content: "You are a real estate assistant. Based on the agent's request and available properties, provide personalized recommendations."
            },
            {
              role: "user",
              content: `Agent Request: "${body.original_message}"
              
              Lead: ${lead ? lead.name : 'Unknown'} (${lead?.lead_type || 'buyer'})
              Preferences: ${JSON.stringify(preferences)}
              Found Properties: ${properties.length}
              
              Provide a brief, helpful response about the property matches and next steps.`
            }
          ]
          
          aiRecommendations = await callOpenAI('gpt-4o-mini', recommendationMessages)
        }

        // Step 6: Store conversation in chat history
        const conversationEntry = {
          id: uuidv4(),
          agent_message: body.original_message,
          parsed_data: body.parsed_data,
          lead_id: lead?.id || null,
          properties_found: properties.length,
          ai_response: aiRecommendations,
          created_at: new Date()
        }

        await db.collection('assistant_conversations').insertOne(conversationEntry)

        return handleCORS(NextResponse.json({
          success: true,
          lead: lead ? { ...lead, _id: undefined } : null,
          is_new_lead: isNewLead,
          properties: properties.slice(0, 10),
          properties_count: properties.length,
          ai_recommendations: aiRecommendations,
          conversation_id: conversationEntry.id,
          summary: summary
        }))

      } catch (error) {
        console.error('Assistant match error:', error)
        return handleCORS(NextResponse.json({
          success: false,
          error: "Failed to process request",
          details: error.message
        }, { status: 500 }))
      }
    }

    // GET /api/assistant/conversations - Get conversation history
    if (route === '/assistant/conversations' && method === 'GET') {
      try {
        const conversations = await db.collection('assistant_conversations')
          .find({})
          .sort({ created_at: -1 })
          .limit(50)
          .toArray()

        const cleanedConversations = conversations.map(({ _id, ...rest }) => rest)
        
        return handleCORS(NextResponse.json(cleanedConversations))
      } catch (error) {
        console.error('Error fetching conversations:', error)
        return handleCORS(NextResponse.json(
          { error: "Failed to fetch conversations" }, 
          { status: 500 }
        ))
      }
    }

    // TRANSACTION & CHECKLIST ENDPOINTS
    
    // GET /api/transactions - Get all transactions
    if (route === '/transactions' && method === 'GET') {
      try {
        const url = new URL(request.url)
        const status = url.searchParams.get('status')
        const agent = url.searchParams.get('agent')
        const limit = parseInt(url.searchParams.get('limit')) || 50
        
        let query = {}
        if (status) query.status = status
        if (agent) query.assigned_agent = agent
        
        const transactions = await db.collection('transactions')
          .find(query)
          .sort({ created_at: -1 })
          .limit(limit)
          .toArray()

        const cleanedTransactions = transactions.map(({ _id, ...rest }) => rest)
        
        return handleCORS(NextResponse.json({
          success: true,
          transactions: cleanedTransactions,
          total: cleanedTransactions.length
        }))
      } catch (error) {
        console.error('Error fetching transactions:', error)
        return handleCORS(NextResponse.json({
          success: false,
          error: 'Failed to fetch transactions'
        }, { status: 500 }))
      }
    }

    // POST /api/transactions - Create new transaction
    if (route === '/transactions' && method === 'POST') {
      try {
        const body = await request.json()
        
        if (!body.property_address || !body.client_name) {
          return handleCORS(NextResponse.json({
            success: false,
            error: "Property address and client name are required"
          }, { status: 400 }))
        }

        const transaction = {
          id: uuidv4(),
          property_address: body.property_address,
          client_name: body.client_name,
          client_email: body.client_email,
          client_phone: body.client_phone,
          transaction_type: body.transaction_type || 'sale', // sale, purchase, lease
          current_stage: 'pre_listing',
          assigned_agent: body.assigned_agent,
          listing_price: body.listing_price,
          contract_price: body.contract_price,
          closing_date: body.closing_date,
          created_at: new Date(),
          updated_at: new Date(),
          stage_history: [{
            stage: 'pre_listing',
            entered_at: new Date(),
            status: 'active'
          }]
        }

        await db.collection('transactions').insertOne(transaction)

        // Create default checklist items for the initial stage
        await createDefaultChecklistItems(db, transaction.id, 'pre_listing')

        const { _id, ...cleanedTransaction } = transaction
        return handleCORS(NextResponse.json({
          success: true,
          transaction: cleanedTransaction
        }, { status: 201 }))
      } catch (error) {
        console.error('Error creating transaction:', error)
        return handleCORS(NextResponse.json({
          success: false,
          error: 'Failed to create transaction'
        }, { status: 500 }))
      }
    }

    // GET /api/transactions/:id - Get specific transaction
    if (route.match(/^\/transactions\/[^\/]+$/) && method === 'GET') {
      try {
        const transactionId = path[1]
        const transaction = await db.collection('transactions').findOne({ id: transactionId })
        
        if (!transaction) {
          return handleCORS(NextResponse.json({
            success: false,
            error: "Transaction not found"
          }, { status: 404 }))
        }

        const { _id, ...cleanedTransaction } = transaction
        return handleCORS(NextResponse.json({
          success: true,
          transaction: cleanedTransaction
        }))
      } catch (error) {
        console.error('Error fetching transaction:', error)
        return handleCORS(NextResponse.json({
          success: false,
          error: 'Failed to fetch transaction'
        }, { status: 500 }))
      }
    }

    // PUT /api/transactions/:id - Update transaction
    if (route.match(/^\/transactions\/[^\/]+$/) && method === 'PUT') {
      try {
        const transactionId = path[1]
        const body = await request.json()
        
        const updateData = {
          ...body,
          updated_at: new Date()
        }
        delete updateData.id
        delete updateData.created_at

        const result = await db.collection('transactions').updateOne(
          { id: transactionId },
          { $set: updateData }
        )

        if (result.matchedCount === 0) {
          return handleCORS(NextResponse.json({
            success: false,
            error: "Transaction not found"
          }, { status: 404 }))
        }

        const updatedTransaction = await db.collection('transactions').findOne({ id: transactionId })
        const { _id, ...cleanedTransaction } = updatedTransaction
        
        return handleCORS(NextResponse.json({
          success: true,
          transaction: cleanedTransaction
        }))
      } catch (error) {
        console.error('Error updating transaction:', error)
        return handleCORS(NextResponse.json({
          success: false,
          error: 'Failed to update transaction'
        }, { status: 500 }))
      }
    }

    // POST /api/transactions/:id/stage-transition - Transition to next stage with validation
    if (route.match(/^\/transactions\/[^\/]+\/stage-transition$/) && method === 'POST') {
      try {
        const transactionId = path[1]
        const body = await request.json()
        
        const transaction = await db.collection('transactions').findOne({ id: transactionId })
        if (!transaction) {
          return handleCORS(NextResponse.json({
            success: false,
            error: "Transaction not found"
          }, { status: 404 }))
        }

        const { target_stage, force = false } = body
        const currentStage = transaction.current_stage

        // Use o1-mini to validate stage transition
        const validationResult = await validateStageTransition(db, transactionId, currentStage, target_stage, force)
        
        if (!validationResult.valid && !force) {
          return handleCORS(NextResponse.json({
            success: false,
            error: "Stage transition validation failed",
            validation_errors: validationResult.errors,
            missing_tasks: validationResult.missing_tasks,
            can_force: true
          }, { status: 422 }))
        }

        // Update transaction stage
        const stageUpdate = {
          $set: {
            current_stage: target_stage,
            updated_at: new Date()
          },
          $push: {
            stage_history: {
              stage: target_stage,
              entered_at: new Date(),
              status: 'active',
              transitioned_from: currentStage,
              validation_result: validationResult
            }
          }
        }

        await db.collection('transactions').updateOne(
          { id: transactionId },
          stageUpdate
        )

        // Create default checklist items for new stage
        await createDefaultChecklistItems(db, transactionId, target_stage)

        const updatedTransaction = await db.collection('transactions').findOne({ id: transactionId })
        const { _id, ...cleanedTransaction } = updatedTransaction
        
        return handleCORS(NextResponse.json({
          success: true,
          transaction: cleanedTransaction,
          validation_result: validationResult
        }))
      } catch (error) {
        console.error('Error transitioning stage:', error)
        return handleCORS(NextResponse.json({
          success: false,
          error: 'Failed to transition stage'
        }, { status: 500 }))
      }
    }

    // GET /api/transactions/:id/checklist - Get checklist items for transaction
    if (route.match(/^\/transactions\/[^\/]+\/checklist$/) && method === 'GET') {
      try {
        const transactionId = path[1]
        const url = new URL(request.url)
        const stage = url.searchParams.get('stage')
        
        let query = { transaction_id: transactionId }
        if (stage) query.stage = stage
        
        const checklistItems = await db.collection('checklist_items')
          .find(query)
          .sort({ stage_order: 1, order: 1 })
          .toArray()

        const cleanedItems = checklistItems.map(({ _id, ...rest }) => rest)
        
        return handleCORS(NextResponse.json({
          success: true,
          checklist_items: cleanedItems,
          total: cleanedItems.length
        }))
      } catch (error) {
        console.error('Error fetching checklist:', error)
        return handleCORS(NextResponse.json({
          success: false,
          error: 'Failed to fetch checklist'
        }, { status: 500 }))
      }
    }

    // POST /api/transactions/:id/checklist - Add checklist item
    if (route.match(/^\/transactions\/[^\/]+\/checklist$/) && method === 'POST') {
      try {
        const transactionId = path[1]
        const body = await request.json()
        
        if (!body.title || !body.stage) {
          return handleCORS(NextResponse.json({
            success: false,
            error: "Title and stage are required"
          }, { status: 400 }))
        }

        const checklistItem = {
          id: uuidv4(),
          transaction_id: transactionId,
          title: body.title,
          description: body.description || '',
          stage: body.stage,
          status: body.status || 'not_started', // not_started, in_progress, completed, blocked
          priority: body.priority || 'medium', // low, medium, high, urgent
          assignee: body.assignee || '',
          due_date: body.due_date ? new Date(body.due_date) : null,
          completed_date: null,
          notes: body.notes || '',
          order: body.order || 999,
          stage_order: getStageOrder(body.stage),
          dependencies: body.dependencies || [],
          created_at: new Date(),
          updated_at: new Date()
        }

        await db.collection('checklist_items').insertOne(checklistItem)

        const { _id, ...cleanedItem } = checklistItem
        return handleCORS(NextResponse.json({
          success: true,
          checklist_item: cleanedItem
        }, { status: 201 }))
      } catch (error) {
        console.error('Error creating checklist item:', error)
        return handleCORS(NextResponse.json({
          success: false,
          error: 'Failed to create checklist item'
        }, { status: 500 }))
      }
    }

    // PUT /api/checklist/:id - Update checklist item
    if (route.match(/^\/checklist\/[^\/]+$/) && method === 'PUT') {
      try {
        const itemId = path[1]
        const body = await request.json()
        
        const updateData = {
          ...body,
          updated_at: new Date()
        }
        
        // Handle status changes
        if (body.status === 'completed' && body.status !== updateData.original_status) {
          updateData.completed_date = new Date()
        } else if (body.status !== 'completed') {
          updateData.completed_date = null
        }
        
        delete updateData.id
        delete updateData.created_at
        delete updateData.original_status

        const result = await db.collection('checklist_items').updateOne(
          { id: itemId },
          { $set: updateData }
        )

        if (result.matchedCount === 0) {
          return handleCORS(NextResponse.json({
            success: false,
            error: "Checklist item not found"
          }, { status: 404 }))
        }

        const updatedItem = await db.collection('checklist_items').findOne({ id: itemId })
        const { _id, ...cleanedItem } = updatedItem
        
        return handleCORS(NextResponse.json({
          success: true,
          checklist_item: cleanedItem
        }))
      } catch (error) {
        console.error('Error updating checklist item:', error)
        return handleCORS(NextResponse.json({
          success: false,
          error: 'Failed to update checklist item'
        }, { status: 500 }))
      }
    }

    // DELETE /api/checklist/:id - Delete checklist item
    if (route.match(/^\/checklist\/[^\/]+$/) && method === 'DELETE') {
      try {
        const itemId = path[1]
        
        const result = await db.collection('checklist_items').deleteOne({ id: itemId })
        
        if (result.deletedCount === 0) {
          return handleCORS(NextResponse.json({
            success: false,
            error: "Checklist item not found"
          }, { status: 404 }))
        }

        return handleCORS(NextResponse.json({
          success: true,
          message: "Checklist item deleted successfully"
        }))
      } catch (error) {
        console.error('Error deleting checklist item:', error)
        return handleCORS(NextResponse.json({
          success: false,
          error: 'Failed to delete checklist item'
        }, { status: 500 }))
      }
    }
    
    // DEAL SUMMARY & SMART ALERTS ENDPOINTS
    
    // POST /api/agent/command - Process natural language agent commands
    if (route === '/agent/command' && method === 'POST') {
      try {
        const body = await request.json()
        
        if (!body.command) {
          return handleCORS(NextResponse.json({
            success: false,
            error: "Command is required"
          }, { status: 400 }))
        }

        // Use GPT-4o-mini to parse the command
        const parseMessages = [
          {
            role: "system",
            content: `You are a real estate assistant that processes agent commands. Parse the command and determine the action needed.
            
            For deal summary commands like "Summarize 125 Maple Ave deal", return:
            {
              "action": "deal_summary",
              "property_address": "extracted property address",
              "intent": "summary of what the agent wants"
            }
            
            For alert commands, return:
            {
              "action": "alerts",
              "filters": {...},
              "intent": "what alerts they want to see"
            }
            
            Return only valid JSON.`
          },
          {
            role: "user",
            content: body.command
          }
        ]

        const parseResponse = await callOpenAI('gpt-4o-mini', parseMessages)
        let parsedCommand

        try {
          parsedCommand = JSON.parse(parseResponse)
        } catch (parseError) {
          return handleCORS(NextResponse.json({
            success: false,
            error: "Could not parse command",
            original_command: body.command
          }))
        }

        // Process the parsed command
        if (parsedCommand.action === 'deal_summary') {
          const summaryResult = await generateDealSummary(db, parsedCommand.property_address)
          return handleCORS(NextResponse.json({
            success: true,
            action: 'deal_summary',
            ...summaryResult
          }))
        } else if (parsedCommand.action === 'alerts') {
          const alertsResult = await getSmartAlerts(db, parsedCommand.filters)
          return handleCORS(NextResponse.json({
            success: true,
            action: 'alerts',
            ...alertsResult
          }))
        } else {
          return handleCORS(NextResponse.json({
            success: false,
            error: "Unknown command action",
            parsed_command: parsedCommand
          }))
        }

      } catch (error) {
        console.error('Agent command error:', error)
        return handleCORS(NextResponse.json({
          success: false,
          error: "Failed to process command"
        }, { status: 500 }))
      }
    }

    // GET /api/deals/summary/:id - Get detailed deal summary
    if (route.match(/^\/deals\/summary\/[^\/]+$/) && method === 'GET') {
      try {
        const transactionId = path[2]
        const summaryResult = await generateDealSummaryById(db, transactionId)
        
        if (summaryResult.success) {
          return handleCORS(NextResponse.json(summaryResult))
        } else {
          return handleCORS(NextResponse.json(summaryResult, { status: 404 }))
        }
      } catch (error) {
        console.error('Deal summary error:', error)
        return handleCORS(NextResponse.json({
          success: false,
          error: "Failed to generate deal summary"
        }, { status: 500 }))
      }
    }

    // GET /api/alerts/smart - Get smart alerts for dashboard
    if (route === '/alerts/smart' && method === 'GET') {
      try {
        const url = new URL(request.url)
        const filters = {
          agent: url.searchParams.get('agent'),
          priority: url.searchParams.get('priority'),
          type: url.searchParams.get('type')
        }
        
        const alertsResult = await getSmartAlerts(db, filters)
        return handleCORS(NextResponse.json(alertsResult))
      } catch (error) {
        console.error('Smart alerts error:', error)
        return handleCORS(NextResponse.json({
          success: false,
          error: "Failed to get alerts"
        }, { status: 500 }))
      }
    }

    // POST /api/alerts/dismiss/:id - Dismiss alert
    if (route.match(/^\/alerts\/dismiss\/[^\/]+$/) && method === 'POST') {
      try {
        const alertId = path[2]
        
        const result = await db.collection('smart_alerts').updateOne(
          { id: alertId },
          { 
            $set: { 
              dismissed_at: new Date(),
              status: 'dismissed'
            } 
          }
        )

        if (result.matchedCount > 0) {
          return handleCORS(NextResponse.json({
            success: true,
            message: "Alert dismissed"
          }))
        } else {
          return handleCORS(NextResponse.json({
            success: false,
            error: "Alert not found"
          }, { status: 404 }))
        }
      } catch (error) {
        console.error('Alert dismiss error:', error)
        return handleCORS(NextResponse.json({
          success: false,
          error: "Failed to dismiss alert"
        }, { status: 500 }))
      }
    }

    // POST /api/alerts/generate - Manually trigger alert generation
    if (route === '/alerts/generate' && method === 'POST') {
      try {
        await generateSmartAlerts(db)
        return handleCORS(NextResponse.json({
          success: true,
          message: "Alerts generated successfully"
        }))
      } catch (error) {
        console.error('Alert generation error:', error)
        return handleCORS(NextResponse.json({
          success: false,
          error: "Failed to generate alerts"
        }, { status: 500 }))
      }
    }
    
    // OPENAI UTILITIES ENDPOINTS
    
    // GET /api/openai/usage - Get OpenAI usage statistics
    if (route === '/openai/usage' && method === 'GET') {
      try {
        const stats = openaiUtility.getUsageStats()
        return handleCORS(NextResponse.json({
          success: true,
          ...stats
        }))
      } catch (error) {
        console.error('Error getting OpenAI usage stats:', error)
        return handleCORS(NextResponse.json({
          success: false,
          error: 'Failed to get usage statistics'
        }, { status: 500 }))
      }
    }

    // POST /api/openai/test - Test OpenAI utility with various models
    if (route === '/openai/test' && method === 'POST') {
      try {
        const body = await request.json()
        let { model = 'gpt-4o-mini', test_type = 'simple', enable_streaming = false } = body

        let messages = []
        let options = {}

        switch (test_type) {
          case 'simple':
            messages = [
              { role: 'system', content: 'You are a helpful assistant.' },
              { role: 'user', content: 'Say hello in exactly 5 words.' }
            ]
            break
          case 'cost_test':
            messages = [
              { role: 'system', content: 'You are a real estate expert.' },
              { role: 'user', content: 'Explain the home buying process in detail with all steps, requirements, and timeline.' }
            ]
            options.maxTokens = 500
            break
          case 'streaming':
            messages = [
              { role: 'system', content: 'You are a creative writer.' },
              { role: 'user', content: 'Write a short story about a real estate agent.' }
            ]
            options.stream = true
            options.maxTokens = 300
            break
          case 'error_test':
            // Test with invalid model to trigger fallback
            model = 'invalid-model'
            messages = [
              { role: 'user', content: 'Test error handling' }
            ]
            break
        }

        if (enable_streaming && test_type !== 'streaming') {
          options.stream = true
        }

        const result = await callOpenAI(model, messages, options)

        return handleCORS(NextResponse.json({
          success: true,
          model: model,
          test_type,
          response: result,
          options_used: options,
          message: 'OpenAI utility test completed successfully'
        }))
      } catch (error) {
        console.error('OpenAI test error:', error)
        return handleCORS(NextResponse.json({
          success: false,
          error: error.message,
          details: 'OpenAI utility test failed'
        }, { status: 500 }))
      }
    }

    // POST /api/openai/reset-usage - Reset daily usage (admin only)
    if (route === '/openai/reset-usage' && method === 'POST') {
      try {
        openaiUtility.resetDailyUsage()
        return handleCORS(NextResponse.json({
          success: true,
          message: 'Daily usage reset successfully'
        }))
      } catch (error) {
        console.error('Error resetting usage:', error)
        return handleCORS(NextResponse.json({
          success: false,
          error: 'Failed to reset usage'
        }, { status: 500 }))
      }
    }

    // GET /api/openai/models - Get supported models and their limits
    if (route === '/openai/models' && method === 'GET') {
      try {
        return handleCORS(NextResponse.json({
          success: true,
          models: openaiUtility.tokenLimits,
          current_limits: {
            daily_cost_limit: openaiUtility.dailyCostLimit,
            max_single_request_cost: 5.00,
            max_retries: openaiUtility.maxRetries,
            base_delay: openaiUtility.baseDelay,
            max_delay: openaiUtility.maxDelay
          },
          usage_summary: openaiUtility.getUsageStats()
        }))
      } catch (error) {
        console.error('Error getting model info:', error)
        return handleCORS(NextResponse.json({
          success: false,
          error: 'Failed to get model information'
        }, { status: 500 }))
      }
    }
    
    // GET /api/analytics/dashboard - Dashboard stats
    if (route === '/analytics/dashboard' && method === 'GET') {
      const totalLeads = await db.collection('leads').countDocuments()
      const activeLeads = await db.collection('leads').countDocuments({ status: { $ne: 'closed' } })
      const buyerLeads = await db.collection('leads').countDocuments({ lead_type: 'buyer' })
      const sellerLeads = await db.collection('leads').countDocuments({ lead_type: 'seller' })
      
      const recentLeads = await db.collection('leads')
        .find({})
        .sort({ created_at: -1 })
        .limit(5)
        .toArray()

      const stats = {
        total_leads: totalLeads,
        active_leads: activeLeads,
        buyer_leads: buyerLeads,
        seller_leads: sellerLeads,
        recent_leads: recentLeads.map(({ _id, ...rest }) => rest)
      }

      return handleCORS(NextResponse.json(stats))
    }

    // Route not found
    return handleCORS(NextResponse.json(
      { error: `Route ${route} not found` }, 
      { status: 404 }
    ))

  } catch (error) {
    console.error('API Error:', error)
    return handleCORS(NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    ))
  }
}

// Export all HTTP methods
export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute