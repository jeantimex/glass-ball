import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import './style.css';

// --------------------------------------------------------------------------
// Procedural Texture Generators (Aesthetics)
// --------------------------------------------------------------------------

// Procedural organic sand/dirt ground texture
function createGroundTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  
  // Base earth color
  ctx.fillStyle = '#6e5138';
  ctx.fillRect(0, 0, 512, 512);
  
  // Soft splotches
  for (let i = 0; i < 250; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 8 + Math.random() * 32;
    
    const colors = [
      'rgba(80, 56, 36, 0.7)',
      'rgba(125, 95, 68, 0.6)',
      'rgba(50, 35, 20, 0.8)',
      'rgba(145, 120, 95, 0.4)'
    ];
    
    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // High-frequency sand grain noise
  const imgData = ctx.getImageData(0, 0, 512, 512);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 30;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i+1] = Math.min(255, Math.max(0, data[i+1] + noise));
    data[i+2] = Math.min(255, Math.max(0, data[i+2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

// Procedural sky dome gradient background
function createSkyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  
  // Sunset vertical gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#0c0822');   // Cosmic top sky
  grad.addColorStop(0.4, '#1b1236');  // Mid twilight transition
  grad.addColorStop(0.7, '#da8c66');  // Warm horizon sunset glow
  grad.addColorStop(0.85, '#ffd1a3'); // Soft sun highlight at ground transition
  grad.addColorStop(1, '#0e0a05');   // Ground shadow
  
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Procedural environment map canvas texture for rich glass refractions
function createProceduralEnvMap(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  
  // Base dark ambient
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#0e092b');
  grad.addColorStop(0.5, '#05030e');
  grad.addColorStop(1, '#010005');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
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
  
  // Neon glowing spots representing environment light panels reflecting in the marble
  drawGlow(250, 256, 220, 'rgba(168, 85, 247, 0.5)'); // Purple
  drawGlow(770, 256, 220, 'rgba(0, 229, 255, 0.5)');  // Cyan
  drawGlow(512, 100, 160, 'rgba(255, 0, 128, 0.45)'); // Pink
  drawGlow(400, 200, 90, 'rgba(255, 250, 220, 0.4)');  // Light gold
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// --------------------------------------------------------------------------
// Core Scene Elements
// --------------------------------------------------------------------------

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;

// Simulation Objects
let marbleGroup: THREE.Group;
let glassOuterMesh: THREE.Mesh;
let cateyeInnerGroup: THREE.Group;


function init() {
  const container = document.getElementById('canvas-container')!;
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  // 1. Scene setup with warm horizon twilight fog
  scene = new THREE.Scene();
  scene.background = createSkyTexture();
  scene.fog = new THREE.FogExp2(0x130a21, 0.08); // exponential fog
  
  // 2. Camera
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 1.2, 4.0);
  
  // 3. Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  
  // 4. Orbit Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 1.5;
  controls.maxDistance = 10.0;
  controls.maxPolarAngle = Math.PI / 2 + 0.05; // limit looking below ground
  
  // 5. Environmental Reflection Map
  scene.environment = createProceduralEnvMap();
  
  // 6. Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
  scene.add(ambientLight);
  
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
  keyLight.position.set(5, 8, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  keyLight.shadow.bias = -0.0001;
  scene.add(keyLight);
  
  const rimLight = new THREE.DirectionalLight(0x00e5ff, 1.0);
  rimLight.position.set(-5, 4, -5);
  scene.add(rimLight);
  
  // Focused spotlight to cast a sharp floor shadow
  const spotLight = new THREE.SpotLight(0xffffff, 5.0, 15, Math.PI / 6, 0.5, 1);
  spotLight.position.set(0, 5, 0);
  spotLight.target.position.set(0, 0, 0);
  spotLight.castShadow = true;
  spotLight.shadow.mapSize.width = 1024;
  spotLight.shadow.mapSize.height = 1024;
  spotLight.shadow.bias = -0.0001;
  scene.add(spotLight);
  
  // 7. Ground floor plane
  const floorGeom = new THREE.PlaneGeometry(50, 50);
  const floorMat = new THREE.MeshStandardMaterial({
    map: createGroundTexture(),
    roughness: 0.65,
    metalness: 0.05,
  });
  const floorMesh = new THREE.Mesh(floorGeom, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = -1.2;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);
  
  // 8. Marble Parent Group (Handles orbital rotations and float oscillations)
  marbleGroup = new THREE.Group();
  marbleGroup.position.set(0, 0, 0);
  scene.add(marbleGroup);
  
  // Outer Physical Glass Shell of the Marble
  const glassGeom = new THREE.SphereGeometry(1.0, 64, 64);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.03,
    transmission: 1.0,  // Clear glass
    ior: 1.18,          // Reduced from 1.5 to reduce magnifying distortion
    thickness: 1.0,     // Reduced from 2.0 to soften refractive bending
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    metalness: 0.0,
    transparent: true,
    shadowSide: THREE.DoubleSide
  });
  
  glassOuterMesh = new THREE.Mesh(glassGeom, glassMat);
  glassOuterMesh.castShadow = true;
  glassOuterMesh.receiveShadow = true;
  marbleGroup.add(glassOuterMesh);
  
  // Inner Cateye Group (Holds loaded OBJ meshes)
  cateyeInnerGroup = new THREE.Group();
  marbleGroup.add(cateyeInnerGroup);
  
  // 9. Load Cat's Eye OBJ Mesh & Swirl Texture
  loadCateyeSwirl();
  
  // 10. Listeners
  window.addEventListener('resize', onWindowResize);
}

// --------------------------------------------------------------------------
// OBJ Loading & Scaling
// --------------------------------------------------------------------------

function loadCateyeSwirl() {
  const textureLoader = new THREE.TextureLoader();
  
  // Load the detailed colorful glass swirl texture
  const colorTexture = textureLoader.load('/cateye/texture_006.jpg', (tex) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
  });
  colorTexture.colorSpace = THREE.SRGBColorSpace;
  
  // High quality gloss material for the internal vanes
  const cateyeMaterial = new THREE.MeshStandardMaterial({
    map: colorTexture,
    roughness: 0.1,
    metalness: 0.1,
    side: THREE.DoubleSide, // Essential as OBJ contains ribbon sheets
  });
  
  const objLoader = new OBJLoader();
  
  // Load Cateye10.obj - the detailed 4-vane swirl
  objLoader.load('/cateye/Cateye10.obj', (obj) => {
    // 1. Assign materials and enable shadow mapping
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = cateyeMaterial;
        child.castShadow = true;
        child.receiveShadow = true;
        
        // Force compute vertex normals if missing, to ensure smooth shading
        child.geometry.computeVertexNormals();
      }
    });
    
    // 2. Programmatically center and scale OBJ to fit perfectly inside the 1.0 sphere
    const box = new THREE.Box3().setFromObject(obj);
    const boxSize = box.getSize(new THREE.Vector3());
    const boxCenter = box.getCenter(new THREE.Vector3());
    
    // Position geometry at origin of parent group
    obj.position.sub(boxCenter);
    
    // Scale model so it sits nicely inside the sphere core (diameter ~0.95 of 2.0)
    const maxDim = Math.max(boxSize.x, boxSize.y, boxSize.z);
    const scaleFactor = 0.95 / maxDim;
    obj.scale.set(scaleFactor, scaleFactor, scaleFactor);
    
    // 3. Add to scene
    cateyeInnerGroup.add(obj);
  }, 
  (xhr) => {
    console.log(`Loading OBJ: ${Math.round((xhr.loaded / xhr.total) * 100)}%`);
  },
  (err) => {
    console.error('Error loading OBJ file:', err);
  });
}

// --------------------------------------------------------------------------
// Window Events
// --------------------------------------------------------------------------

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

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  
  const time = clock.getElapsedTime();
  
  // 1. Slow, realistic rotation of the entire glass marble (shell + vanes)
  if (marbleGroup) {
    marbleGroup.rotation.y = time * 0.25;
    marbleGroup.rotation.x = time * 0.12;
    
    // Slow float height oscillation above the floor
    marbleGroup.position.y = Math.sin(time * 0.85) * 0.05;
  }
  
  // 2. Render pass
  controls.update();
  renderer.render(scene, camera);
}

// --------------------------------------------------------------------------
// Launch Page
// --------------------------------------------------------------------------

window.addEventListener('DOMContentLoaded', () => {
  init();
  animate();
});
