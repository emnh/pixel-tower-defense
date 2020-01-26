uniform vec2 resolution;
uniform vec2 tileSizeRelativeToTexture;
uniform vec2 pixelSizeRelativeToTexture;
uniform vec2 mapSizeInTiles;
uniform sampler2D texture;
uniform sampler2D tileIndexTexture;
uniform sampler2D terrainTexture;
uniform sampler2D transferTexture;
uniform sampler2D velocityTexture;
uniform float waterFrameCount;
uniform float time;
uniform float deltaTime;
uniform float waterShaderMode;
uniform float mapYScale;

uniform float splashTime;

float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

float normpdf(in float x, in float sigma) {
    return 0.39894*exp(-0.5*x*x/(sigma*sigma))/sigma;
}

vec4 gaussian(sampler2D texture) {
    vec3 c = texture2D(texture, gl_FragCoord.xy / resolution.xy).rgb;

    //declare stuff
    const int mSize = 11;
    const int kSize = (mSize-1)/2;
    float kernel[mSize];
    vec3 final_colour = vec3(0.0);

    //create the 1-D kernel
    float sigma = 2.0;
    float Z = 0.0;
    for (int j = 0; j <= kSize; ++j) {
        kernel[kSize+j] = kernel[kSize-j] = normpdf(float(j), sigma);
    }

    //get the normalization factor (as the gaussian has been clamped)
    for (int j = 0; j < mSize; ++j) {
        Z += kernel[j];
    }

    //read out the texels
    for (int i=-kSize; i <= kSize; ++i) {
        for (int j=-kSize; j <= kSize; ++j) {
            final_colour += kernel[kSize+j]*kernel[kSize+i]*texture2D(texture, (gl_FragCoord.xy+vec2(float(i),float(j))) / resolution.xy).rgb;
        }
    }

    return vec4(final_colour/(Z*Z), 1.0);
}

bool isWater(float height) {
    // TODO: uniform
    bool isWater = height <= 0.01 * mapYScale;
    return isWater;
}

float normHeight(float water, float groundHeight) {
    // groundHeight = 0.0;
    float myHeight = water >= 0.0 ? water + groundHeight : groundHeight;
    return myHeight;
    //return water;
}

float getDisplacement(vec4 a) {
    return max(0.0, a.x);
}

float vsum(vec4 a) {
    // TODO: no * 0.25
    //return (a.x + a.y + a.z + a.w) * 0.25;
    return (a.x + a.y + a.z + a.w);
    //return a.x;
}

    #define DRAG_MULT 0.048

vec2 wavedx(vec2 position, vec2 direction, float speed, float frequency, float timeshift) {
    float x = dot(direction, position) * frequency + timeshift * speed;
    float wave = exp(sin(x) - 1.0);
    float dx = wave * cos(x);
    return vec2(wave, -dx);
}

float getwaves(vec2 position){
    float iter = 0.0;
    float phase = 6.0;
    float speed = 2.0;
    float weight = 1.0;
    float w = 0.0;
    float ws = 0.0;
    for(int i=0;i<48;i++){
        vec2 p = vec2(sin(iter), cos(iter));
        vec2 res = wavedx(position, p, speed, phase, time);
        position += normalize(p) * res.y * weight * DRAG_MULT;
        w += res.x * weight;
        iter += 12.0;
        ws += weight;
        weight = mix(weight, 0.0, 0.2);
        phase *= 1.18;
        speed *= 1.07;
    }
    return w / ws;
}

float getGroundHeight(vec2 uv) {
    // Outside map let height be:
    if (abs(uv.x - 0.5) > 0.5 - 1.0e-2) {
        return 0.0;
    }
    if (abs(uv.y - 0.5) > 0.5 - 1.0e-2) {
        return 0.0;
    }
    vec2 tileIndexUV = floor(uv * mapSizeInTiles) / mapSizeInTiles;
    vec4 tileIndex = texture2D(tileIndexTexture, tileIndexUV);
    float groundHeight = tileIndex.z;
    return mapYScale * groundHeight;
}

float checkDelta(float delta, float waterMine, float waterNB) {
    if (delta > 0.0) {
        delta = min(delta, max(0.0, waterMine));
    } else {
        delta = max(delta, -max(0.0, waterNB));
    }
    return delta;
}

float posWater(float x) {
    return max(0.0, x);
}

vec4 EncodeFloatRGBA(float v) {
    vec4 enc = vec4(1.0, 255.0, 65025.0, 16581375.0) * v;
    enc = fract(enc);
    enc -= enc.yzww * vec4(1.0/255.0,1.0/255.0,1.0/255.0,0.0);
    return enc;
}

float DecodeFloatRGBA(vec4 rgba) {
    return dot( rgba, vec4(1.0, 1.0/255.0, 1.0/65025.0, 1.0/16581375.0) );
}

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    float groundHeight = getGroundHeight(uv);

    vec4 displacement = texture2D(texture, uv);
    vec4 velocity = texture2D(velocityTexture, uv);

    vec4 nbg = vec4(0.0);
    nbg.x = getGroundHeight(uv + vec2(-1.0, 0.0) / resolution.xy);
    nbg.y = getGroundHeight(uv + vec2(1.0, 0.0) / resolution.xy);
    nbg.z = getGroundHeight(uv + vec2(0.0, -1.0) / resolution.xy);
    nbg.w = getGroundHeight(uv + vec2(0.0, 1.0) / resolution.xy);
    vec4 nbs = vec4(0.0);
    nbs.x = getDisplacement(texture2D(texture, uv + vec2(-1.0, 0.0) / resolution.xy));
    nbs.y = getDisplacement(texture2D(texture, uv + vec2(1.0, 0.0) / resolution.xy));
    nbs.z = getDisplacement(texture2D(texture, uv + vec2(0.0, -1.0) / resolution.xy));
    nbs.w = getDisplacement(texture2D(texture, uv + vec2(0.0, 1.0) / resolution.xy));

    float mine = groundHeight + getDisplacement(displacement);
    float avg = 0.25 * ((nbs.x - mine) + (nbs.y - mine) + (nbs.z - mine) + (nbs.w - mine));

    vec4 nbsV = vec4(0.0);
    nbsV.x = texture2D(velocityTexture, uv + vec2(-1.0, 0.0) / resolution.xy).y;
    nbsV.y = texture2D(velocityTexture, uv + vec2(1.0, 0.0) / resolution.xy).x;
    nbsV.z = texture2D(velocityTexture, uv + vec2(0.0, -1.0) / resolution.xy).w;
    nbsV.w = texture2D(velocityTexture, uv + vec2(0.0, 1.0) / resolution.xy).z;

    //if (mod(waterFrameCount, 1000.0) == 0.0) {
    float fac = 10.0;
    if (waterFrameCount < 0.5) {
        //displacement.y = (vec4(sin(fac *  6.28 * uv.x) + sin(fac * 6.28 * uv.y) + 0.0) * 0.1).x; // * vec4(0.000125);
        // velocity = vec4(0.0);
        displacement = vec4(0.0);
        float b = 2.0;
        float s = 0.0;
        for (float p = 1.0; p <= 10.0; p++) {
            s += rand(floor(uv * pow(b, p))) / p;
        }
        if (isWater(groundHeight)) {
            //displacement.x = 0.5 * s;
            //displacement.y = 0.005 * s;
            displacement.x = (getwaves(uv * 8.0) * 5.0) - 1.5 - groundHeight;
            displacement.x = max(0.0, displacement.x);
        }
        velocity = vec4(0.0);
    }
    //displacement.x += 0.9 * displacement.x + getwaves(uv * 10.0) * 4.0;

    //displacement.y += (vec4(sin(fac *  6.28 * uv.x) + sin(fac * 6.28 * uv.y) + 0.0) * 0.0001).x * sin(100.0 * time);
    if (mod(time, 10.0) < 1.0) {
    }
    //fac = 100.0;
    //displacement.y += 0.001 * distance(fract(uv * fac), vec2(0.5)) * sin(6.28 * time);

    // X: dx = -1
    // Y: dx = +1
    // Z: dy = -1
    // W: dy = +1

    //vec4 transfer = 0.1 * vec4(avg.xy * displacement.x, avg.zw * displacement.z);

    vec4 transfer = vec4(0.0);
    if (waterShaderMode > 2.5 && waterShaderMode < 3.5) {
        // That's the height difference (ground + water, neighbour ground + water)
        vec4 delta = (nbg + nbs) - vec4(mine);

        // Now make sure the difference is not greater than available water
        checkDelta(delta.x, mine - groundHeight, nbs.x);
        checkDelta(delta.y, mine - groundHeight, nbs.y);
        checkDelta(delta.z, mine - groundHeight, nbs.z);
        checkDelta(delta.w, mine - groundHeight, nbs.w);

        if (!isWater(groundHeight)) {
            //velocity = -vec4(nbg - groundHeight) * 0.1;
        }

        transfer = velocity - nbsV + 2.0 * 0.25 * 0.5 * delta + 0.0 * 0.25 * 0.5 * avg;
        transfer = min(vec4(0.0), transfer);
        if (!isWater(groundHeight)) {
            //transfer = -vec4(1.0 * max(0.0, mine - groundHeight));
            //transfer = 0.0 * velocity - 0.0 * nbsV + 0.25 * 0.5 * delta + 0.0 * 0.25 * 0.5 * avg;
            //transfer = min(vec4(0.0), transfer);
        }
        if (displacement.x <= 0.0) {
            transfer = vec4(0.0);
        }

        /*
        float c = 0.1 * mapYScale;
        //vec4 nbDiff = -sign(nbg - groundHeight - 0.01 / mapHeight);
        //transfer = min(vec4(0.0), transfer * nbDiff);
        // transfer should be 0 if nbDiff is 1
        //float water = groundHeight;
        float water = mine;
        if (nbg.x - water > c) {
          transfer.x = 0.0;
        }
        if (nbg.y - water > c) {
          transfer.y = 0.0;
        }
        if (nbg.z - water > c) {
          transfer.z = 0.0;
        }
        if (nbg.w - water > c) {
          transfer.w = 0.0;
        }
        */
    }

    if (waterShaderMode < 0.5 || (waterShaderMode < 4.5 && waterShaderMode > 3.5)) {
        vec4 prevTransfer = vec4(0.0);
        prevTransfer.x = texture2D(transferTexture, uv + vec2(-1.0, 0.0) / resolution.xy).y;
        prevTransfer.y = texture2D(transferTexture, uv + vec2(1.0, 0.0) / resolution.xy).x;
        prevTransfer.z = texture2D(transferTexture, uv + vec2(0.0, -1.0) / resolution.xy).w;
        prevTransfer.w = texture2D(transferTexture, uv + vec2(0.0, 1.0) / resolution.xy).z;
        transfer = texture2D(transferTexture, uv);

        float outgoing = vsum(abs(transfer));
        float incoming = vsum(abs(prevTransfer));
        float speed = 1.0;
        float scale = 1.0;

        /*
        float dispx = max(0.0, displacement.x);
        if (outgoing * speed > dispx) {
          scale *= dispx / outgoing;
        } else if (incoming * speed > displacement.x) {
          scale *= dispx / incoming;
        }
        */

        displacement.x += (vsum(transfer) - vsum(prevTransfer)) * speed * scale;
        if (displacement.x > 0.0) {
            //displacement.x *= 0.9999;
        }
        //displacement.x += 0.000001;
        //displacement.x = max(displacement.x, -mapHeight);
        //displacement.x = max(displacement.x, 0.0);

        //float wfcMod = mod(waterFrameCount, 100.0);
        if (isWater(groundHeight) && splashTime > 1.0e-6) {
            float i = 15.0 / 4.0 - floor(uv.x * 16.0) / 4.0 * 0.5;
            float splashTime2 = mod(splashTime + i, 4.0);
            vec2 uvSplash = (vec2(uv.y, fract(uv.x * 16.0)) - vec2(0.5)) / vec2(1.0, 16.0);
            //float d = distance(uvSplash, vec2(0.5));
            float d = length(uvSplash);
            if (d < 0.001 && splashTime2 > 0.5 && splashTime2 < 1.0) {
                displacement.x = mapYScale * (splashTime2 + 0.5);
            } else if (d < 0.01 && splashTime2 >= 2.0 && splashTime2 < 3.0) {
                displacement.x = 0.0;
            }
        }

        vec4 diff = transfer - prevTransfer;
        velocity = 0.5 * (transfer - prevTransfer);

        if (displacement.x < 0.0) {
            velocity = vec4(0.0);
        }

        if (!isWater(groundHeight)) {
            //velocity += vec4(nbg - groundHeight) * 0.001;
            //velocity = vec4(0.0);
            //velocity *= 0.9;
        }
        /*
        if (getDisplacement(displacement) < groundHeight) {
          //velocity = -vec4(0.5);
        }
        */
    }

    // TODO: scale pos
    float mapWidth = 64.0;
    float mapHeight = mapWidth;

    vec2 dx = vec2(1.0, 0.0) / resolution.xy;
    vec2 dy = vec2(0.0, 1.0) / resolution.xy;
    float h1 = getDisplacement(texture2D(texture, uv + dx)) + getGroundHeight(uv + dx);
    float h2 = getDisplacement(texture2D(texture, uv + dy)) + getGroundHeight(uv + dy);
    float hmfac = 0.2;
    vec3 v1 = vec3(dx.x * mapWidth, (h1 - getDisplacement(displacement) - groundHeight) * hmfac , dx.y * mapHeight);
    vec3 v2 = vec3(dy.x * mapWidth, (h2 - getDisplacement(displacement) - groundHeight) * hmfac, dy.y * mapHeight);
    vec3 normal = normalize(cross(v1, v2));
    normal.y = -normal.y;

    if (waterShaderMode > 4.5) {
        gl_FragColor = gaussian(texture);
    } else if (waterShaderMode > 3.5 && waterShaderMode < 4.5) {
        gl_FragColor = velocity;
    } else if (waterShaderMode > 2.5 && waterShaderMode < 3.5) {
        gl_FragColor = transfer;
    } else if (waterShaderMode > 1.5 && waterShaderMode < 2.5) {
        vec3 light = normalize(vec3(-1.0, 1.0, -1.0));
        // TODO: scale pos
        // TODO: set camera pos
        float C = 50.0;
        vec3 cameraPos = vec3(-C, C, -C);
        vec3 pos = vec3((uv.x - 0.5) * mapWidth, vsum(displacement), (uv.y - 0.5) * mapHeight);
        vec3 incomingRay = normalize(pos * vec3(1.0, 1.0, 1.0) - cameraPos);
        vec3 refractionDir = refract(incomingRay, normal, 1.0 / 1.333);
        vec2 nuv =
        (pos - sign(pos.y) * sign(refractionDir.y) * refractionDir *
        (abs(pos.y) / max(1.0e-6, abs(refractionDir.y)))).xz / vec2(mapWidth, mapHeight) + vec2(0.5);
        vec3 color = texture2D(terrainTexture, nuv).rgb;
        //color *= (0.5 + max(0.0, dot(light, normal)));
        color *= max(0.0, dot(light, normal));
        gl_FragColor = vec4(color, 1.0);
    } else if (waterShaderMode > 0.5 && waterShaderMode < 1.5) {
        gl_FragColor = vec4(normal, 1.0);
    } else {
        displacement.y = displacement.x > 0.0 ? groundHeight + displacement.x : 0.0;
        gl_FragColor = vec4(displacement);
    }
}