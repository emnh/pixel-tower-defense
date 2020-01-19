export const vertexShader = `
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
    pos.xyz = pos.xzy;

    vec2 vuv = floor(pos.xz + 0.0) / mapSize + vec2(0.5);
    //vUvOffset = vec2(uv.x, -uv.y);
    vUvOffset = uv;
    //vec2 buv = pos.xz / mapSize + vec2(0.5);

    // TODO: is multiplication result a uniform already?
    mat4 VP = projectionMatrix * viewMatrix;
    mat4 vMatrix = viewMatrix;
    vec3 CameraRight = vec3(vMatrix[0][0], vMatrix[1][0], vMatrix[2][0]);
    vec3 CameraUp = vec3(vMatrix[0][1], vMatrix[1][1], vMatrix[2][1]);

    float Size = 0.8;

    /*
    vec4 v1 = VP * vec4(Pos + CameraRight * 0.5 * Size + CameraUp * -0.5 * Size, 1.0);
    vec4 v2 = VP * vec4(Pos + CameraRight * 0.5 * Size + CameraUp * 0.5 * Size, 1.0);
    vec4 v3 = VP * vec4(Pos + CameraRight * -0.5 * Size + CameraUp * -0.5 * Size, 1.0);
    vec4 v4 = VP * vec4(Pos + CameraRight * -0.5 * Size + CameraUp * 0.5 * Size, 1.0);
    */

    // vec4 v1 = VP * vec4(Pos + CameraRight * rpos.x * Size + CameraUp * rpos.y * Size, 1.0);
    //vec3 rpos = fract(pos);
    vec3 rpos = fract((pos + 0.5) * 0.5) * 2.0;
    vec3 billboard = CameraRight * rpos.x * Size + CameraUp * rpos.z * Size;
    vec3 fpos = pos - rpos;

    // fpos.z = pos.z;

    //pos.xz -= 0.3;

    fpos = (modelMatrix * vec4(fpos, 1.0)).xyz;

    fpos += billboard;

    vec4 mvPosition = viewMatrix * vec4(fpos, 1.0);

    // mvPosition.xyz += (viewMatrix * vec4(billboard.xyz, 1.0)).xyz;

    gl_Position = projectionMatrix * mvPosition;

    /*
    gl_Position /= gl_Position.w;
    vec4 glp = VP * vec4(billboard, 1.0);
    gl_Position += glp / glp.w;
    */

    //pos = (modelMatrix * vec4(pos, 1.0)).xyz;


    // TODO: uniform. sz2 / 2.0
    //pos.xz -= 0.3;
    //pos = (modelMatrix * vec4(pos, 1.0)).xyz;

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
  }
`;

export const fragmentShader = `
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
    if (color.a == 0.0) {
      discard;
    }
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
    // XXX: Hack
    // index.xy = vec2(0.0, 61.0) * tileSizeOnTexture;
    index.y = 1.0 - index.y;

    vec4 color = getTilePixel(index.xy, uvRel);
    // color.rgb *= index.w;


    const float lightSpeed = 2.0;
    const float lightCount = 16.0;
    vec4 lcolor = vec4(vec3(0.0), color.a);
    float dirLight = max(0.0, abs(dot(vNormal, normalize(vec3(-1.0, 1.0, -1.0)))));
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
    lcolor.rgb = color.rgb;

    float maxHeight = 2.0;
    // lcolor.rgb += 0.5 * color.rgb * dirLight * (maxHeight - min(maxHeight, abs(maxHeight - vPosition.y)));
    //lcolor.rgb *= lcolor.rgb * dirLight;

    return lcolor;
  }

  void main( void ) {

    vec4 color = getTile(vUv);
    gl_FragColor = color; // (1.0 + facX + facY);
    return;
  }
`;

