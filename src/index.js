'use strict';

const THREE = require('three');
const SimplexNoise = require('simplex-noise');
const seedrandom = require('seedrandom');
const unitShader = require('./unitShader.js');
const bargeJSON = require('./barge.js').bargeJSON;
const uniqueTerrain = require('./uniqueTerrain.js').uniqueTerrain;
const sets = require('./terrainSets.js').terrainSets;
const heightMap = require('./heightMap.js').heightMap;
const tiles = require('./tiles.js');

const config = {
  floatSize: 4,
  textureWidth: 4096,
  textureHeight: 4096,
  testWidth: 200,
  testHeight: 150,
  logWidth: 200,
  logHeight: 150,
  tileWidth: 32,
  tileHeight: 32,
  mapWidthInTiles: 32,
  mapHeightInTiles: 32,
  mapWidthIn3DUnits: 64,
  mapHeightIn3DUnits: 64,
  numTilesX: 64,
  numTilesY: 95,
};
// Terrain has width, height and depth.
// Depth is the Y axis, i.e. up and down.
config.mapWidthInPixels = config.tileWidth * config.mapWidthInTiles;
config.mapHeightInPixels = config.tileWidth * config.mapHeightInTiles;
config.quadVertexShader = `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;
const C = 50;
config.cameraPosition = new THREE.Vector3(-C, C, -C);

const prelude = function() {
  // Global PRNG: set Math.random.
  seedrandom('hello.', { global: true });
};

const fatal = function(msg) {
  document.body.innerHTML = '<h1>' + msg + '</h1>';
}

const setupRenderer = function(width, height, renderOpts) {
  // Set some camera attributes.
  const VIEW_ANGLE = 45;
  const ASPECT = width / height;
  const NEAR = 0.1;
  const FAR = 10000;

  // Get the DOM element to attach to
  const container = document.body;

  // Create a WebGL renderer, camera
  // and a scene
  const renderer = new THREE.WebGLRenderer(renderOpts);
  if ( ! renderer.capabilities.isWebGL2 &&
     ! renderer.extensions.get( "OES_texture_float" ) ) {
    fatal("No OES_texture_float support for float textures.");
    return;
  }

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
  renderer.setSize(width, height);

  // Attach the renderer-supplied
  // DOM element.
  container.appendChild(renderer.domElement);

  return {
    camera: camera,
    container: container,
    scene: scene,
    renderer: renderer,
    canvas: renderer.domElement,
    rendererWidth: width,
    rendererHeight: height
  };
};

const setupQuad = function(setup, width, height, vertexShader, fragmentShader, texture) {
  const quad = new THREE.PlaneGeometry(2.0, 2.0);

  const material =
    new THREE.ShaderMaterial(
      {
        uniforms: {
          resolution: { value: new THREE.Vector2(width, height) },
          texture: { value: texture }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        depthWrite: false,
        depthTest: false
      }
    );
  setup.quadMaterial = material;

  const mesh = new THREE.Mesh(quad, material);

  setup.quadScene = new THREE.Scene();
  //setup.quadScene.add(setup.camera);
  setup.quadScene.add(mesh);

  return setup;
};

const setupTerrainQuad = function(setup) {
  const vertexShader = config.quadVertexShader;

  const fragmentShader = `
uniform vec2 resolution;
uniform vec2 tileSizeRelativeToTexture;
uniform vec2 pixelSizeRelativeToTexture;
uniform vec2 mapSizeInTiles;
uniform sampler2D texture;
uniform sampler2D tileIndexTexture;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  
  // TODO: rounding to nearest tile?
  vec2 tileIndexUV = floor(uv * mapSizeInTiles) / mapSizeInTiles;
  vec4 tileIndex = texture2D(tileIndexTexture, tileIndexUV);
  
  // TODO: rounding to nearest pixel?
  vec2 tileOffset = fract(uv * mapSizeInTiles);

  vec2 tileUV = tileIndex.xy * tileSizeRelativeToTexture + tileOffset * tileSizeRelativeToTexture;
  //tileUV.y = 1.0 - tileUV.y;
  vec4 color = texture2D(texture, tileUV);
  gl_FragColor = color;
}
`;

  setupQuad(setup, config.mapWidthInPixels, config.mapHeightInPixels, vertexShader, fragmentShader, setup.tileTexture);
  return setup;
};

const setupScreenCopyQuad = function(setup, texture) {
  const vertexShader = config.quadVertexShader;

  const fragmentShader = `
uniform vec2 resolution;
uniform sampler2D texture;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 color = texture2D(texture, uv);
  gl_FragColor = color;
}
`;

  setup = setupQuad(setup, setup.rendererWidth, setup.rendererHeight, vertexShader, fragmentShader, texture);
  setup.screenCopyQuadScene = setup.quadScene;
  setup.screenCopyQuadMaterial = setup.quadMaterial;
  return setup;
};

const getTerrainTileSet = function(chosenSet) {
  let validTerrain = [];
  const keys = Object.keys(uniqueTerrain);
  const uniqueWater = {};
  const uniqueGround = {};
  for (let i = 0; i < keys.length; i++) {
    if (uniqueTerrain[keys[i]].includes('water')) {
      uniqueWater[keys[i]] = uniqueTerrain[keys[i]];
    } else {
      uniqueGround[keys[i]] = uniqueTerrain[keys[i]];
    }
  }
  const waterKeys = Object.keys(uniqueWater);
  const groundKeys = Object.keys(uniqueGround);
  const tset = [];
  //const choose = k => k[Math.floor(Math.random() * k.length)];
  //const chosenSet = choose(sets);
  const randomTerrain = false;
  for (let i = 0; i < 6; i++) {
    const key =
      randomTerrain ?
        (i === 0 ?
          choose(waterKeys) :
          choose(groundKeys)) :
        chosenSet[i];
    const xy = key.split("X");
    // Note that xy is reversed. YxX. It was a mistake made earlier.
    const x = parseInt(xy[1]);
    const y = parseInt(xy[0]);
    const p = [x, y];
    tset.push(key);
    console.log(key, uniqueTerrain[key], p[0], p[1]);
    validTerrain.push(p);
  }
  console.log(JSON.stringify(tset));
  return validTerrain;
};

const getTerrainHeightSub = function(x, y) {
  // TODO: optimize?
  const scale = 1.0;
  const xscale = scale / config.mapWidthInTiles;
  const yscale = scale / config.mapHeightInTiles;
  const xs = Math.floor(x * xscale);
  const ys = Math.floor(y * yscale);
  const ret = (simplex.noise2D(x, y) + 1.0) / 2.0;
  return ret;
};

const getTerrainHeight = function(x, y) {
  const ret = heightMap[config.mapWidthInTiles - 1 - y][x] / 256.0;
  return ret;
}

const renderTerrain2D = function(setup) {
  setup = setupTerrainQuad(setup);
  setup.terrainQuadScene = setup.quadScene;
  setup.terrainQuadMaterial = setup.quadMaterial;
  setup.tileIndexTextureData = new Float32Array(config.mapWidthInTiles * config.mapHeightInTiles * config.floatSize);
  const dt = setup.tileIndexTextureData;

  // Fill in terrain indices
  // TODO: terrain set as parameter
  const validTerrain = getTerrainTileSet(sets[16]);
  console.log(validTerrain);
  for (let x = 0; x < config.mapWidthInTiles; x++) {
    for (let y = 0; y < config.mapHeightInTiles; y++) {
      // TODO: check that it works for rectangular map
      const stride = (y * config.mapHeightInTiles + x) * config.floatSize;
      const height = getTerrainHeight(x, y);
      const tile = validTerrain[Math.floor(height * validTerrain.length)];
      dt[stride + 0] = tile[0];
      dt[stride + 1] = tile[1];
      //dt[stride + 0] = Math.floor(Math.random() * config.numTilesX);
      //dt[stride + 1] = Math.floor(Math.random() * config.numTilesY);
      dt[stride + 2] = 0;
      dt[stride + 3] = 0;
    }
  }

  const ti =
    new THREE.DataTexture(setup.tileIndexTextureData, config.mapWidthInTiles, config.mapHeightInTiles, THREE.RBGAFormat, THREE.FloatType);
  ti.minFilter = THREE.NearestFilter;
  ti.magFilter = THREE.NearestFilter;
  setup.terrainQuadMaterial.uniforms.tileIndexTexture = { value: ti };
  setup.terrainQuadMaterial.uniforms.tileSizeRelativeToTexture =
    { value: new THREE.Vector2(config.tileWidth / config.textureWidth, config.tileHeight / config.textureHeight ) };
  setup.terrainQuadMaterial.uniforms.pixelSizeRelativeToTexture =
    { value: new THREE.Vector2(1.0 / config.textureWidth, 1.0 / config.textureHeight ) };
  setup.terrainQuadMaterial.uniforms.mapSizeInTiles = { value: new THREE.Vector2(config.mapWidthInTiles, config.mapHeightInTiles) };
  setup.terrainRenderTarget = new THREE.WebGLRenderTarget(config.mapHeightInPixels, config.mapWidthInPixels);
  setup.terrainRenderTarget.texture.anisotropy = setup.renderer.capabilities.getMaxAnisotropy();
  return setup;
};

const main = function(texture) {
  prelude();

  document.body.style = 'margin: 0px; padding: 0px; overflow: hidden;';

  let setup = setupRenderer(window.innerWidth, window.innerHeight, {});
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.anisotropy = 0;
  texture.flipY = false;
  setup.tileTexture = texture;
  setup = renderTerrain2D(setup);
  setup = setupScreenCopyQuad(setup, setup.terrainRenderTarget.texture);

  setup.renderer.setRenderTarget(setup.terrainRenderTarget);
  setup.renderer.render(setup.terrainQuadScene, setup.camera);

  const geo = new THREE.PlaneGeometry(config.mapWidthIn3DUnits, config.mapHeightIn3DUnits);
  const material = new THREE.MeshStandardMaterial({ map: setup.terrainRenderTarget.texture });
  const mesh = new THREE.Mesh(geo, material);
  setup.scene.add(mesh);
  mesh.rotation.x = -Math.PI / 2.0;
  mesh.rotation.z = -Math.PI / 2.0;
  setup.scene.add(new THREE.AmbientLight(0xFFFFFFF));

  setup.camera.position.set(config.cameraPosition.x, config.cameraPosition.y, config.cameraPosition.z);
  const scene = setup.scene;
  setup.camera.lookAt(new THREE.Vector3(scene.position.x, scene.position.y - 12, scene.position.z));

  function update() {
    setup.renderer.setRenderTarget(null);
    //setup.renderer.render(setup.screenCopyQuadScene, setup.camera);
    setup.renderer.render(setup.scene, setup.camera);
    requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
};

const mainOld = function() {
  prelude();

  const setup = setupRenderer(window.innerWidth, window.innerHeight, {});
  const camera = setup.camera;
  const scene = setup.scene;
  const renderer = setup.renderer;

  // Set up the plane vars
  const SIZE = 32;

  const XSEGMENTRES = 32;
  const YSEGMENTRES = 32;
  const XSEGMENTS = 32 * XSEGMENTRES;
  const YSEGMENTS = 32 * YSEGMENTRES;

  const XUNITS = 32;
  const YUNITS = 32;

  const tileSize = 32;

  const textureWidth = config.textureWidth;
  const textureHeight = config.textureHeight;

  const xf = tileSize / textureWidth;
  const yf = tileSize / textureHeight;
  const xc = 14 * xf;
  const yc = 10 * yf;

  const tilesX = 64;
  const tilesY = 95;

  // Create a buffer with color data
  const dataTextureSize = XSEGMENTS * YSEGMENTS;
  const dataTextureSizeUnits = XUNITS * YUNITS;
  const data = new Float32Array(config.floatSize * dataTextureSize);
  const dataUnits = new Float32Array(config.floatSize * dataTextureSizeUnits);

  const randomTerrain = false;

  let validTerrain = [];
  const keys = Object.keys(uniqueTerrain);
  const uniqueWater = {};
  const uniqueGround = {};
  for (let i = 0; i < keys.length; i++) {
    if (uniqueTerrain[keys[i]].includes('water')) {
      uniqueWater[keys[i]] = uniqueTerrain[keys[i]];
    } else {
      uniqueGround[keys[i]] = uniqueTerrain[keys[i]];
    }
  }
  const waterKeys = Object.keys(uniqueWater);
  const groundKeys = Object.keys(uniqueGround);
  const tset = [];
  const choose = k => k[Math.floor(Math.random() * k.length)];
  //const chosenSet = choose(sets);
  const chosenSet = sets[16];
  for (let i = 0; i < 6; i++) {
    const key =
      randomTerrain ?
        (i === 0 ?
          choose(waterKeys) :
          choose(groundKeys)) :
        chosenSet[i];
    const xy = key.split("X");
    const y = parseInt(xy[0]);
    const x = parseInt(xy[1]);
    const p = [x * 32 + 1, y * 32 + 1];
    tset.push(key);
    console.log(key, uniqueTerrain[key], p[0], p[1]);
    validTerrain.push(p);
  }
  console.log(JSON.stringify(tset));

  const sf2 = function(x, y) {
    const scale = 2.0 * 1.0 / XSEGMENTS;
    const ret = (simplex.noise2D(x * scale, y * scale) + 1.0) / 2.0;
    return ret;
  };

  const sf = function(x, y) {
    const scale = 1.0 / (XSEGMENTS / XSEGMENTRES);
    const xmax = XSEGMENTS / XSEGMENTRES - 1;
    const xs = Math.min(xmax, Math.floor(x * scale));
    const ys = Math.min(xmax, Math.floor(y * scale));
    const ret = heightMap[ys][xs] / 256.0;
    const ret2 = sf2(x, y);
    return ret * 0.7 + ret2 * 0.3;
  }

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
    // Tile brightness
    /*
    if (i == 0) {
      data[stride + 3] = 1.0;
    } else {
      data[stride + 3] = 0.0;
    }
    */
  }

  for (let i = 0; i < dataTextureSizeUnits; i++) {
    const stride = i * 4;
    dataUnits[stride] = Math.floor(Math.random() * tilesX) * xf;
    // dataUnits[stride + 1] = Math.floor(Math.random() * tilesY) * yf;
    dataUnits[stride + 1] = (60 + Math.floor(Math.random() * 10)) * yf;
  }

  // used the buffer to create a DataTexture
  const dataTexture = new THREE.DataTexture(data, XSEGMENTS, YSEGMENTS, THREE.RGBAFormat, THREE.FloatType);
  dataTexture.minFilter = THREE.NearestFilter;
  dataTexture.magFilter = THREE.NearestFilter;
  const dataTextureUnits = new THREE.DataTexture(dataUnits, XUNITS, YUNITS, THREE.RGBAFormat, THREE.FloatType);
  dataTextureUnits.minFilter = THREE.NearestFilter;
  dataTextureUnits.magFilter = THREE.NearestFilter;
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

      vPosition = pos; // vec3(pos.x, height + legoHeight, pos.y);
      // vPosition = vec3(pos.x * 2.0 / mapSize.x + 1.0, color.z + legoHeight / hmul, pos.z * 2.0 / mapSize.y + 1.0);

      vec2 dx = vec2(1.0, 0.0);
      vec2 dy = vec2(0.0, 1.0);
      uvIndex = (floor(vuv * sres3) + 1.0 * dx) / sres3 + 0.5 / sres3;
      float h1 = hmul2 * texture2D(mapIndex, uvIndex).z;
      // Lego
      float d1 = length(fract((vuv + dx / mapSize * 2.0) * segments * 2.0) - vec2(0.5)) < length(vec2(0.25)) ? legoHeight : 0.0;
      h1 += h1 * d1 * 3.0;
      uvIndex = (floor(vuv * sres3) + 1.0 * dy) / sres3 + 0.5 / sres3;
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
      vNormal = normalize(cross(v1, v2));
      vNormal += normal;

      // Hide gaps caused by anisotropy
      // pos -= 0.5 * sign(pos);

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

      vec4 index = texture2D(mapIndex, uvIndex + indexOffset);
      //index = vec2(0.0, 14.0) * tileSizeOnTexture;
      index.y = 1.0 - index.y;

      vec2 uv = fract(vuv * segments);
      uv = vUvOffset;
      //uv = fract(uv + index.w * vec2(time));
      // Fix vertical slopes
      // uv.x = fract(uv + vPosition.y / 10.0 * segments).x;

      vec2 uvRel0to1 = uv;

      vec2 uvRel = uvRel0to1 * tileSizeOnTexture;


      vec4 color = getTilePixel(index.xy, uvRel);
      //color.rgb *= index.w;


      const float lightSpeed = 2.0;
      const float lightCount = 16.0;
      vec4 lcolor = vec4(vec3(0.0), color.a);
      // TODO: uniform
      float dirLight = max(0.0, (dot(vNormal, normalize(vec3(-0.65, 1.0, -0.65)))));
      //dirLight *= (0.5 + ((sin(vPosition.x) + 1.0) / 2.0 + (sin(vPosition.z) + 1.0) / 2.0) / 2.0);
      //dirLight /= pow(length(vPosition), 2.0) * 0.2;
      const float r = 1.0;

      /*
      for (float dx = -r; dx <= r; dx += 1.0) {
        for (float dy = -r; dy <= r; dy += 1.0) {
          vec3 floorPos = vPosition;
          vec3 lightPos = vec3(0.0);
          vec2 lightIndex =
            fract(
              (vec2(dx, dy) +
               vec2(
                 floor(floorPos.x * lightCount),
                 floor(floorPos.z * lightCount)) / lightCount));
          // lightIndex = vec2(rand(lightIndex), rand(lightIndex.yx));
          float t = lightSpeed * rand(lightIndex) * time;
          lightPos.xz += lightIndex + vec2(cos(t), sin(t)) / lightCount;
          //lightPos.xz *= mapSize;
          //floorPos.xz *= mapSize;
          for (float dz = 1.0; dz <= 1.0; dz += 1.0) {
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
      lcolor.rgb *= 40.0;
      lcolor.rgb += color.rgb * pow(dirLight, 20.0) * 1.5;
      */
      // lcolor.rgb += color.rgb * pow(dirLight, 4.0) * 3.0 * 5.0;
      lcolor.rgb += color.rgb * pow(dirLight, 1.0) * 1.5;

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
        fragmentShader: fragmentShader
      });



  const unitMaterial =
    new THREE.ShaderMaterial(
      {
        uniforms: {
          time: { value: 1.0 },
          hmul: { value: hmul },
          resolution: { value: new THREE.Vector2() },
          segments: { value: new THREE.Vector2(XUNITS, YUNITS) },
          segmentsRes: { value: new THREE.Vector2(XUNITS, YUNITS) },
          //tileSizeOnTexture: { value: new THREE.Vector2(tileSize / textureWidth, tileSize / textureHeight) },
          tileSizeOnTexture: { value: new THREE.Vector2(tileSize / textureWidth, tileSize / textureHeight) },
          map: { value: texture },
          heightIndex: { value: dataTexture },
          mapIndex: { value: dataTextureUnits },
          mapSize: { value: new THREE.Vector2(SIZE, SIZE) }
        },
        vertexShader: unitShader.vertexShader,
        fragmentShader: unitShader.fragmentShader,
        depthTest: true
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

    new THREE.MeshLambertMaterial());


  const sz = 1.0;

  const protoBox =
    new THREE.BoxGeometry(
        sz, sz, sz,
        //XSEGMENTRES, 1.0, YSEGMENTRES);
        1.0, 1.0, 1.0);

  const geo = new THREE.Geometry();

  /*
  for (let i = 0; i < protoBox.faceVertexUvs[0].length; i++) {
    const uv = protoBox.faceVertexUvs[0][i];
    console.log(uv[0], uv[1], uv[2]);
  }
  */

  // scene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 10), new THREE.MeshLambertMaterial()));

  const xMax = XSEGMENTS / XSEGMENTRES;
  const yMax = YSEGMENTS / YSEGMENTRES;
  for (let x = 0; x <= xMax; x++) {
    for (let y = 0; y <= yMax; y++) {
      for (let depth = 0; depth <= 2; depth++) {
        //const mesh = new THREE.Mesh(protoBox, planeMaterial);
        const mesh = new THREE.Mesh(protoBox, new THREE.MeshLambertMaterial());
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
  //const plane = new THREE.Mesh(geo, new THREE.MeshLambertMaterial());

  plane2.rotation.x = -Math.PI / 2.0;
  plane2.rotation.z = -Math.PI / 2.0;

  // Finally, add the plane to the scene.
  scene.add(plane);
  //scene.add(plane2);



  const C = 28;
  camera.position.set(-C, C, -C);



  // Merge unit quads



  const sz2 = 0.5;

  const protoQuad =
    new THREE.PlaneGeometry(
        sz2, sz2,
        1.0, 1.0);

  /*
  const protoMesh = new THREE.Mesh(protoQuad, new THREE.MeshBasicMaterial());
  const protoQuad = new THREE.Geometry();
  protoMesh.rotation.x = -Math.PI / 2.0;
  protoMesh.rotation.z = -Math.PI / 2.0;
  protoQuad.mergeMesh(protoMesh);
  */

  const geo2 = new THREE.Geometry();

  /*
  for (let i = 0; i < protoBox.faceVertexUvs[0].length; i++) {
    const uv = protoBox.faceVertexUvs[0][i];
    console.log(uv[0], uv[1], uv[2]);
  }
  */

  // scene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 10), new THREE.MeshLambertMaterial()));

  /*
  const lookMesh = new THREE.Mesh(protoQuad, new THREE.MeshBasicMaterial());
  lookMesh.lookAt(camera.position);
  */

  for (let x = 0; x <= xMax; x += 2) {
    for (let y = 0; y <= yMax; y += 2) {
      //const mesh = new THREE.Mesh(protoBox, planeMaterial);
      const mesh = new THREE.Mesh(protoQuad, new THREE.MeshLambertMaterial());
      mesh.position.x = (x - 0.0 / 2.0) * SIZE / xMax - SIZE / 2.0;
      mesh.position.z = 3.0 + (hmul * sf(x * XSEGMENTRES, y * YSEGMENTRES));
      mesh.position.y = (y - 0.0 / 2.0) * SIZE / yMax - SIZE / 2.0;
      /*
      mesh.scale.x = SIZE / xMax;
      mesh.scale.y = 1.0;
      mesh.scale.z = SIZE / yMax;
      */
      mesh.scale.x = 1.0;
      mesh.scale.y = 1.0;
      mesh.scale.z = 1.0;
      /*
      mesh.rotation.x = lookMesh.rotation.x;
      mesh.rotation.y = lookMesh.rotation.y;
      mesh.rotation.z = lookMesh.rotation.z;
      */
      // mesh.rotation.x = -Math.PI / 2.0;
      // mesh.rotation.y = Math.PI / 2.0;
      // mesh.rotation.z = -Math.PI / 2.0;
      geo2.mergeMesh(mesh);
    }
  }


  //const units = new THREE.Mesh(geo2, new THREE.MeshStandardMaterial());
  const units = new THREE.Mesh(geo2, unitMaterial);

  //scene.add(units);


  camera.lookAt(new THREE.Vector3(plane.position.x, plane.position.y - 2, plane.position.z));

  const ambient = new THREE.AmbientLight(0xFFFFFF);
  //scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0xFFFFFF);

  dirLight.position.set(-0.65, 1.0, -0.65);
  dirLight.lookAt(scene.position);

  scene.add(dirLight);

  const loader = new THREE.ObjectLoader();

  const bargeProto = loader.parse(bargeJSON);

  for (let i = 0; i < 10; i++) {
    const barge = bargeProto.clone();
    const bsc = 0.2;
    barge.scale.set(bsc, bsc, bsc);
    barge.position.x = -15.0 + 3.0 * i;
    barge.position.y = 3.0;
    barge.position.z = -15.0;
    barge.rotation.y = Math.PI / 2.0;
    plane.add(barge);
  }

  // Draw!
  renderer.render(scene, camera);


  function update () {
    // Draw!
    const t = performance.now() / 100.0;
    planeMaterial.uniforms.time.value = performance.now() / 1000.0;
    unitMaterial.uniforms.time.value = performance.now() / 1000.0;
    const c = 0.001;
    //plane.rotation.y += c; // * Math.sin(t);
    //units.rotation.y += c; // * Math.sin(t);
    renderer.render(scene, camera);

    // Schedule the next frame.
    requestAnimationFrame(update);
  }

  // Schedule the first frame.
  requestAnimationFrame(update);
};


// TEST PART: COMMON FUNCTIONS

const testPixelEqual = function(buffer, bx, by, tr, tg, tb, ta) {
  const stride = (by * config.textureWidth + bx) * config.floatSize;
  const r = buffer[stride + 0];
  const g = buffer[stride + 1];
  const b = buffer[stride + 2];
  const a = buffer[stride + 3];
  //const color = new THREE.Color(r, g, b, a).convertLinearTo;
  const c = x => Math.floor(x * 255);
  const result =
    "Pixel equality test:" +
    "x: " + bx +
    ", y: " + by +
    ", r: " + c(r) + " should be " + c(tr) +
    ", g: " + c(g) + " should be " + c(tg) +
    ", b: " + c(b) + " should be " + c(tb) +
    ", a: " + c(a) + " should be " + c(ta);
  const threshold = 1 / 255;
  const success =
    Math.abs(r - tr) <= threshold &&
    Math.abs(g - tg) <= threshold &&
    Math.abs(b - tb) <= threshold &&
    Math.abs(a - ta) <= threshold;
  return {
    text: result,
    success: success
  };
};

const testPixelEqualBuffer = function(dataBuffer, pixelBuffer, bx, by) {
  const stride = (by * config.textureWidth + bx) * config.floatSize;
  const eps = 1.0e-6;
  const r = dataBuffer[stride + 0];
  const g = dataBuffer[stride + 1];
  const b = dataBuffer[stride + 2];
  const a = dataBuffer[stride + 3];
  if (dataBuffer[stride] === -1.0) {
    return {
      text: '',
      success: true
    };
  }
  return testPixelEqual(pixelBuffer, bx, by, r, g, b, a);
};

const combineResults = function(a, b) {
  const oneEmpty = a.text === '' || b.text === '';
  return {
    text: a.text + (oneEmpty ? "" : "<br/>") + b.text,
    success: a.success && b.success
  };
};

const reportResults = function(setup, testResult) {
  const dataURL = setup.canvas.toDataURL();

  const h1 = document.createElement('h1');

  document.body.appendChild(h1);

  h1.innerHTML = 'Texture Render Test';

  const groupResult = document.createElement('div');

  groupResult.style = "display: inline; position: relative; top: -" + config.logHeight * 0.5 + "px;";

  document.body.appendChild(groupResult);

  const testResultElement = document.createElement('span');

  const testResultIcon = document.createElement('img');

  if (testResult.success) {
    testResultElement.innerHTML = ' Test OK: ' + testResult.text;
    testResultIcon.src = "art/images/icons/ok.svg";
  } else {
    testResultElement.innerHTML = ' Test FAIL: ' + testResult.text;
    testResultIcon.src = "art/images/icons/fail.svg";
  }

  testResultIcon.height = 20;

  groupResult.appendChild(testResultIcon);

  groupResult.appendChild(testResultElement);

  const img = document.createElement('img');

  document.body.appendChild(img);

  img.src = dataURL;
  img.width = config.logWidth;
  img.height = config.logHeight;
};

// TEST PART: ACTUAL TESTS

const TestTileTexture = {
  test: function(setup) {
    const bx = config.textureWidth * 0.5;
    const by = config.textureHeight * 0.5;
    const testResult1 = testPixelEqualBuffer(setup.tileTextureBuffer, setup.renderBuffer, bx, by);
    const testResult2 = testPixelEqualBuffer(setup.tileTextureBuffer, setup.renderBuffer, config.textureWidth - 1, config.textureHeight - 1);
    let testResult = combineResults(testResult1, testResult2);
    for (let bx = 0; bx < config.textureWidth; bx++) {
      for (let by = 0; by < config.textureHeight; by++) {
        const newTestResult = testPixelEqualBuffer(setup.tileTextureBuffer, setup.renderBuffer, bx, by);
        testResult = combineResults(testResult, newTestResult);
        if (testResult.success) {
          testResult.text = '';
        } else {
          break;
        }
      }
    }
    if (testResult.success) {
      //testResult.text = 'All ' + config.textureWidth + "x" + config.textureHeight + ' pixels passed: ';
    }
    return testResult;
  }
};

// TEST PART: TEST SETUP

// Unused function. Might be useful for avoiding loading tile image png.
const setupTestTexture = function(setup, width, height) {
  const dataTextureSize = width * height;
  const dataTextureBuffer = new Float32Array(config.floatSize * dataTextureSize);

  for (let i = 0; i < dataTextureSize; i++) {
    const stride = i * config.floatSize;
    const x = i % height;
    const y = Math.floor(i / height);
    dataTextureBuffer[stride] = x / width;
    dataTextureBuffer[stride + 1] = y / height;
    dataTextureBuffer[stride + 2] = 0;
    dataTextureBuffer[stride + 3] = 1;
  }

  const dataTexture =
    new THREE.DataTexture(dataTextureBuffer, config.textureWidth, config.textureHeight, THREE.RGBAFormat, THREE.FloatType);

  setup.tileTextureSize = dataTextureSize;
  setup.tileTextureBuffer = dataTextureBuffer;
  setup.tileTexture = dataTexture;

  return setup;
};

const setupTileTexture = function(setup, width, height, texture) {
  const dataTextureSize = width * height;
  const dataTextureBuffer = new Float32Array(config.floatSize * dataTextureSize);

  for (let i = 0; i < dataTextureSize; i++) {
    const stride = i * config.floatSize;
    const x = i % height;
    const y = Math.floor(i / height);
    // -1.0 means don't check this pixel when testing
    dataTextureBuffer[stride] = -1.0;
    dataTextureBuffer[stride + 1] = -1.0;
    dataTextureBuffer[stride + 2] = -1.0;
    dataTextureBuffer[stride + 3] = -1.0;
  }

  setup.tileTextureSize = dataTextureSize;
  setup.tileTextureBuffer = dataTextureBuffer;
  setup.tileTexture = texture;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.anisotropy = 0;
  texture.flipY = false;

  return setup;
};

const setupTestTileTexture = function(setup) {
  setup.testTileTextureBuffer = new Float32Array(config.floatSize * config.tileWidth * config.tileHeight);
  setup.testTileTexture = new THREE.DataTexture(setup.testTileTextureBuffer, config.tileWidth, config.tileHeight, THREE.RGBAFormat, THREE.FloatType);
  setup.testTileTexture.minFilter = THREE.NearestFilter;
  setup.testTileTexture.magFilter = THREE.NearestFilter;
  setup.testTileTexture.anisotropy = 0;
  setup.testTileTexture.flipY = false;
  return setup;
};

const setupTestQuad = function(setup, width, height) {
  const vertexShader = config.quadVertexShader;

  const fragmentShader = `
uniform vec2 resolution;
uniform sampler2D texture;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 color = texture2D(texture, uv);
  gl_FragColor = color;
}
`;

  return setupQuad(setup, width, height, vertexShader, fragmentShader, setup.tileTexture);
};

const setupRenderTarget = function(setup, width, height) {
  // setup.renderTarget = new THREE.WebGLRenderTarget(width, height);
  setup.renderTarget =
    new THREE.WebGLRenderTarget(width, height, {
			wrapS: THREE.ClampToEdgeWrapping,
			wrapT: THREE.ClampToEdgeWrapping,
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter,
			format: THREE.RGBAFormat,
			type: ( /(iPad|iPhone|iPod)/g.test( navigator.userAgent ) ) ? THREE.HalfFloatType : THREE.FloatType,
			stencilBuffer: false,
			depthBuffer: false
		});
  setup.renderTarget.texture.minFilter = THREE.NearestFilter;
  setup.renderTarget.texture.magFilter = THREE.NearestFilter;
  setup.renderBuffer = new Float32Array(config.floatSize * width * height);
  return setup;
};

const render = function(setup, scene, width, height) {
  setup.renderer.setSize(width, height);
  setup.renderer.setRenderTarget(null);
  setup.renderer.render(scene, setup.camera);

  setup.renderer.setRenderTarget(setup.renderTarget);
  setup.renderer.render(scene, setup.camera);
  setup.renderer.readRenderTargetPixels(setup.renderTarget, 0, 0, width, height, setup.renderBuffer);

  // Note: must be done after render. Can as well just be hidden I guess.
  setup.canvas.style =
    "width: " + config.testWidth + "px;" +
    "height: " + config.testHeight + "px;";
};

const loadTileToTexture = function(setup, buffer, data, xoffset, yoffset, textureWidth, textureHeight, scale) {
  for (let y = 0; y < data.length; y++) {
    for (let x = 0; x < data[y].length; x++) {
      const stride = ((y + yoffset) * textureWidth + (x + xoffset)) * config.floatSize;
      const xRev = x;
      const yRev = y;
      const r = data[yRev][xRev][0] / scale;
      const g = data[yRev][xRev][1] / scale;
      const b = data[yRev][xRev][2] / scale;
      const a = data[yRev][xRev][3] / scale;
      //const color = new THREE.Color(r, g, b).convertLinearToGamma().convertSRGBToLinear();
      const color = new THREE.Color(r, g, b);
      //const color = new THREE.Color(r, g, b).convertSRGBToLinear();
      //const color = new THREE.Color(r, g, b).convertSRGBToLinear().convertLinearToGamma();
      //const color = new THREE.Color(r, g, b).convertLinearToSRGB().convertLinearToGamma();
      //const color = new THREE.Color(r, g, b).convertLinearToSRGB().convertLinearToGamma();
      const c = x => Math.floor(x * 255);
      //console.log(c(r), c(g), c(b), c(a), c(color.r), c(color.g), c(color.b), c(a));
      //const color = new THREE.Color(r, g, b).convertLinearToSRGB();
      buffer[stride + 0] = color.r;
      buffer[stride + 1] = color.g;
      buffer[stride + 2] = color.b;
      // buffer[stride + 3] = data[yRev][xRev][3] / scale;
      buffer[stride + 3] = a;
    }
  }
  return setup;
};

const reloadBufferTileToTexture =
  function(
    setup, buffer, xoffset, yoffset, textureWidth, textureHeight,
    buffer2, buffer2XOffset, buffer2YOffset, textureWidth2, textureHeight2, scale) {
  for (let y = 0; y < config.tileHeight; y++) {
    for (let x = 0; x < config.tileWidth; x++) {
      const stride = ((y + yoffset) * textureWidth + (x + xoffset)) * config.floatSize;
      const stride2 = ((y + buffer2YOffset) * textureWidth2 + (x + buffer2XOffset)) * config.floatSize;
      buffer[stride + 0] = buffer2[stride2 + 0] / scale;
      buffer[stride + 1] = buffer2[stride2 + 1] / scale;
      buffer[stride + 2] = buffer2[stride2 + 2] / scale;
      buffer[stride + 3] = buffer2[stride2 + 3] / scale;
    }
  }
  return setup;
};

// TEST PART: TEST RUNNER

const test = function(texture, testTileTexture) {
  prelude();

  let setup = setupRenderer(config.textureWidth, config.textureHeight, { preserveDrawingBuffer: true });
  setup = setupTileTexture(setup, config.textureWidth, config.textureHeight, texture);

  const cobalt_stone_11_xtile = 41;
  const cobalt_stone_11_ytile = 14;
  setup =
    loadTileToTexture(
      setup,
      setup.tileTextureBuffer,
      tiles.cobalt_stone_11,
      cobalt_stone_11_xtile * config.tileWidth,
      cobalt_stone_11_ytile * config.tileHeight,
      config.textureWidth,
      config.textureHeight,
      255);

  setup = setupTestTileTexture(setup);
  // Set test tile
  // TODO: make function to set default texture properties
  setup.testTileTexture = testTileTexture;
  setup.testTileTexture.minFilter = THREE.NearestFilter;
  setup.testTileTexture.magFilter = THREE.NearestFilter;
  setup.testTileTexture.anisotropy = 0;
  setup.testTileTexture.flipY = false;
  /*
  setup =
    loadTileToTexture(
      setup,
      setup.testTileTextureBuffer,
      tiles.cobalt_stone_11,
      0,
      0,
      config.tileWidth,
      config.tileHeight,
      255);
      */

  setup = setupTestQuad(setup, config.textureWidth, config.textureHeight);
  setup = setupRenderTarget(setup, config.textureWidth, config.textureHeight);

  render(setup, setup.quadScene, config.textureWidth, config.textureHeight);
  const testResult = { text: 'No test ', success: true };
  // TestTileTexture.test(setup);
  reportResults(setup, testResult);

  const renderBufferCopy = Float32Array.from(setup.renderBuffer);
  //console.log(setup.testTileTextureBuffer);

  // Now render the test tile
  setup = setupRenderTarget(setup, config.tileWidth, config.tileHeight);
  setup.quadMaterial.uniforms.texture.value = setup.testTileTexture;
  setup.quadMaterial.uniforms.resolution.value = new THREE.Vector2(config.tileWidth, config.tileHeight);
  // render(setup, setup.quadScene, config.textureWidth, config.textureHeight);
  render(setup, setup.quadScene, config.tileWidth, config.tileHeight);

  // Load the rendered test tile into buffer for pixel equality comparison.
  // Rendering the test tile avoids pixel comparison issues with PNG sRGB <->
  // linear colorspace conversion, gamma <-> linear conversion and other stuff
  // that Chrome, WebGL and Three.js does behind our backs. Vaguely.
  setup =
    reloadBufferTileToTexture(
      setup,
      setup.tileTextureBuffer,
      cobalt_stone_11_xtile * config.tileWidth,
      cobalt_stone_11_ytile * config.tileHeight,
      config.textureWidth,
      config.textureHeight,
      setup.renderBuffer,
      0,
      0,
      config.tileWidth,
      config.tileHeight,
      1);

  // Restore the first renderBuffer
  setup.renderBuffer = renderBufferCopy;
  const testResult2 = TestTileTexture.test(setup);
  reportResults(setup, testResult2);


  // Now render the test tile from the output of the first render
  setup = setupTestTileTexture(setup);
  setup =
    reloadBufferTileToTexture(
      setup,
      setup.testTileTextureBuffer,
      0,
      0,
      config.tileWidth,
      config.tileHeight,
      renderBufferCopy,
      cobalt_stone_11_xtile * config.tileWidth,
      cobalt_stone_11_ytile * config.tileHeight,
      config.textureWidth,
      config.textureHeight,
      1);

  const c = x => Math.floor(x * 255);
  //console.log(setup.testTileTextureBuffer.map(x => c(x)));
  //console.log(setup.testTileTextureBuffer);

  setup.quadMaterial.uniforms.texture.value = setup.testTileTexture;
  render(setup, setup.quadScene, config.tileWidth, config.tileHeight);
  //const testResult3 = TestTileTexture.test(setup);
  const testResult3 = { text: 'No test ', success: true };
  reportResults(setup, testResult3);

  /*
  const testBox = new THREE.BoxGeometry(2.0, 2.0);
  const testMesh = new THREE.Mesh(testBox, new THREE.MeshBasicMaterial(0xFFFFFF));
  setup.scene.add(testMesh);
  setup.scene.add(new THREE.AmbientLight(0xFFFFFF));
  setup.camera.position.z = 0;
  setup.camera.lookAt(testMesh.position);
  */
};

try {
  if (window.location.href.includes("#test")) {
    const texture =
      new THREE.TextureLoader().load('art/images/ProjectUtumno_full_4096.png', texture => {
        new THREE.TextureLoader().load('art/images/testTile-index41x14.png', testTileTexture => {
          test(texture, testTileTexture);
        })
      });
  } else {
    const texture =
      new THREE.TextureLoader().load('art/images/ProjectUtumno_full_4096.png', texture => main(texture));
  }
} catch (error) {
  throw(error);
  document.body.innerHTML = '<pre>' + error.stack + '</pre>';
}
