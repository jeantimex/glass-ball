import * as THREE from 'three';
import './style.css';

// --------------------------------------------------------------------------
// WebGL2 Shader Program Configuration
// --------------------------------------------------------------------------

// The exact GLSL code from the Shadertoy page, configured for GLSL 300 es
const fragmentShaderSource = `
precision highp float;
precision highp int;

// Shadertoy standard uniform declarations
uniform float iTime;
uniform vec3 iResolution;
uniform vec4 iMouse;
uniform sampler2D iChannel1;
uniform samplerCube iChannel0;

// Output variable for GLSL 300 es (Three.js provides gl_FragColor compatibility wrapper, but we declare it to be safe)
out vec4 pc_fragColor;
#define gl_FragColor pc_fragColor

// --- Start of Shadertoy Shader Code (view/4ljXD3) ---
vec3 sunDir = normalize(vec3(0.0,0.3,1.0));
float refractratio = 1.5;
float heightAboveGround = 2.0;

// rotate camera
#define pee 3.141592653
vec3 pos;
vec3 dir;
 
vec3 backGround2() // unused checkerboard
{
	if (dir.y>0.0) return vec3(1,1,1);
	vec2 floorcoords = pos.xz + dir.xz*(-pos.y/dir.y);
	vec2 t = (fract(floorcoords.xy*0.5))-vec2(0.5,0.5);
	return vec3(1,1,1) - vec3(0.6,0.3,0)*float(t.x*t.y>0.0);
}

vec3 sky(vec3 dir)
{
	float f = max(dir.y,0.0);
	vec3 color = 1.0-vec3(1,0.85,0.7)*f;
	color *= (dir.z*0.2+0.8)*1.7;
	
	if (dot(sunDir,dir)>0.0)
	{
	 f = max(length(cross(sunDir,dir))*10.0,1.0);
		
	 color += vec3(1,0.9,0.7)*40.0/(f*f*f*f);
	}
	return color;
	
}

vec3 backGround(vec3 dir) // sky and floor texture with fog
{
 	if (dir.y>=0.0) return sky(dir);
 	vec3 raypos2 = pos - dir*((pos.y+heightAboveGround) / dir.y);
	float fog = exp(length(raypos2)/-20.0);
    
    float sunshadow = 1.0;
    
    if (length(cross(  raypos2-vec3(0.,1.,0.),sunDir))<1.0) sunshadow=0.6;
    
 	return sky(dir)*(1.0-fog)+(sunshadow*texture(iChannel1,raypos2.xz/8.0).xyz*0.6)*fog;
}

vec3 backGround3(vec3 dir) 
{
    vec3 td = texture(iChannel0, dir).xyz;
	return td * pow(length(td)*sqrt(1.0/3.0),1.);
}


vec3 rotatex(vec3 v,float anglex)
{
	float t;
	t =   v.y*cos(anglex) - v.z*sin(anglex);
	v.z = v.z*cos(anglex) + v.y*sin(anglex);
	v.y = t;
	return v;
}

vec3 rotcam(vec3 v)
{
    float anglex = sin((iTime-3.0)*0.3)*0.5+0.15;
    float angley = iTime*0.2-1.0;
    
    if (iMouse.x!=0.0) // use mouse only if user has clicked the screen
    {
    	anglex = (0.5 - iMouse.y/iResolution.y)*pee*1.2; // mouse cam
    	angley = (-iMouse.x/iResolution.x+0.5)*pee*2.0;
    }

	float t;
	v = rotatex(v,anglex);
	
	t = v.x * cos(angley) - v.z*sin(angley);
	v.z = v.z*cos(angley) + v.x*sin(angley);
	v.x = t;
	return v;
}

float side; // 1 for raytracing outside glass,  -1 for raytracing inside glass



vec3 glassColorFunc(float dist) // exponentioanly turn light green as it travels inside glass (real glass has this porperty)
{
    dist*=0.6;
	return vec3(exp(dist*-0.4),exp(dist*-0.1),exp(dist*-0.2));
}


vec3 intersectPos;
vec3 intersectNormal;

float intersectsphere(vec3 center,float rad)
{
    vec3 rp = pos-center;
    rp/=rad;
    rp -= dir*dot(dir,rp);
    if (length(rp)>1.0) return 0.;
    
    float goback = sqrt(1.0-dot(rp,rp));
    rp -= side*dir*goback;
    
    vec3 ip = rp*rad + center;
    
    if (dot(dir,ip-intersectPos)<0.0) // check if this is the closest intersection
    { 
        intersectNormal = rp;
    	intersectPos = ip;
    }
    return 1.;
}

vec3 get()
{
    side = 1.;
    vec3 colorSum = vec3(0.);
    vec3 colormul = vec3(1.);
    
    
        
    intersectPos = dir*1e10;
    if (intersectsphere(vec3(0.,1.,0.),1.0)!=0.)  // sphere hit by initial camera ray
        
    {

        vec3 outside = normalize(reflect(dir,intersectNormal));
        float f=min(1.-dot(outside,intersectNormal),1.0);
        float fresnel = 0.05+0.95*pow(f,5.);

        colorSum += backGround(outside)*colormul*fresnel;
        colormul *= 1.-fresnel;
        
        side=-1.;
        pos = intersectPos;   // continue at the intersection point
        dir = refract(dir,intersectNormal,1.0/refractratio);  // light gets inside the sphere
        
        for(int p=0;p<4;p++) // bouncing inside sphere
        {
            intersectPos = dir*1e10;
            side=1.;
            for(int k=0;k<9;k++)
             intersectsphere(vec3(0.8-0.1*float(k),0.7,0.),0.1);
            
            intersectsphere(vec3(-0.3,1.3,0.),0.1);
            intersectsphere(vec3(0.5,1.4,0.),0.033);
            intersectsphere(vec3(0.5,1.6,0.),0.033);
            intersectsphere(vec3(0.2,1,0.8),0.1);
            intersectsphere(vec3(0.2,1,-0.5),0.1);
            intersectsphere(vec3(0.2,1,-0.7),0.14);

            if (length(intersectPos)<1e9)
            {
                colormul *= glassColorFunc(length(intersectPos-pos));
                colorSum += (dot(intersectNormal,sunDir)*0.5+0.5)*vec3(1.0,0.3,0.1)*colormul*0.8;
                return colorSum;
            }
            
            side=-1.;
            intersectsphere(vec3(0.,1.,0.),1.0);
            colormul *= glassColorFunc(length(intersectPos-pos));
            pos = intersectPos;
            
            vec3 outside = normalize(refract(dir,-intersectNormal ,refractratio));
            
            float f=min(1.-dot(outside,intersectNormal),1.0);
            float fresnel = 0.05+0.95*pow(f,5.);
            colorSum += backGround(outside)*colormul*(1.-fresnel);
            colormul *=fresnel;
            dir = reflect(dir,-intersectNormal);
            
        }
    }
    else return backGround(dir); // initial camera ray missed sphere, goes directly to background
    
    return colorSum;
}

		
float func(float x) // the func for HDR
{
	return x/(x+3.0)*3.0;
}
vec3 HDR(vec3 color)
{
	float powVal = length(color);
	return color * func(powVal)/powVal*1.2;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	float brightNess = min(iTime/5.0,1.0);
	vec2 uv = fragCoord.xy / iResolution.xy;
	pos = vec3(0,1.0,0);
	dir = vec3(uv*2.0-1.0,2.5);
	dir.y *= iResolution.y / iResolution.x; // dynamic aspect ratio correction
	
	dir = normalize(rotcam(dir));
    
	pos -= rotcam(vec3(0,0,5.6)); // back up from subject
    if (pos.y<-heightAboveGround) // under ground
    {
        vec3 dir2 = normalize(rotcam(vec3(0.,0.,1.)));
        pos = pos - dir2*((pos.y+heightAboveGround) / dir2.y);
    }
	
	
		
	fragColor = vec4(HDR(get()*brightNess),1.0); 
}
// --- End of Shadertoy Shader Code ---

void main() {
  mainImage(gl_FragColor, gl_FragCoord.xy);
}
`;

// --------------------------------------------------------------------------
// Ground Noise Texture Generator
// --------------------------------------------------------------------------

function createGroundNoiseTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  
  // Earthy background
  ctx.fillStyle = '#7a5a38';
  ctx.fillRect(0, 0, 512, 512);
  
  // Layer organic dirt splotches
  for (let i = 0; i < 300; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 5 + Math.random() * 30;
    
    const colors = [
      'rgba(90, 62, 38, 0.7)',
      'rgba(140, 105, 75, 0.6)',
      'rgba(60, 42, 24, 0.8)',
      'rgba(160, 130, 100, 0.4)'
    ];
    
    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Generate high-frequency noise mapping
  const imgData = ctx.getImageData(0, 0, 512, 512);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 35;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));     // Red
    data[i+1] = Math.min(255, Math.max(0, data[i+1] + noise)); // Green
    data[i+2] = Math.min(255, Math.max(0, data[i+2] + noise)); // Blue
  }
  ctx.putImageData(imgData, 0, 0);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

// --------------------------------------------------------------------------
// Application Variables & Lifecycle
// --------------------------------------------------------------------------

let scene: THREE.Scene;
let camera: THREE.OrthographicCamera;
let renderer: THREE.WebGLRenderer;
let shaderMaterial: THREE.ShaderMaterial;
let quadMesh: THREE.Mesh;

// Mouse Interaction State
const iMouse = new THREE.Vector4(0.0, 0.0, 0.0, 0.0);
let isMouseDown = false;

function init() {
  const container = document.getElementById('canvas-container')!;
  const width = container.clientWidth;
  const height = container.clientHeight;
  
  // 1. Orthographic full-screen viewport setup
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  
  // 2. WebGL Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  
  // 3. Shader Material with Uniforms
  const uniforms = {
    iTime: { value: 0.0 },
    iResolution: { value: new THREE.Vector3(width, height, 1.0) },
    iMouse: { value: iMouse },
    iChannel1: { value: createGroundNoiseTexture() },
    iChannel0: { value: null } // Passed as null, but declared inside GLSL
  };
  
  shaderMaterial = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: `
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: fragmentShaderSource,
    glslVersion: THREE.GLSL3, // Tells Three.js to construct a GLSL 3.00 es compiler target
    depthWrite: false,
    depthTest: false
  });
  
  // 4. Quad mesh spanning full viewport dimensions
  const quadGeometry = new THREE.PlaneGeometry(2, 2);
  quadMesh = new THREE.Mesh(quadGeometry, shaderMaterial);
  scene.add(quadMesh);
  
  // 5. Input Listeners
  window.addEventListener('resize', onWindowResize);
  setupMouseListeners(renderer.domElement);
  
  // Apply initial theme
  applyTheme('dark');
}

// --------------------------------------------------------------------------
// Mouse Tracker Interface (Simulating Shadertoy Click behavior)
// --------------------------------------------------------------------------

function setupMouseListeners(domElement: HTMLCanvasElement) {
  // Translate coordinate space matching Shadertoy:
  // - Origin (0,0) is at Bottom-Left of viewport
  // - Mouse drag logs current (x, y) and starting click (z, w)
  // - Mouse up makes click coordinates negative indicating state shift
  
  function getMousePos(e: MouseEvent): { x: number; y: number } {
    const rect = domElement.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: rect.bottom - e.clientY // Flip Y coordinate
    };
  }
  
  domElement.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    const pos = getMousePos(e);
    iMouse.x = pos.x;
    iMouse.y = pos.y;
    iMouse.z = pos.x;
    iMouse.w = pos.y;
  });
  
  window.addEventListener('mousemove', (e) => {
    if (!isMouseDown) return;
    const pos = getMousePos(e);
    iMouse.x = pos.x;
    iMouse.y = pos.y;
  });
  
  window.addEventListener('mouseup', () => {
    if (!isMouseDown) return;
    isMouseDown = false;
    // Mark click coords negative on release, as per Shadertoy specs
    iMouse.z = -Math.abs(iMouse.z);
    iMouse.w = -Math.abs(iMouse.w);
  });
  
  // Mobile touch support
  domElement.addEventListener('touchstart', (e) => {
    if (e.touches.length === 0) return;
    isMouseDown = true;
    const touch = e.touches[0]!;
    const rect = domElement.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const touchY = rect.bottom - touch.clientY;
    
    iMouse.x = touchX;
    iMouse.y = touchY;
    iMouse.z = touchX;
    iMouse.w = touchY;
  });
  
  window.addEventListener('touchmove', (e) => {
    if (!isMouseDown || e.touches.length === 0) return;
    const touch = e.touches[0]!;
    const rect = domElement.getBoundingClientRect();
    iMouse.x = touch.clientX - rect.left;
    iMouse.y = rect.bottom - touch.clientY;
  });
  
  window.addEventListener('touchend', () => {
    isMouseDown = false;
    iMouse.z = -Math.abs(iMouse.z);
    iMouse.w = -Math.abs(iMouse.w);
  });
}

// --------------------------------------------------------------------------
// Window Events & Theme Controllers
// --------------------------------------------------------------------------

function onWindowResize() {
  const container = document.getElementById('canvas-container')!;
  const width = container.clientWidth;
  const height = container.clientHeight;
  
  renderer.setSize(width, height);
  shaderMaterial.uniforms.iResolution.value.set(
    width,
    height,
    1.0
  );
}

function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('gb-theme', theme);
}



// --------------------------------------------------------------------------
// Render Cycle Loop
// --------------------------------------------------------------------------

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  
  // Track elapsed animation time
  shaderMaterial.uniforms.iTime.value = clock.getElapsedTime();
  
  // Sync mouse uniform
  shaderMaterial.uniforms.iMouse.value.copy(iMouse);
  
  renderer.render(scene, camera);
}

// --------------------------------------------------------------------------
// Launch Page
// --------------------------------------------------------------------------

window.addEventListener('DOMContentLoaded', () => {
  init();
  animate();
});
