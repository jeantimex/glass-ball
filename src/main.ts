import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './style.css';

// --------------------------------------------------------------------------
// Configuration & Simulation Parameters
// --------------------------------------------------------------------------

const params = {
  // Material parameters
  color: '#ffffff',
  roughness: 0.02,
  transmission: 1.0,
  ior: 1.5,
  thickness: 2.0,
  clearcoat: 1.0,
  clearcoatRoughness: 0.02,
  attenuationColor: '#ffffff',
  attenuationDistance: 1.0,
  
  // Particles
  particleCount: 150,
  particleSpeed: 1.0,
  particleSize: 0.035,
  particleColor: '#a855f7',
  
  // Core
  coreColor: '#a855f7',
  coreRotateSpeed: 1.0,
  coreScale: 1.0,
  coreEmissiveIntensity: 2.0,
  
  // Lights
  ambientIntensity: 0.15,
  keyLightIntensity: 1.5,
  fillLightIntensity: 0.8,
  innerLightIntensity: 5.0,
  
  // Interaction
  autoRotate: true,
};


// --------------------------------------------------------------------------
// Scene Variables & Initialization
// --------------------------------------------------------------------------

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;

// Objects
let ballMesh: THREE.Mesh;
let ballMaterial: THREE.MeshPhysicalMaterial;
let coreMesh: THREE.Mesh;
let coreMaterial: THREE.MeshStandardMaterial;
let particles: THREE.Points;
let particlesGeometry: THREE.BufferGeometry;
let particlesMaterial: THREE.PointsMaterial;
let floorMesh: THREE.Mesh;
let gridHelper: THREE.GridHelper;

// Lights
let ambientLight: THREE.AmbientLight;
let keyLight: THREE.DirectionalLight;
let fillLight: THREE.DirectionalLight;
let spotLight: THREE.SpotLight;
let innerPointLight: THREE.PointLight;

// Particles tracking
let particleData: Array<{
  radius: number;
  phi: number;
  theta: number;
  speed: number;
  orbitSpeed: number;
}> = [];

// Interactive input state
const mouse = { x: 0, y: 0 };
const targetLightPos = new THREE.Vector3(0, 0, 0);

// Initialize Three.js Scene
function init() {
  const container = document.getElementById('canvas-container')!;
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  // 1. Scene & Fog
  scene = new THREE.Scene();
  
  // 2. Camera
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 1.5, 4.5);
  
  // 3. Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);
  
  // 4. Orbit Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 2.0;
  controls.maxDistance = 10.0;
  controls.maxPolarAngle = Math.PI / 2 + 0.1; // allow a tiny bit below ground level
  controls.autoRotate = params.autoRotate;
  controls.autoRotateSpeed = 0.5;
  
  // 5. Environmental Lighting (Procedural Canvas Environment Map)
  const envMap = createProceduralEnvMap();
  scene.environment = envMap;
  
  // 6. Base Lights
  ambientLight = new THREE.AmbientLight(0xffffff, params.ambientIntensity);
  scene.add(ambientLight);
  
  keyLight = new THREE.DirectionalLight(0xffffff, params.keyLightIntensity);
  keyLight.position.set(5, 8, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  keyLight.shadow.bias = -0.0001;
  scene.add(keyLight);
  
  fillLight = new THREE.DirectionalLight(0x00e5ff, params.fillLightIntensity);
  fillLight.position.set(-5, 4, -5);
  scene.add(fillLight);
  
  // Shadow-casting Spotlight focused on the Sphere
  spotLight = new THREE.SpotLight(0xffffff, 3.0, 15, Math.PI / 6, 0.5, 1);
  spotLight.position.set(0, 5, 0);
  spotLight.target.position.set(0, 0, 0);
  spotLight.castShadow = true;
  spotLight.shadow.mapSize.width = 1024;
  spotLight.shadow.mapSize.height = 1024;
  spotLight.shadow.bias = -0.0001;
  scene.add(spotLight);
  
  // Internal Glowing Point Light inside the Glass Sphere
  innerPointLight = new THREE.PointLight(new THREE.Color(params.coreColor), params.innerLightIntensity, 5, 1.2);
  innerPointLight.position.set(0, 0, 0);
  scene.add(innerPointLight);
  
  // 7. Scenic Elements: Ground Floor and Grid
  const floorGeom = new THREE.PlaneGeometry(50, 50);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x090515,
    roughness: 0.3,
    metalness: 0.8,
  });
  floorMesh = new THREE.Mesh(floorGeom, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = -1.2;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);
  
  // 8. The Glass Ball
  const ballGeom = new THREE.SphereGeometry(1.0, 64, 64);
  ballMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(params.color),
    roughness: params.roughness,
    transmission: params.transmission,
    ior: params.ior,
    thickness: params.thickness,
    clearcoat: params.clearcoat,
    clearcoatRoughness: params.clearcoatRoughness,
    attenuationColor: new THREE.Color(params.attenuationColor),
    attenuationDistance: params.attenuationDistance,
    metalness: 0.0,
    transparent: true,
    shadowSide: THREE.DoubleSide,
  });
  ballMesh = new THREE.Mesh(ballGeom, ballMaterial);
  ballMesh.position.set(0, 0, 0);
  ballMesh.castShadow = true;
  ballMesh.receiveShadow = true;
  scene.add(ballMesh);
  
  // 9. Floating Core inside the Sphere
  const coreGeom = new THREE.TorusKnotGeometry(0.32, 0.09, 120, 16);
  coreMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(params.coreColor),
    emissive: new THREE.Color(params.coreColor),
    emissiveIntensity: params.coreEmissiveIntensity,
    roughness: 0.1,
    metalness: 0.9,
  });
  coreMesh = new THREE.Mesh(coreGeom, coreMaterial);
  coreMesh.position.set(0, 0, 0);
  scene.add(coreMesh);
  
  // 10. Floating Particle System inside the Sphere
  particlesGeometry = new THREE.BufferGeometry();
  particlesMaterial = new THREE.PointsMaterial({
    color: new THREE.Color(params.particleColor),
    size: params.particleSize,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false, // Prevents particles blockiness/artifacts inside transparent glass
  });
  
  particles = new THREE.Points(particlesGeometry, particlesMaterial);
  scene.add(particles);
  
  initParticles();
  
  // 11. Initial Theme Setup
  applyTheme('dark');
  
  // 12. Listeners
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('mousemove', onMouseMove);
}

// --------------------------------------------------------------------------
// Procedural Environment Map Generation
// --------------------------------------------------------------------------

function createProceduralEnvMap(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  
  // Base cosmic gradient
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#0c0721');
  grad.addColorStop(0.5, '#04020a');
  grad.addColorStop(1, '#010003');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw colorful radial highlights to act as light reflections
  function drawGlow(x: number, y: number, r: number, color: string) {
    const radial = ctx.createRadialGradient(x, y, 0, x, y, r);
    radial.addColorStop(0, color);
    radial.addColorStop(0.8, color.replace(/[\d.]+\)$/, '0.1)'));
    radial.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = radial;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Purple reflections (representing left/top scene light)
  drawGlow(250, 256, 220, 'rgba(168, 85, 247, 0.45)');
  // Cyan reflections (representing right/bottom rim light)
  drawGlow(770, 256, 220, 'rgba(0, 229, 255, 0.45)');
  // Magenta hot spot
  drawGlow(512, 100, 150, 'rgba(255, 0, 128, 0.3)');
  // White/Amber reflection highlights
  drawGlow(400, 180, 80, 'rgba(255, 240, 210, 0.35)');
  drawGlow(620, 320, 100, 'rgba(253, 186, 116, 0.2)');
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// --------------------------------------------------------------------------
// Particle Functions
// --------------------------------------------------------------------------

function initParticles() {
  particleData = [];
  const positions = new Float32Array(params.particleCount * 3);
  
  for (let i = 0; i < params.particleCount; i++) {
    // Generate particles within sphere boundary of ~0.85
    const radius = 0.2 + 0.62 * Math.random();
    const phi = Math.random() * Math.PI * 2;
    const theta = Math.random() * Math.PI;
    const speed = 0.4 + 0.8 * Math.random();
    const orbitSpeed = 0.5 + 1.0 * Math.random();
    
    particleData.push({ radius, phi, theta, speed, orbitSpeed });
    
    positions[i * 3] = radius * Math.sin(theta) * Math.cos(phi);
    positions[i * 3 + 1] = radius * Math.cos(theta);
    positions[i * 3 + 2] = radius * Math.sin(theta) * Math.sin(phi);
  }
  
  particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particlesGeometry.attributes.position.needsUpdate = true;
}

function updateParticles(deltaTime: number) {
  const positions = particlesGeometry.attributes.position.array as Float32Array;
  
  for (let i = 0; i < params.particleCount; i++) {
    const data = particleData[i];
    if (!data) continue;
    
    // Increment angle based on time and speed multiplier
    data.phi += deltaTime * params.particleSpeed * data.orbitSpeed * 0.4;
    // Wobble polar coordinate
    const thetaWobble = data.theta + Math.sin(data.phi * 2.0 + data.speed) * 0.1;
    
    // Cartesian conversion
    positions[i * 3] = data.radius * Math.sin(thetaWobble) * Math.cos(data.phi);
    positions[i * 3 + 1] = data.radius * Math.cos(thetaWobble);
    positions[i * 3 + 2] = data.radius * Math.sin(thetaWobble) * Math.sin(data.phi);
  }
  
  particlesGeometry.attributes.position.needsUpdate = true;
}

// --------------------------------------------------------------------------
// GUI Controls Setup
// --------------------------------------------------------------------------



// --------------------------------------------------------------------------
// Interactions & Sizing
// --------------------------------------------------------------------------
function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('gb-theme', theme);
  
  if (!renderer || !scene) return;
  
  if (theme === 'light') {
    scene.background = new THREE.Color(0xf1f5f9);
    scene.fog = new THREE.FogExp2(0xf1f5f9, 0.1);
    renderer.setClearColor(0xf1f5f9, 1);
    
    // Add grid with primary violet lines and soft grid lines
    if (gridHelper) scene.remove(gridHelper);
    gridHelper = new THREE.GridHelper(20, 20, 0x7c3aed, 0xcbaffa);
    gridHelper.position.y = -1.19;
    scene.add(gridHelper);
    
    // Floor material adjustments
    if (floorMesh) {
      (floorMesh.material as THREE.MeshStandardMaterial).color.setHex(0xe2e8f0);
      (floorMesh.material as THREE.MeshStandardMaterial).roughness = 0.55;
    }
  } else {
    scene.background = new THREE.Color(0x030008);
    scene.fog = new THREE.FogExp2(0x030008, 0.15);
    renderer.setClearColor(0x030008, 1);
    
    // Add grid with glowing purple lines and deep dark subdivisions
    if (gridHelper) scene.remove(gridHelper);
    gridHelper = new THREE.GridHelper(20, 20, 0xa855f7, 0x221042);
    gridHelper.position.y = -1.19;
    scene.add(gridHelper);
    
    // Floor material adjustments
    if (floorMesh) {
      (floorMesh.material as THREE.MeshStandardMaterial).color.setHex(0x06030e);
      (floorMesh.material as THREE.MeshStandardMaterial).roughness = 0.22;
    }
  }
}

function onMouseMove(event: MouseEvent) {
  // Normalize coordinates: [-1, 1] relative to the window
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
  // Set light target coordinates inside the sphere
  targetLightPos.x = mouse.x * 0.75;
  targetLightPos.y = mouse.y * 0.75;
  targetLightPos.z = Math.sin(mouse.x * Math.PI) * 0.4;
}

function onWindowResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  
  renderer.setSize(width, height);
}

// --------------------------------------------------------------------------
// Frame Rendering Loop
// --------------------------------------------------------------------------

const timer = new THREE.Timer();

function animate(timestamp: number) {
  requestAnimationFrame(animate);
  
  timer.update(timestamp);
  const time = timer.getElapsed();
  const deltaTime = timer.getDelta();
  
  // 1. Hover/Dampen Internal light shifts
  innerPointLight.position.lerp(targetLightPos, 0.08);
  
  // 2. Slow hover float on Glass Sphere
  ballMesh.position.y = Math.sin(time * 0.8) * 0.04;
  
  // 3. Core rotating & floating
  if (coreMesh) {
    coreMesh.rotation.x = time * params.coreRotateSpeed * 0.35;
    coreMesh.rotation.y = time * params.coreRotateSpeed * 0.7;
    coreMesh.position.y = ballMesh.position.y + Math.sin(time * 1.5) * 0.03;
  }
  
  // 4. Update Particle orbit coordinates
  updateParticles(deltaTime);
  
  // Match particles group height to float with the Glass Ball
  particles.position.y = ballMesh.position.y;
  
  // 5. Render cycle
  controls.update();
  renderer.render(scene, camera);
}

// --------------------------------------------------------------------------
// Start Application
// --------------------------------------------------------------------------

window.addEventListener('DOMContentLoaded', () => {
  init();
  requestAnimationFrame(animate);
});
