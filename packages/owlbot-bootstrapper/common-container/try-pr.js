const {request} = require('gaxios');

async function main() {
  try {
    const resp = await request({
      url: 'https://api.github.com/repos/soficodes/nodejs-kms/pulls',
      method: 'POST',
      headers: {
        Authorization: 'token ghs_GTRz0ZUiQj66ZDhloDl7FGDH2g1rEy0wnok9',
        Accept: 'application/vnd.github.v3+json',
      },
      body: '{"head":"owlbot-bootstrapper-initial-PR-3db25a8280c3","base":"main","title":"thing"}',
    });

    console.log(resp.data);
  } catch (err) {
    console.log(err);
    console.log(err.response.data.errors);
    //console.log(err.config.validateStatus);
  }
}

main();
