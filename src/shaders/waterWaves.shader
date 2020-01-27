precision highp float;

float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

vec4 round(vec4 v) {
    return floor(v + 0.5);
}

float normpdf(in float x, in float sigma) {
    return 0.39894*exp(-0.5*x*x/(sigma*sigma))/sigma;
}

vec4 gaussian(sampler2D texture) {
    //vec3 c = texture2D(texture, gl_FragCoord.xy / resolution.xy).rgb;
    WaterGroundTransferVelocity wgtv = unpack(texture2D(texture, gl_FragCoord.xy / resolution.xy));
    float c = wgtv.water;

    //declare stuff
    //const int mSize = 11;
    const int mSize = 3;
    const int kSize = (mSize-1)/2;
    float kernel[mSize];
    float final_colour = 0.0;

    //create the 1-D kernel
    //float sigma = 2.0;
    float sigma = 1.0;
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
            final_colour +=
                kernel[kSize+j]*kernel[kSize+i]*unpack(texture2D(texture, (gl_FragCoord.xy+vec2(float(i),float(j))) / resolution.xy)).water;
        }
    }

    wgtv.water = final_colour;
    return pack(wgtv);
    //return vec4(final_colour/(Z*Z), 1.0);
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

float checkDelta(float delta, float waterMine, float waterNB) {
    if (delta > 0.0) {
        delta = min(delta, max(0.0, waterNB));
        //delta = min(delta, max(0.0, waterMine));
    } else {
        delta = -min(-delta, max(0.0, waterMine));
        //delta = max(delta, max(0.0, -waterNB));
    }
    return delta;
}

float posWater(float x) {
    return max(0.0, x);
}



vec4 EncodeFloatRGBA(float v) {
    vec4 enc = vec4(0.0);
    enc.x = mod(v, encBits);
    v = floor(v / encBits);
    enc.y = mod(v, encBits);
    v = floor(v / encBits);
    enc.z = mod(v, encBits);
    v = floor(v / encBits);
    enc.w = mod(v, encBits);
    enc = vec4(byteToFloat(enc.x), byteToFloat(enc.y), byteToFloat(enc.z), byteToFloat(enc.w));
    return enc;
}

float DecodeFloatRGBA(vec4 rgba) {
    rgba = vec4(floatToByte(rgba.x), floatToByte(rgba.y), floatToByte(rgba.z), floatToByte(rgba.w));
    float e = encBits;
    return rgba.x + rgba.y * e + rgba.z * e * e + rgba.w * e * e * e;
}

vec4 EncodeFloatRGBA2(float v) {
    //vec4 enc = vec4(1.0, 255.0, 65025.0, 16581375.0) * v;
    //enc = fract(enc);
    //enc -= enc.yzww * vec4(1.0/255.0,1.0/255.0,1.0/255.0,0.0);
    float sgn = max(sign(v), 0.0);
    v = abs(v);
    vec4 enc = vec4(0.0); //vec4(rgba.x, rgba.y % 256.0, )

    /*
    if (isInteger(v)) {
        //enc.w = floor(log2(v));
        //float p = 1.0;
        float v2 = v;
        for (float w = 128.0; w < 256.0; w += 1.0) {
            //float v2 = v / pow(2.0, w - 127.0);
            //if (fract(v2) <= eps) {
            //float p = pow(2.0, w - 127.0);
            v2 *= 0.5;
            //if (mod(v, p) <= eps) {
            if (!isInteger(v2)) {
                v = v2 * 2.0;
                enc.w = w;
                break;
            }
        }
    } else {
        //float p = 1.0;
        float v2 = v;
        for (float w = 127.0; w >= 0.0; w -= 1.0) {
            //float v2 = v / pow(2.0, w - 127.0);
            //if (fract(v2) <= eps) {
            //float p = pow(2.0, w - 127.0);
            v2 *= 2.0;
            //if (mod(v, p) <= eps) {
            if (isInteger(v2)) {
                v = v2;
                enc.w = w;
                break;
            }
        }
    }
    */

    //enc.w = 128.0;
    enc.w = floor(log2(v) + 0.0);
    v = floor(v / pow(2.0, enc.w));
    enc.x = mod(v, 256.0);
    v = floor(v / 256.0);
    enc.y = mod(v, 256.0);
    v = floor(v / 256.0);
    enc.z = mod(v, 256.0) + sgn * 128.0;
    //enc = mod(enc, 256.0);
    enc = vec4(byteToFloat(enc.x), byteToFloat(enc.y), byteToFloat(enc.z), byteToFloat(enc.w));
    return enc;
}

float DecodeFloatRGBA2(vec4 rgba) {
    //rgba = clamp(floor(rgba * 255.0) / 255.0, 0.0, 254.0 / 255.0);
    rgba = vec4(floatToByte(rgba.x), floatToByte(rgba.y), floatToByte(rgba.z), floatToByte(rgba.w));
    float sgn = sign(rgba.z - 127.0);
    if (sgn <= eps) {
        sgn = -1.0;
    }
    rgba.z = mod(rgba.z, 128.0);
    //return sgn * (rgba.x + rgba.y * 256.0 + rgba.z * 256.0 * 256.0) * pow(2.0, floor(rgba.w / 2.0));
    //return sgn * (rgba.x + rgba.y * 256.0 + rgba.z * 256.0 * 256.0) * pow(2.0, rgba.w - 127.0);
    return sgn * (rgba.x + rgba.y * 256.0 + rgba.z * 256.0 * 256.0) * pow(2.0, rgba.w);
    //return sgn * (rgba.x + rgba.y * 256.0 + rgba.z * 256.0 * 256.0 + rgba.w * 256.0 * 256.0 * 256.0;
    //return sgn * (rgba.x + rgba.y * 256.0 + rgba.z * 256.0 * 256.0) * pow(2.0, floor(rgba.w * 128.0 / 255.0));
    //return dot( rgba, vec4(1.0, 1.0/255.0, 1.0/65025.0, 1.0/16581375.0) );
}

vec4 EncodeFloatRGBANeg(float v) {
    vec4 enc = vec4(1.0, 255.0, 65025.0, 16581375.0) * v;
    enc = fract(enc);
    enc -= enc.yzww * vec4(1.0/255.0,1.0/255.0,1.0/255.0,0.0);
    enc = enc * 2.0 - 1.0;
    return enc;
}

float DecodeFloatRGBANeg(vec4 rgba) {
    rgba = (rgba + 1.0) / 2.0;
    rgba = clamp(floor(rgba * 255.0) / 255.0, 0.0, 254.0 / 255.0);
    return dot( rgba, vec4(1.0, 1.0/255.0, 1.0/65025.0, 1.0/16581375.0) );
}

vec4 getTransfer(vec4 displacement) {
    return EncodeFloatRGBA(displacement.z) * transferScale;
    /*
    vec4 v1 = EncodeFloatRGBA(displacement.z);
    vec4 v = vec4(1.0) / v1;
    v = v - 1.0;
    //v = log(v);
    v *= vec4(transferScale);
    // TODO: optimize
    if (v1.x <= eps) {
        v.x = 0.0;
    }
    if (v1.y <= eps) {
        v.y = 0.0;
    }
    if (v1.z <= eps) {
        v.z = 0.0;
    }
    if (v1.w <= eps) {
        v.w = 0.0;
    }
    return v;
    //return (transferScale / max(abs(EncodeFloatRGBA(displacement.z)), eps) - 1.0); // - EncodeFloatRGBA(displacement.w) * maxTransfer / byteSize;
    */
}

float setTransfer(vec4 transfer) {
    return DecodeFloatRGBA(transfer / transferScale);
    /*
    vec4 transferNorm = transfer;
    transferNorm = max(vec4(0.0), transferNorm);
    transferNorm /= vec4(transferScale);
    //transferNorm = exp(transferNorm);
    transferNorm = 1.0 + transferNorm;
    transferNorm = vec4(1.0) / transferNorm;
    //transferNorm = 1.0 / (1.0 + abs(transferNorm) / transferScale);
    // TODO: optimize
    if (transfer.x <= eps) {
        transferNorm.x = 0.0;
    }
    if (transfer.y <= eps) {
        transferNorm.y = 0.0;
    }
    if (transfer.z <= eps) {
        transferNorm.z = 0.0;
    }
    if (transfer.w <= eps) {
        transferNorm.w = 0.0;
    }
    return DecodeFloatRGBA(transferNorm);
    */
}

vec4 getVelocity(vec4 displacement) {
    //return vec4(0.0);
    return EncodeFloatRGBA(displacement.w / velocityScale);
    //return EncodeFloatRGBANeg(displacement.w / velocityScale);
    /*
    vec4 v1 = EncodeFloatRGBA(displacement.w);
    vec4 v = vec4(1.0) / v1;
    v = v - 1.0;
    v *= vec4(velocityScale);
    v = v - velocityOffset;
    if (v1.x <= eps) {
        v.x = 0.0;
    }
    if (v1.y <= eps) {
        v.y = 0.0;
    }
    if (v1.z <= eps) {
        v.z = 0.0;
    }
    if (v1.w <= eps) {
        v.w = 0.0;
    }
    return v;
    */
    //vec4 v = velocityScale / max(abs(EncodeFloatRGBA(displacement.w)), eps) - 1.0;
    //return (v - vec4(velocityOffset));
}

float setVelocity(vec4 velocity) {
    return DecodeFloatRGBA(velocity) * velocityScale;
    //return DecodeFloatRGBANeg(velocity) * velocityScale;
    /*
    vec4 velocityNorm = velocity + velocityOffset;
    velocityNorm = max(vec4(0.0), velocityNorm);
    velocityNorm /= vec4(velocityScale);
    velocityNorm = 1.0 + velocityNorm;
    velocityNorm = vec4(1.0) / velocityNorm;
    //vec4 velocityNorm = max(vec4(0.0), velocity + velocityOffset);
    //velocityNorm = 1.0 / (1.0 + abs(velocityNorm) / velocityScale);
    // TODO: optimize
    if (velocity.x <= eps) {
        velocityNorm.x = 0.0;
    }
    if (velocity.y <= eps) {
        velocityNorm.y = 0.0;
    }
    if (velocity.z <= eps) {
        velocityNorm.z = 0.0;
    }
    if (velocity.w <= eps) {
        velocityNorm.w = 0.0;
    }
    return DecodeFloatRGBA(velocityNorm);
    */
}

WaterGroundTransferVelocity lookup(vec2 uv) {
    vec2 uv2 = vec2(0.0);
    uv2.x = clamp(uv.x, 0.5 / resolution.x, 1.0 - 0.5 / resolution.x);
    uv2.y = clamp(uv.y, 0.5 / resolution.y, 1.0 - 0.5 / resolution.y);
    WaterGroundTransferVelocity ret;
    if (uv == uv2) {
        ret = unpack(texture2D(texture, uv));
    } else {
        ret.water = 0.0;
        ret.ground = 0.0;
        ret.transfer = vec4(0.0);
        ret.velocity = vec4(0.0);
    }
    return ret;
}

void main() {
    //Packing
    /*
    float a = 0.45;
    float b = 0.55;
    int aScaled = a * 0xFFFF;
    int bScaled = b * 0xFFFF;
    int abPacked = (aScaled << 16) | (bScaled & 0xFFFF);
    float finalFloat = asfloat(abPacked);

    //Unpacking
    float inputFloat = finalFloat;
    int uintInput = asuint(inputFloat);
    float aUnpacked = (uintInput >> 16) / 65535.0f;
    float bUnpacked = (uintInput & 0xFFFF) / 65535.0f;
    */

    vec2 uv = gl_FragCoord.xy / resolution.xy;

    WaterGroundTransferVelocity wgtv = lookup(uv);

    float groundHeight = getGroundHeight(wgtv);
    //vec4 velocity = texture2D(velocityTexture, uv);

    /*
    nbg.x = getGroundHeight(uv + vec2(-1.0, 0.0) / resolution.xy);
    nbg.y = getGroundHeight(uv + vec2(1.0, 0.0) / resolution.xy);
    nbg.z = getGroundHeight(uv + vec2(0.0, -1.0) / resolution.xy);
    nbg.w = getGroundHeight(uv + vec2(0.0, 1.0) / resolution.xy);
    */

    WaterGroundTransferVelocity nbX = lookup(uv + vec2(-1.0, 0.0) / resolution.xy);
    WaterGroundTransferVelocity nbY = lookup(uv + vec2(1.0, 0.0) / resolution.xy);
    WaterGroundTransferVelocity nbZ = lookup(uv + vec2(0.0, -1.0) / resolution.xy);
    WaterGroundTransferVelocity nbW = lookup(uv + vec2(0.0, 1.0) / resolution.xy);
    /*
    vec4 nbX = texture2D(texture, uv + vec2(-1.0, 0.0) / resolution.xy);
    vec4 nbY = texture2D(texture, uv + vec2(1.0, 0.0) / resolution.xy);
    vec4 nbZ = texture2D(texture, uv + vec2(0.0, -1.0) / resolution.xy);
    vec4 nbW = texture2D(texture, uv + vec2(0.0, 1.0) / resolution.xy);
    */

    vec4 nbs = vec4(0.0);
    nbs.x = getDisplacement(nbX);
    nbs.y = getDisplacement(nbY);
    nbs.z = getDisplacement(nbZ);
    nbs.w = getDisplacement(nbW);

    vec4 nbg = vec4(0.0);
    nbg.x = getGroundHeight(nbX);
    nbg.y = getGroundHeight(nbY);
    nbg.z = getGroundHeight(nbZ);
    nbg.w = getGroundHeight(nbW);

    float mine = groundHeight + getDisplacement(wgtv);
    float avg = 0.25 * ((nbs.x - mine) + (nbs.y - mine) + (nbs.z - mine) + (nbs.w - mine));

    vec4 nbsV = vec4(0.0);
    nbsV.x = texture2D(velocityTexture, uv + vec2(-1.0, 0.0) / resolution.xy).y;
    nbsV.y = texture2D(velocityTexture, uv + vec2(1.0, 0.0) / resolution.xy).x;
    nbsV.z = texture2D(velocityTexture, uv + vec2(0.0, -1.0) / resolution.xy).w;
    nbsV.w = texture2D(velocityTexture, uv + vec2(0.0, 1.0) / resolution.xy).z;

    //if (mod(waterFrameCount, 1000.0) == 0.0) {
    if (waterFrameCount < 0.5) {
        //displacement.y = (vec4(sin(fac *  6.28 * uv.x) + sin(fac * 6.28 * uv.y) + 0.0) * 0.1).x; // * vec4(0.000125);
        // velocity = vec4(0.0);
        /*
        displacement = vec4(0.0);
        displacement.z = DecodeFloatRGBA(vec4(0.0));
        displacement.w = DecodeFloatRGBA(vec4(0.0));
        */
        //displacement = vec4(0.0);
        // TODO: move to waterInit
        wgtv.water = 0.0;
        //wgtv.ground = 0.0;
        //wgtv.transfer = vec4(0.0);
        //wgtv.velocity = vec4(0.0);
        if (isWater(groundHeight)) {
            //displacement.x = 0.5 * s;
            //displacement.y = 0.005 * s;
            wgtv.water = (getwaves(uv * 8.0) * 5.0) - 1.5 - groundHeight;
            wgtv.water = max(0.0, wgtv.water);
        }
        //velocity = vec4(0.0);
    }
    //displacement.x += 0.9 * displacement.x + getwaves(uv * 10.0) * 4.0;

    //displacement.y += (vec4(sin(fac *  6.28 * uv.x) + sin(fac * 6.28 * uv.y) + 0.0) * 0.0001).x * sin(100.0 * time);
    //if (mod(time, 10.0) < 1.0) {
    //}
    //fac = 100.0;
    //displacement.y += 0.001 * distance(fract(uv * fac), vec2(0.5)) * sin(6.28 * time);

    // X: dx = -1
    // Y: dx = +1
    // Z: dy = -1
    // W: dy = +1

    //vec4 transfer = 0.1 * vec4(avg.xy * displacement.x, avg.zw * displacement.z);

    //vec4 oldTransfer = vec4(0.0);
    //if (waterShaderMode < 0.5 || (waterShaderMode < 4.5 && waterShaderMode > 3.5)) {

        /*
        vec4 oldNBTransfer = vec4(0.0);
        oldNBTransfer.x = texture2D(transferTexture, uv + vec2(-1.0, 0.0) / resolution.xy).y;
        oldNBTransfer.y = texture2D(transferTexture, uv + vec2(1.0, 0.0) / resolution.xy).x;
        oldNBTransfer.z = texture2D(transferTexture, uv + vec2(0.0, -1.0) / resolution.xy).w;
        oldNBTransfer.w = texture2D(transferTexture, uv + vec2(0.0, 1.0) / resolution.xy).z;
        vec4 oldTransfer = texture2D(transferTexture, uv);
        */

        vec4 oldTransfer = wgtv.transfer;
        vec4 oldNBTransfer = vec4(0.0);
        oldNBTransfer.x = nbX.transfer.y;
        oldNBTransfer.y = nbY.transfer.x;
        oldNBTransfer.z = nbZ.transfer.w;
        oldNBTransfer.w = nbW.transfer.z;

        //transfer = vec4(1.0);
        //prevTransfer = vec4(0.5);

        if (waterFrameCount < 0.5) {
            oldTransfer = vec4(0.0);
            oldNBTransfer = vec4(0.0);
        }

        //float outgoing = vsum(abs(oldTransfer));
        //float incoming = vsum(abs(oldNBTransfer));
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

        wgtv.water += (vsum(oldTransfer) - vsum(oldNBTransfer)) * speed * scale;

        //if (displacement.x > 0.0) {
            //displacement.x *= 0.9999;
        //}
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
                wgtv.water = mapYScale * (splashTime2 + 0.5);
            } else if (d < 0.01 && splashTime2 >= 2.0 && splashTime2 < 3.0) {
                wgtv.water = 0.0;
            }
        }

        //vec4 diff = transfer - prevTransfer;
        vec4 newVelocity = 0.5 * (oldTransfer - oldNBTransfer) * scale;
        //vec4 newVelocity = (oldTransfer - oldNBTransfer) * scale;

        //velocity = vec4(0.0);
        if (waterFrameCount < 0.5) {
            newVelocity = vec4(0.0);
        }

        if (wgtv.water < 0.0) {
            newVelocity = vec4(0.0);
        }

        //if (!isWater(groundHeight)) {
            //velocity += vec4(nbg - groundHeight) * 0.001;
            //velocity = vec4(0.0);
            //velocity *= 0.9;
        //}
        /*
        if (getDisplacement(displacement) < groundHeight) {
          //velocity = -vec4(0.5);
        }
        */
    //}

    //if (waterShaderMode > 2.5 && waterShaderMode < 3.5) {
    // That's the height difference (ground + water, neighbour ground + water)
    vec4 delta = (nbg + nbs) - vec4(mine);

    // Now make sure the difference is not greater than available water
    checkDelta(delta.x, mine - groundHeight, nbs.x);
    checkDelta(delta.y, mine - groundHeight, nbs.y);
    checkDelta(delta.z, mine - groundHeight, nbs.z);
    checkDelta(delta.w, mine - groundHeight, nbs.w);

    //if (!isWater(groundHeight)) {
        //velocity = -vec4(nbg - groundHeight) * 0.1;
    //}

    /*
    vec4 nbsV = vec4(0.0);
    nbsV.x = nbX.velocity.y;
    nbsV.y = nbY.velocity.x;
    nbsV.z = nbZ.velocity.w;
    nbsV.w = nbW.velocity.z;
    */

    //velocity = 0.5 * (transfer - prevTransfer);
    vec4 oldVelocity = texture2D(velocityTexture, uv);
    //vec4 oldVelocity = wgtv.velocity;

    vec4 newTransfer = oldVelocity - nbsV + 2.0 * 0.25 * 0.5 * delta + 0.0 * 0.25 * 0.5 * avg;
    //vec4 newTransfer = 2.0 * 0.25 * 0.5 * delta + 0.0 * 0.25 * 0.5 * avg;
    //vec4 newTransfer = oldVelocity - nbsV + 0.25 * 0.5 * delta + 0.0 * 0.25 * 0.5 * avg;
    //transfer = 2.0 * 0.25 * 0.5 * delta + 0.0 * 0.25 * 0.5 * avg;
    newTransfer = min(vec4(0.0), newTransfer);
    //transfer = max(vec4(0.0), -transfer);

    // What about the new prevTransfer?
    //velocity = 0.5 * (transfer - prevTransfer);

    //if (!isWater(groundHeight)) {
        //transfer = -vec4(1.0 * max(0.0, mine - groundHeight));
        //transfer = 0.0 * velocity - 0.0 * nbsV + 0.25 * 0.5 * delta + 0.0 * 0.25 * 0.5 * avg;
        //transfer = min(vec4(0.0), transfer);
    //}
    if (wgtv.water <= 0.0) {
        newTransfer = vec4(0.0);
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

    // transfer is negative
    //transfer = -vec4(0.0);
    //prevTransfer = vec4(0.5);

    //displacement.z = setTransfer(newTransfer);
    //displacement.w = setVelocity(newVelocity);

    // TODO: scale pos
    float mapWidth = 64.0;
    float mapHeight = mapWidth;

    vec2 dx = vec2(1.0, 0.0) / resolution.xy;
    vec2 dy = vec2(0.0, 1.0) / resolution.xy;
    //float h1 = getFinalDisplacement(nbY) + getGroundHeight(nbY);
    //float h2 = getDisplacement(nbW) + getGroundHeight(nbW);
    float h1 = getFinalDisplacement(nbY);
    float h2 = getFinalDisplacement(nbW);
    float hmfac = 0.2;
    vec3 v1 = vec3(dx.x * mapWidth, (h1 - mine) * hmfac, dx.y * mapHeight);
    vec3 v2 = vec3(dy.x * mapWidth, (h2 - mine) * hmfac, dy.y * mapHeight);
    vec3 normal = normalize(cross(v1, v2));
    normal.y = -normal.y;

    if (waterFrameCount < 1.5) {
        newVelocity = vec4(0.0);
    }
    if (waterFrameCount < 0.5) {
        newTransfer = vec4(0.0);
    }

    if (waterShaderMode > 4.5) {
        gl_FragColor = gaussian(texture);
        //wgtv.transfer = newTransfer;
        //wgtv.velocity = newVelocity;
        //gl_FragColor = pack(wgtv);
    } else if (waterShaderMode > 3.5 && waterShaderMode < 4.5) {
        gl_FragColor = newVelocity;
    } else if (waterShaderMode > 2.5 && waterShaderMode < 3.5) {
        gl_FragColor = newTransfer;
    } else if (waterShaderMode > 1.5 && waterShaderMode < 2.5) {
        vec3 light = normalize(vec3(-1.0, 1.0, -1.0));
        // TODO: scale pos
        // TODO: set camera pos
        float C = 50.0;
        vec3 cameraPos = vec3(-C, C, -C);
        vec3 pos = vec3((uv.x - 0.5) * mapWidth, getFinalDisplacement(wgtv), (uv.y - 0.5) * mapHeight);
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
        //displacement.y = displacement.x > 0.0 ? groundHeight + displacement.x : 0.0;
        //displacement.x += 0.01;
        wgtv.transfer = newTransfer;
        wgtv.velocity = newVelocity;
        gl_FragColor = pack(wgtv);
    }
}