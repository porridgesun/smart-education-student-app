// 基于 Edge 神经网络语音的 TTS 服务（仅本地开发代理使用）
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'

const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural' // 晓晓 · 温柔自然女声
const VOICE_WHITELIST = new Set([
  DEFAULT_VOICE,
  'zh-CN-XiaoyiNeural', // 晓伊 · 活泼女声
  'zh-CN-YunxiNeural', // 云希 · 阳光男声
  'zh-CN-YunyangNeural', // 云扬 · 沉稳男声
])

const MAX_TEXT_LENGTH = 2000

let tts = null
let currentVoice = null
// 串行化请求，避免同一 WebSocket 实例并发合成
let chain = Promise.resolve()

async function ensureTts(voiceName) {
  if (!tts) {
    tts = new MsEdgeTTS()
  }
  if (currentVoice !== voiceName) {
    await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
    currentVoice = voiceName
  }
  return tts
}

function synthesizeOnce(text, voiceName) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let settled = false
    try {
      tts.toStream(text, { rate: '-10%' }).audioStream
        .on('data', (chunk) => chunks.push(chunk))
        .on('end', () => { if (!settled) { settled = true; resolve(Buffer.concat(chunks)) } })
        .on('error', (error) => { if (!settled) { settled = true; reject(error) } })
    } catch (error) {
      if (!settled) { settled = true; reject(error) }
    }
  })
}

export async function synthesizeSpeech(rawText, rawVoice) {
  const text = typeof rawText === 'string' ? rawText.trim() : ''
  if (!text) throw new Error('invalid_input')
  if (text.length > MAX_TEXT_LENGTH) throw new Error('text_too_long')
  const voiceName = typeof rawVoice === 'string' && VOICE_WHITELIST.has(rawVoice) ? rawVoice : DEFAULT_VOICE

  const task = chain.then(async () => {
    await ensureTts(voiceName)
    return synthesizeOnce(text, voiceName)
  })
  // 失败后重置连接，下次请求重建
  chain = task.catch(() => {
    tts = null
    currentVoice = null
  })
  return task
}
