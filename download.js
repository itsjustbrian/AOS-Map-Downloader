/**
 * Author: Brian Ferch (https://github.com/itsjustbrian) 
 * Date: December 2019
 * 
 * Bulk downloads map files and images from aos.party
 */

const rp = require('request-promise');
const r = require('request');
const cheerio = require('cheerio')
const fs = require('fs');
const path = require('path');
const del = require('del');
const readline = require('readline');

const MAPS_DIRECTORY = 'AOS_Maps';
const AOS_DOMAIN = 'http://aos.party';
const AOS_DOWNLOAD_LINK = AOS_DOMAIN + '/dl.php';
const AOS_VIEW_LINK = AOS_DOMAIN + '/view.php';
const VERSION_EXTENSION = (num) => `_v${num}`;

// Change these to download specific maps
const STARTING_MAP_ID = 0;
const CHUNK_SIZE = 15;
const SHOULD_LOOP = true;

const args = process.argv.slice(2);
let FOLDERS = VERSIONS = IMAGES = true;
for (let arg of args) {
  if (arg === '--no-folders') FOLDERS = false;
  if (arg === '--no-versions') VERSIONS = false;
  if (arg === '--no-images') IMAGES = false;
}

const main = async () => {
  var timeStart = process.hrtime();

  await del(MAPS_DIRECTORY); // Deletes current maps directory if it exists

  let numDownloaded = 0;
  let mapId = STARTING_MAP_ID;
  let IdOutOfBounds = false;
  const versionMap = {}; // Keeps track of duplicate names
  do {
    const mapPromises = [];
    for (let i = 0; i < CHUNK_SIZE; i++) {
      const $ = await getSiteData(buildViewURL(mapId)); // Scrape map page HTML
      let mapName = await getMapName($, mapId);
      if (!mapName) { // Map ID probably invalid, assume there's no more maps to download
        IdOutOfBounds = true;
        break;
      }
      if (versionMap[mapName]) versionMap[mapName]++;
      else versionMap[mapName] = 1;
      if (VERSIONS) mapName = `${mapName}${versionMap[mapName] > 1 ? VERSION_EXTENSION(versionMap[mapName]) : ''}`
      const imageName = await getImageName($);
      await createDirectory(buildDirectoryPath(mapName));
      mapPromises.push(downloadMap(mapId, mapName, imageName).then(() => {
        numDownloaded++;
        printProgress(numDownloaded);
      }).catch((err) => {
        console.error(`\nError downloading map with ID ${err.id}:`)
        console.error(err);
      }));
      mapId++;
    }
    await Promise.all(mapPromises);
    if (IdOutOfBounds) break;
  } while (SHOULD_LOOP);

  timeEnd = process.hrtime(timeStart);
  const totalSeconds = timeEnd[0];
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 60 / 60);

  console.log(`\nDone! Downloaded ${numDownloaded} map${numDownloaded === 1 ? '' : 's'} in ${hours}h ${minutes}m ${seconds}s`);
};

const downloadMap = async (mapId, mapName, imageName) => {
  try {
    const fileDownloads = [
      downloadFile(buildDownloadURL(mapId, 'txt'), buildFilePath(mapName, 'txt')),
      downloadFile(buildDownloadURL(mapId, 'vxl'), buildFilePath(mapName, 'vxl'))
    ];
    if (imageName && IMAGES) fileDownloads.push(downloadImages(imageName, mapName));
    await Promise.all(fileDownloads);
  } catch (err) { // Wrap error with ID
    err.id = mapId;
    throw err;
  }
};

const downloadImages = async (imageName, mapName) => {
  try {
    const fileDownloads = [
      downloadFile(buildImageURL(imageName, 'png'), buildFilePath(mapName, 'png')).catch(() => {
        downloadFile(buildImageURL(imageName, 'png_min'), buildFilePath(mapName + '_min', 'png', mapName));
      }),
      downloadFile(buildImageURL(imageName, 'png_topdown'), buildFilePath(mapName + '_topdown', 'png', mapName))
    ];
    await Promise.all(fileDownloads);
  } catch (err) { // Wrap error with ID
    err.id = mapId;
    throw err;
  }
};

const getSiteData = (uri) => rp({ uri, transform: (body) => cheerio.load(body) });

const getMapName = ($) => {
  const mapName = $('p > span.header').text();
  if (!mapName.length) return null;
  return mapName;
};

const getImageName = ($) => {
  const imageElements = $('#imageslide');
  if (imageElements[0]) {
    const imagePath = imageElements[0].attribs.src;
    return imagePath.substring(imagePath.indexOf('/') + 1);
  }
  return null;
};

const buildFilePath = (fileName, extension, directoryName=fileName) => path.normalize(`./${buildDirectoryPath(directoryName)}/${fileName}.${extension}`);
const buildDirectoryPath = (directoryName) => path.normalize(FOLDERS ? `/${MAPS_DIRECTORY}/${directoryName}` : `/${MAPS_DIRECTORY}`);
const buildImageURL = (imageName, imageType) => `${AOS_DOMAIN}/${imageType}/${imageName}`;
const buildDownloadURL = (id, fileType) => `${AOS_DOWNLOAD_LINK}?id=${id}&${fileType}=1}`;
const buildViewURL = (id) => `${AOS_VIEW_LINK}?id=${id}`;

const createDirectory = (path) => {
  return new Promise((resolve, reject) => {
    fs.mkdir(process.cwd() + path, { recursive: true }, (err) => {
      if (!err || err.code === 'EEXIST') resolve(); // Don't blow up if it already exists
      else reject(err);
    });
  });
};

const downloadFile = ((uri, dir) => {
  return new Promise((resolve, reject) => {
    r(uri).on('response', (response) => {
      if (response.statusCode !== 200) reject(response);
    }).pipe(fs.createWriteStream(dir)).on('finish', resolve).on('error', (error) => reject(error));
  }).catch(() => del(dir)); // Clean up blank file
});

const printProgress = (progress) => {
  readline.cursorTo(process.stdout, 0);
  process.stdout.write(`Progress: ${progress} maps downloaded`);
}

main();