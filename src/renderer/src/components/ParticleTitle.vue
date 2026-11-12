<template>
  <div class="particle-title">
    <canvas ref="canvasRef" class="canvas" aria-hidden="true"></canvas>
    <h1 ref="textRef" class="text" :style="{ fontSize: size }">
      <span v-for="(line, index) in lines" :key="index" class="line">{{ line }}</span>
    </h1>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

interface Grain {
  hx: number
  hy: number
  x: number
  y: number
  amp: number
  speed: number
  phase: number
  r: number
  tone: string
}

const props = withDefaults(
  defineProps<{
    lines: string[]
    size?: string
  }>(),
  { size: 'clamp(2rem, 2.4vw + 1.2rem, 3rem)' }
)

const canvasRef = ref<HTMLCanvasElement>()
const textRef = ref<HTMLElement>()
let grains: Grain[] = []
let raf = 0
let width = 0
let height = 0
let dpr = 1
let reduced = false
let observer: ResizeObserver | undefined

const TONES = ['rgba(246, 250, 253, 0.96)', 'rgba(214, 231, 243, 0.9)', 'rgba(126, 176, 212, 0.95)']

function sample(): void {
  const canvas = canvasRef.value
  const host = textRef.value
  if (!canvas || !host) return

  const rect = host.getBoundingClientRect()
  width = Math.max(1, Math.round(rect.width))
  height = Math.max(1, Math.round(rect.height))
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  const style = getComputedStyle(host)
  const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.3

  const buffer = document.createElement('canvas')
  buffer.width = canvas.width
  buffer.height = canvas.height
  const ctx = buffer.getContext('2d')
  if (!ctx) return

  const scale = dpr
  ctx.scale(scale, scale)
  ctx.font = font
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  props.lines.forEach((line, index) => {
    const y = height / 2 + (index - (props.lines.length - 1) / 2) * lineHeight
    ctx.fillText(line, width / 2, y)
  })

  const data = ctx.getImageData(0, 0, buffer.width, buffer.height).data
  const step = Math.max(2, Math.round(2 * scale))
  const next: Grain[] = []

  for (let y = 0; y < buffer.height; y += step) {
    for (let x = 0; x < buffer.width; x += step) {
      const alpha = data[(y * buffer.width + x) * 4 + 3]
      if (alpha < 120) continue
      const hue = Math.random()
      next.push({
        hx: x / scale + (Math.random() - 0.5) * 0.9,
        hy: y / scale + (Math.random() - 0.5) * 0.9,
        x: x / scale,
        y: y / scale,
        amp: Math.random() < 0.08 ? 3 + Math.random() * 5 : 0.7 + Math.random() * 1.1,
        speed: 0.35 + Math.random() * 0.85,
        phase: Math.random() * Math.PI * 2,
        r: 0.5 + Math.random() * 0.4,
        tone: hue > 0.93 ? TONES[2] : hue > 0.6 ? TONES[1] : TONES[0]
      })
    }
  }

  grains = next
  if (reduced) drawFrame(0)
}

function drawFrame(time: number): void {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)

  const t = time / 1000
  for (const grain of grains) {
    const tx = grain.hx + Math.sin(t * grain.speed + grain.phase) * grain.amp
    const ty = grain.hy + Math.cos(t * grain.speed * 0.8 + grain.phase) * grain.amp
    grain.x += (tx - grain.x) * 0.12
    grain.y += (ty - grain.y) * 0.12
    ctx.fillStyle = grain.tone
    ctx.beginPath()
    ctx.arc(grain.x, grain.y, grain.r, 0, Math.PI * 2)
    ctx.fill()
  }
}

function loop(now: number): void {
  drawFrame(now)
  raf = requestAnimationFrame(loop)
}

onMounted(() => {
  reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  sample()
  if (textRef.value) {
    observer = new ResizeObserver(() => {
      sample()
    })
    observer.observe(textRef.value)
  }
  if (!reduced) raf = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  observer?.disconnect()
})
</script>

<style scoped>
.particle-title {
  position: relative;
  display: inline-block;
  padding: 1.5rem 2.5rem;
}

.text {
  position: relative;
  margin: 0;
  display: block;
  text-align: center;
  line-height: 1.42;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: transparent;
  opacity: 0;
  user-select: none;
}

.line {
  display: block;
}

.canvas {
  position: absolute;
  inset: 1.5rem 2.5rem;
  pointer-events: none;
}
</style>
