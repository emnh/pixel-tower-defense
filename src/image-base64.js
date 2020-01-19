const process = require('process');

const base64Img = require('base64-img');

const fname = process.argv[2];

var data = base64Img.base64Sync(fname);
console.log(fname, data);
