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