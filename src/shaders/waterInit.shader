float getGroundHeight(vec2 uv) {
    // Outside map let height be:
    /*
    if (abs(uv.x - 0.5) > 0.5 - 1.0e-2) {
        return 0.0;
    }
    if (abs(uv.y - 0.5) > 0.5 - 1.0e-2) {
        return 0.0;
    }
    */
    vec2 tileIndexUV = floor(uv * mapSizeInTiles) / mapSizeInTiles;
    vec4 tileIndex = texture2D(tileIndexTexture, tileIndexUV);
    float groundHeight = tileIndex.z;
    return mapYScale * groundHeight;
}

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    float height = getGroundHeight(uv);
    WaterGroundTransferVelocity wgtv;
    wgtv.water = 0.0;
    wgtv.ground = height;
    wgtv.velocity = vec4(0.0);
    wgtv.transfer = vec4(0.0);
    gl_FragColor = pack(wgtv);
}