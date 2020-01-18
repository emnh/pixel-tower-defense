const THREE = require('three');
const SimplexNoise = require('simplex-noise');

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
const SIZE = 32;

const XSEGMENTRES = 32;
const YSEGMENTRES = 32;
const XSEGMENTS = 32 * XSEGMENTRES;
const YSEGMENTS = 32 * YSEGMENTRES;

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

/*
for (let i = 11; i < 39; i++) {
  if (i === 20 || i === 21) {
    continue;
  }
  validTerrainX.push(i * xf);
}
*/
validTerrain = [
  [50, 757],
  [366, 305],
  [465, 305],
  [495, 305],
  [693, 237],
  [1328, 464]
];
/*
for (let xi = 8; xi < 2048; xi += 32) {
  for (let yi = 8; yi < 3040; yi += 32) {
    validTerrain.push([xi, yi]);
  }
}
*/

const sf = function(x, y) {
  const scale = 4.0 * 1.0 / XSEGMENTS;
  const ret = (simplex.noise2D(x * scale, y * scale) + 1.0) / 2.0;
  return ret;
};

const simplex = new SimplexNoise();
for (let i = 0; i < dataTextureSize; i++) {
	const stride = i * 4;
	//data[stride] = Math.floor(Math.random() * tilesX) * xf;
	//data[stride] = validTerrainX[Math.floor(Math.random() * validTerrainX.length)];
  const x = i % YSEGMENTS;
  const y = Math.floor(i / YSEGMENTS);
  const x2 = Math.floor(x * XSEGMENTS / XSEGMENTRES); // / (XSEGMENTS / XSEGMENTRES);
  const y2 = Math.floor(y * YSEGMENTS / YSEGMENTRES); // / (YSEGMENTS / YSEGMENTRES);
  const height = sf(x, y);
  const height2 = sf(x / YSEGMENTRES, y / YSEGMENTRES); //2 * (XSEGMENTS / XSEGMENTRES);
  const height3 = sf(y / YSEGMENTRES, x / YSEGMENTRES); //2 * (YSEGMENTS / YSEGMENTRES);
  const tile = validTerrain[Math.floor(height * validTerrain.length)];
  //const tile = [height2 * tilesX * tileSize, height3 * tilesY * tileSize];
	data[stride] = Math.ceil(tile[0] / tileSize) * xf;
	data[stride + 1] = Math.ceil(tile[1] / tileSize) * yf;
	//data[stride + 1] = (2 + Math.floor(Math.random() * 8)) * yf;
	//data[stride + 1] = 10 * yf;
	//data[stride] = 0.0;
	//data[stride + 1] = (Math.floor(500.0 / 32.0) - 1.0) * yf;
	data[stride + 2] = height;
  // Tile brightess
  if (tile == validTerrain[0]) {
    data[stride + 3] = 2.0;
  } else {
    data[stride + 3] = 1.0;
  }
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
//texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

// create the plane's material
/*
const planeMaterial =
  new THREE.MeshLambertMaterial(
    {
      map: texture
    });
*/
const vertexShader = `
  uniform float time;
  uniform vec2 tileSizeOnTexture;
  uniform vec2 segments;
  uniform vec2 segmentsRes;
  uniform vec2 mapSize;
  uniform sampler2D mapIndex;
  uniform sampler2D map;
  uniform float hmul;

  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec2 vUv;
  varying vec2 vUvOffset;

  float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
  }

  void main()
  {
    vec3 pos = position;

    vec2 vuv = uv / segmentsRes + (pos.xz / mapSize + vec2(0.5));
    vUvOffset = uv;
    //vec2 buv = pos.xz / mapSize + vec2(0.5);

    pos = (modelMatrix * vec4(pos, 1.0)).xyz;

    vec2 sres = segments;
    vec2 sres2 = segments * 1.0;
    vec2 sres3 = sres2;
    vec2 uvIndex = floor(vuv * sres) / sres + 0.5 / sres;
    vec2 uvIndex2 = floor(vuv * sres2) / sres2 + 0.5 / sres2;
    const float hmul2 = 5.0;

    vec4 color = texture2D(mapIndex, uvIndex);
    vec4 color2 = texture2D(mapIndex, uvIndex2);
    float height = hmul2 * (color.z + color2.z);
    // Lego
    float legoHeight = 0.0;
    float d = length(fract(vuv * segments * 2.0) - vec2(0.5)) < length(vec2(0.25)) ? legoHeight : 0.0;
    height += d;
    //pos.y += height;
    height = pos.y;

    vUv = vuv;

    vPosition = vec3(vuv.x, height / hmul2 + legoHeight / hmul2, vuv.y);
    // vPosition = vec3(pos.x * 2.0 / mapSize.x + 1.0, color.z + legoHeight / hmul, pos.z * 2.0 / mapSize.y + 1.0);

    vec2 dx = vec2(1.0, 0.0);
    vec2 dy = vec2(0.0, 1.0);
    uvIndex = (floor(vuv * sres3) + 32.0 * dx) / sres3 + 0.5 / sres3;
    float h1 = hmul2 * texture2D(mapIndex, uvIndex).z;
    // Lego
    float d1 = length(fract((vuv + dx / mapSize * 2.0) * segments * 2.0) - vec2(0.5)) < length(vec2(0.25)) ? legoHeight : 0.0;
    h1 += h1 * d1 * 3.0;
    uvIndex = (floor(vuv * sres3) + 32.0 * dy) / sres3 + 0.5 / sres3;
    float h2 = hmul2 * texture2D(mapIndex, uvIndex).z;
    // Lego
    float d2 = length(fract((vuv + dy / mapSize * 2.0) * segments * 2.0) - vec2(0.5)) < length(vec2(0.25)) ? legoHeight : 0.0;
    h2 += h2 * d2 * 3.0;

    //vNormal = normalize(vec3(0.0, 1.0, 0.0));
    float hmfac = 1.0;
    vec3 v1 = vec3(dx.x, (h1 - height) * hmfac , dx.y);
    vec3 v2 = vec3(dy.x, (h2 - height) * hmfac, dy.y);
    vec3 v12 = vec3(dx.x, h1 , dx.y);
    vec3 v22 = vec3(dy.x, h2, dy.y);
    /*
    if (height / hmul2 < 0.5) {
      vNormal = -0.95 * normalize(cross(v12, v22));
    } else {
      vNormal = -normalize(cross(v1, v2));
    }
    */
    vNormal = -normalize(cross(v1, v2));

    vec4 mvPosition = viewMatrix * vec4(pos, 1.0);

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  uniform float time;
  uniform vec2 tileSizeOnTexture;
  uniform vec2 segments;
  uniform vec2 segmentsRes;
  uniform vec2 mapSize;
  uniform sampler2D mapIndex;
  uniform sampler2D map;

  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec2 vUv;
  varying vec2 vUvOffset;

  float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
  }

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

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

    vec2 uvIndex = floor(vuv * segmentsRes) / segmentsRes;

    vec2 indexOffset = vec2(0.5) / segmentsRes;

    vec2 uv = fract(vuv * segments);
    uv = vUvOffset;
    // Fix vertical slopes
    // uv.x = fract(uv + vPosition.y / 10.0 * segments).x;

    vec2 uvRel0to1 = uv;

    vec2 uvRel = uvRel0to1 * tileSizeOnTexture;

    vec4 index = texture2D(mapIndex, uvIndex + indexOffset);
    //index = vec2(0.0, 14.0) * tileSizeOnTexture;
    index.y = 1.0 - index.y;

    vec4 color = getTilePixel(index.xy, uvRel);
    color.rgb *= index.w;

    const float lightSpeed = 2.0;
    const float lightCount = 16.0;
    vec4 lcolor = vec4(vec3(0.0), color.a);
    float dirLight = max(0.0, (dot(vNormal, normalize(vec3(-1.0, 1.0, -1.0)))) * 1.0);
    const float r = 4.0;
    for (float dx = -r; dx <= r; dx += 1.0) {
      for (float dy = -r; dy <= r; dy += 1.0) {
        vec3 floorPos = vPosition;
        vec3 lightPos = vec3(0.0);
        vec2 lightIndex = fract((vec2(dx, dy) + vec2(floor(floorPos.x * lightCount), floor(floorPos.z * lightCount))) / lightCount);
        float t = lightSpeed * rand(lightIndex) * time;
        lightPos.xz = lightIndex + vec2(cos(t), sin(t)) / lightCount;
        //lightPos.xz *= mapSize;
        //floorPos.xz *= mapSize;
        for (float dz = 0.0; dz <= 2.0; dz += 1.0) {
          //floorPos.y = dz - 0.1;
          lightPos.y = dz + 0.15 * (sin(t) + 1.0);
          vec3 lightDir = length(lightPos - floorPos) > 0.0 ? normalize(lightPos - floorPos) : vec3(0.0);

          float d = distance(lightPos, floorPos) * 2.0 / max(0.1, dz) + 0.5;
          float k = 4.0;
          d = pow(d, k) * pow(6.0, k) * 1.0;
          float light = max(0.0, dot(vNormal, lightDir)) / d;
          vec2 rl = abs(lightIndex * 0.4902 + 0.4325);
          //vec3 lightColor = abs(vec3(rand(1.9523 * rl), 1.0 * rand(0.24982 * rl), rand(1.324 * rl)));
          vec3 lightColor = hsv2rgb(vec3(rand(rl), 1.0, 1.0));
          lightColor.g *= 0.75;
          vec3 newColor = (color.rgb * 2.0 + vec3(1.0)) * (vec3(2.0) + lightColor) * ((1.0 + 1.0 * dirLight) * (1.5e-5 + light));
          lcolor.rgb += newColor * lightColor;
        }
      }
    }
    lcolor.rgb *= 20.0;
    lcolor.rgb += color.rgb * pow(dirLight, 20.0) * 1.5;
    float maxHeight = 2.0;
    // lcolor.rgb += 0.5 * color.rgb * dirLight * (maxHeight - min(maxHeight, abs(maxHeight - vPosition.y)));
    //lcolor.rgb *= lcolor.rgb * dirLight;

    return lcolor;
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

const hmul = 4.0;
const planeMaterial =
  new THREE.ShaderMaterial(
    {
      uniforms: {
        time: { value: 1.0 },
        hmul: { value: hmul },
        resolution: { value: new THREE.Vector2() },
        segments: { value: new THREE.Vector2(XSEGMENTS / XSEGMENTRES, YSEGMENTS / YSEGMENTRES) },
        segmentsRes: { value: new THREE.Vector2(XSEGMENTS, YSEGMENTS) },
        //tileSizeOnTexture: { value: new THREE.Vector2(tileSize / textureWidth, tileSize / textureHeight) },
        tileSizeOnTexture: { value: new THREE.Vector2(tileSize / textureWidth, tileSize / textureHeight) },
        map: { value: texture },
        mapIndex: { value: dataTexture },
        mapSize: { value: new THREE.Vector2(SIZE, SIZE) }
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      transparent: true
    });

// Create a new mesh with
// plane geometry - we will cover
// the planeMaterial next!
const plane2 = new THREE.Mesh(

  new THREE.PlaneBufferGeometry(
    SIZE,
    SIZE,
    XSEGMENTS,
    YSEGMENTS),

  planeMaterial);

const protoBox =
  new THREE.BoxGeometry(
      1.0, 1.0, 1.0,
      //XSEGMENTRES, 1.0, YSEGMENTRES);
      1.0, 1.0, 1.0);

const geo = new THREE.Geometry();

for (let i = 0; i < protoBox.faceVertexUvs[0].length; i++) {
  const uv = protoBox.faceVertexUvs[0][i];
  console.log(uv[0], uv[1], uv[2]);
}

const xMax = XSEGMENTS / XSEGMENTRES;
const yMax = YSEGMENTS / YSEGMENTRES;
for (let x = 0; x <= xMax; x++) {
  for (let y = 0; y <= yMax; y++) {
    for (let depth = 0; depth <= 2; depth++) {
      const mesh = new THREE.Mesh(protoBox, planeMaterial);
      mesh.position.x = x * SIZE / xMax - SIZE / 2.0;
      mesh.position.y = depth + (hmul * sf(x * XSEGMENTRES, y * YSEGMENTRES));
      mesh.position.z = y * SIZE / yMax - SIZE / 2.0;
      mesh.scale.x = SIZE / xMax;
      mesh.scale.y = 1.0;
      mesh.scale.z = SIZE / yMax;
      //mesh.rotation.x = -Math.PI / 2.0;
      mesh.rotation.y = Math.PI / 2.0;
      //mesh.rotation.z = -Math.PI / 2.0;
      geo.mergeMesh(mesh);
    }
  }
}

const plane = new THREE.Mesh(geo, planeMaterial);

//plane.rotation.x = -Math.PI / 2.0;
//plane.rotation.z = -Math.PI / 2.0;

// Finally, add the plane to the scene.
scene.add(plane);

const C = 25;
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
  planeMaterial.uniforms.time.value = performance.now() / 2000.0;
  const c = 0.001;
  plane.rotation.y += c;
  renderer.render(scene, camera);

  // Schedule the next frame.
  requestAnimationFrame(update);
}

// Schedule the first frame.
requestAnimationFrame(update);
