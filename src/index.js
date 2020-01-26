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
const Stats = require('stats-js');
const waterWavesShader = require('./shaders/waterWaves.shader');

const config = {
  floatSize: 4,
  // This is max supported by THREE
  lightCount: 4,
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
  //waterWidthInPixels: 128,
  //waterHeightInPixels: 128,
  //waterWidthInPixels: 1024,
  //waterHeightInPixels: 1024,
  waterWidthInPixels: 1024,
  waterHeightInPixels: 1024,
  mapDetailX: 8,
  mapDetailY: 8,
  //mapDetailX: 4,
  //mapDetailY: 4,
  mapYScale: 5
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

const setDefaultTextureProperties = function(texture) {
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.anisotropy = 0;
  texture.flipY = false;
  return texture;
};

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
  if ( ! renderer.capabilities.isWebGL2 &&
     ! renderer.extensions.get( "OES_texture_half_float" ) ) {
    fatal("No OES_texture_float support for half float textures.");
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

  // Set options
  renderer.localClippingEnabled = true;

  // We want displacementMap to affect vertex positions directly, instead of using the normal
  THREE.ShaderChunk.displacementmap_vertex = `
#ifdef USE_DISPLACEMENTMAP
  vec2 dmuv = vec2(transformed.zx * displacementBias + 0.5) * vec2(1.0, 1.0);
  if (abs(transformed.y) <= 1.0e-6) {
    vec4 dtex = texture2D(displacementMap, dmuv);
    //float disp = abs(dtex.x + dtex.y + dtex.z + dtex.w) * displacementScale;
    //float disp = 0.25 * (dtex.x + dtex.y + dtex.z + dtex.w) * displacementScale;
    //float disp = (dtex.x + dtex.y) * displacementScale;
    float disp = dtex.y * displacementScale;
    transformed.y += disp;
  }
#endif
`;

  // Attach the renderer-supplied
  // DOM element.
  container.appendChild(renderer.domElement);

  const stats = new Stats();
  stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
  container.appendChild(stats.dom);

  return {
    stats: stats,
    camera: camera,
    container: container,
    scene: scene,
    renderer: renderer,
    canvas: renderer.domElement,
    rendererWidth: width,
    rendererHeight: height,
    updaters: []
  };
};

const setupQuad = function(setup, width, height, vertexShader, fragmentShader, texture) {
  const quad = new THREE.PlaneGeometry(2.0, 2.0);

  const material =
    new THREE.ShaderMaterial(
      {
        uniforms: {
          resolution: { value: new THREE.Vector2(width, height) },
          texture: { value: texture },
          frameCount: { value: -1 },
          time: { value: 0.0 },
          deltaTime: { value: 0.0 },
          accumTime: { value: 0.0 }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        depthWrite: false,
        depthTest: false
      }
    );
  setup.quadMaterial = material;
  
  const startTime = performance.now() / 1000.0;
  setup.updaters.push(function() {
    // material.uniforms.deltaTime.value = Math.max(1.0 / 30.0, performance.now() / 1000.0 - material.uniforms.time.value);
    material.uniforms.deltaTime.value = performance.now() / 1000.0 - material.uniforms.time.value;
    material.uniforms.time.value = performance.now() / 1000.0 - startTime;
    material.uniforms.frameCount.value++;
  });

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

const setupRenderTerrain2D = function(setup, chosenSet) {
  setup = setupTerrainQuad(setup);
  setup.terrainQuadScene = setup.quadScene;
  setup.terrainQuadMaterial = setup.quadMaterial;
  setup.tileIndexTextureData = new Float32Array(config.mapWidthInTiles * config.mapHeightInTiles * config.floatSize);
  const dt = setup.tileIndexTextureData;

  // Fill in terrain indices
  const validTerrain = getTerrainTileSet(chosenSet);
  console.log(validTerrain);
  for (let x = 0; x < config.mapWidthInTiles; x++) {
    for (let y = 0; y < config.mapHeightInTiles; y++) {
      // TODO: check that it works for rectangular map
      const stride = (y * config.mapWidthInTiles + x) * config.floatSize;
      const height = getTerrainHeight(x, y);
      const tile = validTerrain[Math.floor(height * validTerrain.length)];
      dt[stride + 0] = tile[0];
      dt[stride + 1] = tile[1];
      //dt[stride + 0] = Math.floor(Math.random() * config.numTilesX);
      //dt[stride + 1] = Math.floor(Math.random() * config.numTilesY);
      dt[stride + 2] = height;
      dt[stride + 3] = 0;
    }
  }

  const ti =
    new THREE.DataTexture(setup.tileIndexTextureData, config.mapWidthInTiles, config.mapHeightInTiles, THREE.RBGAFormat, THREE.FloatType);
  setDefaultTextureProperties(ti);
	//ti.wrapS = THREE.RepeatWrapping;
	//ti.wrapT = THREE.RepeatWrapping;
  setup.tileIndexTexture = ti;
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

const addPlane = function(setup, scene) {
  const geo =
    new THREE.PlaneBufferGeometry(
      config.mapWidthIn3DUnits,
      config.mapHeightIn3DUnits,
      config.mapWidthInTiles * config.mapDetailX,
      config.mapHeightInTiles * config.mapDetailY);
  const material = new THREE.MeshStandardMaterial({ map: setup.terrainRenderTarget.texture });
  material.metalness = 1.0;
  material.roughness = 0.0;
  material.refractionRatio = 1.0 / 1.333;
  const matrix =  new THREE.Matrix4().makeRotationX(-Math.PI / 2.0);
  const matrix2 =  new THREE.Matrix4().makeRotationZ(-Math.PI / 2.0);
  geo.applyMatrix(matrix2);
  geo.applyMatrix(matrix);
  const mesh = new THREE.Mesh(geo, material);
  scene.add(mesh);
  //mesh.rotation.x = -Math.PI / 2.0;
  //mesh.rotation.z = -Math.PI / 2.0;
  setup.terrainMeshWater = mesh;
  return setup;
};

const addCubes = function(setup, scene, heightScale, yScale) {
  const hmul = heightScale;

  const sz = 1.0;

  const protoBox =
    new THREE.BoxGeometry(
        sz, sz, sz,
        1.0, 1.0, 1.0);
  const protoPlane =
    new THREE.PlaneGeometry(
        sz, sz,
        1.0, 1.0);

  const geo = new THREE.Geometry();

  const uvs = [];
  for (let i = 0; i < protoBox.faceVertexUvs[0].length; i++) {
    const uv = protoBox.faceVertexUvs[0][i];
    uvs.push([{ x: uv[0].x, y: uv[0].y }, { x: uv[1].x, y: uv[1].y }, { x: uv[2].x, y: uv[2].y } ]);
    // console.log(uv, uv[0].x, uv[0].y, uv[1].x, uv[1].y, uv[2].x, uv[2].y);
  }

  // scene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 10), new THREE.MeshLambertMaterial()));

  const xMax = config.mapWidthInTiles;
  const yMax = config.mapHeightInTiles;

  const width = config.mapWidthIn3DUnits - 2;
  const height = config.mapHeightIn3DUnits - 2;

  const clipY = yScale;

  const addBox = function(proto, x, y, xd, yd, depth, maxDepth, uvWidth, uvHeight, mapDetailX, mapDetailY) {
    const mesh = new THREE.Mesh(proto, new THREE.MeshBasicMaterial());

    const remaining = Math.min(yScale, maxDepth + yScale - depth);

    for (let i = 0; i < proto.faceVertexUvs[0].length; i++) {
      const uvOrig = uvs[i];
      const uv = proto.faceVertexUvs[0][i];

      const flipX = v => (1.0 - v) + x * mapDetailX + xd;
      const flipY = v => (1.0 - v) + y * mapDetailY + yd;
      uv[0].x = (flipX(uvOrig[0].x)) * uvWidth;
      uv[0].y = (flipY(uvOrig[0].y)) * uvHeight;
      uv[1].x = (flipX(uvOrig[1].x)) * uvWidth;
      uv[1].y = (flipY(uvOrig[1].y)) * uvHeight;
      uv[2].x = (flipX(uvOrig[2].x)) * uvWidth;
      uv[2].y = (flipY(uvOrig[2].y)) * uvHeight;
    }
    mesh.scale.x = width / (xMax - 1) / Math.max(1, mapDetailX - 1);
    mesh.scale.y = yScale / Math.max(1, mapDetailX - 1);
    mesh.scale.z = height / (yMax - 1) / Math.max(1, mapDetailY - 1);
    const xpos = (x / (xMax - 1) - 0.5) * width + (xd + 0.0) * mesh.scale.x;
    const zpos = (y / (yMax - 1) - 0.5) * height + (yd + 0.0) * mesh.scale.z;
    mesh.position.x = -xpos;
    // Adjust such that the top of the box is at maxDepth
    mesh.position.y = depth - yScale * 0.5;
    mesh.position.z = zpos;
    if (proto === protoPlane) {
      mesh.position.y = 0.0;
      mesh.rotation.x = -Math.PI * 0.5;
      //mesh.rotation.z = -Math.PI * 0.5;
    }
    geo.mergeMesh(mesh);
  };

  for (let x = 0; x < xMax; x++) {
    for (let y = 0; y < yMax; y++) {
      const maxDepth = hmul * getTerrainHeight(x, y);
      //for (let depth = -2 + maxDepth % yScale; depth < maxDepth + yScale; depth += yScale) {
      for (let depth = maxDepth; depth + yScale >= -clipY; depth -= yScale) {
        /*
        if (depth === maxDepth && depth <= 0.1) {
          const uvWidth = 1.0 / (config.mapWidthInTiles * config.mapDetailX);
          const uvHeight = 1.0 / (config.mapHeightInTiles * config.mapDetailY);
          for (let xd = 0; xd < config.mapDetailX; xd++) {
            for (let yd = 0; yd < config.mapDetailY; yd++) {
              addBox(protoPlane, x, y, xd, yd, depth, maxDepth, uvWidth, uvHeight, config.mapDetailX, config.mapDetailY);
            }
          }
        }
        */
        {
          const uvWidth = 1.0 / (config.mapWidthInTiles);
          const uvHeight = 1.0 / (config.mapHeightInTiles);
          addBox(protoBox, x, y, 0, 0, depth, maxDepth, uvWidth, uvHeight, 1, 1);
        }
      }
    }
  }
  

  const material = new THREE.MeshStandardMaterial({
    map: setup.terrainRenderTarget.texture,
  });
  const waterMaterial = new THREE.MeshStandardMaterial({
    map: setup.terrainRenderTarget.texture,
    displacementMap: setup.waterRenderTarget1.texture,
    // TODO: support mapWidth != mapHeight. rectangular maps.
    displacementBias: 1.0 / config.mapWidthIn3DUnits,
    displacementScale: 1.0
  });

  material.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), clipY)];
  const bgeo = new THREE.BufferGeometry();
  bgeo.fromGeometry(geo);
  const plane = new THREE.Mesh(bgeo, material);
  plane.rotation.y = Math.PI / 2.0;
  scene.add(plane);
  setup.terrainMesh = plane;

  addPlane(setup, scene);
  setup.terrainMeshWater.material = waterMaterial;

  return setup;
};

const setupLighting = function(setup, width, height) {
  setup.lightingRenderTarget =
    new THREE.WebGLRenderTarget(width, height, {
			wrapS: THREE.RepeatWrapping,
			wrapT: THREE.RepeatWrapping,
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter,
			format: THREE.RGBAFormat,
			type: ( /(iPad|iPhone|iPod)/g.test( navigator.userAgent ) ) ? THREE.HalfFloatType : THREE.FloatType,
			stencilBuffer: false,
			depthBuffer: false
		});
  const vertexShader = config.quadVertexShader;
  const fragmentShader = `
uniform vec2 resolution;
uniform sampler2D texture;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  //vec4 color = texture2D(texture, uv);
  vec4 color = vec4(uv.x, 0.0, uv.y, 1.0);
  //color.r = pow(10.0 * (color.r + 1.0), 10.0);
  //color.b = pow(10.0 * (color.b + 1.0), 10.0);
  //color.r = 1.0 / color.r;
  //color.b = 1.0 / color.b;
  gl_FragColor = color;
}
`;

  setup = setupQuad(setup, width, height, vertexShader, fragmentShader, new THREE.Texture());
  setup.lightingScene = setup.quadScene;
  setup.lightingQuadMaterial = setup.quadMaterial;
  //setup.terrainMesh.material.lightMap = setup.lightingRenderTarget.texture;
  //setup.terrainMeshWater.material.lightMap = setup.lightingRenderTarget.texture;
  /*
  setup.terrainMesh.material.emissive = new THREE.Color(0xFFFFFF);
  setup.terrainMesh.material.emissiveMap = setup.lightingRenderTarget.texture;
  setup.terrainMeshWater.material.emissive = new THREE.Color(0xFFFFFF);
  setup.terrainMeshWater.material.emissiveMap = setup.lightingRenderTarget.texture;
  */

  /*
  const geometry = setup.terrainMesh.geometry;
  const uvs = geometry.attributes.uv.array;
  geometry.setAttribute( 'uv2', new THREE.BufferAttribute( uvs, 2 ) );
  setup.terrainMesh.geometry = geometry;
  */

  setup.updaters.push(function() {
    setup.renderer.setRenderTarget(setup.lightingRenderTarget);
    setup.renderer.render(setup.lightingScene, setup.camera);
  });
  return setup;
};

const setupWater = function(setup) {
  const width = config.waterWidthInPixels;
  const height = config.waterHeightInPixels;
  // TODO: function to get default options
  setup.waterRenderTarget1 =
    new THREE.WebGLRenderTarget(width, height, {
			wrapS: THREE.RepeatWrapping,
			wrapT: THREE.RepeatWrapping,
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter,
			format: THREE.RGBAFormat,
			type: ( /(iPad|iPhone|iPod)/g.test( navigator.userAgent ) ) ? THREE.HalfFloatType : THREE.FloatType,
			stencilBuffer: false,
			depthBuffer: false
		});
  setup.waterRenderTarget2 =
    new THREE.WebGLRenderTarget(width, height, {
			wrapS: THREE.RepeatWrapping,
			wrapT: THREE.RepeatWrapping,
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter,
			format: THREE.RGBAFormat,
			type: ( /(iPad|iPhone|iPod)/g.test( navigator.userAgent ) ) ? THREE.HalfFloatType : THREE.FloatType,
			stencilBuffer: false,
			depthBuffer: false
		});
  setup.waterRenderTargetVelocity1 =
    new THREE.WebGLRenderTarget(width, height, {
			wrapS: THREE.RepeatWrapping,
			wrapT: THREE.RepeatWrapping,
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter,
			format: THREE.RGBAFormat,
			type: ( /(iPad|iPhone|iPod)/g.test( navigator.userAgent ) ) ? THREE.HalfFloatType : THREE.FloatType,
			stencilBuffer: false,
			depthBuffer: false
		});
  setup.waterRenderTargetVelocity2 =
    new THREE.WebGLRenderTarget(width, height, {
			wrapS: THREE.RepeatWrapping,
			wrapT: THREE.RepeatWrapping,
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter,
			format: THREE.RGBAFormat,
			type: ( /(iPad|iPhone|iPod)/g.test( navigator.userAgent ) ) ? THREE.HalfFloatType : THREE.FloatType,
			stencilBuffer: false,
			depthBuffer: false
		});
  setup.waterRenderTargetTransfer =
    new THREE.WebGLRenderTarget(width, height, {
			wrapS: THREE.RepeatWrapping,
			wrapT: THREE.RepeatWrapping,
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter,
			format: THREE.RGBAFormat,
			type: ( /(iPad|iPhone|iPod)/g.test( navigator.userAgent ) ) ? THREE.HalfFloatType : THREE.FloatType,
			stencilBuffer: false,
			depthBuffer: false
		});
  setup.waterNormalsRenderTarget =
    new THREE.WebGLRenderTarget(width, height, {
			wrapS: THREE.RepeatWrapping,
			wrapT: THREE.RepeatWrapping,
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter,
			format: THREE.RGBAFormat,
			type: ( /(iPad|iPhone|iPod)/g.test( navigator.userAgent ) ) ? THREE.HalfFloatType : THREE.FloatType,
			stencilBuffer: false,
			depthBuffer: false
		});
  setup.waterColorRenderTarget =
    new THREE.WebGLRenderTarget(width, height, {
			wrapS: THREE.RepeatWrapping,
			wrapT: THREE.RepeatWrapping,
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter,
			format: THREE.RGBAFormat,
			type: ( /(iPad|iPhone|iPod)/g.test( navigator.userAgent ) ) ? THREE.HalfFloatType : THREE.FloatType,
			stencilBuffer: false,
			depthBuffer: false
		});
  //setup.waterRenderTarget1 = new THREE.WebGLRenderTarget(width, height);
  //setup.waterRenderTarget2 = new THREE.WebGLRenderTarget(width, height);
  setDefaultTextureProperties(setup.waterRenderTarget1.texture);
  setDefaultTextureProperties(setup.waterRenderTarget2.texture);
  setDefaultTextureProperties(setup.waterRenderTargetVelocity1.texture);
  setDefaultTextureProperties(setup.waterRenderTargetVelocity2.texture);
  setDefaultTextureProperties(setup.waterRenderTargetTransfer.texture);
  setDefaultTextureProperties(setup.waterNormalsRenderTarget.texture);
  setup.waterRenderTargets = [setup.waterRenderTarget1, setup.waterRenderTarget2];
  setup.waterRenderTargetVelocities = [setup.waterRenderTargetVelocity1, setup.waterRenderTargetVelocity2];

  const vertexShader = config.quadVertexShader;

  const fragmentShader = waterWavesShader;

  setupQuad(setup, width, height, vertexShader, fragmentShader, setup.waterRenderTarget1.texture);
  setup.waterQuadScene = setup.quadScene;
  setup.waterQuadMaterial = setup.quadMaterial;
  setup.waterQuadMaterial.uniforms.mapSizeInTiles = { value: new THREE.Vector2(config.mapWidthInTiles, config.mapHeightInTiles) };
  let waterFrameCount = 0;
  const material = setup.waterQuadMaterial;
  const nullTexture = setup.terrainRenderTarget.texture;
  material.uniforms.tileIndexTexture = { value: setup.tileIndexTexture };
  material.uniforms.terrainTexture   = { value: setup.terrainRenderTarget.texture };
  material.uniforms.transferTexture  = { value: nullTexture };
  material.uniforms.velocityTexture  = { value: nullTexture };
  material.uniforms.waterShaderMode  = { value: 0.0 };
  material.uniforms.waterFrameCount  = { value: waterFrameCount };
  material.uniforms.mapYScale        = { value: config.mapYScale };
  setup.updaters.push(function(frameCount) {
    material.uniforms.accumTime.value += material.uniforms.deltaTime.value;
    let fixedTime = 0.4; // milliseconds
    //let fixedTime = 16; // milliseconds
    let count = 0;
    //console.log(material.uniforms.accumTime.value);
    //while (waterFrameCount < 10000 || material.uniforms.accumTime.value >= fixedTime) {
    if (waterFrameCount < 0 || material.uniforms.accumTime.value >= fixedTime) {
      const rts = setup.waterRenderTargets;
      const wrt = rts[waterFrameCount % 2];
      const wrt2 = rts[(waterFrameCount + 1) % 2];
      const rtsV = setup.waterRenderTargetVelocities;
      const wrtV = rtsV[waterFrameCount % 2];
      const wrtV2 = rtsV[(waterFrameCount + 1) % 2];
      //setup.renderer.setSize(wrt.width, wrt.height);
      
      material.uniforms.accumTime.value -= fixedTime;
      material.uniforms.accumTime.value = Math.max(0.0, material.uniforms.accumTime.value);
      material.uniforms.texture.value = wrt2.texture;
      material.uniforms.velocityTexture.value = wrtV2.texture;

      // Render transfer
      material.uniforms.transferTexture.value = nullTexture;
      material.uniforms.waterShaderMode.value = 3.0;
      setup.renderer.setRenderTarget(setup.waterRenderTargetTransfer);
      setup.renderer.render(setup.waterQuadScene, setup.camera);

      // Render displacement
      // Depends on transfer
      material.uniforms.transferTexture.value = setup.waterRenderTargetTransfer.texture;
      material.uniforms.waterShaderMode.value = 0.0;
      setup.renderer.setRenderTarget(wrt);
      setup.renderer.render(setup.waterQuadScene, setup.camera);

      // Render velocities
      // Depends on transfer
      //material.uniforms.texture.value = wrt.texture;
      material.uniforms.velocityTexture.value = wrtV2.texture;
      material.uniforms.waterShaderMode.value = 4.0;
      setup.renderer.setRenderTarget(wrtV);
      setup.renderer.render(setup.waterQuadScene, setup.camera);

      material.uniforms.transferTexture.value = nullTexture;

      waterFrameCount++;
      material.uniforms.waterFrameCount.value = waterFrameCount;
      count++;
    }

    const rts = setup.waterRenderTargets;
    const wrt = rts[(waterFrameCount) % 2];
    const wrt2 = rts[(waterFrameCount + 1) % 2];

    // Gaussian blur of displacement
    // Depends on transfer
    material.uniforms.texture.value = wrt2.texture;
    material.uniforms.waterShaderMode.value = 5.0;
    setup.renderer.setRenderTarget(wrt);
    setup.renderer.render(setup.waterQuadScene, setup.camera);

    // Render normals
    material.uniforms.texture.value = wrt.texture;
    material.uniforms.waterShaderMode.value = 1.0;
    setup.renderer.setRenderTarget(setup.waterNormalsRenderTarget);
    setup.renderer.render(setup.waterQuadScene, setup.camera);

    // Render water surface color
    material.uniforms.waterShaderMode.value = 2.0;
    setup.renderer.setRenderTarget(setup.waterColorRenderTarget);
    setup.renderer.render(setup.waterQuadScene, setup.camera);

    // TODO: maybe relocate this line
    setup.terrainMeshWater.material.displacementMap = wrt.texture;
    //setup.terrainMeshWater.material.lightMap = setup.waterNormalsRenderTarget.texture;
    setup.terrainMeshWater.material.normalMap = setup.waterNormalsRenderTarget.texture;
    setup.terrainMeshWater.material.normalMapType = THREE.ObjectSpaceNormalMap;
    setup.terrainMeshWater.material.map = setup.waterColorRenderTarget.texture;
  });

  return setup;
};

const setupSplash = function(setup) {
  const width = 20;
  const height = 20;
  const quad = new THREE.PlaneGeometry(width, height);
  // TODO: update when camera moves
  const material = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: null }
    },
    transparent: true,
    vertexShader: `
  varying vec2 vUV;
  void main() {
    vUV = uv;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position.xy, 0.0, 1.0);
  }
`,
    fragmentShader: `
  varying vec2 vUV;
  uniform sampler2D map;
  void main() {
    vec3 color = texture2D(map, vUV).rgb;
    /*
    if (color.g > 0.1 && color.r < 0.1 && color.b < 0.1) {
      discard;
    }
    color.g *= 1.0;
    color.b *= 2.0;
    */

    vec3 gcolor = vec3(0.0, 1.0, 0.0);
    float gray = (color.r + color.g + color.b) / 3.0;
    vec3 tcolor = vec3(gray, 1.5 * gray, 2.0 * gray);
    if (length(color) < 0.3) {
      discard;
    }
    //float a = min(1.0, (1.0 - vUV.y - 0.5) * 1.0);
    float a = vUV.y < 0.25 ? vUV.y * 4.0 : 1.0;
    gl_FragColor = vec4(tcolor * a, (0.9 - dot(gcolor, color) / (length(color) + 0.05)) * 3.0 * a);
  }
`
  });
  const startTime = performance.now();
  const loadedVideos = [];
  const mclones = [];
  const count = 16;
  setup.waterQuadMaterial.uniforms.splashTime = {
    value: 0.0
  };
  for (let i = 0; i < count; i++) {
    const mclone = material.clone();
    const mesh = new THREE.Mesh(quad, mclone);
    mclones.push(mclone);

    const video = document.createElement('video');
    video.style = "display: none;";
    video.preload = 'auto';
    video.autoload = true;
    video.autoplay = true;
    video.playbackRate = 2.0;
    video.loop = true;
    // Video from https://www.youtube.com/watch?v=faz7i4lrFVI
    video.src = 'art/video/splash8.mp4';
    video.onloadstart = function(video) {
      return function() {
        loadedVideos.push(video);
        if (loadedVideos.length == count) {
          for (let i = 0; i < count; i++) {
            const video2 = loadedVideos[i];
            video2.currentTime = (15.0 / 4.0 - i / 4.0) * 0.5;
            //video2.play();

            const texture = new THREE.VideoTexture(video2);

            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.format = THREE.RGBFormat;

            mclones[i].uniforms.map.value = texture;
            // TODO: timing for each splash, not just last
            if (i == 0) {
              setup.updaters.push(function(frameCount) {
                setup.waterQuadMaterial.uniforms.splashTime.value = video2.currentTime;
              });
            }
          }
        }
      };
    }(video);
    document.body.appendChild(video);

    mesh.lookAt(setup.camera.position);
    setup.terrainMeshWater.add(mesh);
    mesh.position.set(0, height / 2 + 1, (i - Math.floor(count / 2)) * 3);
  }
  //mesh.scale.set(1.0, 1.0, 1.0);

  return setup;
};

const main = function(texture) {
  prelude();

  // This line causes problems on iPhone 5C.
  //document.body.style = 'margin: 0px; padding: 0px; overflow: hidden;';

  let setup = setupRenderer(window.innerWidth, window.innerHeight, { maxLights: config.lightCount });
  setup.tileTexture = setDefaultTextureProperties(texture);
  setup = setupRenderTerrain2D(setup, sets[16]);
  setup = setupScreenCopyQuad(setup, setup.terrainRenderTarget.texture);

  setup.renderer.setRenderTarget(setup.terrainRenderTarget);
  setup.renderer.render(setup.terrainQuadScene, setup.camera);
  
  //const setup.planeScene = new THREE.Scene();
  //setup = addPlane(setup, setup.planeScene);
  //setup = addPlane(setup, setup.scene);

  //setup = addCubes(setup, setup.scene, 0, 0.0, 0.0);
  
  // Set yScale equal to xScale so that the cubes are cubes and not rectangular
  // cuboids, i.e. all dimensions are equal, given that width (xScale) and
  // height (zScale) are same.
  
  setup.camera.position.set(config.cameraPosition.x, config.cameraPosition.y, config.cameraPosition.z);
  setup = setupWater(setup);
  setup = addCubes(setup, setup.scene, config.mapYScale, config.mapWidthIn3DUnits / (config.mapWidthInTiles - 1));
  setup = setupLighting(setup, config.mapWidthInPixels, config.mapHeightInPixels);
  //setup = setupSplash(setup);

  //setup.scene.add(new THREE.AmbientLight(0xFFFFFFF));
  const dirLight = new THREE.DirectionalLight(0xFFFFFF);
  //dirLight.position.set(new THREE.Vector3(0.65, 1.0, 0.65));
  //dirLight.position.set(-0.65, 1.0, -0.65);
  dirLight.position.set(setup.camera.position.x, setup.camera.position.y, setup.camera.position.z);
  dirLight.lookAt(setup.scene.position);
  //dirLight.intensity = 2.0;
  dirLight.intensity = 1.0;
  setup.scene.add(dirLight);
  const lightCount = config.lightCount;
  const lc2 = Math.round(Math.sqrt(lightCount));
  for (let i = 0; i < lightCount; i++) {
    const pointLight = new THREE.PointLight(new THREE.Color(Math.random(), 0.5 * Math.random(), Math.random()), 4, 0, 1.0);
    //const pointLight = new THREE.PointLight(new THREE.Color(1, 1, 1)); //, 2, 20, 0.1);
    //const x = (Math.random() - 0.5) * config.mapWidthIn3DUnits;
    const xi = i % lc2;
    const yi = Math.floor(i / lc2);
    const x = (xi / (lc2 - 1) - 0.5) * config.mapWidthIn3DUnits * 2.0 * 0.75;
    const y = 2.5;
    //Math.random() * config.mapYScale,
    const z = (yi / (lc2 - 1) - 0.5) * config.mapHeightIn3DUnits * 2.0 * 0.75;
    console.log(x, y, z);
    //const z = (Math.random() - 0.5) * config.mapHeightIn3DUnits);
    pointLight.position.set(x, y, z);
    setup.terrainMesh.add(pointLight);
  }

  const scene = setup.scene;
  setup.camera.lookAt(new THREE.Vector3(scene.position.x, scene.position.y - 16, scene.position.z));

  let frameCount = 0;

  function update() {
    setup.stats.begin();
    for (let i = 0; i < setup.updaters.length; i++) {
      setup.updaters[i](frameCount);
    }
    /*
    for (let i = 0; i < setup.scene.children; i++) {
      setup.scene.children[i].rotation.y += 0.1;
    }
    setup.terrainMesh.rotation.y += 0.01;
    setup.terrainMeshWater.rotation.y += 0.01;
    */
    
    if (setup.renderer.domElement.width != window.innerWidth ||
        setup.renderer.domElement.height != window.innerHeight) {
      setup.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    setup.renderer.setRenderTarget(null);
    //setup.renderer.render(setup.screenCopyQuadScene, setup.camera);
    setup.renderer.render(setup.scene, setup.camera);
    frameCount++;
    setup.stats.end();
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

  // use the buffer to create a DataTexture
  const dataTexture = new THREE.DataTexture(data, XSEGMENTS, YSEGMENTS, THREE.RGBAFormat, THREE.FloatType);
  setDefaultTextureProperties(dataTexture);
  const dataTextureUnits = new THREE.DataTexture(dataUnits, XUNITS, YUNITS, THREE.RGBAFormat, THREE.FloatType);
  setDefaultTextureProperties(dataTextureUnits);
  //dataTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const texture = new THREE.TextureLoader().load('art/images/ProjectUtumno_full_4096.png' );

  setDefaultTextureProperties(texture);
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

  //const dirLight = new THREE.DirectionalLight(0xFFFFFF);
  const dirLight = new THREE.DirectionalLight(0xFFFFFF);
  dirLight.intensity = 0.0;

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

const testPixelEqual = function(buffer, width, bx, by, tr, tg, tb, ta) {
  const stride = (by * width + bx) * config.floatSize;
  const r = buffer[stride + 0];
  const g = buffer[stride + 1];
  const b = buffer[stride + 2];
  const a = buffer[stride + 3];
  const c = x => Math.floor(x * 255);
  const threshold = 0;
  const success =
    Math.abs(r - tr) <= threshold &&
    Math.abs(g - tg) <= threshold &&
    Math.abs(b - tb) <= threshold &&
    Math.abs(a - ta) <= threshold;
  const result =
    success ?
      '' :
      ("Pixel equality test:" +
       "x: " + bx +
       ", y: " + by +
       ", r: " + c(r) + " should be " + c(tr) +
       ", g: " + c(g) + " should be " + c(tg) +
       ", b: " + c(b) + " should be " + c(tb) +
       ", a: " + c(a) + " should be " + c(ta));
  return {
    text: result,
    success: success
  };
};

const testPixelEqualBuffer = function(dataBuffer, pixelBuffer, width, bx, by) {
  const stride = (by * width + bx) * config.floatSize;
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
  return testPixelEqual(pixelBuffer, width, bx, by, r, g, b, a);
};

const compareBuffers = function(setup, expectedBuffer, renderBuffer, width, height) {
  let testResult = { text: '', success: true };
  for (let bx = 0; bx < width; bx++) {
    for (let by = 0; by < height; by++) {
      const newTestResult = testPixelEqualBuffer(expectedBuffer, renderBuffer, width, bx, by);
      testResult = combineResults(testResult, newTestResult);
      if (testResult.success) {
        testResult.text = '';
      } else {
        break;
      }
    }
  }
  if (testResult.success) {
    testResult.text = 'All ' + width + "x" + height + ' pixels passed: ';
  }
  return testResult;
}

const combineResults = function(a, b) {
  const oneEmpty = a.text === '' || b.text === '';
  return {
    text: a.text + (oneEmpty ? "" : "<br/>") + b.text,
    success: a.success && b.success
  };
};

// Note: Stateful function, due to storing table
const reportResults = function(setup, testResult) {
  const dataURL = setup.canvas.toDataURL();

  // Create table first time, store for later
  const groupResultTable = 
    setup.groupResultTable ||
    document.createElement('table');
  setup.groupResultTable = groupResultTable;

  const h1 = document.createElement('h1');

  groupResultTable
    .appendChild(document.createElement('tr'))
    .appendChild(document.createElement('td'))
    .appendChild(h1);

  h1.innerHTML = testResult.header;

  const groupResultRow = document.createElement('tr');
  
  const groupResult = document.createElement('td');
  
  //groupResult.style = "display: inline; position: relative; top: -" + config.logHeight * 0.5 + "px;";

  document.body.appendChild(groupResultTable);
  groupResultTable.appendChild(groupResultRow);
  groupResultRow.appendChild(groupResult);

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

  groupResultRow.appendChild(document.createElement('td')).appendChild(img);

  img.src = dataURL;
  img.width = config.logWidth;
  img.height = config.logHeight;

  return setup;
};

// TEST PART: ACTUAL TESTS

const TestTileTexture = {
  test: function(setup) {
    // Render all tiles, i.e. simply re-render input texture
    render(setup, setup.quadScene, config.textureWidth, config.textureHeight);
    const testResult = 
      {
        text: 'No test ',
        success: true,
        header: 'Render Input Tile Texture'
      };
    reportResults(setup, testResult);

    setup.renderBufferContainingAllTiles = Float32Array.from(setup.renderBuffer);

    // Now render the test tile
    setup = setupRenderTarget(setup, config.tileWidth, config.tileHeight);
    setup.quadMaterial.uniforms.texture.value = setup.testTileTexture;
    setup.quadMaterial.uniforms.resolution.value = new THREE.Vector2(config.tileWidth, config.tileHeight);
    render(setup, setup.quadScene, config.tileWidth, config.tileHeight);

    // Load the rendered test tile into buffer for pixel equality comparison.
    // Rendering the test tile avoids pixel comparison issues with PNG sRGB <->
    // linear colorspace conversion, gamma <-> linear conversion and other stuff
    // that Chrome, WebGL and Three.js does behind our backs. Vaguely.
    setup =
      reloadBufferTileToTexture(
        setup,
        setup.tileTextureBuffer,
        setup.cobalt_stone_11_xtile * config.tileWidth,
        setup.cobalt_stone_11_ytile * config.tileHeight,
        config.textureWidth,
        config.textureHeight,
        setup.renderBuffer,
        0,
        0,
        config.tileWidth,
        config.tileHeight,
        1);

    // Restore the first renderBuffer
    setup.renderBuffer = setup.renderBufferContainingAllTiles;
    const testResult2 = compareBuffers(setup, setup.tileTextureBuffer, setup.renderBuffer, config.textureWidth, config.textureHeight);
    testResult2.header = 'Compare Test Tile to position in rendered Tile Sheet';
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
        setup.renderBufferContainingAllTiles,
        setup.cobalt_stone_11_xtile * config.tileWidth,
        setup.cobalt_stone_11_ytile * config.tileHeight,
        config.textureWidth,
        config.textureHeight,
        1);

    //setup = setupRenderTarget(setup, config.tileWidth, config.tileHeight);
    setup.quadMaterial.uniforms.texture.value = setup.testTileTextureFromBuffer;
    render(setup, setup.quadScene, config.tileWidth, config.tileHeight);
    const testResult3 = compareBuffers(setup, setup.testTileTextureBuffer, setup.renderBuffer, config.tileWidth, config.tileHeight);
    testResult3.header = 'Render Test Tile Offset from rendered Tile Sheet';
    reportResults(setup, testResult3);
    return setup;
  }
};

const TestRenderTerrain2D = {
  test: function(setup) {
    setup = setupRenderTerrain2D(setup, sets[16]);
    setup = setupScreenCopyQuad(setup, setup.terrainRenderTarget.texture);

    setup.renderer.setRenderTarget(setup.terrainRenderTarget);
    setup.renderer.render(setup.terrainQuadScene, setup.camera);
    //readPixels(setup, setup.terrainRenderTarget);

    const width = setup.terrainRenderTarget.width;
    const height = setup.terrainRenderTarget.height;
    setup.screenCopyQuadMaterial.uniforms.resolution.value.set(width, height);
    setup = setupRenderTarget(setup, width, height);
    render(setup, setup.screenCopyQuadScene, width, height);
    /*
    setup.renderer.setSize(width, height);
    setup.renderer.setRenderTarget(null);
    setup.renderer.render(setup.screenCopyQuadScene, setup.camera);
    */

    setup.expectedTerrain2DBuffer = new Float32Array(width * height * config.floatSize);
    const data = setup.expectedTerrain2DBuffer;
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const stride = (y * width + x) * config.floatSize;
        const xTileIndex = Math.floor(x * config.mapWidthInTiles / width);
        const yTileIndex = Math.floor(y * config.mapHeightInTiles / height);
        const xTileOffset = x % config.tileWidth;
        const yTileOffset = y % config.tileHeight;
        const stride3 = (yTileIndex * config.mapWidthInTiles + xTileIndex) * config.floatSize;
        const ix = setup.tileIndexTextureData[stride3 + 0] * config.tileWidth + xTileOffset;
        const iy = setup.tileIndexTextureData[stride3 + 1] * config.tileHeight + yTileOffset;
        const stride2 = (iy * config.textureWidth + ix) * config.floatSize;
        const r = setup.renderBufferContainingAllTiles[stride2 + 0];
        const g = setup.renderBufferContainingAllTiles[stride2 + 1];
        const b = setup.renderBufferContainingAllTiles[stride2 + 2];
        const a = setup.renderBufferContainingAllTiles[stride2 + 3];
        data[stride + 0] = r;
        data[stride + 1] = g;
        data[stride + 2] = b;
        data[stride + 3] = a;
      }
    }
    const dataTexture =
      new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);

    const testResult = compareBuffers(setup, setup.expectedTerrain2DBuffer, setup.renderBuffer, width, height);
    testResult.header = 'Render Terrain 2D';
    reportResults(setup, testResult);

    setup.screenCopyQuadMaterial.uniforms.texture.value = dataTexture;
    render(setup, setup.screenCopyQuadScene, width, height);
    const testResult2 = 
      {
        text: 'No test ',
        success: true,
        header: 'Expected Render Terrain 2D'
      };
    reportResults(setup, testResult2);

    return setup;
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
  setDefaultTextureProperties(texture);

  return setup;
};

const setupTestTileTexture = function(setup) {
  setup.testTileTextureBuffer = new Float32Array(config.floatSize * config.tileWidth * config.tileHeight);
  setup.testTileTextureFromBuffer = new THREE.DataTexture(setup.testTileTextureBuffer, config.tileWidth, config.tileHeight, THREE.RGBAFormat, THREE.FloatType);
  setDefaultTextureProperties(setup.testTileTexture);
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
  setDefaultTextureProperties(setup.renderTarget.texture);
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

/*
const readPixels = function(setup, renderTarget) {
  const width = renderTarget.width;
  const height = renderTarget.height;
  const renderBuffer = new Uint8Array(config.floatSize * width * height);
  setup.renderer.readRenderTargetPixels(setup.terrainRenderTarget, 0, 0, width, height, renderBuffer);
  for (let i = 0; i < renderBuffer.length; i++) {
    setup.renderBuffer = renderBuffer[i] / 255.0;
  }
  return setup;
};
*/

// TEST PART: TEST RUNNER

const test = function(texture, testTileTexture) {
  prelude();

  // Setup renderer, set tile texture
  let setup = setupRenderer(config.textureWidth, config.textureHeight, { preserveDrawingBuffer: true });
  setup = setupTileTexture(setup, config.textureWidth, config.textureHeight, texture);

  // Set test tile index
  setup.cobalt_stone_11_xtile = 41;
  setup.cobalt_stone_11_ytile = 14;

  // Set test tile
  setup.testTileTexture = setDefaultTextureProperties(testTileTexture);
  setup = setupTestQuad(setup, config.textureWidth, config.textureHeight);
  setup = setupRenderTarget(setup, config.textureWidth, config.textureHeight);

  // Actual tests
  TestTileTexture.test(setup);
  TestRenderTerrain2D.test(setup);
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
  //document.body.innerHTML = '<pre>' + error.toString() + error.stack + '</pre>';
  document.body.innerHTML = '<pre>' + error + '</pre>';
}
