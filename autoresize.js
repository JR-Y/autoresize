const fs = require('fs');
const path = require('path');
let chokidar = require('chokidar');
let jimp = require("jimp");
require('dotenv').config()

let log = console.log.bind(console);

let workList = [];
let workListInProgress = [];

let dirToWatch = process.env.DIR_TO_WATCH;
log(dirToWatch);

let dirToWrite = process.env.DIR_TO_WRITE;
log(dirToWrite);


let filesToConvert = [
    ".JPG",
    ".PNG"
];

function readFileStatsSync(srcPath) {
    try {
        return fs.statSync(srcPath)
    } catch (error) {
        return undefined;
    }
};

function checkIfResize(pathToFile) {
    try {
        let smallStats = readFileStatsSync(getSmallFileName(pathToFile));
        let newStats = readFileStatsSync(pathToFile);

        if (!smallStats) {
            workList.push(pathToFile)
        } else if (newStats && smallStats && newStats.mtime.getTime() > smallStats.mtime.getTime()) {
            workList.push(pathToFile)
        }

    } catch (error) {
        log("Autocrop check if convert function: " + error);
    }
}

function getSmallFileName(pathToFile) {
    try {
        let ext = path.extname(pathToFile);
        let fileName = path.basename(pathToFile, ext);
        return path.join(dirToWrite, fileName + "-small" + ext)
    } catch (error) {
        log("getSmallFileName " + error);
        return
    }
}


function resize(pathToFile) {
    try {
        let newFullPath = getSmallFileName(pathToFile);
        jimp.read(pathToFile).then(function (image) {
            if (image.hasAlpha()) {
                image.background(0xFFFFFFFF)
                    .quality(60)
                    .resize(600, jimp.AUTO)
                    .write(newFullPath); // save
            } else {
                image.quality(60)
                    .resize(600, jimp.AUTO)
                    .write(newFullPath); // save
            }
            workList = workList.filter(val => val !== pathToFile);
            workListInProgress = workListInProgress.filter(val => val !== pathToFile);
            log("Resize called on dir: " + pathToFile + "\nResized to dir: " + newFullPath + "\n");
        }).catch(function (err) {
            console.error(err);
            workList = workList.filter(val => val !== pathToFile);
            workListInProgress = workListInProgress.filter(val => val !== pathToFile);
        });

    } catch (error) {
        log("Resize file error: " + error + ", on file: " + pathToFile);
        workList = workList.filter(val => val !== pathToFile);
        workListInProgress = workListInProgress.filter(val => val !== pathToFile);
    }

};

log("Watch started");
let resizeWatcher = chokidar.watch(dirToWatch, {
    ignored: /[\/\\]\./, persistent: true,
    awaitWriteFinish: true,
    ignored: '*.db',
    usePolling: true
});

function convertTimerTask() {
    let convertFive = workList.slice(0, 5);
    convertFive.forEach(pathToFile => {
        if (workListInProgress.length < 5 && !workListInProgress.includes(pathToFile)) {
            resize(pathToFile);
            workListInProgress.push(pathToFile)
        }
    })
}

setInterval(convertTimerTask, 20000);

if (dirToWatch && dirToWrite) {
    resizeWatcher
        .on('error', error => log(`Watcher error: ${error}`))
        .on('add', function (pathToFile) {
            let ext = path.extname(pathToFile);
            if (filesToConvert.includes(ext.toUpperCase())) {
                checkIfResize(pathToFile);
            }
        })
        .on('change', function (pathToFile) {
            let ext = path.extname(pathToFile);
            if (filesToConvert.includes(ext.toUpperCase())) {
                checkIfResize(pathToFile);
            }
        });
} else {
    console.error("No environment variable provided, DIR_TO_WRITE & DIR_TO_WATCH")
}



