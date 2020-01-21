const THREE = require('three');
const SimplexNoise = require('simplex-noise');
const seedrandom = require('seedrandom');
const unitShader = require('./unitShader.js');
const bargeJSON = require('./barge.js').bargeJSON;
const uniqueTerrain = require('./uniqueTerrain.js').uniqueTerrain;
const sets = require('./terrainSets.js').terrainSets;
const heightMap = require('./heightMap.js').heightMap;

const config = {
  floatSize: 4,
  textureWidth: 4096,
  textureHeight: 4096,
  testWidth: 200,
  testHeight: 150,
  logWidth: 200,
  logHeight: 150
};

const prelude = function() {
  // Global PRNG: set Math.random.
  seedrandom('hello.', { global: true });
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
    canvas: renderer.domElement
  };
};

const main = function() {
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
  const stride = (by * config.textureHeight + bx) * config.floatSize;
  const r = buffer[stride + 0];
  const g = buffer[stride + 1];
  const b = buffer[stride + 2];
  const a = buffer[stride + 3];
  const result =
    "Pixel equality test:" +
    "x: " + bx +
    ", y: " + by +
    ", r: " + r + " should be " + tr +
    ", g: " + g + " should be " + tg +
    ", b: " + b + " should be " + tb +
    ", a: " + a + " should be " + ta;
  const success =
    r == tr &&
    g == tg &&
    b == tb &&
    a == ta;
  return {
    text: result,
    success: success
  };
};

const testPixelEqualBuffer = function(dataBuffer, pixelBuffer, bx, by) {
  const stride = (by * config.textureHeight + bx) * config.floatSize;
  const eps = 1.0e-6;
  const r = Math.round(dataBuffer[stride + 0] * 255 - eps);
  const g = Math.round(dataBuffer[stride + 1] * 255 - eps);
  const b = Math.round(dataBuffer[stride + 2] * 255 - eps);
  const a = Math.round(dataBuffer[stride + 3] * 255 - eps);
  return testPixelEqual(pixelBuffer, bx, by, r, g, b, a);
};

const combineResults = function(a, b) {
  return {
    text: a.text + "<br/>" + b.text,
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
    const testResult1 = testPixelEqualBuffer(setup.dataTextureBuffer, setup.renderBuffer, bx, by);
    const testResult2 = testPixelEqualBuffer(setup.dataTextureBuffer, setup.renderBuffer, config.textureWidth - 1, config.textureHeight - 1);
    let testResult = combineResults(testResult1, testResult2);
    for (let bx = 0; bx < config.textureWidth; bx++) {
      for (let by = 0; by < config.textureWidth; by++) {
        const newTestResult = testPixelEqualBuffer(setup.dataTextureBuffer, setup.renderBuffer, bx, by);
        testResult = combineResults(testResult, newTestResult);
        if (testResult.success) {
          testResult.text = '';
        }
      }
    }
    if (testResult.success) {
      testResult.text = 'All ' + config.textureWidth + "x" + config.textureHeight + ' pixels passed: ';
    }
    return testResult;
  }
};

// TEST PART: TEST SETUP

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

  setup.dataTextureSize = dataTextureSize;
  setup.dataTextureBuffer = dataTextureBuffer;
  setup.dataTexture = dataTexture;

  return setup;
};

const clearScene = function(setup) {
  while (setup.scene.children.length > 0) {
    setup.scene.remove(setup.scene.children[0]);
  }
  return setup;
};

const setupQuad = function(setup, width, height) {
  const quad = new THREE.PlaneGeometry(2.0, 2.0);

  const vertexShader = `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

  const fragmentShader = `
uniform vec2 resolution;
uniform sampler2D texture;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 color = texture2D(texture, uv);
  gl_FragColor = color;
}
`;

  const material =
    new THREE.ShaderMaterial(
      {
        uniforms: {
          resolution: { value: new THREE.Vector2(width, height) },
          texture: { value: setup.dataTexture }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        depthWrite: false,
        depthTest: false
      }
    );

  const mesh = new THREE.Mesh(quad, material);

  setup.scene.add(mesh);

  return setup;
};

const setupRenderTarget = function(setup, width, height) {
  setup.renderTarget = new THREE.WebGLRenderTarget(width, height);
  setup.renderBuffer = new Uint8Array(config.floatSize * setup.dataTextureSize);
  return setup;
};

const render = function(setup, width, height) {
  setup.renderer.setRenderTarget(null);
  setup.renderer.render(setup.scene, setup.camera);

  // Note: must be done after render. Can as well just be hidden I guess.
  setup.canvas.style =
    "width: " + config.testWidth + "px;" +
    "height: " + config.testHeight + "px;";

  setup.renderer.setRenderTarget(setup.renderTarget);
  setup.renderer.render(setup.scene, setup.camera);
  setup.renderer.readRenderTargetPixels(setup.renderTarget, 0, 0, width, height, setup.renderBuffer);
};

// TEST PART: TEST RUNNER

const test = function() {
  prelude();

  let setup = setupRenderer(config.textureWidth, config.textureHeight, { preserveDrawingBuffer: true });

  setup = setupTestTexture(setup, config.textureWidth, config.textureHeight);
  setup = clearScene(setup);
  setup = setupQuad(setup, config.textureWidth, config.textureHeight);
  setup = setupRenderTarget(setup, config.textureWidth, config.textureHeight);

  render(setup, config.textureWidth, config.textureHeight);
  const testResult = TestTileTexture.test(setup);
  reportResults(setup, testResult);

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
    test();
  } else {
    main();
  }
} catch (error) {
  throw(error);
  document.body.innerHTML = '<pre>' + error.stack + '</pre>';
}
