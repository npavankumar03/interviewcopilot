import type { LLMProvider, LLMConfig, LLMStreamChunk, ResponseStyle } from './types.js';
import { RESPONSE_STYLES } from './types.js';

// LLM Service - handles OpenAI and Gemini streaming

export interface LLMServiceConfig {
  openaiKey?: string;
  geminiKey?: string;
  openaiModel?: string;
  geminiModel?: string;
}

let cachedConfig: LLMServiceConfig | null = null;

export function setLLMConfig(config: LLMServiceConfig): void {
  cachedConfig = config;
}

export function getLLMConfig(): LLMServiceConfig {
  return cachedConfig || {
    openaiKey: process.env.OPENAI_API_KEY,
    geminiKey: process.env.GEMINI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash'
  };
}

export function resolveProvider(modelPreference?: string): { provider: LLMProvider; model: string; apiKey: string } {
  const config = getLLMConfig();
  
  // Check if model preference indicates Gemini
  if (modelPreference?.toLowerCase().includes('gemini')) {
    if (!config.geminiKey) {
      // Fallback to OpenAI if Gemini key not available
      if (config.openaiKey) {
        return { provider: 'openai', model: config.openaiModel || 'gpt-4o-mini', apiKey: config.openaiKey };
      }
      throw new Error('No LLM API keys configured');
    }
    return { provider: 'gemini', model: config.geminiModel || 'gemini-2.0-flash', apiKey: config.geminiKey };
  }
  
  // Default to OpenAI
  if (config.openaiKey) {
    return { provider: 'openai', model: config.openaiModel || 'gpt-4o-mini', apiKey: config.openaiKey };
  }
  
  // Fallback to Gemini
  if (config.geminiKey) {
    return { provider: 'gemini', model: config.geminiModel || 'gemini-2.0-flash', apiKey: config.geminiKey };
  }
  
  throw new Error('No LLM API keys configured');
}

export interface StreamOptions {
  question: string;
  style: ResponseStyle;
  customStylePrompt?: string;
  conversationContext?: string;
  docContext?: string;
  memoryContext?: string;
  tier: 't0' | 't1';
}

export interface StylePromptConfig {
  systemPrompt: string;
  maxTokens: number;
}

export function buildStylePrompt(style: ResponseStyle, customStylePrompt?: string): StylePromptConfig {
  const styleConfig = RESPONSE_STYLES[style];
  
  let systemPrompt = `You are an AI meeting copilot assistant. Your role is to help the user during meetings, interviews, and conversations by providing instant, helpful answers.

Guidelines:
- Answer directly and professionally
- Be accurate and helpful
- If you don't know something, say so
- ${styleConfig.prompt}`;

  if (style === 'custom' && customStylePrompt) {
    systemPrompt = `You are an AI meeting copilot assistant.

${customStylePrompt}`;
  }

  return {
    systemPrompt,
    maxTokens: styleConfig.maxTokens
  };
}

export function buildTier0Prompt(options: StreamOptions): { messages: Array<{ role: string; content: string }>; maxTokens: number } {
  const { question, style, customStylePrompt, conversationContext, tier } = options;
  const promptConfig = buildStylePrompt(style, customStylePrompt);
  
  // Tier 0: Minimal prompt for fastest response
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: promptConfig.systemPrompt }
  ];
  
  // Add minimal context - only last turn if available
  if (conversationContext) {
    const contextLines = conversationContext.split('\n').slice(-4).join('\n'); // Last 2 exchanges
    if (contextLines.trim()) {
      messages.push({ role: 'user', content: `[Recent context]\n${contextLines}` });
      messages.push({ role: 'assistant', content: 'Understood. I\'m ready to help.' });
    }
  }
  
  messages.push({ role: 'user', content: question });
  
  return {
    messages,
    maxTokens: tier === 't0' ? Math.min(promptConfig.maxTokens, 220) : promptConfig.maxTokens
  };
}

export function buildTier1Prompt(options: StreamOptions): { messages: Array<{ role: string; content: string }>; maxTokens: number } {
  const { question, style, customStylePrompt, conversationContext, docContext, memoryContext } = options;
  const promptConfig = buildStylePrompt(style, customStylePrompt);
  
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: promptConfig.systemPrompt }
  ];
  
  // Add memory context (user profile)
  if (memoryContext) {
    messages.push({ role: 'user', content: `[Your profile]\n${memoryContext}` });
    messages.push({ role: 'assistant', content: 'I have your profile information.' });
  }
  
  // Add document context
  if (docContext) {
    messages.push({ role: 'user', content: `[Reference documents]\n${docContext.slice(0, 2000)}` }); // Limit context
    messages.push({ role: 'assistant', content: 'I have the reference documents.' });
  }
  
  // Add conversation context
  if (conversationContext) {
    messages.push({ role: 'user', content: `[Conversation so far]\n${conversationContext}` });
    messages.push({ role: 'assistant', content: 'I understand the context.' });
  }
  
  messages.push({ role: 'user', content: `Please provide a refined, comprehensive answer to: ${question}` });
  
  return { messages, maxTokens: promptConfig.maxTokens };
}

// OpenAI Streaming
export async function* streamOpenAI(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number
): AsyncGenerator<LLMStreamChunk> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      stream: true
    })
  });

  if (!response.ok) {
    const error = await response.text();
    yield { text: '', done: true, error: `OpenAI error: ${error}` };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield { text: '', done: true, error: 'No response body' };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            yield { text: content, done: false };
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  yield { text: '', done: true };
}

// Gemini Streaming
export async function* streamGemini(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number
): AsyncGenerator<LLMStreamChunk> {
  // Convert messages to Gemini format
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  let systemInstruction = '';

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction = msg.content;
    } else {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents,
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        generationConfig: {
          maxOutputTokens: maxTokens
        }
      })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    yield { text: '', done: true, error: `Gemini error: ${error}` };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield { text: '', done: true, error: 'No response body' };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            yield { text, done: false };
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  yield { text: '', done: true };
}

// Main streaming function
export async function* streamLLM(options: StreamOptions): AsyncGenerator<LLMStreamChunk> {
  const { provider, model, apiKey } = resolveProvider();
  
  const promptConfig = options.tier === 't0' 
    ? buildTier0Prompt(options) 
    : buildTier1Prompt(options);

  if (provider === 'openai') {
    yield* streamOpenAI(apiKey, model, promptConfig.messages, promptConfig.maxTokens);
  } else {
    yield* streamGemini(apiKey, model, promptConfig.messages, promptConfig.maxTokens);
  }
}

// Non-streaming for Tier 1 refine
export async function generateLLM(options: StreamOptions): Promise<string> {
  const { provider, model, apiKey } = resolveProvider();
  const promptConfig = buildTier1Prompt(options);

  if (provider === 'openai') {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: promptConfig.messages,
        max_tokens: promptConfig.maxTokens
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI error: ${await response.text()}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  } else {
    // Gemini non-streaming
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    let systemInstruction = '';

    for (const msg of promptConfig.messages) {
      if (msg.role === 'system') {
        systemInstruction = msg.content;
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      }
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents,
          systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
          generationConfig: {
            maxOutputTokens: promptConfig.maxTokens
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini error: ${await response.text()}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
}
