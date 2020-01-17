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

const textureWidth = 4096;
const textureHeight = 4096;

const xf = tileSize / textureWidth;
const yf = tileSize / textureHeight;
const xc = 14 * xf;
const yc = 10 * yf;

const tilesX = 64;
const tilesY = 95;

// Create a buffer with color data
const dataTextureSize = XSEGMENTS * YSEGMENTS;
const data = new Float32Array(4 * dataTextureSize);

const validTerrainX = [];

for (let i = 11; i < 39; i++) {
  if (i === 20 || i === 21) {
    continue;
  }
  validTerrainX.push(i * xf);
}

for (let i = 0; i < dataTextureSize; i++) {
	const stride = i * 4;
	//data[stride] = Math.floor(Math.random() * tilesX) * xf;
	data[stride] = validTerrainX[Math.floor(Math.random() * validTerrainX.length)];
	//data[stride + 1] = (2 + Math.floor(Math.random() * 8)) * yf;
	data[stride + 1] = 10 * yf;
	//data[stride] = 0.0;
	//data[stride + 1] = (Math.floor(500.0 / 32.0) - 1.0) * yf;
	data[stride + 2] = 0;
	data[stride + 3] = 0;
}

// used the buffer to create a DataTexture
const dataTexture = new THREE.DataTexture(data, XSEGMENTS, YSEGMENTS, THREE.RGBAFormat, THREE.FloatType);
dataTexture.minFilter = THREE.NearestFilter;
dataTexture.magFilter = THREE.NearestFilter;
//dataTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

const texture = new THREE.TextureLoader().load('art/images/ProjectUtumno_full_4096.png' );

/*
texture.wrapS = THREE.RepeatWrapping;
texture.wrapT = THREE.RepeatWrapping;
texture.offset.x = xc;
texture.offset.y = yc;
texture.repeat.x = tileSize / textureWidth;
texture.repeat.y = tileSize / textureHeight;
texture.minFilter = THREE.LinearFilter;
texture.magFilter = THREE.LinearFilter;
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
  uniform vec2 segments;
  uniform sampler2D mapIndex;
  uniform sampler2D map;

  varying vec2 vUv;

  vec4 getTilePixel(vec2 index, vec2 uvRel) {
    const vec2 tileSize = vec2(1.0 / 32.0);
    // Assumes texture resized to width * width

    vec2 uvRounded = uvRel;
    uvRounded /= tileSizeOnTexture * tileSize;
    uvRounded.y *= 31.0 / 32.0;
    uvRounded = floor(uvRounded) + vec2(0.5, 0.5);
    uvRounded /= tileSize;
    uvRounded = floor(uvRounded);
    uvRounded *= tileSizeOnTexture * tileSize * tileSize;
    //float fac = 1.0 / tileSize;
    //uvRounded = clamp(uvRounded, fac * tileSizeOnTexture, (1.0 - fac) * tileSizeOnTexture);

    vec2 uvIndex = index;
    uvIndex /= tileSizeOnTexture * tileSize;
    uvIndex = floor(uvIndex);
    uvIndex /= tileSize;
    uvIndex = floor(uvIndex);
    uvIndex *= tileSizeOnTexture * tileSize * tileSize;

    uvRounded += uvIndex;
    //uvRounded.y += 0.5 * tileSizeOnTexture.y * tileSize.y;

    vec4 color = texture2D(map, uvRounded);
    color = color * color.a;
    return color;
  }

  vec4 getTile(vec2 vuv) {
    const vec2 tileSize = vec2(1.0 / 32.0);

    vec2 uvIndex = floor(vuv * segments) / segments;

    vec2 indexOffset = vec2(0.5) / segments;

    vec2 uv = fract(vuv * segments);

    vec2 uvRel0to1 = uv;

    vec2 uvRel = uvRel0to1 * tileSizeOnTexture;

    vec2 index = texture2D(mapIndex, uvIndex + indexOffset).xy;
    //index = vec2(0.0, 14.0) * tileSizeOnTexture;
    index.y = 1.0 - index.y;

    vec4 color = getTilePixel(index, uvRel);

    return color;
  }

  void main( void ) {

    vec4 color = getTile(vUv);
    gl_FragColor = color; // (1.0 + facX + facY);
    return;

    vec2 uv = fract(vUv * segments);

    float d = 0.1;
    float d2 = 0.01;
    vec2 uv2 = vec2(0.0);
    if (uv.x <= d) {
      uv2 = floor(vUv * segments) - vec2(1.0, 0.0) + vec2(d2, uv.y);
      color = mix(color, getTile(uv2), 0.5);
    }
    if (1.0 - uv.x <= d) {
      uv2 = floor(vUv * segments) + vec2(1.0, 0.0) + vec2(-d2, uv.y);
      color = mix(color, getTile(uv2), 0.5);
    }
    if (uv.y <= d) {
      uv2 = floor(vUv * segments) - vec2(0.0, 1.0) + vec2(uv.x, d2);
      color = mix(color, getTile(uv2), 0.5);
    }
    if (1.0 - uv.y <= d) {
      uv2 = floor(vUv * segments) + vec2(0.0, 1.0) + vec2(uv.x, -d2);
      color = mix(color, getTile(uv2), 0.5);
    }

    d = 1.0 / segments.x / 32.0;
    d = 0.1;
    float dx = d * min(abs(1.0 - uv.x), abs(uv.x));
    float dy = d * min(abs(1.0 - uv.y), abs(uv.y));

    vec4 colorXP = getTile(vUv + vec2(dx, 0.0));
    vec4 colorYP = getTile(vUv + vec2(0.0, dy));

    float fac = 0.1;
    color = mix(color, colorXP, fac * dx);
    color = mix(color, colorYP, fac * dy);

    gl_FragColor = color; // (1.0 + facX + facY);
  }
`;

const planeMaterial =
  new THREE.ShaderMaterial(
    {
      uniforms: {
        time: { value: 1.0 },
        resolution: { value: new THREE.Vector2() },
        segments: { value: new THREE.Vector2(XSEGMENTS, YSEGMENTS) },
        //tileSizeOnTexture: { value: new THREE.Vector2(tileSize / textureWidth, tileSize / textureHeight) },
        tileSizeOnTexture: { value: new THREE.Vector2(tileSize / textureWidth, tileSize / textureHeight) },
        map: { value: texture },
        mapIndex: { value: dataTexture }
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      transparent: true
    });

// Create a new mesh with
// plane geometry - we will cover
// the planeMaterial next!
const plane = new THREE.Mesh(

  new THREE.PlaneBufferGeometry(
    SIZE,
    SIZE,
    1.0,
    1.0),

  planeMaterial);

plane.rotation.x = -Math.PI / 2.0;
plane.rotation.z = -Math.PI / 2.0;

// Finally, add the plane to the scene.
scene.add(plane);

const C = 100;
camera.position.set(-C, C, -C);
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
