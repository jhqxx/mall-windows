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
  sx: number
  sy: number
  amp: number
  speed: number
  phase: number
  r: number
  tone: string
  delay: number
  duration: number
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
let introStart = 0
let introDone = 0

const TONES = ['rgba(250, 253, 255, 0.99)', 'rgba(224, 238, 248, 0.94)', 'rgba(126, 176, 212, 0.95)']

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function sample(): void {
  const canvas = canvasRef.value
  const host = textRef.value
  if (!canvas || !host) return

  const box = canvas.getBoundingClientRect()
  const rect = host.getBoundingClientRect()
  width = Math.max(1, Math.round(box.width))
  height = Math.max(1, Math.round(box.height))
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)

  const style = getComputedStyle(host)
  const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.3
  const originX = rect.left - box.left
  const originY = rect.top - box.top

  const buffer = document.createElement('canvas')
  buffer.width = canvas.width
  buffer.height = canvas.height
  const ctx = buffer.getContext('2d')
  if (!ctx) return

  ctx.scale(dpr, dpr)
  ctx.font = font
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  props.lines.forEach((line, index) => {
    const y = originY + rect.height / 2 + (index - (props.lines.length - 1) / 2) * lineHeight
    ctx.fillText(line, originX + rect.width / 2, y)
  })

  const data = ctx.getImageData(0, 0, buffer.width, buffer.height).data
  const step = Math.max(2, Math.round(1.5 * dpr))
  const next: Grain[] = []
  const cx = width / 2
  const cy = height / 2
  const halfW = width / 2
  const halfH = height / 2
  const maxDistance = Math.hypot(halfW, halfH)

  for (let y = 0; y < buffer.height; y += step) {
    for (let x = 0; x < buffer.width; x += step) {
      const alpha = data[(y * buffer.width + x) * 4 + 3]
      if (!(alpha >= 120)) continue

      const hx = x / dpr + (Math.random() - 0.5) * 0.28
      const hy = y / dpr + (Math.random() - 0.5) * 0.28
      const angle = Math.atan2(hy - cy, hx - cx) + (Math.random() - 0.5) * 0.7
      const cosA = Math.abs(Math.cos(angle)) || 1e-6
      const sinA = Math.abs(Math.sin(angle)) || 1e-6
      const tEdge = Math.min(halfW / cosA, halfH / sinA)
      const startDistance = tEdge * (0.9 + Math.random() * 0.08)
      const homeDistance = Math.hypot(hx - cx, hy - cy)
      const hue = Math.random()

      next.push({
        hx,
        hy,
        sx: cx + Math.cos(angle) * startDistance,
        sy: cy + Math.sin(angle) * startDistance,
        amp: Math.random() < 0.06 ? 2.2 + Math.random() * 3.4 : 0.3 + Math.random() * 0.5,
        speed: 0.35 + Math.random() * 0.85,
        phase: Math.random() * Math.PI * 2,
        r: 0.95 + Math.random() * 0.35,
        tone: hue > 0.93 ? TONES[2] : hue > 0.6 ? TONES[1] : TONES[0],
        delay: (1 - homeDistance / maxDistance) * 170 + Math.random() * 170,
        duration: 1150 + Math.random() * 480
      })
    }
  }

  grains = next
  introStart = performance.now()
  introDone = introStart + next.reduce((max, g) => Math.max(max, g.delay + g.duration), 0)
  if (reduced) drawFrame(introDone + 2000)
}

function drawFrame(now: number): void {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)

  const settle = Math.min(1, Math.max(0, (now - introDone) / 900))
  const t = now / 1000

  for (const grain of grains) {
    const raw = (now - introStart - grain.delay) / grain.duration
    const progress = raw < 0 ? 0 : raw > 1 ? 1 : raw
    const eased = easeInOutCubic(progress)

    const driftX = Math.sin(t * grain.speed + grain.phase) * grain.amp * settle
    const driftY = Math.cos(t * grain.speed * 0.8 + grain.phase) * grain.amp * settle
    const targetX = grain.hx + driftX
    const targetY = grain.hy + driftY

    const px = grain.sx + (targetX - grain.sx) * eased
    const py = grain.sy + (targetY - grain.sy) * eased

    ctx.globalAlpha = Math.min(1, progress * 5)
    ctx.fillStyle = grain.tone
    ctx.beginPath()
    ctx.arc(px, py, grain.r, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.globalAlpha = 1
}

function loop(now: number): void {
  drawFrame(now)
  raf = requestAnimationFrame(loop)
}

onMounted(() => {
  reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  sample()
  if (canvasRef.value) {
    observer = new ResizeObserver(() => {
      sample()
    })
    observer.observe(canvasRef.value)
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
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
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
  padding: 1.5rem 2.5rem;
}

.line {
  display: block;
}

.canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
