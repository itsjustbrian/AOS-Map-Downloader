# AOS Map Downloader
Bulk download Ace of Spades map files and images from aos.party

# How to Run

```javascript
  npm install
  node download.js
```

Tested on Node 10 on MacOS

# Command Line Options

`--no-folders`\
By default, the downloader creates a folder for each map. With this flag enabled, all files are dumped into one folder,
which can be helpful for uploading to the AOS client.

`--no-versions`\
Maps with the same name will have a version number appended to them by default.\
For example: `Orbix_v2`\
Enabling this flag will cause newer maps with the same name to overwrite the older version.

`--no-images`\
Prevents downloading map images. This can speed up the download significantly.

# Downloading specific map(s)

There's no command line options that support this, but you can change some global variables in the code to accomplish this.
You will also need to get the ID of the map(s) you want. You can find these in the URLs of maps on `aos.party`. \
For example, to download the map with ID 10: \
Change `STARTING_MAP_ID` to 10 \
Change `CHUNK_SIZE` to 1 \
Change `SHOULD_LOOP` to false

`CHUNK_SIZE` determines the number of maps that are downloaded simultaneously before moving to the next chunk.
You can try playing with this to speed up the download.
