import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildDeepSeekPayload, prepareStudentQuestion, prepareStudentReply } from './companionPolicy.mjs'
import { recognize } from './recognition.mjs'
import { synthesizeSpeech } from './tts.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.COMPANION_PROXY_PORT ?? 8787)
const MAX_BODY_BYTES = 16 * 1024

loadLocalEnvironment(join(__dirname, '.env.local'))

function loadLocalEnvironment(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!match || process.env[match[1]]) continue
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(JSON.stringify(body))
}

function readJson(request, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let size = 0
    let raw = ''
    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      size += Buffer.byteLength(chunk)
      if (size > limit) {
        reject(new Error('body_too_large'))
        request.destroy()
        return
      }
      raw += chunk
    })
    request.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'))
      } catch {
        reject(new Error('invalid_json'))
      }
    })
    request.on('error', reject)
  })
}

async function createReply(body) {
  const question = prepareStudentQuestion(body?.question, body?.companionId)
  if (question.directReply) return question.directReply
  if (!process.env.DEEPSEEK_API_KEY) throw new Error('missing_api_key')
  const upstream = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(buildDeepSeekPayload(question)),
  })

  if (!upstream.ok) throw new Error('provider_error')
  const data = await upstream.json()
  const content = data?.choices?.[0]?.message?.content
  return prepareStudentReply(content)
}

const server = createServer(async (request, response) => {
  if (request.method === 'POST' && request.url?.split('?')[0] === '/api/companion/recognize') {
    try {
      const body = await readJson(request, 7 * 1024 * 1024)
      sendJson(response, 200, { result: await recognize(body) })
    } catch (error) {
      const code = error instanceof Error ? error.message : 'provider_error'
      const known = ['invalid_input', 'invalid_json', 'body_too_large', 'vision_not_configured', 'text_not_configured', 'invalid_result', 'result_too_long', 'provider_error']
      sendJson(response, code.includes('not_configured') ? 503 : code.startsWith('invalid_') ? 400 : 502, { error: known.includes(code) ? code : 'provider_error' })
    }
    return
  }
  if (request.method === 'POST' && request.url?.split('?')[0] === '/api/tts') {
    try {
      const body = await readJson(request)
      const audio = await synthesizeSpeech(body?.text, body?.voice)
      response.writeHead(200, {
        'content-type': 'audio/mpeg',
        'cache-control': 'no-store',
      })
      response.end(audio)
    } catch (error) {
      const code = error instanceof Error ? error.message : 'tts_failed'
      sendJson(response, code === 'invalid_input' || code === 'text_too_long' ? 400 : 502, {
        error: code === 'invalid_input' || code === 'text_too_long' ? code : 'tts_failed',
      })
    }
    return
  }
  if (request.method !== 'POST' || request.url?.split('?')[0] !== '/api/companion/reply') {
    sendJson(response, 404, { error: 'not_found' })
    return
  }

  try {
    const body = await readJson(request)
    const reply = await createReply(body)
    sendJson(response, 200, { reply })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'unknown_error'
    const status = code === 'missing_api_key' ? 503 : code === 'invalid_question' || code === 'unsafe_question' ? 400 : 502
    sendJson(response, status, { error: code })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`AI companion proxy running at http://127.0.0.1:${PORT}`)
})
