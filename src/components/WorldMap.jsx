import { useEffect, useRef } from "react"
import * as THREE from "three"
import land from "../data/land.geo.json"

export default function WorldMap() {
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current) return

    /* ================= SCENE ================= */
    const scene = new THREE.Scene()

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setClearColor(0x000000, 1)
    ref.current.appendChild(renderer.domElement)

    /* ================= CAMERA ================= */
    const WORLD_WIDTH = 360
    const WORLD_HEIGHT = 180
    const aspect = window.innerWidth / window.innerHeight

    const camera = new THREE.OrthographicCamera(
      -WORLD_WIDTH * aspect * 0.5,
       WORLD_WIDTH * aspect * 0.5,
       WORLD_HEIGHT * 0.5,
      -WORLD_HEIGHT * 0.5,
      -100,
       100
    )
    camera.position.z = 10

    /* ================= GROUP ================= */
    const mapGroup = new THREE.Group()
    scene.add(mapGroup)

    /* ================= PROJECTION ================= */
    const project = ([lon, lat]) => new THREE.Vector2(lon, lat)

    /* ================= MATERIALS ================= */
    const landMat = new THREE.MeshBasicMaterial({
      color: 0x0b1622,
      transparent: true,
      opacity: 0.95
    })

    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35
    })

    const coastMat = new THREE.LineBasicMaterial({
      color: 0x4da3ff,
      transparent: true,
      opacity: 0.9
    })

    /* ================= DRAW POLYGON ================= */
    const drawPolygon = ring => {
      if (!Array.isArray(ring) || ring.length < 3) return

      const shape = new THREE.Shape()

      ring.forEach((p, i) => {
        if (!Array.isArray(p) || p.length < 2) return
        const v = project(p)
        if (i === 0) shape.moveTo(v.x, v.y)
        else shape.lineTo(v.x, v.y)
      })

      const shadowGeo = new THREE.ShapeGeometry(shape)
      const shadow = new THREE.Mesh(shadowGeo, shadowMat)
      shadow.position.y -= 4
      shadow.position.z -= 2
      shadow.scale.set(1.03, 1.03, 1)
      mapGroup.add(shadow)

      const landGeo = new THREE.ShapeGeometry(shape)
      const landMesh = new THREE.Mesh(landGeo, landMat)
      mapGroup.add(landMesh)

      const pts = ring
        .filter(p => Array.isArray(p) && p.length >= 2)
        .map(p => {
          const v = project(p)
          return new THREE.Vector3(v.x, v.y, 2)
        })

      if (pts.length > 1) {
        const lineGeo = new THREE.BufferGeometry().setFromPoints(pts)
        const line = new THREE.Line(lineGeo, coastMat)
        mapGroup.add(line)
      }
    }

    /* ================= LOAD GEOJSON ================= */
    if (land?.features?.length) {
      land.features.forEach(f => {
        const g = f.geometry
        if (!g || !g.coordinates) return

        if (g.type === "Polygon") {
          drawPolygon(g.coordinates[0])
        }

        if (g.type === "MultiPolygon") {
          g.coordinates.forEach(poly => {
            if (Array.isArray(poly) && poly[0]) {
              drawPolygon(poly[0])
            }
          })
        }
      })
    }

    /* ================= TRAVEL ARC ================= */
    const arcSteps = 160
    const arcPts = []
    const arcProg = []

    const start = project([10, 45])
    const end = project([120, 25])

    for (let i = 0; i <= arcSteps; i++) {
      const t = i / arcSteps
      arcPts.push(
        new THREE.Vector3(
          THREE.MathUtils.lerp(start.x, end.x, t),
          THREE.MathUtils.lerp(start.y, end.y, t) + Math.sin(t * Math.PI) * 18,
          6
        )
      )
      arcProg.push(t)
    }

    const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPts)
    arcGeo.setAttribute("progress", new THREE.Float32BufferAttribute(arcProg, 1))

    const arcMat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: { time: { value: 0 } },
      vertexShader: `
        attribute float progress;
        varying float vP;
        void main(){
          vP = progress;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        varying float vP;
        void main(){
          float h = smoothstep(time-0.05, time, vP);
          float t = smoothstep(time, time+0.2, vP);
          float g = h * t;
          gl_FragColor = vec4(vec3(1.0,0.55,0.15)*g, g);
        }
      `
    })

    scene.add(new THREE.Line(arcGeo, arcMat))

    /* ================= ANIMATE ================= */
    const clock = new THREE.Clock()
    let raf

    const animate = () => {
      arcMat.uniforms.time.value = (clock.getElapsedTime() * 0.25) % 1
      renderer.render(scene, camera)
      raf = requestAnimationFrame(animate)
    }
    animate()

    /* ================= RESIZE ================= */
    const resize = () => {
      const a = window.innerWidth / window.innerHeight
      camera.left = -WORLD_WIDTH * a * 0.5
      camera.right = WORLD_WIDTH * a * 0.5
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener("resize", resize)

    /* ================= CLEANUP ================= */
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", resize)
      renderer.dispose()
      ref.current?.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={ref} style={{ position: "fixed", inset: 0 }} />
}
