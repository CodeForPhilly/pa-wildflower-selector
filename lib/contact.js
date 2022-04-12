const { GoogleSpreadsheet } = require('google-spreadsheet');
const { google } = require('googleapis');

const serviceAccount = require('../service-account.json');
const settings = require('../settings.json');

// Append contact message to google sheets

module.exports = async (data) => {
  const id = settings.contactSheetId;
  const timeRegex = /^(.*?)T(.*?)(\..*)$/;
  const timeFields = (new Date()).toISOString().match(timeRegex);

  data.date = timeFields[1];
  data.time = timeFields[2];

  const doc = new GoogleSpreadsheet(id);
  await doc.useServiceAccountAuth({
    client_email: serviceAccount.client_email,
    private_key: serviceAccount.private_key
  });

  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];
  await sheet.addRow(data);
};

const auth = new docs.auth.GoogleAuth({
  keyFilename: 'PATH_TO_SERVICE_ACCOUNT_KEY.json',
    // Scopes can be specified either as an array or as a single, space-delimited string.
  scopes: ['https://www.googleapis.com/auth/documents']
});
const authClient = await auth.getClient();

var fileMetadata = {
  'name': 'photo.jpg'
};
var media = {
  mimeType: 'image/jpeg',
  body: fs.createReadStream('files/photo.jpg')
};
drive.files.create({
  resource: fileMetadata,
  media: media,
  fields: 'id'
}, function (err, file) {
  if (err) {
    // Handle error
    console.error(err);
  } else {
    console.log('File Id: ', file.id);
  }
});