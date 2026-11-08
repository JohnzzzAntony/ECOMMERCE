'use client'

import { useEffect, useRef, type RefObject } from 'react'
import gsap from 'gsap'

// A WebGL room behind the salon: a perspective floor lit by a soft pool that follows the pointer, and dust
// drifting through real 3D depth so nearer motes pass faster as the rail moves. Decorative only.
const W = 64
const vertex = /* glsl */ `
  uniform float uShift; uniform float uTime; uniform float uPixel;
  attribute float aSeed;
  varying float vFade;
  void main() {
    vec3 p = position;
    p.x = mod(p.x - uShift, ${W}.0) - ${W / 2}.0;
    p.y += sin(uTime * (.12 + aSeed * .2) + aSeed * 40.0) * .35;
    vec4 view = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = uPixel * (1.8 + aSeed * 2.8) * (14.0 / -view.z);
    vFade = smoothstep(42.0, 6.0, -view.z) * smoothstep(1.0, 4.0, -view.z);
  }`
const dust = /* glsl */ `
  uniform vec3 uInk;
  varying float vFade;
  void main() {
    float d = length(gl_PointCoord - .5);
    gl_FragColor = vec4(uInk, smoothstep(.5, 0.0, d) * vFade * .38);
  }`
const floorVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() { vWorld = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0); }`
const floorFragment = /* glsl */ `
  uniform vec3 uInk; uniform vec2 uLight; uniform float uShift;
  varying vec3 vWorld;
  void main() {
    float pool = smoothstep(14.0, 0.0, length((vWorld.xz - uLight) * vec2(.55, 1.0)));
    float horizon = smoothstep(-60.0, -18.0, vWorld.z);
    float lines = smoothstep(.04, 0.0, abs(fract((vWorld.x + uShift) * .125) - .5)) * .25;
    gl_FragColor = vec4(uInk, horizon * ((1.0 - pool) * .07 + lines * pool * .12));
  }`

export function OmbrineAtmosphere({ distance, active }: { distance: RefObject<number>; active: boolean }) {
  const host = useRef<HTMLDivElement>(null)
  const running = useRef(active)
  useEffect(() => { running.current = active }, [active])

  useEffect(() => {
    const el = host.current
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let dispose = () => {}
    let cancelled = false
    import('three').then((THREE) => {
      if (cancelled) return
      let renderer: InstanceType<typeof THREE.WebGLRenderer>
      try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' }) } catch { return }
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
      el.appendChild(renderer.domElement)
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(38, 1, .1, 80)
      camera.position.set(0, 1.4, 6)
      camera.lookAt(0, .2, -10)
      const ink = new THREE.Color()
      const shared = { uInk: { value: ink }, uShift: { value: 0 } }

      const count = 420
      const positions = new Float32Array(count * 3)
      const seeds = new Float32Array(count)
      for (let i = 0; i < count; i++) {
        positions.set([Math.random() * W, -1.4 + Math.random() * 7, -2 - Math.random() * 40], i * 3)
        seeds[i] = Math.random()
      }
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
      const dustMaterial = new THREE.ShaderMaterial({
        uniforms: { ...shared, uTime: { value: 0 }, uPixel: { value: renderer.getPixelRatio() } },
        vertexShader: vertex, fragmentShader: dust, transparent: true, depthWrite: false,
      })
      scene.add(new THREE.Points(geometry, dustMaterial))

      const floorGeometry = new THREE.PlaneGeometry(200, 120)
      const floorMaterial = new THREE.ShaderMaterial({
        uniforms: { ...shared, uLight: { value: new THREE.Vector2(0, -6) } },
        vertexShader: floorVertex, fragmentShader: floorFragment, transparent: true, depthWrite: false,
      })
      const floor = new THREE.Mesh(floorGeometry, floorMaterial)
      floor.rotation.x = -Math.PI / 2
      floor.position.y = -1.5
      scene.add(floor)

      const root = el.closest('.ombrine') ?? document.documentElement
      const readInk = () => ink.set(getComputedStyle(root).color)
      readInk()
      const appearance = new MutationObserver(readInk)
      appearance.observe(root, { attributes: true, attributeFilter: ['data-appearance'] })

      const resize = () => {
        const { clientWidth: w, clientHeight: h } = el
        if (!w || !h) return
        renderer.setSize(w, h, false)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
      }
      resize()
      const observer = new ResizeObserver(resize)
      observer.observe(el)

      const pointer = { x: 0, z: -6 }
      const light = floorMaterial.uniforms.uLight.value
      const onPointer = (e: PointerEvent) => {
        pointer.x = (e.clientX / innerWidth - .5) * 18
        pointer.z = -3 - (1 - e.clientY / innerHeight) * 9
      }
      addEventListener('pointermove', onPointer, { passive: true })

      let time = 0
      const tick = (_: number, delta: number) => {
        if (!running.current || document.hidden) return
        time += Math.min(delta, 50) / 1000
        shared.uShift.value = (distance.current ?? 0) * .012
        dustMaterial.uniforms.uTime.value = time
        light.x += (pointer.x - light.x) * .04
        light.y += (pointer.z - light.y) * .04
        renderer.render(scene, camera)
      }
      gsap.ticker.add(tick)

      dispose = () => {
        gsap.ticker.remove(tick)
        removeEventListener('pointermove', onPointer)
        observer.disconnect()
        appearance.disconnect()
        geometry.dispose(); dustMaterial.dispose(); floorGeometry.dispose(); floorMaterial.dispose()
        renderer.dispose()
        renderer.domElement.remove()
      }
    }).catch(() => { /* Without WebGL the salon keeps its CSS depth planes. */ })
    return () => { cancelled = true; dispose() }
  }, [distance])

  return <div className="om-atmosphere" ref={host} aria-hidden="true" />
}
