const THREE = require('three');

// Set the scene size.
const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;

// Set some camera attributes.
const VIEW_ANGLE = 45;
const ASPECT = WIDTH / HEIGHT;
const NEAR = 0.1;
const FAR = 10000;

// Get the DOM element to attach to
const container = document.body;

// Create a WebGL renderer, camera
// and a scene
const renderer = new THREE.WebGLRenderer();
const camera =
    new THREE.PerspectiveCamera(
        VIEW_ANGLE,
        ASPECT,
        NEAR,
        FAR
    );

const scene = new THREE.Scene();

// Add the camera to the scene.
scene.add(camera);

// Start the renderer.
renderer.setSize(WIDTH, HEIGHT);

// Attach the renderer-supplied
// DOM element.
container.appendChild(renderer.domElement);

// Set up the plane vars
const SIZE = 128;

const XSEGMENTS = 64;
const YSEGMENTS = 64;

const tileSize = 32;

const textureWidth = 2048;
const textureHeight = 3040;

const xf = tileSize / textureWidth;
const yf = tileSize / textureHeight;
const xc = 14 * xf;
const yc = 10 * yf;

const tilesX = 64;
const tilesY = 95;

// Create a buffer with color data
const dataTextureSize = XSEGMENTS * YSEGMENTS;
const data = new Float32Array(4 * dataTextureSize);

for (let i = 0; i < dataTextureSize; i++) {
	const stride = i * 4;
	data[stride] = Math.floor(Math.random() * tilesX) * xf;
	data[stride + 1] = (2 + Math.floor(Math.random() * 8)) * yf;
	data[stride + 2] = 0;
	data[stride + 3] = 0;
}

// used the buffer to create a DataTexture
const dataTexture = new THREE.DataTexture(data, XSEGMENTS, YSEGMENTS, THREE.RGBAFormat, THREE.FloatType);

const texture = new THREE.TextureLoader().load('art/images/ProjectUtumno_full.png' );

/*
texture.wrapS = THREE.RepeatWrapping;
texture.wrapT = THREE.RepeatWrapping;
texture.offset.x = xc;
texture.offset.y = yc;
texture.repeat.x = tileSize / textureWidth;
texture.repeat.y = tileSize / textureHeight;
*/
texture.minFilter = THREE.NearestFilter;
texture.magFilter = THREE.NearestFilter;
texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

// create the plane's material
/*
const planeMaterial =
  new THREE.MeshLambertMaterial(
    {
      map: texture
    });
*/
const vertexShader = `
  varying vec2 vUv;

  void main()
  {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  uniform float time;
  uniform vec2 tileSizeOnTexture;
  uniform vec2 tileSizeOnPlane;
  uniform vec2 segments;
  uniform sampler2D mapIndex;
  uniform sampler2D map;

  varying vec2 vUv;

  void main( void ) {

    vec2 uvIndex = floor(vUv * segments) / segments;

    vec2 uvRel = (vUv - uvIndex) * tileSizeOnPlane;

    vec2 index = texture2D(mapIndex, uvIndex).xy;
    index.y = 1.0 - index.y;

    vec4 color = texture2D(map, index + uvRel);

    gl_FragColor = color;

  }
`;

const planeMaterial =
  new THREE.ShaderMaterial(
    {
      uniforms: {
        time: { value: 1.0 },
        resolution: { value: new THREE.Vector2() },
        segments: { value: new THREE.Vector2(XSEGMENTS, YSEGMENTS) },
        tileSizeOnTexture: { value: new THREE.Vector2(tileSize / textureWidth, tileSize / textureHeight) },
        tileSizeOnPlane: { value: new THREE.Vector2(XSEGMENTS / SIZE, YSEGMENTS / SIZE) },
        map: { value: texture },
        mapIndex: { value: dataTexture }
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader
    });

// Create a new mesh with
// plane geometry - we will cover
// the planeMaterial next!
const plane = new THREE.Mesh(

  new THREE.PlaneBufferGeometry(
    SIZE,
    SIZE,
    XSEGMENTS,
    YSEGMENTS),

  planeMaterial);

plane.rotation.x = -Math.PI / 2.0;
plane.rotation.z = -Math.PI / 2.0;

// Finally, add the plane to the scene.
scene.add(plane);

camera.position.set(-100, 100, -100);
camera.lookAt(plane.position);

const ambient = new THREE.AmbientLight(0xFFFFFF);
scene.add(ambient);

// create a point light
const pointLight =
  new THREE.PointLight(0xFFFFFF);

// set its position
pointLight.position.x = 0;
pointLight.position.y = 0;
pointLight.position.z = 0;

// add to the scene
scene.add(pointLight);

// Draw!
renderer.render(scene, camera);


function update () {
  // Draw!
  renderer.render(scene, camera);

  // Schedule the next frame.
  requestAnimationFrame(update);
}

// Schedule the first frame.
requestAnimationFrame(update);
