"use client"

import React from 'react'

function renderInline(text) {
  if (!text) return null
  const parts = String(text).split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (!part) return null
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="px-1 py-0.5 rounded bg-muted text-foreground/90 text-[0.9em]">{part.slice(1, -1)}</code>
    }
    return <React.Fragment key={i}>{part}</React.Fragment>
  })
}

function parseBlocks(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }

    // Headings like "## Title" or "# Title"
    const mH = line.match(/^(#{1,3})\s+(.+)$/)
    if (mH) {
      const level = mH[1].length
      blocks.push({ type: 'heading', level, content: mH[2] })
      i++; continue
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''))
        i++
      }
      blocks.push({ type: 'ol', items })
      continue
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ''))
        i++
      }
      blocks.push({ type: 'ul', items })
      continue
    }

    // Paragraph (consume contiguous non-empty, non-list lines)
    const para = [line]
    i++
    while (i < lines.length && lines[i].trim() && !/^\d+\.\s+/.test(lines[i]) && !/^[-*]\s+/.test(lines[i]) && !/^#{1,3}\s+/.test(lines[i])) {
      para.push(lines[i])
      i++
    }
    blocks.push({ type: 'p', content: para.join(' ') })
  }
  return blocks
}

export function MarkdownText({ text, className = '' }) {
  if (!text) return null
  const blocks = parseBlocks(text)
  return (
    <div className={`space-y-2 ${className}`}>
      {blocks.map((b, idx) => {
        if (b.type === 'heading') {
          const Tag = b.level === 1 ? 'h3' : b.level === 2 ? 'h4' : 'h5'
          return <Tag key={idx} className="font-semibold text-foreground break-words">{renderInline(b.content)}</Tag>
        }
        if (b.type === 'ol') {
          return (
            <ol key={idx} className="list-decimal pl-5 space-y-1">
              {b.items.map((it, i) => (
                <li key={i} className="text-sm leading-relaxed break-words whitespace-pre-wrap">{renderInline(it)}</li>
              ))}
            </ol>
          )
        }
        if (b.type === 'ul') {
          return (
            <ul key={idx} className="list-disc pl-5 space-y-1">
              {b.items.map((it, i) => (
                <li key={i} className="text-sm leading-relaxed break-words whitespace-pre-wrap">{renderInline(it)}</li>
              ))}
            </ul>
          )
        }
        return <p key={idx} className="text-sm leading-relaxed whitespace-pre-wrap break-words">{renderInline(b.content)}</p>
      })}
    </div>
  )
}

export default MarkdownText
