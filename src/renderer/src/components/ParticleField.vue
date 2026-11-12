<template>
  <canvas ref="canvasRef" class="particles" aria-hidden="true"></canvas>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

interface Dot {
  x: number
  y: number
  vx: number
  vy: number
  r: number
}

const canvasRef = ref<HTMLCanvasElement>()
let raf = 0
let resize: ResizeObserver | undefined
let dots: Dot[] = []
let width = 0
let height = 0
let dpr = 1

const COUNT = 44
const LINK_DISTANCE = 140

function seed(): Dot[] {
  return Array.from({ length: COUNT }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.18,
    vy: (Math.random() - 0.5) * 0.18,
    r: Math.random() * 1.3 + 0.6
  }))
}

function draw(): void {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)

  for (const dot of dots) {
    dot.x += dot.vx
    dot.y += dot.vy
    if (dot.x < 0 || dot.x > width) dot.vx *= -1
    if (dot.y < 0 || dot.y > height) dot.vy *= -1
  }

  for (let i = 0; i < dots.length; i++) {
    for (let j = i + 1; j < dots.length; j++) {
      const dx = dots[i].x - dots[j].x
      const dy = dots[i].y - dots[j].y
      const dist = Math.hypot(dx, dy)
      if (dist > LINK_DISTANCE) continue
      ctx.strokeStyle = `rgba(122, 176, 214, ${(1 - dist / LINK_DISTANCE) * 0.2})`
      ctx.lineWidth = 0.6
      ctx.beginPath()
      ctx.moveTo(dots[i].x, dots[i].y)
      ctx.lineTo(dots[j].x, dots[j].y)
      ctx.stroke()
    }
  }

  for (const dot of dots) {
    ctx.fillStyle = 'rgba(206, 226, 241, 0.62)'
    ctx.beginPath()
    ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2)
    ctx.fill()
  }
}

function loop(): void {
  draw()
  raf = requestAnimationFrame(loop)
}

function resizeCanvas(): void {
  const canvas = canvasRef.value
  const host = canvas?.parentElement
  if (!canvas || !host) return
  width = host.clientWidth
  height = host.clientHeight
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  if (dots.length === 0) dots = seed()
}

onMounted(() => {
  resizeCanvas()
  const host = canvasRef.value?.parentElement
  if (host) {
    resize = new ResizeObserver(() => resizeCanvas())
    resize.observe(host)
  }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) {
    draw()
  } else {
    raf = requestAnimationFrame(loop)
  }
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  resize?.disconnect()
})
</script>

<style scoped>
.particles {
  position: absolute;
  inset: 0;
  display: block;
  pointer-events: none;
  opacity: 0.9;
}
</style>
