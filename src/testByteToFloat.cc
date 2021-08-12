#include <iostream>
#include <cmath>
#include <algorithm>

using namespace std;

const float exponentBitCount = 3.0;
const float mantissaBitCount = 4.0;
// pow(2.0, mantissaBitCount)
const float mantissaSize = 16.0;

template <typename T> int sgn(T val) {
    return (T(0) < val) - (val < T(0));
}

float byteToFloat(float v) {
    float i = v;
    v = clamp(floor(v), 0.0f, 256.0f);
    float sgn2 = sgn(v - 127.0f) < 0.0 ? -1.0 : 1.0;
    v = fmod(v, 128.0f);
    //float msize = pow(2.0, mantissaBitCount);
    float exponent = floor(v / mantissaSize);
    //cout << "exp: " << exponent << endl;
    float mantissa = fmod(v, mantissaSize) + 1.0;
    float l = floor(log2(mantissa));
    exponent -= l;
    mantissa /= pow(2.0, l);
    //cout << "mantissa: " << mantissa << endl;
    float ret = sgn2 * pow(0.5f, exponent) * mantissa;
    cout << "i: " << i << ", e:" << exponent << ", m: " << mantissa << ": " << ret << endl;
    return ret;
}

struct vec2 {
  float x;
  float y;
};

const float eps = 1.0e-20;

float c1 = 31.0f;
float c2 = 511.0f;

float Compose(float vx, float vy) {
    /*
    if (vx == 255.0 && vy == 0.0) {
      return 0.0;
    }
    */
    float l = vx - c1;
    float l2 = (vy - c2) / c2;
    if (abs(vx) > eps) {
        l2 = sgn(l2) * (abs(l2) + 1.0) * 0.5;
    }
    return pow(2.0, l) * l2;
    //return pow(2.0, l);
}

vec2 Decompose(float v) {
    // TODO: Do we do ceil if negative?
    vec2 ret;
    /*
    if (abs(v) == eps) {
      ret.x = 255.0f;
      ret.y = 0.0f;
      return ret;
    }
    */
    float l = abs(v) == 0.0 ? -c1 : ceil(log2(abs(v)));
    //float l1 = l >= 0.0 ? clamp(l, 0.0, 128.0) + 127.0 : clamp(l + 127.0, 0, 128.0);
    float l1 = clamp(l + c1, 0.0f, 2.0f * c1);
    float l2 = 0.0f;
    if (l1 <= eps) {
        l2 = sgn(v) * floor((abs(v) * 1.0f * pow(2.0, -l) - 0.0f) * c2);
    } else {
        l2 = sgn(v) * floor((abs(v) * 2.0f * pow(2.0, -l) - 1.0f) * c2);
    }
    l2 = clamp(l2 + c2, 0.0f, 2.0f * c2);
    ret.x = l1;
    ret.y = l2;
    return ret;
}

int main() {
  float sx = 0.0;
  for (int i = 0; i < 65536.0; i++) {
    //byteToFloat((float) i);
    float f = i == 0 ? 0.0 : 1.0 / i;
    vec2 res = Decompose(f);
    res.x = floor(res.x);
    res.y = floor(res.y);
    float x = Compose(res.x, res.y);
    cout << "i: " << i << ", f: " << f << ", xy: " << res.x << " " << res.y << " " << x << ", i - x: " << abs(f - x) << endl;
    sx += i == 0 ? abs(f - x) : abs(f - x) / (float) f;
    //sx += abs(f - x);
  }
  cout << "SX: " << sx << endl;
  //std::cout << "Hello World!\n";
}
