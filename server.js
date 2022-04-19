const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const request = require("request");
const express = require("express");
const RssFeedEmitter = require("rss-feed-emitter");
const feeder = new RssFeedEmitter({ skipFirstLoad: true }); //
const sdk = require("matrix-js-sdk");
const { exit } = require("process");

if (
  process.env.MATRIX_HOST &&
  process.env.MATRIX_USER &&
  process.env.MATRIX_ROOM &&
  process.env.MATRIX_ACCESSTOKEN &&
  process.env.BASE_URL &&
  process.env.FEEDS
) {
  console.log("All nessesary variables are set! you are good to go!");
} else {
  console.log("NOT all nessesary variables are set! check your ENV!");
  exit();
}

const MATRIX_HOST = process.env.MATRIX_HOST;
const MATRIX_USER = process.env.MATRIX_USER;
const MATRIX_ACCESSTOKEN = process.env.MATRIX_ACCESSTOKEN;
const MATRIX_ROOM = process.env.MATRIX_ROOM;
const BASE_URL = process.env.BASE_URL;
const FEEDS = process.env.FEEDS;
const ARRAY_FEED = FEEDS.split(",");

console.log(MATRIX_HOST);
console.log(MATRIX_USER);
console.log(MATRIX_ACCESSTOKEN);
console.log(MATRIX_ROOM);
console.log(BASE_URL);
console.log(FEEDS);
console.log(ARRAY_FEED);

// const matrixClient = sdk.createClient(MATRIX_HOST);
// matrixClient.login("m.login.password", {
//   password: MATRIX_PASSWORD,
//   user: MATRIX_USER,
// });
const matrixClient = sdk.createClient({
  baseUrl: MATRIX_HOST,
  accessToken: MATRIX_ACCESSTOKEN,
  userId: MATRIX_USER,
});

const listenToMessages = async () => {
  matrixClient.on("Room.timeline", function (event, room, toStartOfTimeline) {
    if (toStartOfTimeline) {
      return; // don't print paginated results
    }
    if (event.getType() !== "m.room.message") {
      return; // only print messages
    }
    if (room.roomId == MATRIX_ROOM) {
      const msg = event.getContent().body;
      if (msg.startsWith("!ig")) {
        const cmd = msg.substring(4);

        if (cmd == "list") {
          sendAllActiveSubs();
        }
      }
    }
  });
};

const startListener = () => {
  matrixClient.startClient();
  matrixClient.once("sync", function (state, prevState, res) {
    console.log(state);
    listenToMessages();
  });
};

startListener();

function sendMessage(body) {
  var content = {
    body: body,
    msgtype: "m.text",
  };
  matrixClient.sendEvent(
    MATRIX_ROOM,
    "m.room.message",
    content,
    "",
    (err, res) => {
      console.log(err);
    }
  );
}

var app = express();
app.use("/images", express.static("images"));

var server = app.listen(5001, () => {
  console.log(`Running server on PORT 5001...`);
});

feeder.add({
  url: ARRAY_FEED,
  refresh: 2000,
});
const base = BASE_URL;

const sendAllActiveSubs = () => {
  let rss = [];
  const arr = feeder.list;
  arr.forEach((el) => {
    rss.push(el.url);
  });
  sendMessage(
    "You are subscribed to following rss feeds: " +
      rss.toString().replaceAll(",", " and ")
  );
};

var download = function (uri, filename, callback) {
  request.head(uri, function (err, res, body) {
    console.log("content-type:", res.headers["content-type"]);
    console.log("content-length:", res.headers["content-length"]);

    request(uri).pipe(fs.createWriteStream(filename)).on("close", callback);
  });
};

async function scrapeData(url) {
  try {
    const id = url.substring(32);
    console.log(id);
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const images = $(".images-gallery img");

    images.each((idx, el) => {
      console.log($(el).attr("src"));
      const imgurl = $(el).attr("src");
      download(BASE_URL + imgurl, "./images/" + id + "-" + idx + ".jpg", () => {
        sendImage(
          "http://localhost:5001/" + "images/" + id + "-" + idx + ".jpg",
          "./images/" + id + "-" + idx + ".jpg"
        );
      });
    });
  } catch (err) {
    console.error(err);
    return;
  }
}

feeder.on("new-item", function (item) {
  console.log(item.link);
  scrapeData(item.link);
});

async function sendImage(url, imagePath) {
  try {
    const imageResponse = await axios.get(url, { responseType: "arraybuffer" });
    const imageType = imageResponse.headers["content-type"];
    console.log(imageType);
    const uploadResponse = await matrixClient.uploadContent(
      imageResponse.data,
      { rawResponse: false, type: imageType, onlyContentUri: false }
    );
    const matrixUrl = uploadResponse.content_uri;
    console.log(matrixUrl);
    const sendImageResponse = await matrixClient.sendImageMessage(
      MATRIX_ROOM,
      matrixUrl,
      {},
      "",
      () => {
        deleteImage(imagePath);
      }
    );
    console.log(sendImageResponse);
  } catch (error) {
    console.log(error);
  }
}

const deleteImage = (imagePath) => {
  fs.unlink(imagePath, (err) => {
    if (err) {
      console.error(err);
      return;
    }
  });
};

// const listenToMessages = async () => {
//   matrixClient.on("Room.timeline", function (event, room, toStartOfTimeline) {
//     if (event.getType() !== "m.room.message") {
//       return; // only use messages
//     }
//     console.log(event.event.content.body);
//   });
// };

// listenToMessages();
