async function main() {
  var pixels = require('image-pixels');

  // load single source
  var {data, width, height} = await pixels('art/images/ProjectUtumno_full_4096.png')

  //for (let x = 0; x < width; x++) {
  //for (let y = 0; y < width; y++) {
  const tile = [];
  for (let y = 14 * 32; y < 15 * 32; y++) {
    const row = [];
    tile.push(row);
    for (let x = 41 * 32; x < 42 * 32; x++) {
      const color = [];
      row.push(color);
      for (let r = 0; r < 4; r++) {
        const i = (y * width + x) * 4 + r;
        color.push(data[i]);
      }
    }
  }
  console.log(JSON.stringify(tile));
}
main();
