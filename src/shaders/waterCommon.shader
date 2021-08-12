//const float maxTransfer = 1.0;
//const float invMaxTransfer = 1.0 / maxTransfer;
const float transferScale = 1.0;
const float velocityScale = 1.0;
const float byteSize = 255.0;
const float eps = 1.0e-20;
const float velocityOffset = 128.0;
const float signBitCount = 1.0;

/*
const float exponentBitCount = 3.0;
const float mantissaBitCount = 4.0;
// pow(2.0, mantissaBitCount)
const float mantissaSize = 16.0;
*/

const float exponentBitCount = 3.0;
const float mantissaBitCount = 4.0;
// pow(2.0, mantissaBitCount)
const float mantissaSize = 16.0;

//const float encBits = 64.0;
const float encBits = 256.0;

bool isInteger(float v) {
    return fract(v + eps) != fract(v - eps);
}

float scaleIt = 1.0;

float byteToFloat2(float v) {
    v = clamp(floor(v), 0.0, 256.0 - 1.0);
    //return exp(v * 2.0 / 255.0 - 1.0);
    return (v * 2.0 / 255.0 - 1.0) * scaleIt;
}

// Ideas:
// Accumulator: small exponent transfer, overflow into high exponent water height. but how to tell what is the transfer, for velocity?
// Varying: vary the precision over frames, such that big waves are in one frame and small waves in another
// Random: vary the precision randomly as a function of time to avoid stagnation. remember to read last frame using seed from last frame.
// Perhaps allow additional buffer to store more data. Each additional buffer brings another render and probably more texture reads..
// Velocity only depends on transfer. Maybe can do it in 2 passes.
// Incorporate gaussian in main pass. But what about its huge amount of reads? Find solution.
// Do additional passes which try to do as few texture lookups as possible. Perhaps simple copy and so on?

// Convert a byte from 0.0 to 255.0 to floating point between -1.0 and 1.0
float byteToFloat(float v) {
    v = clamp(floor(v), 0.0, encBits - 1.0);
    //float sgn = sign(v - 127.0) < 0.0 ? -1.0 : 1.0;
    float sgn = sign(v - encBits * 0.5 - 1.0);
    /*
    if (v - encBits * 0.5 <= eps) {
        sgn = 0.0;
    }
    */
    v = mod(v, encBits * 0.5);
    //float msize = pow(2.0, mantissaBitCount);
    //float mantissa = mod(v, mantissaSize) + 1.0;
    //float exponent = floor(v / mantissaSize);
    float mantissa = v;
    float exponent = 0.0;
    if (abs(mantissa) < eps) {
        return 0.0;
    }
    float l = ceil(log2(mantissa));
    exponent = l;
    //mantissa *= pow(0.5, l);
    mantissa *= pow(2.0, -l);
    //float exponent = v - 16.0;
    //float mantissa = 1.0;
    return sgn * pow(2.0, exponent) * mantissa;
}

float floatToByte2(float v) {
    //v = log(v);
    v /= scaleIt;
    v = clamp(v, -1.0, 1.0);
    return floor((v + 1.0) / 2.0 * 255.0);
}

// Convert a float between -1 and 1 to a minifloat
float floatToByte(float v) {
    //float sign = max(sign(v), 0.0);
    //float exponent =
    float mind = 1.0e20;
    float mini = 0.0;
    for (float i = 0.0; i < encBits; i += 1.0) {
        float n = byteToFloat(i);
        float d = abs(v - n);
        if (d < mind) {
            mind = d;
            mini = i;
        }
    }
    return mini;
}

vec3 EncodeFloatRGBA3(float v) {
    vec3 enc = vec3(0.0);
    enc.x = mod(v, encBits);
    v = floor(v / encBits);
    enc.y = mod(v, encBits);
    v = floor(v / encBits);
    enc.z = mod(v, encBits);
    enc = vec3(byteToFloat(enc.x), byteToFloat(enc.y), byteToFloat(enc.z));
    return enc;
}

float DecodeFloatRGBA3(vec3 rgba) {
    rgba = vec3(floatToByte(rgba.x), floatToByte(rgba.y), floatToByte(rgba.z));
    float e = encBits;
    return rgba.x + rgba.y * e + rgba.z * e * e;
}

vec3 EncodeFloatRGBA3_2(float v) {
    vec3 enc = vec3(0.0);
    enc.x = mod(v, encBits);
    v = floor(v / encBits);
    enc.y = mod(v, encBits);
    v = floor(v / encBits);
    enc.z = mod(v, encBits);
    //enc = vec3(byteToFloat(enc.x), byteToFloat(enc.y), byteToFloat(enc.z));
    return enc;
}

float DecodeFloatRGBA3_2(vec3 rgba) {
    //rgba = vec3(floatToByte(rgba.x), floatToByte(rgba.y), floatToByte(rgba.z));
    float e = encBits;
    return rgba.x + rgba.y * e + rgba.z * e * e;
}

// 32 * 4 / 10 = 12.8
// 24 * 4 = 96 / 10 = 9.6
struct WaterGroundTransferVelocity {
    float water;
    float ground;
    vec4 transfer;
    vec4 velocity;
};

float getDisplacement(WaterGroundTransferVelocity a) {
    return max(0.0, a.water);
}

float getFinalDisplacement(WaterGroundTransferVelocity a) {
    return a.water > 0.0 ? a.ground + a.water * 1.0 : 0.0;
    //return max(0.0, a.water) * 10.0;
}

float getGroundHeight(WaterGroundTransferVelocity v) {
    return v.ground;
}

float Compose(float vx, float vy) {
    /*
    if (abs(vx - 255.0) <= eps && abs(vy - 0.0) <= eps) {
        return 0.0;
    }
    */
    float l = vx - 128.0;
    float l2 = (vy - 128.0) / 128.0;
    if (abs(vx) > 0.5) {
        l2 = sign(l2) * (abs(l2) + 1.0) * 0.5;
    }
    return pow(2.0, l) * l2;
    //return pow(2.0, l);
}

vec2 Decompose(float v) {
    /*
    if (abs(v) <= eps) {
        return vec2(255.0, 0.0);
    }
    */
    float l = abs(v) == 0.0 ? -128.0 : ceil(log2(abs(v)));
    //float l1 = l >= 0.0 ? clamp(l, 0.0, 128.0) + 127.0 : clamp(l + 127.0, 0, 128.0);
    float l1 = clamp(l + 128.0, 0.0, 255.0);
    float l2 = 0.0;
    if (l1 <= 0.5) {
        l2 = sign(v) * floor((abs(v) * 1.0 * pow(2.0, -l) - 0.0) * 128.0);
    } else {
        l2 = sign(v) * floor((abs(v) * 2.0 * pow(2.0, -l) - 1.0) * 128.0);
    }
    l2 = clamp(l2 + 128.0, 0.0, 255.0);
    return vec2(l1, l2);
}

vec4 pack(WaterGroundTransferVelocity v) {
    vec4 ret = vec4(0.0);
    vec2 w = Decompose(v.water);
    vec2 g = Decompose(v.ground);
    vec2 tx = Decompose(v.transfer.x);
    vec2 ty = Decompose(v.transfer.y);
    vec2 tz = Decompose(v.transfer.z);
    vec2 tw = Decompose(v.transfer.w);
    ret.x = DecodeFloatRGBA3_2(vec3(w.x, w.y, g.x));
    ret.y = DecodeFloatRGBA3_2(vec3(g.y, tx.x, tx.y));
    ret.z = DecodeFloatRGBA3_2(vec3(ty.x, ty.y, tz.x));
    ret.w = DecodeFloatRGBA3_2(vec3(tz.y, tw.x, tw.y));
    /*
    // Pack 25: 2 * 16 = 32, 32 - 25 = 7
    ret.x = Pack25(0, w.water, g.ground, 0.0, 0.0);
    // Pack 50: 4 * 16 = 64, 64 - 50 = 14
    ret.y = Pack25(1, g.ground, v.transfer.x, v.transfer.y, v.transfer.z);
    // Pack 75: 5 * 16 = 80, 80 - 75 = 5
    ret.z = Pack25(2, g.ground, v.transfer.y, v.transfer.z);
    // Pack 100: 6 * 16 = 96, 80 - 75 = 5
    ret.w = Pack25(3, g.ground, v.transfer.x, v.transfer.y);
    */

    //4 * 24 = 96
    //4 * 25 = 100
    //100 / 6 = 16
    return ret;
}

WaterGroundTransferVelocity unpack(vec4 v) {
    WaterGroundTransferVelocity ret;
    vec3 a = EncodeFloatRGBA3_2(v.x);
    vec3 b = EncodeFloatRGBA3_2(v.y);
    vec3 c = EncodeFloatRGBA3_2(v.z);
    vec3 d = EncodeFloatRGBA3_2(v.w);
    ret.water = Compose(a.x, a.y);
    ret.ground = Compose(a.z, b.x);
    ret.transfer.x = Compose(b.y, b.z);
    ret.transfer.y = Compose(c.x, c.y);
    ret.transfer.z = Compose(c.z, d.x);
    ret.transfer.w = Compose(d.y, d.z);
    return ret;
}

vec4 pack2(WaterGroundTransferVelocity v) {
    vec4 ret = vec4(0.0);
    ret.x = DecodeFloatRGBA3(vec3(v.water, v.ground, v.transfer.x));
    ret.y = DecodeFloatRGBA3(v.transfer.yzw);
    ret.z = DecodeFloatRGBA3(v.velocity.xyz);
    ret.w = DecodeFloatRGBA3(vec3(v.velocity.w, 0.0, 0.0));
    return ret;
}

WaterGroundTransferVelocity unpack2(vec4 v) {
    WaterGroundTransferVelocity ret;
    vec3 a = EncodeFloatRGBA3(v.x);
    vec3 b = EncodeFloatRGBA3(v.y);
    vec3 c = EncodeFloatRGBA3(v.z);
    vec3 d = EncodeFloatRGBA3(v.w);
    ret.water = a.x;
    ret.ground = a.y;
    ret.transfer.x = a.z;
    ret.transfer.yzw = b;
    ret.velocity.xyz = c;
    ret.velocity.w = d.x;
    return ret;
}