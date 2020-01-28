
const { App } = require("@octokit/app");
const Octokit = require("@octokit/rest");
const dotenv = require("dotenv");
const path = require('path');
const fs = require('fs');


// const jsonData = path.resolve(__dirname, '../../auto-label/src/downloadedfile.txt');
// const colorsData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../auto-label/src/colors.json'), 'utf8'));

const octokit = new Octokit({
    auth() {
        return `token bc59d6bc25b9ecaec69cfcfc414c5c5924a09fa1`;    
    }
   });

// async function createLabel(owner, repo, name, color) {
//         const data = await octokit.issues.createLabel({
//             owner: owner,
//             repo: repo,
//             name: name,
//             color: color
//         })
//         console.log(await data);
//         console.log('a');
//         return data;
//     }
    
// async function getLabelsfromRepo(owner, repo) {
//     const data = await octokit.issues.listLabelsForRepo({
//         owner,
//         repo
//       });
// }
  
  async function addLabels() {
        const data = await octokit.issues.addLabels({
            owner: 'sofisl',
            repo: 'mergeOnGreenTest',
            issue_number: 51, 
            labels: ['otherName']
        })
        console.log('d');
        console.log(await data);
        return data;
    }


    addLabels();
    // createLabel('sofisl', 'mergeOnGreenTest', 'otherName', '8DB600');
    //setTimeout(function() { addLabels('sofisl', 'mergeOnGreenTest', 51, {labels: 'myName'}) }, 7000);
//getLabels();
//createIssue();

// async function callStorage() {


//     const {Storage} = require('@google-cloud/storage');
//     const storage = new Storage();
//     const bucketName = 'devrel-dev-settings';
//     const srcFilename = 'public_repos.json';
//     const destFilename = path.resolve("src/downloadedfile.txt")
  
//     const options = {
//     // The path to which the file should be downloaded, e.g. "./file.txt"
//     destination: destFilename,
//     };
  
//     // Downloads the file
//     await storage
//     .bucket(bucketName)
//     .file(srcFilename)
//     .download(options);
  
//     console.log(
//     `gs://${bucketName}/${srcFilename} downloaded to ${destFilename}.`
//     );
//   }
// async function name() {
//     const storageFile = await callStorage();
//     console.log(storageFile);
// }

// console.log(colorsData);
// console.log(colorsData[5].color);
// //const info = callStorage();
// //console.log(info);

// // const storage = name();

// // console.log(storageFile);


// // const jsonArray = JSON.parse(fs.readFileSync(jsonData, 'utf8')).repos;
// // jsonArray.forEach(element => {
// //     console.log(element);
// // })