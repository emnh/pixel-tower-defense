const process = require('process');

const { imageHash }= require('image-hash');

const fname = process.argv[2];

// imageHash('https://ichef-1.bbci.co.uk/news/660/cpsprodpb/7F76/production/_95703623_mediaitem95703620.jpg', 16, true, (error, data) => {
imageHash(fname, 16, true, (error, data) => {
  if (error) throw error;
  console.log(fname, data);
});
