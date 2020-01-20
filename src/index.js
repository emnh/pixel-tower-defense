const main = function() {
  const THREE = require('three');
  const SimplexNoise = require('simplex-noise');
  const seedrandom = require('seedrandom');
  const unitShader = require('./unitShader.js');
  const bargeJSON = require('./barge.js').bargeJSON;

  // Global PRNG: set Math.random.
  seedrandom('hello.', { global: true });

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

  const XUNITS = 32;
  const YUNITS = 32;

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
  const dataTextureSizeUnits = XUNITS * YUNITS;
  const data = new Float32Array(4 * dataTextureSize);
  const dataUnits = new Float32Array(4 * dataTextureSizeUnits);

  const validTerrainX = [];

  const uniqueTerrain = {
    "2X2": "dungeon/floor/acidic_floor_0",
    "2X3": "dungeon/floor/acidic_floor_1",
    "2X6": "dungeon/floor/black_cobalt_1",
    "2X7": "dungeon/floor/black_cobalt_10",
    "2X8": "dungeon/floor/black_cobalt_11",
    "2X9": "dungeon/floor/black_cobalt_12",
    "2X18": "dungeon/floor/bog_green_0_new",
    "2X19": "dungeon/floor/bog_green_0_old",
    "2X20": "dungeon/floor/bog_green_1_new",
    "2X21": "dungeon/floor/bog_green_1_old",
    "2X26": "dungeon/floor/cage_0",
    "2X27": "dungeon/floor/cage_1",
    "2X32": "dungeon/floor/cobble_blood_10_new",
    "2X33": "dungeon/floor/cobble_blood_10_old",
    "2X34": "dungeon/floor/cobble_blood_11_new",
    "2X35": "dungeon/floor/cobble_blood_11_old",
    "2X36": "dungeon/floor/cobble_blood_12_new",
    "2X37": "dungeon/floor/cobble_blood_12_old",
    "2X38": "dungeon/floor/cobble_blood_1_new",
    "2X39": "dungeon/floor/cobble_blood_1_old",
    "2X56": "dungeon/floor/crypt_10",
    "2X57": "dungeon/floor/crypt_11",
    "2X58": "dungeon/floor/crypt_domino_1a",
    "2X59": "dungeon/floor/crypt_domino_1b",
    "3X4": "dungeon/floor/crystal_floor_0",
    "3X5": "dungeon/floor/crystal_floor_1",
    "3X10": "dungeon/floor/demonic_red_1",
    "3X19": "dungeon/floor/dirt_0_new",
    "3X20": "dungeon/floor/dirt_0_old",
    "3X21": "dungeon/floor/dirt_1_new",
    "3X22": "dungeon/floor/dirt_1_old",
    "3X27": "dungeon/floor/dirt_full_new",
    "3X28": "dungeon/floor/dirt_full_old",
    "3X43": "dungeon/floor/etched_0",
    "3X44": "dungeon/floor/etched_1",
    "3X49": "dungeon/floor/floor_nerves_0",
    "3X50": "dungeon/floor/floor_nerves_1_new",
    "3X51": "dungeon/floor/floor_nerves_1_old",
    "3X61": "dungeon/floor/floor_sand_rock_0",
    "3X62": "dungeon/floor/floor_sand_rock_1",
    "4X1": "dungeon/floor/floor_sand_stone_0",
    "4X2": "dungeon/floor/floor_sand_stone_1",
    "4X9": "dungeon/floor/floor_vines_0_new",
    "4X10": "dungeon/floor/floor_vines_0_old",
    "4X11": "dungeon/floor/floor_vines_1_new",
    "4X12": "dungeon/floor/floor_vines_1_old",
    "4X23": "dungeon/floor/frozen_0",
    "4X24": "dungeon/floor/frozen_1",
    "4X25": "dungeon/floor/frozen_10",
    "4X26": "dungeon/floor/frozen_11",
    "4X27": "dungeon/floor/frozen_12",
    "4X36": "dungeon/floor/green_bones_1",
    "4X37": "dungeon/floor/green_bones_10",
    "4X38": "dungeon/floor/green_bones_11",
    "4X39": "dungeon/floor/green_bones_12",
    "4X48": "dungeon/floor/grey_dirt_0_new",
    "4X49": "dungeon/floor/grey_dirt_0_old",
    "4X50": "dungeon/floor/grey_dirt_1_new",
    "4X51": "dungeon/floor/grey_dirt_1_old",
    "5X0": "dungeon/floor/grey_dirt_b_0",
    "5X1": "dungeon/floor/grey_dirt_b_1",
    "5X8": "dungeon/floor/hive_0",
    "5X9": "dungeon/floor/hive_1",
    "5X12": "dungeon/floor/ice_0_new",
    "5X13": "dungeon/floor/ice_0_old",
    "5X14": "dungeon/floor/ice_1_new",
    "5X15": "dungeon/floor/ice_1_old",
    "5X20": "dungeon/floor/infernal_1",
    "5X21": "dungeon/floor/infernal_10",
    "5X22": "dungeon/floor/infernal_11",
    "5X23": "dungeon/floor/infernal_12",
    "5X24": "dungeon/floor/infernal_13",
    "5X25": "dungeon/floor/infernal_14",
    "5X26": "dungeon/floor/infernal_15",
    "5X35": "dungeon/floor/infernal_blank",
    "5X36": "dungeon/floor/labyrinth_0",
    "5X37": "dungeon/floor/labyrinth_1",
    "5X40": "dungeon/floor/lair0b",
    "5X41": "dungeon/floor/lair1b",
    "5X42": "dungeon/floor/lair2b",
    "5X43": "dungeon/floor/lair3b",
    "5X44": "dungeon/floor/lair4b",
    "5X45": "dungeon/floor/lair5b",
    "5X46": "dungeon/floor/lair6b",
    "5X47": "dungeon/floor/lair7b",
    "5X48": "dungeon/floor/lair_0_new",
    "5X49": "dungeon/floor/lair_0_old",
    "5X50": "dungeon/floor/lair_1_new",
    "5X51": "dungeon/floor/lair_1_old",
    "5X60": "dungeon/floor/lava_0",
    "5X61": "dungeon/floor/lava_1",
    "6X0": "dungeon/floor/lava_old",
    "6X1": "dungeon/floor/limestone_0",
    "6X2": "dungeon/floor/limestone_1",
    "6X11": "dungeon/floor/marble_floor_1",
    "6X19": "dungeon/floor/mesh_1_new",
    "6X20": "dungeon/floor/mesh_0_old",
    "6X25": "dungeon/floor/mosaic_0",
    "6X26": "dungeon/floor/mosaic_1",
    "6X27": "dungeon/floor/mosaic_10",
    "6X28": "dungeon/floor/mosaic_11",
    "6X29": "dungeon/floor/mosaic_12",
    "6X30": "dungeon/floor/mosaic_13",
    "6X31": "dungeon/floor/mosaic_14",
    "6X32": "dungeon/floor/mosaic_15",
    "6X41": "dungeon/floor/moss_0",
    "6X42": "dungeon/floor/moss_1",
    "6X45": "dungeon/floor/mud_0",
    "6X46": "dungeon/floor/mud_1",
    "6X49": "dungeon/floor/orc_0",
    "6X50": "dungeon/floor/orc_1",
    "6X57": "dungeon/floor/pebble_brown_0_new",
    "6X58": "dungeon/floor/pebble_brown_0_old",
    "6X59": "dungeon/floor/pebble_brown_1_new",
    "6X60": "dungeon/floor/pebble_brown_1_old",
    "7X12": "dungeon/floor/pedestal_full",
    "7X20": "dungeon/floor/rect_gray_0_new",
    "7X21": "dungeon/floor/rect_gray_0_old",
    "7X22": "dungeon/floor/rect_gray_1_new",
    "7X23": "dungeon/floor/rect_gray_1_old",
    "7X28": "dungeon/floor/rough_red_0",
    "7X29": "dungeon/floor/rough_red_1",
    "7X32": "dungeon/floor/sandstone_floor_0",
    "7X33": "dungeon/floor/sandstone_floor_1",
    "7X42": "dungeon/floor/sand_1",
    "8X25": "dungeon/floor/snake-a_0",
    "8X26": "dungeon/floor/snake-a_1",
    "8X29": "dungeon/floor/snake-c_0",
    "8X30": "dungeon/floor/snake-c_1",
    "8X33": "dungeon/floor/snake-d_0",
    "8X34": "dungeon/floor/snake-d_1",
    "8X37": "dungeon/floor/snake_0",
    "8X38": "dungeon/floor/snake_1",
    "8X42": "dungeon/floor/swamp_0_new",
    "8X43": "dungeon/floor/swamp_1_new",
    "8X44": "dungeon/floor/swamp_1_old",
    "8X49": "dungeon/floor/tomb_0_new",
    "8X50": "dungeon/floor/tomb_0_old",
    "8X52": "dungeon/floor/tomb_1_new",
    "8X57": "dungeon/floor/tutorial_pad",
    "8X58": "dungeon/floor/volcanic_floor_0",
    "8X59": "dungeon/floor/volcanic_floor_1",
    "9X1": "dungeon/floor/white_marble_0",
    "9X2": "dungeon/floor/white_marble_1",
    "9X11": "dungeon/floor/grass/grass0-dirt-mix_1",
    "9X16": "dungeon/floor/grass/grass_1_new",
    "9X17": "dungeon/floor/grass/grass_1_old",
    "9X22": "dungeon/floor/grass/grass_flowers_blue_1_new",
    "9X23": "dungeon/floor/grass/grass_flowers_blue_1_old",
    "9X27": "dungeon/floor/grass/grass_0_old",
    "9X28": "dungeon/floor/grass/grass_flowers_red_1_new",
    "9X34": "dungeon/floor/grass/grass_flowers_yellow_1_new",
    "9X35": "dungeon/floor/grass/grass_flowers_yellow_1_old",
    "9X40": "dungeon/floor/grass/grass_full_new",
    "9X41": "dungeon/floor/grass/grass_full_old",
    "21X19": "dungeon/water/deep_water",
    "21X21": "dungeon/water/deep_water_murky",
    "21X47": "dungeon/water/grey_dirt_bl",
    "21X61": "dungeon/water/liquefaction_1",
    "21X63": "dungeon/water/open_sea",
    "22X9": "dungeon/water/shallow_water",
    "22X11": "dungeon/water/shallow_water_disturbance",
    "22X13": "dungeon/water/shallow_water_murky",
    "22X15": "dungeon/water/shallow_water_murky_disturbance",
    "22X33": "dungeon/water/shoals_deep_water_0",
    "22X34": "dungeon/water/shoals_deep_water_10",
    "22X35": "dungeon/water/shoals_deep_water_11",
    "22X36": "dungeon/water/shoals_deep_water_1_new",
    "22X37": "dungeon/water/shoals_deep_water_1_old",
    "22X38": "dungeon/water/shoals_deep_water_1_shape",
    "22X54": "dungeon/water/shoals_shallow_water_0",
    "22X55": "dungeon/water/shoals_shallow_water_10",
    "22X56": "dungeon/water/shoals_shallow_water_11",
    "22X57": "dungeon/water/shoals_shallow_water_1_new",
    "22X58": "dungeon/water/shoals_shallow_water_1_old",
    "23X6": "dungeon/water/shoals_shallow_water_disturbance_1_new",
    "23X7": "dungeon/water/shoals_shallow_water_disturbance_1_old",
  };

  const sets = [
    ["5X23","22X34","6X27","6X0","7X32","8X34"],      // sandstone
    ["2X20","5X41","4X12","5X22","2X56","5X46"],      // dark
    ["8X58","4X24","2X3","3X28","6X0","4X26"],        // acidic 2
    ["5X15","22X55","7X32","4X38","4X50","6X29"],     // arctic
    ["5X61","6X26","22X15","2X37","9X40","8X34"],     // green
    ["6X11","3X19","2X36","6X29","8X49","21X21"],     // cobble
    ["21X47","6X60","22X58","2X8","6X31","22X37"],    // oceanic
    ["22X15","6X1","2X37","2X38","5X40","4X39"],      // green desert
    ["22X9","9X23","4X9","9X1","9X2","9X35"],         // marble
    ["23X7","7X42","7X32","3X62","8X37","5X35"],      // desert
    ["21X47","9X16","9X11","8X52","3X44","2X2"],      // acidic
    ["22X35","8X25","2X57","2X7","4X12","6X41"],      // darkgreen
    ["21X21","8X25","4X11","6X45","6X41","2X26"],     // lightgreen
    ["22X37","2X9","3X61","5X47","5X37","6X19"],      // contrast
    ["23X7","4X23","3X62","8X43","6X2","2X27"],       // limestone
    ["22X37","3X20","5X40","9X23","5X13","5X48"],     // grass+dirt
    ["23X2","9X11","9X14","9X15","7X21","14X41"]      // standard
  ];

  const heightMap =
    [
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[35,51,56,61,74,83,90,90,90,90,90,99,111,116,116,116,116,116,116,116,116,116,114,104,80,0,0,0,0,0,0,0],
[87,103,108,111,111,113,113,113,113,113,113,115,121,123,123,123,123,123,123,123,123,123,123,120,89,0,0,0,0,0,0,0],
[98,108,114,115,115,113,113,113,113,113,113,115,115,116,116,116,116,116,116,116,116,116,116,111,89,0,0,0,0,0,0,0],
[180,169,161,150,157,166,176,176,176,176,176,185,194,200,200,200,200,200,200,200,200,200,194,173,136,0,0,0,0,0,0,0],
[244,253,253,252,252,252,252,252,252,252,252,252,248,248,248,249,251,251,251,248,248,248,248,240,188,0,0,0,0,0,0,0],
[230,244,245,244,244,244,244,244,244,244,244,244,248,248,248,249,252,254,251,248,248,248,248,240,188,0,0,0,0,0,0,0],
[120,138,138,136,136,136,136,136,136,136,136,158,173,184,189,201,230,230,225,200,200,194,189,169,136,0,0,0,0,0,0,0],
[80,110,117,118,117,117,117,117,117,117,117,117,117,117,117,116,116,116,116,116,116,116,117,111,89,0,0,0,0,0,0,0],
[80,117,122,122,121,121,121,121,121,121,121,121,121,121,121,123,123,123,123,123,123,123,121,120,89,0,0,0,0,0,0,0],
[71,100,110,111,110,110,110,110,110,110,110,110,110,110,112,114,116,116,116,116,116,114,112,100,80,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,89,111,119,117,117,117,116,116,114,112,112,114,116,116,116,116,116,116,116,116,116,116,116,116,108,89],
[0,0,0,0,0,0,147,130,134,128,128,128,123,123,123,128,128,123,123,123,123,123,123,123,123,123,123,123,123,123,123,120],
[0,0,0,0,0,0,187,195,172,172,163,158,153,148,148,144,144,148,148,148,148,148,148,148,148,148,148,148,148,148,166,188],
[0,0,0,0,0,0,218,254,255,254,254,254,254,254,245,237,237,246,255,255,255,255,254,254,255,255,255,255,255,255,255,250],
[0,0,0,0,0,0,180,219,232,226,217,217,212,207,200,200,200,220,224,235,227,227,216,225,231,237,240,243,245,244,240,218],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
[76,96,106,109,111,109,107,105,105,105,105,102,97,91,91,91,91,91,91,98,98,104,105,105,91,60,0,0,0,0,0,0],
[91,112,116,118,118,118,116,116,116,116,116,116,114,114,114,114,114,114,114,116,117,116,117,117,112,85,0,0,0,0,0,0],
[86,106,111,111,111,111,112,112,112,112,112,112,114,114,114,114,114,114,114,116,117,116,116,116,112,85,0,0,0,0,0,0],
[166,197,212,222,230,222,215,208,208,208,201,183,176,168,168,168,176,176,174,160,166,168,183,183,188,174,0,0,0,0,0,0],
[202,244,252,252,252,252,252,252,252,252,252,248,251,253,251,250,253,253,250,252,252,255,255,255,255,188,0,0,0,0,0,0],
[190,230,241,244,244,244,244,244,244,244,244,248,252,253,251,250,251,252,250,244,244,241,241,241,225,188,0,0,0,0,0,0]
];

  /*
  for (let i = 11; i < 39; i++) {
    if (i === 20 || i === 21) {
      continue;
    }
    validTerrainX.push(i * xf);
  }
  */
  const validTerrain2 = [
    [50, 757],
    [366, 305],
    [465, 305],
    [495, 305],
    [693, 237],
    [1328, 464]
  ];

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
  /*
  for (let xi = 8; xi < 2048; xi += 32) {
    for (let yi = 8; yi < 3040; yi += 32) {
      validTerrain.push([xi, yi]);
    }
  }
  */

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
    if (tile == validTerrain[0]) {
      data[stride + 3] = 1.0;
    } else {
      data[stride + 3] = 1.0;
    }
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

try {
  main();
} catch (error) {
  throw(error);
  document.body.innerHTML = '<pre>' + error.stack + '</pre>';
}
